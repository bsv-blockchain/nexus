import { AsyncLocalStorage } from 'node:async_hooks'
import { DatabaseSync } from 'node:sqlite'
import type { SqlBindValue, SqlDriver, SqlRunResult } from '../SqlDriver'

/**
 * `SqlDriver` over Node's built-in `node:sqlite`, for the Electron main
 * process. No native module, no `@electron/rebuild` — Electron 43 ships Node
 * 24, and `DatabaseSync` works there as-is.
 *
 * Everything in this file exists to reconcile two engines that agree on SQL and
 * disagree on almost everything around it. The differences that matter, all
 * probed rather than assumed:
 *
 *  - `node:sqlite` is synchronous. Every method here returns an already-resolved
 *    promise; that is honest rather than lazy, because the work really is done
 *    by the time the promise exists.
 *  - It enforces foreign keys by default; expo-sqlite does not, and this app
 *    depends on them *not* being enforced (see the comment in
 *    `wallet-core/src/utils/offline/payerHold.ts` — `offline_actions.userId`
 *    references a row that may not exist yet). Hence the constructor option.
 *  - Its run result spells the insert id `lastInsertRowid`; expo spells it
 *    `lastInsertRowId`. Renaming is not cosmetic — `sqlInsert` returns that
 *    field straight into every entity's primary key.
 *  - It returns rows with a null prototype and `undefined` (not `null`) for a
 *    missing row.
 *  - It binds anonymous parameters variadically, so the array is spread.
 *
 * ── TRANSACTIONS: ONE CONNECTION, SERIALISED IN JS ──
 *
 * expo gets isolation by opening a NEW CONNECTION per transaction and letting
 * SQLite's file locking sort it out. That model was tried here and does not
 * survive contact with a synchronous driver: `node:sqlite` runs on the event
 * loop, so `busy_timeout` blocks the very thread that would run the lock
 * holder's remaining JS and release it. Every contention becomes a guaranteed
 * deadlock rather than a wait — measured, not theorised: both a nested
 * transaction and two independent top-level transactions failed with
 * SQLITE_BUSY after the full timeout.
 *
 * So serialisation has to happen in JS, which means one connection, a queue for
 * top-level transactions, and SAVEPOINT for genuine nesting (which is not an
 * edge case: `commitNewTxToStorage` opens a transaction and
 * `EntityProvenTxReq.insertOrMerge` opens another inside it, on every
 * createAction).
 *
 * The hard part is telling those two apart, and an earlier version got it
 * wrong by asking WHICH DRIVER OBJECT the call arrived on.
 * `StorageExpoSQLite.transaction()` swaps `this.db` for the scope's driver
 * GLOBALLY, so a concurrent caller reaching the storage object during that
 * window picked up the scoped driver and was misclassified as nested. Three
 * reproductions showed what that costs:
 *
 *   1. The concurrent caller opened a SAVEPOINT inside a stranger's
 *      transaction; its ROLLBACK TO then discarded work the outer transaction
 *      had already done, while the outer still reported success. Silent loss,
 *      on the money path.
 *   2. With the other interleaving, the outer COMMIT landed first and the inner
 *      RELEASE threw `no such savepoint` — the caller was told its transaction
 *      FAILED while its rows were already durably committed.
 *   3. `StorageExpoSQLite.transaction`'s save/restore of `this.db` assumes LIFO
 *      nesting, so one interleave left `this.db` permanently pointing at a
 *      committed scope's driver, poisoning every later transaction.
 *
 * Nesting is therefore decided by ASYNC CONTEXT, not by object identity: a call
 * made within the dynamic extent of a transaction's callback is nested, and
 * anything else is concurrent and gets queued. `AsyncLocalStorage` tracks that
 * across awaits, which is exactly the question being asked, and it is immune to
 * whichever driver reference the caller happens to be holding.
 *
 * ── KNOWN DIVERGENCE FROM MOBILE, WHICH CANNOT BE CLOSED HERE ──
 *
 * A statement issued on the ROOT driver while a transaction is open runs on the
 * one connection, so it is inside that transaction and dies with its rollback.
 * On mobile expo routes it to a separate connection and it survives.
 *
 * This is not an oversight and it is not fixable within this design. Giving such
 * writes their own connection reintroduces exactly the deadlock described above:
 * the second connection blocks on the open transaction's write lock, and because
 * `node:sqlite` is synchronous, blocking the thread stops the transaction from
 * ever reaching its COMMIT.
 *
 * Who this affects, concretely — both capture `storage.sqliteDb` once and then
 * write through it across awaits that may open transactions:
 *   `methods/processOfflineActions.ts`  (the offline queue)
 *   `wallet-core/src/utils/offline/payerHold.ts`  (holding a sent payment)
 * On desktop, a createAction rollback can therefore also erase offline-queue
 * bookkeeping that mobile would keep. The queue is designed to be re-derivable
 * and the payment itself is not lost — but the divergence is real, and anyone
 * adding a root-driver write near a transaction needs to know it exists.
 */

/**
 * How long a transaction waits for another transaction's write lock before
 * giving up. Long enough to cover a slow scope on a busy disk; short enough
 * that a genuine deadlock surfaces as an error someone can read, rather than an
 * app that has simply stopped.
 */
const BUSY_TIMEOUT_MS = 10_000

/**
 * Anything the storage layer can legitimately bind, in the form `node:sqlite`
 * accepts. Booleans are the only conversion, and only as a backstop — the three
 * converter layers in `StorageExpoSQLite` already map them to 0/1. Everything
 * else is passed through so that a genuinely wrong value (a `Date`, a plain
 * number array, `undefined`) fails loudly at the bind instead of being guessed
 * at, which is the behaviour a funded database wants.
 */
function toNodeBind(value: SqlBindValue): string | number | null | Uint8Array {
  return typeof value === 'boolean' ? (value ? 1 : 0) : value
}

function toNodeBinds(params?: SqlBindValue[]): (string | number | null | Uint8Array)[] {
  return params === undefined ? [] : params.map(toNodeBind)
}

/** Settings every connection to this database needs, root or transaction. */
function configure(db: DatabaseSync): DatabaseSync {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`)
  // WAL so a reader is never blocked by the writer. Irrelevant while one process
  // holds the only connection — which is the situation this driver is designed
  // for — but the moment anything else opens the file (a forked Monitor, a
  // debugging session, a backup) the default rollback journal makes every reader
  // wait for the writer, and with a synchronous driver that wait is a stall.
  // Cheap now; a mysterious hang later.
  db.exec('PRAGMA journal_mode = WAL')
  return db
}

/**
 * The transaction scope a call is running inside, if any.
 *
 * Set for the dynamic extent of a transaction callback, so nesting is answered
 * by "am I within a transaction right now?" rather than by which object the
 * caller was handed. Survives awaits, which is what makes it usable here.
 */
const activeScope = new AsyncLocalStorage<TransactionScope>()

interface TransactionScope {
  /** The connection the open transaction belongs to. */
  conn: NodeConnection
}

/**
 * Connection-wide state: the handle, the queue that serialises top-level
 * transactions, and the savepoint counter.
 */
class NodeConnection {
  private tail: Promise<unknown> = Promise.resolve()
  private savepointSeq = 0

  constructor(readonly db: DatabaseSync) {}

  /**
   * Run `job` after every previously enqueued job has settled, successfully or
   * not. Only top-level transactions come through here — a failed transaction
   * must not wedge the queue, and nothing that could run *inside* a transaction
   * may ever wait on it, or the queue deadlocks against itself.
   */
  enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.tail.then(job, job)
    this.tail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  nextSavepointName(): string {
    // Monotonic rather than depth-derived: two sibling nested scopes at the same
    // depth must not release each other's savepoint.
    this.savepointSeq += 1
    return `nexus_sp_${this.savepointSeq}`
  }
}

class NodeSqlDriver implements SqlDriver {
  constructor(private readonly conn: NodeConnection) {}

  async execAsync(sql: string): Promise<void> {
    // exec() runs every statement in the string, which is what createTables
    // relies on to send a CREATE TABLE and its indexes together.
    this.conn.db.exec(sql)
  }

  async runAsync(sql: string, params?: SqlBindValue[]): Promise<SqlRunResult> {
    const result = this.conn.db.prepare(sql).run(...toNodeBinds(params))
    // Number() rather than a cast: both fields are typed `number | bigint`
    // because `readBigInts` can promote them, and `sqlInsert`'s callers expect a
    // plain number for a primary key.
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }
  }

  async getAllAsync<T = unknown>(sql: string, params?: SqlBindValue[]): Promise<T[]> {
    const rows = this.conn.db.prepare(sql).all(...toNodeBinds(params))
    // Spread away the null prototype. These rows travel into wallet-toolbox
    // entity constructors, and a row without Object.prototype is a trap nobody
    // downstream is written to expect.
    return rows.map(row => ({ ...row }) as T)
  }

  async getFirstAsync<T = unknown>(sql: string, params?: SqlBindValue[]): Promise<T | null> {
    const row = this.conn.db.prepare(sql).get(...toNodeBinds(params))
    // expo returns null for "no row" and every caller in this package tests for
    // that; node returns undefined.
    return row === undefined ? null : ({ ...row } as T)
  }

  /**
   * Nested if and only if we are already inside a transaction ON THIS
   * CONNECTION. The scope comparison matters: a driver for a different database
   * must not be fooled into a savepoint by an unrelated transaction running up
   * the stack.
   */
  async withExclusiveTransactionAsync(fn: (tx: SqlDriver) => Promise<void>): Promise<void> {
    const scope = activeScope.getStore()
    if (scope && scope.conn === this.conn) return await this.runSavepoint(fn)
    return await this.conn.enqueue(() => this.runTransaction(fn))
  }

  /**
   * The outermost transaction: queued so two independent callers cannot
   * interleave on the one connection, then BEGIN IMMEDIATE / COMMIT with
   * ROLLBACK on any throw.
   *
   * IMMEDIATE rather than expo's bare deferred BEGIN because a deferred
   * transaction takes its write lock at the first write; taking it up front
   * makes the exclusivity this method promises true from the first statement.
   */
  private async runTransaction(fn: (tx: SqlDriver) => Promise<void>): Promise<void> {
    const db = this.conn.db
    db.exec('BEGIN IMMEDIATE')
    try {
      await activeScope.run({ conn: this.conn }, () => fn(new NodeSqlDriver(this.conn)))
      db.exec('COMMIT')
    } catch (err) {
      try {
        db.exec('ROLLBACK')
      } catch {
        // A failed COMMIT has usually already unwound the transaction, and
        // ROLLBACK with nothing open throws. The caller's error explains what
        // happened; this one would only bury it.
      }
      throw err
    }
  }

  /**
   * A transaction opened from inside another on the same connection.
   *
   * SAVEPOINT is both the only workable answer and the more correct one: a
   * second BEGIN IMMEDIATE throws "cannot start a transaction within a
   * transaction", and routing it through the queue would deadlock — the queue
   * would be waiting on the transaction that is waiting on the queue. The inner
   * scope rolls back on its own failure and commits with the outer one.
   *
   * Mobile differs: expo hands the nested scope a third connection, so its work
   * commits independently. That difference is deliberate, confined to this
   * driver, and cannot be closed without the deadlock described in the header.
   */
  private async runSavepoint(fn: (tx: SqlDriver) => Promise<void>): Promise<void> {
    const db = this.conn.db
    const name = this.conn.nextSavepointName()
    db.exec(`SAVEPOINT ${name}`)
    try {
      await activeScope.run({ conn: this.conn }, () => fn(new NodeSqlDriver(this.conn)))
      db.exec(`RELEASE ${name}`)
    } catch (err) {
      try {
        // ROLLBACK TO leaves the savepoint on the stack; RELEASE pops it. Both,
        // or a later sibling savepoint unwinds further than it should.
        db.exec(`ROLLBACK TO ${name}`)
        db.exec(`RELEASE ${name}`)
      } catch {
        // The outer transaction is failing anyway and will take this with it.
      }
      throw err
    }
  }

  async closeAsync(): Promise<void> {
    this.conn.db.close()
  }
}

/**
 * Open a database file and return its root driver.
 *
 * Takes a full filesystem path, not a bare name: expo resolves a name against
 * its own database directory and Node has no such notion, so the shell supplies
 * the directory. An Electron host wraps this as
 * `name => openNodeDriver(join(app.getPath('userData'), name))` to satisfy
 * `OpenSqlDriver`.
 *
 * `enableForeignKeyConstraints: false` is not a preference. `node:sqlite`
 * defaults it on, expo leaves SQLite's own default off, and this schema is full
 * of foreign keys that shipped code writes out of order. Turning them on here
 * would reject writes that mobile accepts — and would reject them against a
 * database that mobile wrote.
 *
 * WAL matters more here than on mobile: transactions get their own connections
 * (see the class header), so readers and the writer are genuinely concurrent,
 * and the default rollback journal would make them block each other.
 */
export async function openNodeDriver(databaseFilePath: string): Promise<SqlDriver> {
  const db = configure(new DatabaseSync(databaseFilePath, { enableForeignKeyConstraints: false }))
  return new NodeSqlDriver(new NodeConnection(db))
}

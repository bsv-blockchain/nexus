/**
 * Proof that the `node:sqlite` driver actually drives this package's storage
 * layer — the real schema, the real StorageExpoSQLite, on a real file — with no
 * device, no simulator and no test framework.
 *
 * Run it with `npm test` from the repo root, or directly:
 *
 *   node --experimental-transform-types --test packages/wallet-storage/test/nodeDriver.test.mjs
 *
 * WHY THE LOADER SHIM BELOW EXISTS
 *
 * `StorageExpoSQLite.ts` cannot be imported by Node as it stands, for two
 * reasons that have nothing to do with SQL:
 *
 *   1. Its relative imports are extensionless (`./schema/createTables`). That is
 *      Metro/bundler resolution, which Node's ESM loader does not do.
 *   2. It reaches `@nexus/wallet-core/src/utils/net/online`, which statically
 *      imports `@react-native-community/netinfo` — a package that does not even
 *      *parse* under Node (untranspiled Flow).
 *
 * Both are known, tracked gaps in the desktop port; neither is something this
 * test can fix, and neither is what this test is about. So the shim does exactly
 * two things: it resolves extensionless specifiers the way Metro would, and it
 * substitutes a module for `react-native`/netinfo.
 *
 * That substitute THROWS on every access. It is a load-bearing choice: it means
 * the tests below cannot silently pass because a fake connectivity check said
 * something convenient. If any assertion here ever depended on netinfo, the test
 * would fail loudly rather than lie. Nothing on the migrate/insert/transaction
 * path touches it — `getOnline` is only called from the offline-hold path.
 *
 * `--experimental-transform-types` is required because `nodeDriver.ts` uses
 * TypeScript parameter properties (`constructor(private readonly conn: ...)`),
 * which Node's default strip-only mode rejects.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A module that is a tripwire, not a mock: any real use of it fails the test.
// encodeURIComponent because a data: URL is a single line — raw newlines in the
// source get collapsed and the module stops parsing.
const TRIPWIRE =
  'data:text/javascript,' +
  encodeURIComponent(`
    const fail = p => { throw new Error('test reached react-native/netinfo: ' + String(p)) }
    const t = new Proxy(function () {}, { get: (_, p) => fail(p), apply: () => fail('call') })
    export default t
    export const Platform = t
  `)

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@react-native-community/netinfo' || specifier === 'react-native') {
      return { url: TRIPWIRE, shortCircuit: true }
    }
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      // Extensionless specifier — what Metro resolves for the mobile build and
      // what Node's ESM loader refuses to. Try the extensions a bundler would.
      if (/\.[cm]?[jt]sx?$/.test(specifier)) throw err
      for (const ext of ['.ts', '.tsx', '.js', '/index.ts']) {
        try {
          return nextResolve(specifier + ext, context)
        } catch {
          /* keep trying; the original error is the one worth reporting */
        }
      }
      throw err
    }
  }
})

// Dynamic, because the hooks above must be registered before anything resolves.
const SRC = new URL('../src/', import.meta.url).href
const { openNodeDriver } = await import(`${SRC}drivers/nodeDriver.ts`)
const { createTables, ensureOfflineActionsColumns } = await import(`${SRC}schema/createTables.ts`)
const { StorageExpoSQLite } = await import(`${SRC}StorageExpoSQLite.ts`)
const { StorageProvider } = await import('@bsv/wallet-toolbox-mobile')

/** Every table `createTables` is expected to have produced. */
const EXPECTED_TABLES = [
  'certificate_fields',
  'certificates',
  'commissions',
  'key_value_store',
  'monitor_events',
  'offline_actions',
  'output_baskets',
  'output_tags',
  'output_tags_map',
  'outputs',
  'proven_tx_reqs',
  'proven_txs',
  'settings',
  'sync_states',
  'transactions',
  'tx_labels',
  'tx_labels_map',
  'users'
]

const IDENTITY_KEY = '02c1934b0000000000000000000000000000000000000000000000000000907e70'
const STORAGE_IDENTITY_KEY = '03aa00000000000000000000000000000000000000000000000000000000000001'

let dir

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nexus-nodedriver-'))
})

after(async () => {
  await rm(dir, { recursive: true, force: true })
})

/** A migrated StorageExpoSQLite on its own file, wired to the node driver. */
async function openStorage(name) {
  const storage = new StorageExpoSQLite({
    ...StorageProvider.createStorageBaseOptions('main'),
    chain: 'main',
    feeModel: { model: 'sat/kb', value: 100 },
    identityKey: IDENTITY_KEY,
    databaseName: `${name}.db`,
    // Exactly the shape an Electron host supplies: the driver takes a path, the
    // storage layer only knows a name, and the host owns the directory.
    openDriver: dbName => openNodeDriver(join(dir, dbName))
  })
  await storage.migrate('nexus-test-storage', STORAGE_IDENTITY_KEY)
  return storage
}

/** A bare driver with the real schema on it, for driver-level assertions. */
async function openDriver(name) {
  const db = await openNodeDriver(join(dir, `${name}.db`))
  await createTables(db)
  await ensureOfflineActionsColumns(db)
  return db
}

const now = () => new Date().toISOString()

// ---------------------------------------------------------------------------
// 1 + 2. Open a temp database and run the real migrations against it.
// ---------------------------------------------------------------------------

test('StorageExpoSQLite.migrate() builds the real schema over the node driver', async () => {
  const storage = await openStorage('migrate')
  try {
    const db = storage.sqliteDb
    assert.ok(db, 'migrate() should have opened a driver')

    // One argument, no params — the call shape createTables and WalletContext
    // both use, and the reason `params` is optional on SqlDriver.
    const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    const names = tables.map(t => t.name).filter(n => !n.startsWith('sqlite_'))
    assert.deepEqual(names, EXPECTED_TABLES)

    // The migration inside createTables that a fresh database must still satisfy.
    const reqCols = await db.getAllAsync('PRAGMA table_info(proven_tx_reqs)')
    const reqNames = new Set(reqCols.map(c => c.name))
    assert.ok(reqNames.has('wasBroadcast'))
    assert.ok(reqNames.has('rebroadcastAttempts'))
    assert.ok((await db.getAllAsync('PRAGMA table_info(offline_actions)')).some(c => c.name === 'framePayload'))

    // migrate() writes the settings singleton and reads it back through
    // readSettings(), so a non-null _settings is proof the round-trip worked.
    const settings = await storage.readSettings()
    assert.equal(settings.storageIdentityKey, STORAGE_IDENTITY_KEY)
    assert.equal(settings.storageName, 'nexus-test-storage')
    assert.equal(settings.chain, 'main')
    assert.equal(settings.dbtype, 'SQLite')

    // Not a detail: node:sqlite enables foreign keys by default and expo does
    // not. The app writes offline_actions rows referencing users that may not
    // exist yet, so enforcement being off is what mobile behaviour depends on.
    const fk = await db.getFirstAsync('PRAGMA foreign_keys')
    assert.equal(fk.foreign_keys, 0, 'foreign key enforcement must be off, as on expo')
  } finally {
    await storage.destroy()
  }
})

test('migrate() is idempotent and preserves rows', async () => {
  const storage = await openStorage('remigrate')
  await storage.sqliteDb.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?, ?, ?)', [
    now(),
    now(),
    IDENTITY_KEY
  ])
  await storage.destroy()

  const again = await openStorage('remigrate')
  try {
    const rows = await again.sqliteDb.getAllAsync('SELECT identityKey FROM users')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].identityKey, IDENTITY_KEY)
    // Still one settings row, not two.
    const count = await again.sqliteDb.getFirstAsync('SELECT COUNT(*) AS c FROM settings')
    assert.equal(count.c, 1)
  } finally {
    await again.destroy()
  }
})

// ---------------------------------------------------------------------------
// 3. Insert and read back through runAsync / getAllAsync / getFirstAsync.
// ---------------------------------------------------------------------------

test('runAsync / getAllAsync / getFirstAsync round-trip', async () => {
  const db = await openDriver('roundtrip')
  try {
    const t = now()
    await db.runAsync('INSERT INTO users (created_at, updated_at, identityKey, activeStorage) VALUES (?, ?, ?, ?)', [
      t,
      t,
      IDENTITY_KEY,
      'local'
    ])
    await db.runAsync('INSERT INTO users (created_at, updated_at, identityKey, activeStorage) VALUES (?, ?, ?, ?)', [
      t,
      t,
      'deadbeef',
      null
    ])

    const all = await db.getAllAsync('SELECT * FROM users ORDER BY userId')
    assert.equal(all.length, 2)
    assert.equal(all[0].identityKey, IDENTITY_KEY)
    assert.equal(all[1].activeStorage, null)

    // node:sqlite hands back null-prototype rows; the driver spreads them so
    // that toolbox entity constructors get an ordinary object.
    assert.equal(Object.getPrototypeOf(all[0]), Object.prototype)

    const one = await db.getFirstAsync('SELECT * FROM users WHERE identityKey = ?', [IDENTITY_KEY])
    assert.equal(one.activeStorage, 'local')

    // expo returns null for a miss, node returns undefined; every caller in this
    // package tests for null.
    const miss = await db.getFirstAsync('SELECT * FROM users WHERE identityKey = ?', ['nope'])
    assert.equal(miss, null)

    // BLOB in, Uint8Array out — what validateEntity's `instanceof Uint8Array`
    // branch is written against.
    await db.runAsync(
      `INSERT INTO proven_txs (created_at, updated_at, txid, height, "index", merklePath, rawTx, blockHash, merkleRoot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t, t, 'abc123', 800000, 3, new Uint8Array([1, 2, 3]), new Uint8Array([4, 5]), 'hash', 'root']
    )
    const proven = await db.getFirstAsync('SELECT * FROM proven_txs WHERE txid = ?', ['abc123'])
    assert.ok(proven.merklePath instanceof Uint8Array)
    assert.deepEqual(Array.from(proven.merklePath), [1, 2, 3])

    // Booleans reach the driver only by accident, but must not be the reason a
    // write is lost.
    await db.runAsync('INSERT INTO output_tags (created_at, updated_at, userId, tag, isDeleted) VALUES (?,?,?,?,?)', [
      t,
      t,
      1,
      'flagged',
      true
    ])
    const tag = await db.getFirstAsync('SELECT isDeleted FROM output_tags WHERE tag = ?', ['flagged'])
    assert.equal(tag.isDeleted, 1)
  } finally {
    await db.closeAsync()
  }
})

// ---------------------------------------------------------------------------
// 5. The run-result shape the storage layer actually consumes.
// ---------------------------------------------------------------------------

test('runAsync returns lastInsertRowId (expo spelling), not lastInsertRowid', async () => {
  const db = await openDriver('runresult')
  try {
    const t = now()
    const result = await db.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?, ?, ?)', [
      t,
      t,
      IDENTITY_KEY
    ])

    // The whole point. `sqlInsert` returns `result.lastInsertRowId` straight
    // into every entity's primary key; node:sqlite spells its own field
    // `lastInsertRowid`, so an adapter that spread the native result would
    // return undefined ids that insert cleanly and only fail much later.
    assert.deepEqual(Object.keys(result).sort(), ['changes', 'lastInsertRowId'])
    assert.equal('lastInsertRowid' in result, false, 'the node spelling must not leak through')
    assert.equal(typeof result.lastInsertRowId, 'number')
    assert.ok(Number.isInteger(result.lastInsertRowId) && result.lastInsertRowId > 0)
    assert.equal(result.changes, 1)

    const second = await db.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?, ?, ?)', [
      t,
      t,
      'second'
    ])
    assert.equal(second.lastInsertRowId, result.lastInsertRowId + 1)

    // changes is a count, not a rowid — sqlUpdate returns it verbatim.
    const updated = await db.runAsync('UPDATE users SET activeStorage = ?', ['local'])
    assert.equal(updated.changes, 2)
  } finally {
    await db.closeAsync()
  }
})

test('sqlInsert yields a usable primary key through the real storage layer', async () => {
  const storage = await openStorage('insertuser')
  try {
    const user = { userId: 0, created_at: new Date(), updated_at: new Date(), identityKey: IDENTITY_KEY }
    const id = await storage.insertUser(user)

    assert.ok(Number.isInteger(id) && id > 0, `insertUser returned ${id}`)
    assert.equal(user.userId, id, 'the entity should carry the assigned primary key')

    const found = await storage.findUsers({ partial: { userId: id } })
    assert.equal(found.length, 1)
    assert.equal(found[0].identityKey, IDENTITY_KEY)
    assert.equal(found[0].userId, id)
  } finally {
    await storage.destroy()
  }
})

// ---------------------------------------------------------------------------
// 4. Transactions: commit, and rollback on throw.
// ---------------------------------------------------------------------------

test('withExclusiveTransactionAsync commits', async () => {
  const db = await openDriver('trx-commit')
  try {
    const t = now()
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?,?,?)', [t, t, 'a'])
      await tx.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?,?,?)', [t, t, 'b'])
    })
    const rows = await db.getAllAsync('SELECT identityKey FROM users ORDER BY userId')
    assert.deepEqual(
      rows.map(r => r.identityKey),
      ['a', 'b']
    )
  } finally {
    await db.closeAsync()
  }
})

test('withExclusiveTransactionAsync rolls back on throw, leaving no rows, and rethrows the original error', async () => {
  const db = await openDriver('trx-rollback')
  try {
    const t = now()
    const boom = new Error('scope failed')

    await assert.rejects(
      db.withExclusiveTransactionAsync(async tx => {
        await tx.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?,?,?)', [t, t, 'doomed'])
        // The row exists inside the transaction right up until the throw.
        const inside = await tx.getAllAsync('SELECT identityKey FROM users')
        assert.equal(inside.length, 1)
        throw boom
      }),
      // The caller's error, not a rollback error dressed up as one.
      err => err === boom
    )

    const rows = await db.getAllAsync('SELECT identityKey FROM users')
    assert.deepEqual(rows, [], 'the failed transaction must leave nothing behind')

    // A failed transaction must not wedge the queue for everyone after it.
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?,?,?)', [t, t, 'after'])
    })
    assert.equal((await db.getAllAsync('SELECT identityKey FROM users')).length, 1)
  } finally {
    await db.closeAsync()
  }
})

test('StorageExpoSQLite.transaction() rolls back through the real class', async () => {
  const storage = await openStorage('storage-trx')
  try {
    const boom = new Error('storage scope failed')
    await assert.rejects(
      storage.transaction(async () => {
        await storage.insertUser({ userId: 0, created_at: new Date(), updated_at: new Date(), identityKey: 'ghost' })
        throw boom
      }),
      err => err === boom
    )
    assert.deepEqual(await storage.findUsers({ partial: { identityKey: 'ghost' } }), [])

    // And the storage object is usable afterwards — this.db must have been
    // restored from the transaction-scoped driver even on the throwing path.
    const id = await storage.insertUser({
      userId: 0,
      created_at: new Date(),
      updated_at: new Date(),
      identityKey: 'survivor'
    })
    assert.ok(id > 0)
  } finally {
    await storage.destroy()
  }
})

// An explicit timeout, because this test's failure mode is a hang rather than a
// wrong answer: with a plain FIFO mutex the queue waits on the transaction that
// is waiting on the queue, and the run never ends. Verified by mutation — the
// savepoint branch removed, this times out instead of passing.
test('a nested transaction becomes a savepoint instead of deadlocking', { timeout: 10_000 }, async () => {
  // The shape `commitNewTxToStorage` produces on every createAction:
  // EntityProvenTxReq.insertOrMerge opens a second transaction from inside the
  // first and passes no trx token. A plain FIFO mutex hangs here forever.
  const db = await openDriver('trx-nested')
  try {
    const t = now()
    await db.withExclusiveTransactionAsync(async outer => {
      await outer.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?,?,?)', [t, t, 'outer'])
      await outer.withExclusiveTransactionAsync(async inner => {
        await inner.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?,?,?)', [t, t, 'inner'])
      })
    })
    const rows = await db.getAllAsync('SELECT identityKey FROM users ORDER BY userId')
    assert.deepEqual(
      rows.map(r => r.identityKey),
      ['outer', 'inner']
    )

    // An inner scope that fails unwinds only itself; the outer work survives.
    await db.withExclusiveTransactionAsync(async outer => {
      await outer.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?,?,?)', [t, t, 'kept'])
      await assert.rejects(
        outer.withExclusiveTransactionAsync(async inner => {
          await inner.runAsync('INSERT INTO users (created_at, updated_at, identityKey) VALUES (?,?,?)', [t, t, 'lost'])
          throw new Error('inner failed')
        })
      )
    })
    const after = (await db.getAllAsync('SELECT identityKey FROM users')).map(r => r.identityKey)
    assert.ok(after.includes('kept'))
    assert.ok(!after.includes('lost'))
  } finally {
    await db.closeAsync()
  }
})

test('two independent top-level transactions serialise rather than interleave', { timeout: 10_000 }, async () => {
  const db = await openDriver('trx-serialise')
  try {
    const order = []
    const a = db.withExclusiveTransactionAsync(async () => {
      order.push('a-start')
      await new Promise(r => setTimeout(r, 20))
      order.push('a-end')
    })
    const b = db.withExclusiveTransactionAsync(async () => {
      order.push('b-start')
      order.push('b-end')
    })
    await Promise.all([a, b])
    assert.deepEqual(order, ['a-start', 'a-end', 'b-start', 'b-end'])
  } finally {
    await db.closeAsync()
  }
})

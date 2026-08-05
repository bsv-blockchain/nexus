/**
 * The entire database surface this package needs, as an interface rather than a
 * concrete `expo-sqlite` handle.
 *
 * Six methods, counted across the package: `execAsync` 21, `getAllAsync` 9,
 * `runAsync` 7, `getFirstAsync` 4, `withExclusiveTransactionAsync` 1,
 * `closeAsync` 1. Opening is deliberately *not* on the interface — a database
 * name means different things to different hosts (Expo resolves a bare filename
 * against its own directory, Electron needs an absolute path under
 * `app.getPath('userData')`), so opening is a shell-supplied factory and this
 * interface only describes an already-open connection.
 *
 * Written from the expo-sqlite shape rather than a neutral one, on purpose: the
 * mobile wallet holds real funds and its driver must be a pass-through with
 * nowhere for a behaviour change to hide. Every divergence therefore lands in
 * the Node adapter, where it can be reasoned about in one file.
 */

/**
 * What the package actually binds. `boolean` is here because the three
 * converter layers in `StorageExpoSQLite` (`buildWhere`,
 * `validatePartialForUpdate`, `validateEntityForInsert`) each map booleans to
 * 0/1 *before* a value reaches a driver — so nothing should arrive as one, but
 * a driver that accepts it cannot be the reason a write is lost.
 */
export type SqlBindValue = string | number | null | boolean | Uint8Array

/**
 * Field names follow expo-sqlite. `lastInsertRowId` — capital I — is not a
 * stylistic choice: `StorageExpoSQLite.sqlInsert` returns this value straight
 * into every entity's primary key, and `node:sqlite` spells its own field
 * `lastInsertRowid`, so an adapter that spreads the native result instead of
 * renaming yields `undefined` ids that insert cleanly and only fail later.
 */
export interface SqlRunResult {
  changes: number
  lastInsertRowId: number
}

export interface SqlDriver {
  /**
   * Run one or more statements for effect, with no parameters. The whole string
   * is executed — `createTables` relies on this to send a CREATE TABLE and its
   * indexes in a single call.
   */
  execAsync(sql: string): Promise<void>

  /**
   * Run a single statement that returns no rows, and report what it changed.
   * `params` is optional only for symmetry with the read methods; every current
   * caller passes an array.
   */
  runAsync(sql: string, params?: SqlBindValue[]): Promise<SqlRunResult>

  /**
   * All matching rows, as plain objects keyed by column name.
   *
   * `params` must stay optional: `createTables` and
   * `WalletContext`'s proven-tx header read both call this with one argument.
   */
  getAllAsync<T = unknown>(sql: string, params?: SqlBindValue[]): Promise<T[]>

  /**
   * The first matching row, or `null` when there is none — `null`, not
   * `undefined`, because that is what expo returns and what
   * `StorageExpoSQLite.readSettings` and `getKeyValue` are written against.
   */
  getFirstAsync<T = unknown>(sql: string, params?: SqlBindValue[]): Promise<T | null>

  /**
   * Run `fn` with everything it does inside one atomic unit: committed if `fn`
   * resolves, rolled back if it throws, and the original error re-thrown after
   * the rollback.
   *
   * The driver handed to `fn` is a *different object* from the one this was
   * called on, and that difference is load-bearing. `StorageExpoSQLite.transaction`
   * swaps it into the storage object for the duration of the scope, so every
   * statement issued inside lands on the transaction; and a driver can tell a
   * nested call (arriving on the scoped object) from a genuinely concurrent one
   * (arriving on the outer object) by which object it was called on.
   *
   * Nesting is not hypothetical and not avoidable here: `commitNewTxToStorage`
   * opens a transaction and calls `EntityProvenTxReq.insertOrMerge` inside it,
   * which opens another one and passes no trx token
   * (`wallet-toolbox-mobile/out/src/storage/schema/entities/EntityProvenTxReq.js:317`).
   * That runs on every `createAction`. An implementation that serialises
   * transactions with a queue MUST let a nested call through, or the wallet
   * deadlocks on its hottest money path.
   *
   * Two callers that are not nested must not interleave. How that is achieved
   * is the implementation's business — expo opens a second connection, the Node
   * driver queues — but concurrent *non*-transactional statements are not
   * covered by this guarantee in either driver.
   */
  withExclusiveTransactionAsync(fn: (tx: SqlDriver) => Promise<void>): Promise<void>

  /** Close the connection. Not called on a transaction-scoped driver. */
  closeAsync(): Promise<void>
}

/**
 * How a host opens a database. `StorageExpoSQLite` calls this once, from
 * `migrate()`, with its `dbName` — see `SqlDriver` above for why opening is not
 * a method on the driver.
 */
export type OpenSqlDriver = (databaseName: string) => Promise<SqlDriver>

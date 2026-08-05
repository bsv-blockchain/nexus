import * as SQLite from 'expo-sqlite'
import type { SQLiteDatabase } from 'expo-sqlite'
import type { OpenSqlDriver, SqlBindValue, SqlDriver, SqlRunResult } from '../SqlDriver'

/**
 * `SqlDriver` over expo-sqlite, for the mobile shell.
 *
 * A pass-through and nothing else. There is a live wallet with real mainnet
 * funds behind this file; the only safe amount of cleverness here is none, so
 * every method forwards its arguments unchanged and returns the native result
 * unchanged. No coercion, no defaulting, no normalising — anything this driver
 * "fixed" would be a behaviour change on a funded device, which is a migration
 * bug wearing a helpful face.
 *
 * The one shape the wrapper does impose is the two-arg / one-arg split below,
 * and that exists to *preserve* the existing calls rather than change them.
 */
class ExpoSqlDriver implements SqlDriver {
  constructor(private readonly db: SQLiteDatabase) {}

  async execAsync(sql: string): Promise<void> {
    return await this.db.execAsync(sql)
  }

  async runAsync(sql: string, params?: SqlBindValue[]): Promise<SqlRunResult> {
    // Omitting the argument rather than forwarding `undefined` keeps callers on
    // expo's variadic overload, which is the call they make today: its array
    // overload takes `SQLiteBindParams`, and `undefined` is not one.
    return params === undefined ? await this.db.runAsync(sql) : await this.db.runAsync(sql, params)
  }

  async getAllAsync<T = unknown>(sql: string, params?: SqlBindValue[]): Promise<T[]> {
    return params === undefined ? await this.db.getAllAsync<T>(sql) : await this.db.getAllAsync<T>(sql, params)
  }

  async getFirstAsync<T = unknown>(sql: string, params?: SqlBindValue[]): Promise<T | null> {
    return params === undefined ? await this.db.getFirstAsync<T>(sql) : await this.db.getFirstAsync<T>(sql, params)
  }

  async withExclusiveTransactionAsync(fn: (tx: SqlDriver) => Promise<void>): Promise<void> {
    // expo opens a dedicated connection for the transaction and hands it to the
    // task; wrapping it keeps the callback on the driver interface without
    // altering which connection the statements go to. Nested transactions
    // therefore behave exactly as they do today — expo opens a third connection
    // and the inner scope commits independently of the outer one. That is not
    // ideal, but it is what the shipped wallet does, and changing it here is
    // out of scope for a driver extraction.
    await this.db.withExclusiveTransactionAsync(async txn => {
      await fn(new ExpoSqlDriver(txn))
    })
  }

  async closeAsync(): Promise<void> {
    return await this.db.closeAsync()
  }
}

/**
 * Open a database by name, resolved by expo against its own database directory
 * — the same bare-filename call `StorageExpoSQLite.migrate` made inline before
 * the driver seam existed.
 */
export const openExpoDriver: OpenSqlDriver = async databaseName => {
  return new ExpoSqlDriver(await SQLite.openDatabaseAsync(databaseName))
}

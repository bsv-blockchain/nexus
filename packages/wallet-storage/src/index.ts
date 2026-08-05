export { StorageExpoSQLite } from './StorageExpoSQLite'
export type { StorageExpoSQLiteOptions } from './StorageExpoSQLite'
export { createTables } from './schema/createTables'
export type { OpenSqlDriver, SqlBindValue, SqlDriver, SqlRunResult } from './SqlDriver'
// The drivers themselves are deliberately absent: `expoDriver` imports
// expo-sqlite and `nodeDriver` imports node:sqlite, and neither engine resolves
// on the other's host. Each shell deep-imports the one it can actually load.

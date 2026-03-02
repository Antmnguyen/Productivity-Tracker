/**
 * @file IDbAdapter.ts
 * @description Unified database adapter interface.
 *
 * Both the native (expo-sqlite) and web (sql.js) adapters implement this
 * interface, so all storage files stay completely unchanged — they just call
 * these four methods regardless of platform.
 *
 * The method signatures intentionally mirror expo-sqlite's synchronous API:
 *   getAllSync  → db.getAllSync
 *   getFirstSync → db.getFirstSync
 *   runSync    → db.runSync
 *   execSync   → db.execSync
 */
export interface IDbAdapter {
  /**
   * Execute a SELECT query and return all matching rows.
   * Returns an empty array if no rows match.
   */
  getAllSync<T>(sql: string, params?: (string | number | null)[]): T[];

  /**
   * Execute a SELECT query and return the first matching row, or null.
   */
  getFirstSync<T>(sql: string, params?: (string | number | null)[]): T | null;

  /**
   * Execute a single parameterized INSERT / UPDATE / DELETE statement.
   */
  runSync(sql: string, params?: (string | number | null)[]): void;

  /**
   * Execute one or more SQL statements with no parameters.
   * Used exclusively for schema initialization (CREATE TABLE, ALTER TABLE,
   * CREATE INDEX statements).
   */
  execSync(sql: string): void;
}

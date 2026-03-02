/**
 * @file database.ts
 * @description Platform-aware database entry point.
 *
 * All storage files import `db` from here. On native (iOS / Android) `db`
 * delegates to expo-sqlite via NativeAdapter. On web it delegates to the
 * sql.js-backed WebSqlAdapter that is injected by App.tsx after async init.
 *
 * The exported `db` object is a thin synchronous proxy — callers never need
 * to await or check for null; by the time the React component tree mounts,
 * `_db` is always populated (App.tsx shows a loading screen until ready).
 *
 * ## Native startup (unchanged behaviour)
 *   Module loads → NativeAdapter wraps expo-sqlite → `_db` set immediately.
 *   `initializeAllSchemas()` still runs synchronously at module level in App.tsx.
 *
 * ## Web startup
 *   Module loads → `_db` stays null (expo-sqlite cannot run in a browser).
 *   App.tsx calls `createWebSqlAdapter()` (async, loads sql.js WASM).
 *   After resolution, App.tsx calls `_setWebDb(adapter)` and then
 *   `initializeAllSchemas()`, then sets the React ready-state to true.
 */

import { Platform } from 'react-native';
import type { IDbAdapter } from './adapters/IDbAdapter';

// ─── Internal mutable reference ───────────────────────────────────────────────

let _db: IDbAdapter | null = null;

// On native: initialize synchronously (same as before).
// Metro's dead-code elimination strips this block from the web bundle because
// `Platform.OS` is replaced with the platform string at build time, making
// `Platform.OS !== 'web'` → `false` in the web build.
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { openDatabaseSync } = require('expo-sqlite') as typeof import('expo-sqlite');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NativeAdapter } = require('./adapters/NativeAdapter') as typeof import('./adapters/NativeAdapter');
  _db = new NativeAdapter(openDatabaseSync('tasks.db'));
}

// ─── Public db proxy ──────────────────────────────────────────────────────────

/**
 * The shared database handle.  Implements IDbAdapter so every storage file
 * can call `db.getAllSync(...)`, `db.runSync(...)`, etc. without knowing which
 * platform they are running on.
 *
 * On web, calling any method before `_setWebDb()` throws a clear error.
 * In practice this never happens because App.tsx awaits DB init before render.
 */
export const db: IDbAdapter = {
  getAllSync<T>(sql: string, params?: (string | number | null)[]): T[] {
    if (!_db) throw new Error('[db] Web database not initialized yet. Ensure App.tsx awaits createWebSqlAdapter() before rendering.');
    return _db.getAllSync<T>(sql, params);
  },

  getFirstSync<T>(sql: string, params?: (string | number | null)[]): T | null {
    if (!_db) throw new Error('[db] Web database not initialized yet.');
    return _db.getFirstSync<T>(sql, params);
  },

  runSync(sql: string, params?: (string | number | null)[]): void {
    if (!_db) throw new Error('[db] Web database not initialized yet.');
    _db.runSync(sql, params);
  },

  execSync(sql: string): void {
    if (!_db) throw new Error('[db] Web database not initialized yet.');
    _db.execSync(sql);
  },
};

// ─── Web injection ────────────────────────────────────────────────────────────

/**
 * Called once by App.tsx on web after `createWebSqlAdapter()` resolves.
 * Sets the internal `_db` reference so all subsequent storage calls work.
 *
 * NOT exported on native — the native adapter is set above at module load time.
 */
export function _setWebDb(adapter: IDbAdapter): void {
  _db = adapter;
}

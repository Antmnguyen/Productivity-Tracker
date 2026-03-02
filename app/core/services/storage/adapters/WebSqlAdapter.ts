/**
 * @file WebSqlAdapter.ts
 * @description IDbAdapter implementation for web using sql.js (SQLite WASM).
 *
 * sql.js compiles SQLite to WebAssembly and exposes a *synchronous* JavaScript
 * API.  This means every storage file in this project works on web unchanged —
 * they call the exact same getAllSync / runSync / execSync / getFirstSync methods
 * as on native.
 *
 * ## Persistence
 *   sql.js keeps the entire database in memory.  After every write we debounce
 *   a serialisation to localStorage (200 ms window).  localStorage.setItem is
 *   synchronous and the database is small enough (< 5 MB for any realistic
 *   task list) that this is safe.
 *
 *   On the next app launch, loadSavedDb() restores the in-memory database from
 *   localStorage so the user's data survives page refreshes.
 *
 * ## Initialisation
 *   sql.js must load a WASM binary before any queries can run.  That load is
 *   asynchronous, so `createWebSqlAdapter()` returns a Promise.  Call it once
 *   at app startup (App.tsx) and then the adapter is entirely synchronous.
 *
 * ## WASM location
 *   The file `public/sql-wasm.wasm` (copied from node_modules/sql.js/dist/)
 *   is served at `/sql-wasm.wasm` by Expo web / Vercel.
 *   `locateFile` tells sql.js where to fetch it.
 */

import type { IDbAdapter } from './IDbAdapter';

// ─── Persistence ─────────────────────────────────────────────────────────────

const DB_STORAGE_KEY = 'tasktrackerdb_v1';
let _persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(sqlDb: SqlJs.Database): void {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    try {
      const data = sqlDb.export();           // Uint8Array — in-memory db bytes
      let binary = '';
      for (let i = 0; i < data.byteLength; i++) {
        binary += String.fromCharCode(data[i]);
      }
      localStorage.setItem(DB_STORAGE_KEY, btoa(binary));
    } catch (e) {
      console.warn('[WebSqlAdapter] Failed to persist DB:', e);
    }
  }, 200);
}

function loadSavedDb(): Uint8Array | null {
  try {
    const saved = localStorage.getItem(DB_STORAGE_KEY);
    if (!saved) return null;
    const binary = atob(saved);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

// ─── Adapter class ────────────────────────────────────────────────────────────

export class WebSqlAdapter implements IDbAdapter {
  constructor(private sqlDb: SqlJs.Database) {}

  getAllSync<T>(sql: string, params?: (string | number | null)[]): T[] {
    const stmt = this.sqlDb.prepare(sql);
    const results: T[] = [];
    try {
      if (params && params.length > 0) {
        stmt.bind(params as SqlJs.BindParams);
      }
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as T);
      }
    } finally {
      stmt.free();
    }
    return results;
  }

  getFirstSync<T>(sql: string, params?: (string | number | null)[]): T | null {
    const rows = this.getAllSync<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  runSync(sql: string, params?: (string | number | null)[]): void {
    if (params && params.length > 0) {
      this.sqlDb.run(sql, params as SqlJs.BindParams);
    } else {
      this.sqlDb.run(sql);
    }
    schedulePersist(this.sqlDb);
  }

  execSync(sql: string): void {
    // exec() supports multiple semicolon-separated statements (used by schema
    // initializers) and silently handles comments.
    this.sqlDb.exec(sql);
    schedulePersist(this.sqlDb);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Async factory — loads the sql.js WASM binary, then returns a ready-to-use
 * WebSqlAdapter.  Call once from App.tsx before mounting the app.
 *
 * The WASM file is served from `/sql-wasm.wasm` (copied to public/ at install
 * time from node_modules/sql.js/dist/).
 */
export async function createWebSqlAdapter(): Promise<WebSqlAdapter> {
  // Dynamic import keeps sql.js out of the native bundle entirely.
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });

  const saved = loadSavedDb();
  const sqlDb = saved ? new SQL.Database(saved) : new SQL.Database();

  return new WebSqlAdapter(sqlDb);
}

/**
 * @file NativeAdapter.ts
 * @description IDbAdapter implementation for iOS / Android using expo-sqlite.
 *
 * This is a thin pass-through wrapper so all platforms use the same IDbAdapter
 * interface. On native, every call delegates directly to expo-sqlite's
 * synchronous API — no behaviour changes.
 *
 * This file is only bundled on native (iOS / Android).
 * Metro's dead-code elimination strips it from the web bundle because the
 * conditional `if (Platform.OS !== 'web')` in database.ts gates the import.
 */
import * as SQLite from 'expo-sqlite';
import type { IDbAdapter } from './IDbAdapter';

export class NativeAdapter implements IDbAdapter {
  constructor(private nativeDb: SQLite.SQLiteDatabase) {}

  getAllSync<T>(sql: string, params?: (string | number | null)[]): T[] {
    return this.nativeDb.getAllSync<T>(sql, (params ?? []) as SQLite.SQLiteBindValue[]);
  }

  getFirstSync<T>(sql: string, params?: (string | number | null)[]): T | null {
    return this.nativeDb.getFirstSync<T>(sql, (params ?? []) as SQLite.SQLiteBindValue[]) ?? null;
  }

  runSync(sql: string, params?: (string | number | null)[]): void {
    this.nativeDb.runSync(sql, (params ?? []) as SQLite.SQLiteBindValue[]);
  }

  execSync(sql: string): void {
    this.nativeDb.execSync(sql);
  }
}

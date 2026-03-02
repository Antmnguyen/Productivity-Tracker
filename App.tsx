// App.tsx
// =============================================================================
// APP ENTRY POINT
// =============================================================================
//
// Root component that initializes the database and renders the main navigator.
//
// NAVIGATION STRUCTURE:
//   App.tsx
//     └── MainNavigator (bottom tab bar)
//           ├── TasksStack (All Tasks tab)
//           │     ├── AllTasksScreen
//           │     ├── CreateTaskScreen
//           │     ├── CreatePermanentTaskScreen
//           │     └── UsePermanentTaskScreen
//           ├── TodayScreen (Today tab)
//           ├── StatsScreen (Stats tab)
//           └── BrowseScreen (Browse tab)
//
// PLATFORM STARTUP
//
//   Native (iOS / Android):
//     expo-sqlite opens synchronously at module load (database.ts).
//     initializeAllSchemas() runs synchronously before the component mounts.
//     No loading state needed.
//
//   Web:
//     expo-sqlite is unavailable in the browser. database.ts leaves _db null.
//     This component awaits createWebSqlAdapter() (loads sql.js WASM + restores
//     any saved DB from localStorage), then calls _setWebDb() and
//     initializeAllSchemas(), then sets `dbReady = true` to allow rendering.
//     A blank white view is shown during the brief init window.
//
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MainNavigator } from './app/navigation/MainNavigator';
import { initializeAllSchemas } from './app/core/services/storage/schema';
import { ThemeProvider } from './app/theme/ThemeContext';

// On native: initialize DB + schemas synchronously before anything renders.
// The `if` block is dead-code eliminated from the web bundle by Metro.
if (Platform.OS !== 'web') {
  initializeAllSchemas();
}

export default function App() {
  // On web: wait for the async sql.js init before rendering the app.
  // On native: always true (schemas already initialized above).
  const [dbReady, setDbReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;

    (async () => {
      try {
        // Dynamically import so Metro strips this from the native bundle.
        const { createWebSqlAdapter } = await import(
          './app/core/services/storage/adapters/WebSqlAdapter'
        );
        const { _setWebDb } = await import(
          './app/core/services/storage/database'
        );

        const adapter = await createWebSqlAdapter();

        if (cancelled) return;

        // Inject the adapter so all db.xxxSync() calls work.
        _setWebDb(adapter);

        // Schema init is idempotent — CREATE TABLE IF NOT EXISTS, etc.
        initializeAllSchemas();

        setDbReady(true);
      } catch (err) {
        console.error('[App] Web DB init failed:', err);
        // Still set ready so the app renders (it may error on first DB call,
        // but that's better than a perpetual blank screen).
        if (!cancelled) setDbReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Blank screen while web DB initializes (typically < 500ms on first load,
  // near-instant on subsequent visits because the WASM is browser-cached).
  if (!dbReady) {
    return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />;
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <MainNavigator />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

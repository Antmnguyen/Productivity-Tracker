# Sprint 5.5 — Web Deployment Progress

## Checkpoint 1 — Storage Adapter Layer (3 files done)

### Completed
- [x] Installed `sql.js` + `@types/sql.js` (synchronous SQLite WASM for web)
- [x] Copied `sql-wasm.wasm` → `public/sql-wasm.wasm` (served at `/sql-wasm.wasm`)
- [x] `app/core/services/storage/adapters/IDbAdapter.ts` — shared interface
  - `getAllSync`, `getFirstSync`, `runSync`, `execSync`
  - Mirrors expo-sqlite's sync API exactly → zero changes to any storage file
- [x] `app/core/services/storage/adapters/NativeAdapter.ts` — thin expo-sqlite wrapper
- [x] `app/core/services/storage/adapters/WebSqlAdapter.ts` — sql.js wrapper
  - Persistence: debounced localStorage serialization (200ms window)
  - Factory: `createWebSqlAdapter()` async, load-once, then fully sync

### Key architectural decision
sql.js was chosen over Dexie.js because it provides a *synchronous* API identical
to expo-sqlite. This means **zero changes** to any of the 6 storage files
(taskStorage, permanentTaskStorage, categoryStorage, statsStorage, archiveStorage,
appSettingsStorage) or any of the 6 schema files.

---

## Checkpoint 2 — database.ts + App.tsx (done)

### Completed
- [x] `app/core/services/storage/database.ts` — new platform-aware proxy
  - Native: wraps expo-sqlite via NativeAdapter (synchronous, unchanged behavior)
  - Web: `_db` stays null until `_setWebDb()` is injected from App.tsx
  - Metro dead-code elimination strips expo-sqlite from web bundle
- [x] `App.tsx` — async web DB init before React tree mounts
  - Native: `initializeAllSchemas()` runs synchronously at module load (unchanged)
  - Web: awaits `createWebSqlAdapter()`, calls `_setWebDb()`, then `initializeAllSchemas()`, then sets `dbReady=true`
  - Shows blank white view during brief init (~500ms first load, near-instant after)

---

## Checkpoint 3 — DateTimePicker (done)

### Completed
- [x] `CreateTaskScreen.tsx` — web branch added
  - iOS/Android: unchanged native DateTimePicker
  - Web: `<TextInput type="date">` (React Native Web passes `type` through to DOM `<input>`)
  - `handleWebDateChange` parses `YYYY-MM-DD` → local Date at 23:59:59
- [x] `EditTaskModal.tsx` — same pattern
- [x] `UsePermanentTaskScreen.tsx` — same pattern + added `TextInput` import

---

## Checkpoint 4 — PWA + Deployment config (done)

### Completed
- [x] `public/manifest.json` — PWA manifest
  - `display: standalone` hides browser chrome when opened from iPhone home screen
  - `theme_color: #007AFF` (iOS blue, matches app accent)
- [x] `app.json` — updated web section
  - Added `bundler: metro`, `output: single` (required for Vercel SPA deploy)
  - Added PWA meta: `name`, `shortName`, `themeColor`, `display: standalone`
  - Removed `@react-native-community/datetimepicker` from plugins (native-only plugin,
    breaks web builds if listed as an Expo plugin)
- [x] `vercel.json` — SPA routing + WASM MIME type
- [x] `package.json` — added `build:web` script

---

## Checkpoint 5 — Additional fixes (done)

### Completed
- [x] `scripts/inject-pwa-links.js` — post-build script injects manifest + Apple PWA tags
- [x] `web/index.html` — custom HTML template (fallback; Expo uses its own generator)
- [x] `metro.config.js` — added WASM asset extension support
- [x] `react-dom` + `react-native-web` installed (required for `expo export --platform web`)
- [x] `app/components/tasks/Taskitem.tsx` → renamed to `TaskItem.tsx` (case fix for web bundler)

## Final status — BUILD PASSING ✅
`npm run build:web` completes successfully:
- 3 JS bundles + dist/sql-wasm.wasm + dist/manifest.json + dist/index.html (with PWA tags)
- All 3 DateTimePicker screens have web fallbacks
- All storage files unchanged (no query logic modified)

## To deploy
1. Push to GitHub (main branch)
2. Connect repo to Vercel: build command `npm run build:web`, output dir `dist`
3. Every push to `main` auto-deploys
4. iPhone users: open URL in Safari → "Add to Home Screen" → full-screen PWA

## What the web version intentionally omits
| Feature | Reason |
|---------|--------|
| Geofencing | Native OS API only |
| Health Connect | Android only |
| Push notifications | Out of scope |
| Cross-device sync | localStorage is per-device (IndexedDB coming in Sprint 6+) |

---

## What the web version intentionally omits
| Feature | Reason |
|---------|--------|
| Geofencing | Native OS API only |
| Health Connect | Android only |
| Push notifications | Out of scope |
| Cross-device sync | localStorage is per-device |

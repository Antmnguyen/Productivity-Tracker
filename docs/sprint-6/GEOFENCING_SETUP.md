# Geofencing — Setup Instructions

Work through these steps in order. Each section ends with a quick check so
you know it worked before moving on. All testing requires a **physical Android
device** — geofencing and background location do not work in the emulator.

---

## Step 1 — Install packages

Run all three installs from the project root:

```bash
npx expo install expo-location
npx expo install expo-task-manager
npx expo install react-native-maps
```

`expo install` pins the versions that are compatible with the current Expo SDK
(54.x) automatically — do not use `npm install` directly for these.

**Verify** — check `package.json` now shows entries for all three under `dependencies`.

---

## Step 2 — Add expo-location plugin to app.json

Add the `expo-location` plugin entry inside the `"plugins"` array in `app.json`.
It must sit alongside the existing plugin entries (not replace them):

```json
[
  "expo-location",
  {
    "locationAlwaysAndWhenInUsePermission": "This app uses your location in the background to detect when you arrive at or leave a saved place, so it can automatically complete your scheduled tasks.",
    "locationWhenInUsePermission": "This app uses your location to let you pin places on a map for task auto-completion.",
    "isAndroidBackgroundLocationEnabled": true,
    "isAndroidForegroundServiceEnabled": true
  }
]
```

**What each field does:**
- `locationAlwaysAndWhenInUsePermission` — iOS "Always" location rationale string (shown in the OS dialog)
- `locationWhenInUsePermission` — iOS "When In Use" rationale string
- `isAndroidBackgroundLocationEnabled` — adds `ACCESS_BACKGROUND_LOCATION` to the manifest
- `isAndroidForegroundServiceEnabled` — adds the foreground service declaration needed for background geofencing on Android

---

## Step 3 — Add Android permissions to app.json

Inside the `"android"` block, extend the existing `"permissions"` array to include
the location permissions (keep the Health Connect permissions already there):

```json
"permissions": [
  "android.permission.health.READ_STEPS",
  "android.permission.health.READ_SLEEP",
  "android.permission.health.READ_EXERCISE",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_LOCATION"
]
```

**Note on `ACCESS_BACKGROUND_LOCATION`:** Google Play Store requires a separate
declaration and privacy policy justification for this permission. It is fine for
development and internal testing builds. For production submission, a form must
be completed in the Play Console before the app can be published.

---

## Step 4 — react-native-maps: OSM-only setup (no Google API key)

`react-native-maps` defaults to Google Maps on Android which requires an API key.
To use OSM tiles only (no key), add the plugin with `googleMapsApiKey` left empty
and plan to use `mapType="none"` + `<UrlTile>` in all map views:

```json
[
  "react-native-maps",
  {
    "googleMapsApiKey": ""
  }
]
```

The `mapType="none"` approach hides the Google base layer entirely — the map
renders only the OSM `<UrlTile>` overlay. Gestures, zoom, and pan still work
through the react-native-maps framework.

**If the map crashes at runtime without a key:** react-native-maps may still
initialise the Google Maps SDK and fail. In that case, the fallback is
`@maplibre/maplibre-react-native`, which is a truly OSM-native map library.
Switch to it and use `<RasterSource>` with the OSM tile URL instead of `<UrlTile>`.
Note this in a follow-up issue if it occurs — don't spend more than 30 minutes
debugging the API-key crash before switching.

---

## Step 5 — Register the background task in index.ts

The `expo-task-manager` background task **must** be defined at the module level
before the app boots — it cannot be defined inside a component or hook. Add this
block near the top of `index.ts`, after the existing imports:

```ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const GEOFENCE_TASK = 'GEOFENCE_TASK';

TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
  if (error) {
    console.warn('[Geofence] Task error:', error.message);
    return;
  }
  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  console.log(
    '[Geofence] Event:',
    eventType === Location.GeofencingEventType.Enter ? 'ENTER' : 'EXIT',
    'region:', region.identifier,
  );
  // Full handler wired in later — this stub is enough to confirm events fire.
});
```

This stub just logs events. The real handler (storage writes + task completion)
is wired in during implementation. The stub is enough to verify the plumbing works.

**Verify** — confirm `index.ts` now imports `expo-task-manager` and `expo-location`
and has the `defineTask` call before `registerRootComponent`.

---

## Step 6 — Rebuild the dev client

The new native modules (`expo-location`, `expo-task-manager`, `react-native-maps`)
require a native rebuild — a regular Metro reload is not enough:

```bash
npx expo run:android
```

Or if using EAS for the dev client build:

```bash
eas build --profile development --platform android
```

Install the resulting APK on the device. From this point, all testing is on
the physical device.

---

## Step 7 — Smoke test: foreground location permission

Add a temporary button somewhere in the app (e.g. the Browse screen, removed
after testing) that runs this:

```ts
import * as Location from 'expo-location';

async function testForegroundLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  console.log('[Test] Foreground location permission:', status);

  if (status === 'granted') {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    console.log('[Test] Current location:', loc.coords.latitude, loc.coords.longitude);
  }
}
```

**Expected output in Metro logs:**
```
[Test] Foreground location permission: granted
[Test] Current location: <lat> <lng>
```

If status is `denied`, the OS dialog either wasn't shown or was rejected. Check
that the `expo-location` plugin is in `app.json` and that the app was rebuilt.

---

## Step 8 — Smoke test: background location permission

Run this **after** foreground is granted (Android enforces the two-step order):

```ts
async function testBackgroundLocation() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  console.log('[Test] Background location permission:', status);
}
```

**Expected output:**
```
[Test] Background location permission: granted
```

On Android 10+, the OS will show a second dialog (separate from the foreground
one) that says "Allow all the time". The user must select that option. If the
dialog does not appear, confirm `ACCESS_BACKGROUND_LOCATION` is in the
`app.json` permissions array and the app was rebuilt.

---

## Step 9 — Smoke test: register a geofence and confirm events fire

This is the end-to-end check. Add a temporary test function that:
1. Gets current position
2. Registers a 50-metre geofence around it
3. Waits for you to walk away and back (or just checks ENTER fires immediately if already inside)

```ts
async function testGeofence() {
  // 1. Get current position
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  console.log('[Test] Position:', loc.coords.latitude, loc.coords.longitude);

  // 2. Register geofence
  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    {
      identifier: 'TEST_GEOFENCE',
      latitude:   loc.coords.latitude,
      longitude:  loc.coords.longitude,
      radius:     50,           // metres
      notifyOnEnter: true,
      notifyOnExit:  true,
    },
  ]);
  console.log('[Test] Geofence registered. Walk away and back to trigger ENTER/EXIT.');
}

async function stopGeofence() {
  await Location.stopGeofencingAsync(GEOFENCE_TASK);
  console.log('[Test] Geofence stopped.');
}
```

**Expected Metro log output when events fire:**
```
[Geofence] Event: ENTER  region: TEST_GEOFENCE
[Geofence] Event: EXIT   region: TEST_GEOFENCE
```

Background events (app backgrounded or killed) appear in the device logcat rather
than Metro. To read them:

```bash
adb logcat | grep "\[Geofence\]"
```

**If no events fire:**
- Confirm both foreground AND background permissions are granted (Step 7 + 8).
- Confirm `TaskManager.defineTask` is called before `registerRootComponent` in `index.ts`.
- Confirm the rebuild included the new native modules (Step 6).
- Google Play Services must be available on the device — geofencing silently does
  nothing on devices without it.
- Geofence accuracy is low at 50m indoors; step outside for the test.

---

## Step 10 — Clean up test code

Once all three smoke tests pass:
- Remove the temporary test buttons/functions from the UI
- Keep the `TaskManager.defineTask(GEOFENCE_TASK, ...)` stub in `index.ts` — it stays permanently, just gets a real handler later

---

## app.json — Full plugins array after setup

For reference, the complete `plugins` array once all steps above are done:

```json
"plugins": [
  "expo-sqlite",
  "@react-native-community/datetimepicker",
  "expo-font",
  [
    "expo-build-properties",
    { "android": { "minSdkVersion": 26 } }
  ],
  [
    "react-native-health-connect",
    { "permissions": ["READ_STEPS", "READ_SLEEP", "READ_EXERCISE"] }
  ],
  [
    "./plugins/withHealthConnectSetup",
    { "privacyPolicyUrl": "https://example.com/privacy" }
  ],
  [
    "expo-location",
    {
      "locationAlwaysAndWhenInUsePermission": "This app uses your location in the background to detect when you arrive at or leave a saved place, so it can automatically complete your scheduled tasks.",
      "locationWhenInUsePermission": "This app uses your location to let you pin places on a map for task auto-completion.",
      "isAndroidBackgroundLocationEnabled": true,
      "isAndroidForegroundServiceEnabled": true
    }
  ],
  [
    "react-native-maps",
    { "googleMapsApiKey": "" }
  ]
]
```

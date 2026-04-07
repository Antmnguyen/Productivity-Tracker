# How to Build — TaskTrackerApp APK

All builds are **local** (no Expo/EAS account required).

> **Windows note:** Replace `./gradlew` with `gradlew.bat` in any Gradle command below.
> `npx` and `adb` commands are identical on all platforms.

---

## Prerequisites

The `android/` folder is gitignored and must exist on your machine.
If you cloned fresh or the folder is missing, regenerate it first:

```bash
npx expo prebuild --platform android
```

> You only need to do this once, or after installing a new native package.

---

## Debug APK (fastest — for testing on your own device)

**macOS / Linux**
```bash
cd android
./gradlew assembleDebug
```

**Windows**
```bat
cd android
gradlew.bat assembleDebug
```

Output file:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

Install directly on a connected device:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Release APK (optimised — for distribution / sideloading)

**macOS / Linux**
```bash
cd android
./gradlew assembleRelease
```

**Windows**
```bat
cd android
gradlew.bat assembleRelease
```

Output file:
```
android\app\build\outputs\apk\release\app-release.apk
```

Install on a connected device:
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

> **Note:** The current `build.gradle` signs the release build with the debug keystore.
> This is fine for personal sideloading. For Play Store submission you need a
> dedicated release keystore — see the [React Native signing guide](https://reactnative.dev/docs/signed-apk-android).

---

## Alternatively — via Expo CLI (builds and installs in one step)

Same command on all platforms:

```bash
# Debug
npx expo run:android

# Release
npx expo run:android --variant release
```

**How this differs from the Gradle commands above:**

| | Gradle (`gradlew.bat`) | Expo CLI (`npx expo run:android`) |
|---|---|---|
| Runs prebuild first | No | Yes (regenerates `android/` if needed) |
| Auto-installs on device | No — you `adb install` manually | Yes |
| Auto-launches the app | No | Yes |
| Gives you an APK file to share | Yes | No (installs directly, no file output) |

**When to use which:**
- **Expo CLI** — day-to-day development. One command builds, installs, and launches.
- **Gradle** — when you want the `.apk` file itself (to share, sideload on a device without a PC attached, or distribute). Both produce the same APK; Gradle just skips the install step.

---

## Clean build (if something is broken)

**macOS / Linux**
```bash
cd android && ./gradlew clean && cd ..
npx expo run:android
```

**Windows**
```bat
cd android
gradlew.bat clean
cd ..
npx expo run:android
```

---

## Quick reference

| Goal | macOS / Linux | Windows |
|------|--------------|---------|
| Regenerate `android/` after fresh clone | `npx expo prebuild --platform android` | ← same |
| Debug APK file | `cd android && ./gradlew assembleDebug` | `cd android && gradlew.bat assembleDebug` |
| Release APK file | `cd android && ./gradlew assembleRelease` | `cd android && gradlew.bat assembleRelease` |
| Debug — build + install on device | `npx expo run:android` | ← same |
| Release — build + install on device | `npx expo run:android --variant release` | ← same |
| Install an APK manually | `adb install path/to/app.apk` | ← same |
| Clean build cache | `cd android && ./gradlew clean` | `cd android && gradlew.bat clean` |

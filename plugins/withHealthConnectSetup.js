/**
 * withHealthConnectSetup.js
 *
 * Custom Expo config plugin that applies the native Android changes required
 * for react-native-health-connect to work correctly with EAS / expo prebuild.
 *
 * The library's own app.plugin.js only adds ACTION_SHOW_PERMISSIONS_RATIONALE
 * to the MainActivity intent-filter. These three additional changes are also
 * required:
 *
 *   1. health_connect_privacy_policy_url <meta-data> inside <application>
 *      — Health Connect silently ignores any app that lacks this entry.
 *      Without it the app never appears in HC's app list and requestPermission()
 *      returns [] immediately with no dialog.
 *
 *   2. <activity-alias> for android.intent.action.VIEW_PERMISSION_USAGE with
 *      category android.intent.category.HEALTH_PERMISSIONS
 *      — Required for Health Connect to surface the app in its permissions
 *      management UI. Putting this intent-filter directly on MainActivity
 *      does NOT work — it must be an activity-alias.
 *
 *   3. PermissionController$HealthDataRequestPermissionsActivity declaration
 *      — The activity that drives the HC permission dialog. Must be declared
 *      with android:exported="true" and an ACTION_SHOW_PERMISSIONS_RATIONALE
 *      intent-filter so HC can launch it and show the rationale screen.
 *
 *   4. <queries> intent entry for ACTION_SHOW_PERMISSIONS_RATIONALE
 *      — On Android 11+ package visibility rules block intent resolution unless
 *      the intent is declared in <queries>. The app.json `queries` array only
 *      emits <package> entries, not <intent> entries, so this must be added here.
 *
 *   5. HealthConnectPermissionDelegate.setPermissionDelegate(this) in
 *      MainActivity.kt onCreate
 *      — The library uses Android's ActivityResultContracts API. Without
 *      registering the delegate before any permission request, requestPermission()
 *      crashes the app on some devices and silently returns [] on others.
 *
 * References:
 *   docs/sprint-7/SETUP_PROGRESS_2026-03-28.md  — troubleshooting log
 *   https://github.com/matinzd/react-native-health-connect
 */

const {
  withAndroidManifest,
  withMainActivity,
} = require('@expo/config-plugins');

// ---------------------------------------------------------------------------
// 1–4 — AndroidManifest.xml changes
// ---------------------------------------------------------------------------

function withHealthConnectManifest(config, privacyPolicyUrl) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application[0];

    // ── 1. Privacy policy meta-data ────────────────────────────────────────
    // Health Connect requires this to be present or it ignores the app.
    // The value can be any non-empty URL string (it's displayed in the HC UI).
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    const privacyMetaName = 'health_connect_privacy_policy_url';
    const alreadyHasPrivacyMeta = application['meta-data'].some(
      (m) => m.$?.['android:name'] === privacyMetaName,
    );
    if (!alreadyHasPrivacyMeta) {
      application['meta-data'].push({
        $: {
          'android:name': privacyMetaName,
          'android:value': privacyPolicyUrl,
        },
      });
    }

    // ── 2. PermissionController activity ──────────────────────────────────
    // The activity that drives the HC permission dialog. Needs to be explicitly
    // declared as exported so HC can launch it. Also needs the
    // SHOW_PERMISSIONS_RATIONALE intent-filter so HC can find it — the library's
    // own plugin only adds this filter to MainActivity, not here.
    if (!application.activity) {
      application.activity = [];
    }

    const permControllerName =
      'androidx.health.connect.client.PermissionController$HealthDataRequestPermissionsActivity';
    const alreadyHasPermController = application.activity.some(
      (a) => a.$?.['android:name'] === permControllerName,
    );
    if (!alreadyHasPermController) {
      application.activity.push({
        $: {
          'android:name': permControllerName,
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
                },
              },
            ],
          },
        ],
      });
    }

    // ── 3. <queries> intent entry for ACTION_SHOW_PERMISSIONS_RATIONALE ───
    // Android 11+ package visibility: without this, the system blocks intent
    // resolution for the rationale action. app.json `queries` only supports
    // <package> entries, not <intent> entries — so we add it here.
    if (!manifest.queries) {
      manifest.queries = [{}];
    }
    if (!manifest.queries[0].intent) {
      manifest.queries[0].intent = [];
    }
    const rationaleIntentName = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
    const alreadyHasRationaleIntent = manifest.queries[0].intent.some(
      (i) =>
        i.action?.[0]?.['$']?.['android:name'] === rationaleIntentName,
    );
    if (!alreadyHasRationaleIntent) {
      manifest.queries[0].intent.push({
        action: [{ $: { 'android:name': rationaleIntentName } }],
      });
    }

    // ── 4. activity-alias for VIEW_PERMISSION_USAGE ────────────────────────
    // Must be an <activity-alias> targeting MainActivity — putting this
    // intent-filter directly on MainActivity's <activity> does not work.
    if (!application['activity-alias']) {
      application['activity-alias'] = [];
    }

    const aliasName = 'ViewPermissionUsageActivity';
    const alreadyHasAlias = application['activity-alias'].some(
      (a) => a.$?.['android:name'] === aliasName,
    );
    if (!alreadyHasAlias) {
      application['activity-alias'].push({
        $: {
          'android:name': aliasName,
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE',
                },
              },
            ],
            category: [
              {
                $: {
                  'android:name': 'android.intent.category.HEALTH_PERMISSIONS',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

// ---------------------------------------------------------------------------
// 5 — MainActivity.kt — register the permission delegate
// ---------------------------------------------------------------------------

function withHealthConnectMainActivity(config) {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;

    // Add import if not present
    const importStatement =
      'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
    if (!src.includes(importStatement)) {
      // Insert after the last existing import line
      src = src.replace(
        /(import [^\n]+\n)(?!import )/,
        `$1${importStatement}\n`,
      );
    }

    // Add delegate call inside onCreate, after super.onCreate(...)
    const delegateCall =
      'HealthConnectPermissionDelegate.setPermissionDelegate(this)';
    if (!src.includes(delegateCall)) {
      // Match super.onCreate(null) or super.onCreate(savedInstanceState)
      src = src.replace(
        /(super\.onCreate\([^)]*\))/,
        `$1\n    ${delegateCall}`,
      );
    }

    config.modResults.contents = src;
    return config;
  });
}

// ---------------------------------------------------------------------------
// Compose both mods
// ---------------------------------------------------------------------------

/**
 * @param {object} config - Expo config
 * @param {object} [options]
 * @param {string} [options.privacyPolicyUrl] - URL shown in Health Connect's
 *   app permissions profile page. Should be a real privacy policy link in
 *   production. Defaults to a placeholder if omitted.
 */
module.exports = function withHealthConnectSetup(config, options = {}) {
  const privacyPolicyUrl =
    options.privacyPolicyUrl ?? 'https://example.com/privacy';
  config = withHealthConnectManifest(config, privacyPolicyUrl);
  config = withHealthConnectMainActivity(config);
  return config;
};

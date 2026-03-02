// metro.config.js
// =============================================================================
// Metro bundler configuration for Expo web + sql.js WASM support.
//
// sql.js loads its WASM binary at runtime via a fetch() call, so the WASM
// file is served as a static asset from public/ (not bundled by Metro).
// The only change needed here is telling Metro to treat .wasm files as
// opaque binary assets rather than attempting to parse them as JS.
// =============================================================================

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to serve .wasm files as static binary assets.
// Without this, Metro throws when it encounters the sql-wasm.wasm file
// reference in the sql.js package source.
config.resolver.assetExts.push('wasm');

module.exports = config;

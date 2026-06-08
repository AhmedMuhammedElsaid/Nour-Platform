const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo: pnpm symlinks workspace packages into apps/mobile/node_modules,
// so default resolution already finds them — we only need Metro to *watch*
// the linked sources (e.g. @repo/shared-core raw .ts — see ADR 0006) so edits
// there trigger a refresh.
config.watchFolders = [monorepoRoot];

module.exports = withNativeWind(config, { input: "./global.css" });

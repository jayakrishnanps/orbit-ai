// scripts/webpack-build.cjs
// Direct webpack build — replaces "electron-forge package" in the predist step.
// Produces the same .webpack/ output but skips:
//   • native module rebuild (electron-builder does this)
//   • Electron fuse injection (electron-builder does this)
//   • node_modules copy to out/ (not needed)
// Result: ~60 seconds instead of 45-60 minutes.

'use strict';

// Register ts-node so we can require() TypeScript webpack config files
require('ts-node').register({
  transpileOnly: true,           // Skip type-checking for speed
  skipProject: false,
  compilerOptions: {
    module: 'commonjs',          // Override esnext → CJS so require() works
    esModuleInterop: true,
  },
});

const path   = require('path');
const fs     = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const ROOT = path.resolve(__dirname, '..');

// ── Load TypeScript webpack configs ──────────────────────────────────────────
const { mainConfig }     = require('../webpack.main.config');
const { rendererConfig } = require('../webpack.renderer.config');
const { preloadConfig }  = require('../webpack.preload.config');

// ── Output directories (flat, non-arch-specific) ─────────────────────────────
const MAIN_OUT     = path.join(ROOT, '.webpack', 'main');
const RENDERER_OUT = path.join(ROOT, '.webpack', 'renderer');

// ── Constants injected by electron-forge webpack plugin in production ─────────
// These are runtime template literals — __dirname resolves at app startup to
// the directory of .webpack/main/index.js inside the ASAR.
const ENTRY_DEFINES = {
  'MAIN_WINDOW_WEBPACK_ENTRY':
    '`file://${require("path").resolve(__dirname, "..", "renderer", "main_window", "index.html")}`',
  'MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY':
    'require("path").resolve(__dirname, "..", "renderer", "main_window", "preload.js")',
};

// ── Helper: remove static __dirname DefinePlugin from a plugins array ─────────
// The base main config has DefinePlugin({ __dirname: JSON.stringify(buildTimeDir) })
// which bakes the project root path into the bundle. We replace this with
// node: { __dirname: true } (runtime value) so MAIN_WINDOW_WEBPACK_ENTRY works.
function withoutDirnameDefine(plugins) {
  return (plugins || []).filter(p => {
    if (p instanceof webpack.DefinePlugin) {
      const defs = p.definitions || {};
      if ('__dirname' in defs || '__filename' in defs) return false;
    }
    return true;
  });
}

// ── Main process config ───────────────────────────────────────────────────────
const mainBuildConfig = {
  ...mainConfig,
  mode: 'production',
  output: {
    ...mainConfig.output,
    path: MAIN_OUT,
    filename: 'index.js',
  },
  plugins: [
    ...withoutDirnameDefine(mainConfig.plugins),
    new webpack.DefinePlugin(ENTRY_DEFINES),
  ],
  // Runtime __dirname — required so MAIN_WINDOW_WEBPACK_ENTRY resolves correctly
  node: {
    __dirname: true,
    __filename: true,
  },
};

// ── Preload script config ─────────────────────────────────────────────────────
const preloadBuildConfig = {
  ...preloadConfig,
  mode: 'production',
  output: {
    ...preloadConfig.output,
    path: RENDERER_OUT,
    filename: 'main_window/preload.js',
  },
};

// ── Renderer process config ───────────────────────────────────────────────────
// Output layout (matches publicPath '../'):
//   renderer/main_window/index.html   ← HTML entry
//   renderer/main_window/index.js     ← React/Monaco bundle
//   renderer/[id]/index.js            ← Lazy-loaded chunks (Monaco workers etc.)
const rendererBuildConfig = {
  ...rendererConfig,
  mode: 'production',
  entry: './src/renderer/main.tsx',
  output: {
    path: RENDERER_OUT,
    filename: 'main_window/index.js',
    chunkFilename: '[id]/index.js',   // Chunks at renderer/[id]/ (NOT inside main_window/)
    publicPath: '../',                  // Resolves correctly from main_window/index.html
    globalObject: 'self',             // Required for Monaco web workers
  },
  plugins: [
    ...withoutDirnameDefine(rendererConfig.plugins),
    new HtmlWebpackPlugin({
      template: path.join(ROOT, 'src', 'index.html'),
      filename: 'main_window/index.html',
      inject: 'head',
    }),
  ],
};

// ── Webpack runner ────────────────────────────────────────────────────────────
function runWebpack(config, name) {
  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err) {
        console.error(`[${name}] Fatal:`, err.message);
        return reject(err);
      }
      if (stats.hasErrors()) {
        console.error(stats.toString({ all: false, errors: true }));
        return reject(new Error(`[${name}] Build failed with errors`));
      }
      if (stats.hasWarnings()) {
        // Print only critical warnings
        const ws = stats.toJson({ warnings: true }).warnings;
        ws.filter(w => !w.message.includes('size limit')).forEach(w =>
          console.log(`[${name}] warn:`, w.message.split('\n')[0])
        );
      }
      const elapsed = ((stats.endTime - stats.startTime) / 1000).toFixed(1);
      console.log(`  [${name}] done in ${elapsed}s`);
      resolve(stats);
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function build() {
  console.log('\nOrbit AI — webpack production build');
  console.log('=====================================\n');
  const t = Date.now();

  // Clean previous .webpack output
  if (fs.existsSync(path.join(ROOT, '.webpack'))) {
    fs.rmSync(path.join(ROOT, '.webpack'), { recursive: true, force: true });
    console.log('  Cleaned .webpack/\n');
  }

  // Build main + preload in parallel (independent)
  console.log('Building main + preload...');
  await Promise.all([
    runWebpack(mainBuildConfig, 'main'),
    runWebpack(preloadBuildConfig, 'preload'),
  ]);

  // Build renderer (Monaco takes ~30-40s)
  console.log('\nBuilding renderer (Monaco editor — takes ~40s)...');
  await runWebpack(rendererBuildConfig, 'renderer');

  const total = ((Date.now() - t) / 1000).toFixed(1);
  console.log(`\n✓ All bundles ready in ${total}s`);
  console.log('  Main:     .webpack/main/index.js');
  console.log('  Renderer: .webpack/renderer/main_window/index.html');
  console.log('  Preload:  .webpack/renderer/main_window/preload.js\n');
}

build().catch(err => {
  console.error('\nBuild error:', err.message || err);
  process.exit(1);
});

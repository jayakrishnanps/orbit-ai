import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';
import { preloadConfig } from './webpack.preload.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Required for node-pty (and other natives) to work inside ASAR.
    // The relocator puts natives in native_modules/, and node-pty has .node files.
    asarUnpack: ['**/node-pty/**', '**/native_modules/**/*.node', '**/*.node'],
    // Use a function for ignore so the webpack plugin doesn't complain/warn.
    // This excludes marketing/ (huge node_modules from the site) and other junk,
    // while still only including the .webpack output (as the plugin intends).
    // Without this, packaging would include the entire source + node_modules, making
    // "Copying files" + "Finalizing package" (asar) extremely slow or hang.
    ignore: (file: string | undefined) => {
      if (!file) return false;
      // Our extra excludes (marketing/ etc. - these are not part of the Electron app)
      if (/[/\\]marketing($|[/\\])/.test(file) || /\.bak$/.test(file) || /[/\\]out($|[/\\])/.test(file) || /[/\\]\.git($|[/\\])/.test(file)) {
        return true;
      }
      // Replicate the webpack plugin's default logic: only keep things under .webpack/
      // (the plugin normally sets a function that does exactly this + some stats handling)
      if (/[^/\\]+\.js\.map$/.test(file)) {
        return true;
      }
      return !/^[/\\]\.webpack($|[/\\]).*$/.test(file);
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'OrbitAI',
      authors: 'Jayakrishnan PS',
      description: 'Lightweight AI-powered desktop code editor',
      // setupIcon: 'icon.ico', // add later for branded installer
      // iconUrl: 'https://.../icon.ico',
    }, ['win32']),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer/main.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
              config: preloadConfig,
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;

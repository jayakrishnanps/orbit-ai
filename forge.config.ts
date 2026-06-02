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

const config = {
  packagerConfig: {
    asar: true,
    asarUnpack: ['**/node-pty/**', '**/native_modules/**/*.node', '**/*.node'],
    ignore: (file: string | undefined) => {
      if (!file) return false;
      if (/[/\\]marketing($|[/\\])/.test(file) || /\.bak$/.test(file) || /[/\\]out($|[/\\])/.test(file) || /[/\\]\.git($|[/\\])/.test(file)) {
        return true;
      }
      if (/[^/\\]+\.js\.map$/.test(file)) {
        return true;
      }
      return !/^[/\\]\.webpack($|[/\\]).*$/.test(file);
    },
  } as any,
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'OrbitAI',
      authors: 'Jayakrishnan PS',
      description: 'Lightweight AI-powered desktop code editor',
    }, ['win32']),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      port: 3001,
      loggerPort: 9001,
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

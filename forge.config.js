const webpack = require('webpack');

module.exports = {
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer/main.tsx',
              name: 'main_window',
              preload: {
                js: './src/preload.ts',
                config: './webpack.preload.config.js',
              },
            },
          ],
        },
      },
    },
  ],
};

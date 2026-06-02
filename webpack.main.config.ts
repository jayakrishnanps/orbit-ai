import type { Configuration } from 'webpack';
import * as path from 'path';
import * as webpack from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',
  target: 'electron-main',
  devtool: 'source-map',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    new webpack.DefinePlugin({
      __dirname: JSON.stringify(__dirname),
      __filename: JSON.stringify(__filename),
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, '.webpack/main'),
  },
  node: {
    __dirname: true,
    __filename: true,
  },
  externals: {
    'node-pty': 'commonjs node-pty',
  },
};

import type { Configuration } from 'webpack';
import * as path from 'path';
import * as webpack from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

export const mainConfig: Configuration = {
  entry: './src/index.ts',
  target: 'electron-main',
  devtool: 'source-map',
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

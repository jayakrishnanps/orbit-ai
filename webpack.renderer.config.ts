import type { Configuration } from 'webpack';
import * as path from 'path';
import * as webpack from 'webpack';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

import { rules } from './webpack.rules';
import { plugins as basePlugins } from './webpack.plugins';

// Add CSS rule for renderer (not needed in main)
const rendererRules = [
  ...rules,
  {
    test: /\.css$/,
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
  },
];

const rendererPlugins = [
  ...basePlugins,
  new MonacoWebpackPlugin({
    languages: ['typescript', 'javascript', 'json', 'markdown'],
  }),
  new webpack.DefinePlugin({
    __dirname: JSON.stringify(''),
    __filename: JSON.stringify(''),
  }),
];

export const rendererConfig: Configuration = {
  target: 'web',
  devtool: 'source-map',
  module: {
    rules: rendererRules,
  },
  plugins: rendererPlugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '.webpack/renderer'),
    publicPath: './',
    globalObject: 'self',
  },
  node: {
    __dirname: true,
    __filename: true,
  },
};

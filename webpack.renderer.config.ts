import type { Configuration } from 'webpack';
import * as path from 'path';
import * as webpack from 'webpack';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

import { plugins as basePlugins } from './webpack.plugins';

const rendererRules = [
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  },
  {
    test: /\.(woff|woff2|eot|ttf|otf)$/,
    type: 'asset/resource',
  },
  {
    test: /\.svg$/,
    type: 'asset/resource',
  },
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
    publicPath: '../',
    globalObject: 'self',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};

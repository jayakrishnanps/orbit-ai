import type { Configuration } from 'webpack';
import * as path from 'path';
import * as webpack from 'webpack';

export const preloadConfig: Configuration = {
  entry: './src/preload.ts',
  target: 'electron-preload',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: 'tsconfig.json',
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'preload.js',
    path: path.resolve(__dirname, '.webpack/renderer/main_window'),
  },
  node: {
    __dirname: true,
    __filename: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      __dirname: JSON.stringify(__dirname),
      __filename: JSON.stringify(__filename),
    }),
  ],
};

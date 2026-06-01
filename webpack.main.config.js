const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.ts',
  target: 'electron-main',
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
      {
        test: /\.node$/,
        use: [
          {
            loader: '@vercel/webpack-asset-relocator-loader',
            options: {
              outputAssetBase: 'native_modules',
              // This is important for node-pty + conpty on Windows
            },
          },
          {
            loader: 'node-loader',
            options: {
              name: '[name].[ext]',
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
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
  plugins: [
    new webpack.DefinePlugin({
      __dirname: JSON.stringify(__dirname),
      __filename: JSON.stringify(__filename),
    }),
  ],
};

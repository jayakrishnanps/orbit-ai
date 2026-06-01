const path = require('path');
const webpack = require('webpack');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
  target: 'web',
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
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '.webpack/renderer'),
    publicPath: './',
  },
  node: {
    __dirname: true,
    __filename: true,
  },
  plugins: [
    new MonacoWebpackPlugin({
      languages: ['typescript', 'javascript', 'json', 'markdown'],
    }),
    new webpack.DefinePlugin({
      __dirname: JSON.stringify(''),
      __filename: JSON.stringify(''),
    }),
  ],
};

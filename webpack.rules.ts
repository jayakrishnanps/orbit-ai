import type { ModuleOptions } from 'webpack';

export const rules: Required<ModuleOptions>['rules'] = [
  // Add support for native node modules
  {
    test: /\.node$/,
    use: 'node-loader',
  },
  {
    test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
    exclude: /node_modules[/\\]monaco-editor[/\\]/,
    parser: { amd: false },
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
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
  // Monaco Editor requires TTF fonts (Codicon) and SVGs.
  // Without asset rules these binary files crash the webpack bundle.
  {
    test: /\.(woff|woff2|eot|ttf|otf)$/,
    type: 'asset/resource',
  },
  {
    test: /\.svg$/,
    type: 'asset/resource',
  },
];

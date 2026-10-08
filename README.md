# rspack `devtool` source-maps non-JS/CSS assets

With a source-map `devtool` such as `"source-map"`, rspack emits a source map for an `asset/resource` module that uses
`generator.binary: false`, and appends `//# sourceMappingURL=…` to the emitted asset. For JSON-based formats such as
glTF, the emitted file is no longer valid JSON. webpack builds the same config without touching the asset.

Versions: `@rspack/core` 2.2.8 (latest at the time of writing), `webpack` 5.111.1.

## Reproduce

```sh
npm install
npm run build   # rspack -> rspack-dist, webpack -> webpack-dist, rspack with the workaround -> rspack-workaround-dist
npm run check   # validates the emitted glTF files, exits with code 1 while the bug reproduces
```

The `*-dist` folders are committed, so the outputs can be compared without building.

## Setup

[`src/index.js`](./src/index.js) imports the same glTF (JSON) file twice. [`rspack.config.mjs`](./rspack.config.mjs) emits it
once as a text asset and once as a binary asset (the default):

```js
devtool: "source-map",
module: {
    rules: [{
        test: /\.gltf$/,
        oneOf: [
            // `import "./scene.gltf?text"`
            { resourceQuery: /text/, type: "asset/resource", generator: { filename: "text/[name][ext]", binary: false } },
            // `import "./scene.gltf"`
            { type: "asset/resource", generator: { filename: "binary/[name][ext]" } },
        ],
    }],
},
```

[`webpack.config.mjs`](./webpack.config.mjs) is the same config with a different output directory.

## Expected

`text/scene.gltf` is emitted unchanged and without a `.map` file, as with webpack: webpack's `devtool` only adds source
maps to JS and CSS files.

## Actual

```
$ npm run check
BUG  rspack-dist/text/scene.gltf              valid JSON: false  .map emitted: true
     ends with: " [] }]\n}\n\n//# sourceMappingURL=scene.gltf.map"
ok   rspack-dist/binary/scene.gltf            valid JSON: true   .map emitted: false
ok   webpack-dist/text/scene.gltf             valid JSON: true   .map emitted: false
ok   webpack-dist/binary/scene.gltf           valid JSON: true   .map emitted: false
ok   rspack-workaround-dist/text/scene.gltf   valid JSON: true   .map emitted: false
ok   rspack-workaround-dist/binary/scene.gltf valid JSON: true   .map emitted: false
```

Every non-`eval` source-map `devtool` is affected:

| `devtool` | Emitted `text/scene.gltf` |
|---|---|
| `source-map`, `cheap-source-map`, `cheap-module-source-map`, `nosources-source-map` | `//# sourceMappingURL=scene.gltf.map` appended, `scene.gltf.map` emitted |
| `inline-source-map` | `//# sourceMappingURL=data:application/json;charset=utf-8;base64,…` appended |
| `hidden-source-map` | content unchanged, but `scene.gltf.map` emitted |
| `eval`, `eval-source-map` | unchanged |

## Cause

webpack's `devtool` creates `SourceMapDevToolPlugin` with `test: /\.((c|m)?js|css)($|\?)/i`
([`lib/WebpackOptionsApply.js`](https://github.com/webpack/webpack/blob/v5.111.1/lib/WebpackOptionsApply.js)). rspack's
`devtool` creates the plugin with the same options except `test`
([`packages/rspack/src/rspackOptionsApply.ts`](https://github.com/web-infra-dev/rspack/blob/v2.2.8/packages/rspack/src/rspackOptionsApply.ts)),
and without `test` the plugin processes every output asset that has a source map. A text asset has one, a binary
asset does not.

The filter is the only difference: a webpack `SourceMapDevToolPlugin` configured with `test: /\.gltf$/` corrupts
`text/scene.gltf` in exactly the same way.

## Workaround

[`rspack.workaround.config.mjs`](./rspack.workaround.config.mjs): `devtool: false` plus the plugin that
`devtool: "source-map"` creates, with webpack's filter:

```js
devtool: false,
plugins: [
    new rspack.SourceMapDevToolPlugin({
        filename: "[file].map[query]",
        test: /\.((c|m)?js|css)($|\?)/i,
        module: true,
        columns: true,
    }),
],
```

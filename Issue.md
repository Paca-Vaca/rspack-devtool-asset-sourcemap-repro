<!--
Rspack bug report: https://github.com/web-infra-dev/rspack/issues/new?template=1-bug-report.en-US.yml
Paste each section below into the matching field of the form. Paragraphs are kept on one line on purpose: GitHub renders
single newlines in issue bodies as line breaks.
-->

# Title

[Bug]: `devtool` appends `sourceMappingURL` to non-JS/CSS assets (`asset/resource` with `generator.binary: false`), unlike webpack

# System Info

```
  System:
    OS: macOS 26.5.2
    CPU: (14) arm64 Apple M4 Pro
    Memory: 440.94 MB / 48.00 GB
    Shell: 5.9 - /bin/zsh
  Binaries:
    Node: 24.14.1 - ~/.nvm/versions/node/v24.14.1/bin/node
    Yarn: 1.22.22 - ~/.nvm/versions/node/v24.14.1/bin/yarn
    npm: 11.11.0 - ~/.nvm/versions/node/v24.14.1/bin/npm
    Deno: 2.8.3 - /opt/homebrew/bin/deno
  Browsers:
    Chrome: 155.0.8059.39
    Firefox: 157.0
    Safari: 26.5.2
  npmPackages:
    @rspack/cli: 2.2.8 => 2.2.8
    @rspack/core: 2.2.8 => 2.2.8
```

# Details

With a source-map `devtool` such as `"source-map"`, Rspack emits a source map for an `asset/resource` module that uses `generator.binary: false`, and appends `//# sourceMappingURL=…` to the emitted asset. For JSON-based formats (glTF in the repro, Babylon.js `.babylon` scenes) the emitted file is no longer valid JSON and fails to load. webpack 5.111.1 builds the same config without touching the asset.

We emit these formats as text because they reference other hashed assets (textures, buffers), and real content hashing only updates hashes inside text assets (both Rspack's and webpack's `RealContentHashPlugin` skip binary sources).

Config, built with both Rspack and webpack:

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

**Expected:** `text/scene.gltf` is emitted unchanged and without a `.map` file, as with webpack: webpack's `devtool` only adds source maps to JS and CSS files.

**Actual:** Rspack appends the comment to `text/scene.gltf` and emits `text/scene.gltf.map`, a map of the file onto itself. The binary asset is not affected:

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

It is not specific to glTF: `.svg`, `.html`, `.xml`, `.txt` and `.json` files emitted as `asset/resource` with `binary: false` get the same comment and `.map` file. With the default `binary`, none of them are affected.

Every non-`eval` source-map `devtool` is affected:

| `devtool` | Emitted `text/scene.gltf` |
|---|---|
| `source-map`, `cheap-source-map`, `cheap-module-source-map`, `nosources-source-map` | `//# sourceMappingURL=scene.gltf.map` appended, `scene.gltf.map` emitted |
| `inline-source-map` | `//# sourceMappingURL=data:application/json;charset=utf-8;base64,…` appended |
| `hidden-source-map` | content unchanged, but `scene.gltf.map` emitted |
| `eval`, `eval-source-map` | unchanged |

**Cause:** webpack's `devtool` creates `SourceMapDevToolPlugin` with a JS/CSS filter ([`lib/WebpackOptionsApply.js`](https://github.com/webpack/webpack/blob/v5.111.1/lib/WebpackOptionsApply.js#L466-L486)):

```js
const assetExt =
  type === "javascript"
    ? /\.((c|m)?js)($|\?)/i
    : type === "css"
      ? /\.(css)($|\?)/i
      : /\.((c|m)?js|css)($|\?)/i;

new Plugin({
  test: evalWrapped ? undefined : assetExt,
  // ...
}).apply(compiler);
```

Rspack's `devtool` handling ([`packages/rspack/src/rspackOptionsApply.ts`](https://github.com/web-infra-dev/rspack/blob/v2.2.8/packages/rspack/src/rspackOptionsApply.ts#L223-L234), unchanged on `main`) creates the plugin with the same options except `test`. Without `test` the plugin processes every output asset that has a source map ([docs](https://rspack.rs/plugins/source-map-dev-tool-plugin): "When omitted, `test` does not filter output assets"). A text asset has one, a binary asset does not. The filter is the only difference: a webpack `SourceMapDevToolPlugin` configured with `test: /\.gltf$/` corrupts `text/scene.gltf` in exactly the same way.

**Suggested fix:** pass webpack's filter from `devtool`:

```diff
 new Plugin({
+  test: evalWrapped ? undefined : /\.((c|m)?js|css)($|\?)/i,
   filename: inline ? null : options.output.sourceMapFilename,
```

An explicitly created `SourceMapDevToolPlugin` also defaults differently from webpack's (no filter instead of `/\.((c|m)?js|css)($|\?)/i`), but Rspack documents that default, so this issue is only about `devtool`.

**Workaround:** `devtool: false` plus a `SourceMapDevToolPlugin` with webpack's filter:

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

# Reproduce link

https://github.com/Paca-Vaca/rspack-devtool-asset-sourcemap-repro

# Reproduce Steps

1. `npm install`
2. `npm run build`: builds `rspack-dist` (Rspack), `webpack-dist` (webpack) and `rspack-workaround-dist` (Rspack with the workaround).
3. `npm run check`: `rspack-dist/text/scene.gltf` is reported as invalid JSON with a `.map` file; the webpack and workaround outputs are valid. The `*-dist` folders are committed, so the outputs can also be compared on GitHub.

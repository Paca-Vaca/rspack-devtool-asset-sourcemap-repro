import path from "node:path";
import { fileURLToPath } from "node:url";

import { rspack } from "@rspack/core";

import config from "./rspack.config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Workaround: `devtool: false` plus the SourceMapDevToolPlugin that `devtool: "source-map"` creates, with the
 * `test` that webpack's `devtool` passes to it.
 */
export default {
    ...config,
    output: {
        ...config.output,
        path: path.resolve(__dirname, "rspack-workaround-dist"),
    },
    devtool: false,
    plugins: [
        new rspack.SourceMapDevToolPlugin({
            filename: "[file].map[query]",
            test: /\.((c|m)?js|css)($|\?)/i,
            module: true,
            columns: true,
        }),
    ],
};

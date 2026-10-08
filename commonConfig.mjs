import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function createCommonConfig(name) {
    return  {
        mode: "development",
        devtool: "source-map",
        entry: "./src/index.js",
        output: {
            path: path.resolve(__dirname, name),
            clean: true,
        },
        module: {
            rules: [
                {
                    test: /\.gltf$/,
                    oneOf: [
                        {
                            // `import "./scene.gltf?text"`: emitted as a text asset
                            resourceQuery: /text/,
                            type: "asset/resource",
                            generator: {
                                filename: "text/[name][ext]",
                                binary: false,
                            },
                        },
                        {
                            // `import "./scene.gltf"`: emitted as a binary asset (the default)
                            type: "asset/resource",
                            generator: {
                                filename: "binary/[name][ext]",
                            },
                        },
                    ],
                },
            ],
        },
    };
}
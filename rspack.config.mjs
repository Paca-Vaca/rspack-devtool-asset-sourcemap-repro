import path from "node:path";
import { fileURLToPath } from "node:url";
import createCommonConfig from "./commonConfig.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @type {import("@rspack/core").Configuration}
 */

export default createCommonConfig("rspack-dist");

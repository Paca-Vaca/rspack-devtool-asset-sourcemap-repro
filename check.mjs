// Checks the emitted glTF files: each one should be valid JSON and have no source map.
// Exits with code 1 while the bug reproduces.
import fs from "node:fs";

const outputs = ["rspack-dist", "webpack-dist", "rspack-workaround-dist"];
const files = ["text/scene.gltf", "binary/scene.gltf"];
let reproduced = false;

for (const output of outputs) {
    for (const file of files) {
        const filePath = `${output}/${file}`;
        if (!fs.existsSync(filePath)) {
            console.log(`?    ${filePath} is missing, run \`npm run build\` first`);
            continue;
        }

        const content = fs.readFileSync(filePath, "utf8");
        const mapEmitted = fs.existsSync(`${filePath}.map`);
        let validJson = true;
        try {
            JSON.parse(content);
        } catch {
            validJson = false;
        }

        const ok = validJson && !mapEmitted;
        reproduced ||= !ok;
        console.log(`${ok ? "ok  " : "BUG "} ${filePath.padEnd(40)} valid JSON: ${String(validJson).padEnd(6)} .map emitted: ${mapEmitted}`);
        if (!validJson) {
            console.log(`     ends with: ${JSON.stringify(content.slice(-45))}`);
        }
    }
}

process.exitCode = reproduced ? 1 : 0;

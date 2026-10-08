// The same glTF (JSON) file, emitted twice as `asset/resource` - see the rules in rspack.config.mjs.
import textAssetUrl from "./scene.gltf?text";
import binaryAssetUrl from "./scene.gltf";

console.log({ textAssetUrl, binaryAssetUrl });

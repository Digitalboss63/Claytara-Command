import { build } from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

await build({
  entryPoints: [resolve(root, "server/index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: resolve(root, "dist/server.mjs"),
  // No banner — let esbuild inject __dirname/__filename shims via inject
  // and use createRequire only for packages that need CJS require().
  // Mark all node_modules as external — avoids CJS/ESM bundling conflicts
  // with express, depd, and other CJS packages that use dynamic require().
  packages: "external",
});

console.log("Server build complete → dist/server.mjs");

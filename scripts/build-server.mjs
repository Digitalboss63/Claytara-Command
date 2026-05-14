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
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
    `.trim(),
  },
  external: ["postgres", "@neondatabase/serverless"],
});

console.log("Server build complete → dist/server.mjs");

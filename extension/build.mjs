/**
 * Bundles extension/src/*.js into extension/dist/, which is what manifest.json
 * and popup.html actually load. @clerk/chrome-extension is an npm package, so
 * the popup can't load it directly from a <script> tag — hence a bundler.
 *
 *   node extension/build.mjs          one-off build
 *   node extension/build.mjs --watch  rebuild on save
 */
import * as esbuild from "esbuild";

const options = {
  entryPoints: ["extension/src/popup.js"],
  outdir: "extension/dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  // Clerk's browser build branches on NODE_ENV; minify keeps the bundle
  // from shipping its whole dev path (4.8mb -> ~1mb).
  define: { "process.env.NODE_ENV": '"production"' },
  minify: true,
  sourcemap: true,
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("watching extension/src...");
} else {
  await esbuild.build(options);
}

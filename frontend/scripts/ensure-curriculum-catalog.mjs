/**
 * Copy repo-root data/curriculum/catalog_from_pdfs.json → public/curriculum/catalog.json
 * so Vercel ships bundled textbook structure without relying on the Python backend.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const src = path.join(repoRoot, "data", "curriculum", "catalog_from_pdfs.json");
const destDir = path.join(frontendRoot, "public", "curriculum");
const dest = path.join(destDir, "catalog.json");

if (!fs.existsSync(src)) {
  console.warn("[ensure-curriculum-catalog] Skip: missing", src);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
const doc = JSON.parse(fs.readFileSync(src, "utf-8"));
for (const b of doc.books ?? []) {
  if (b.meta && typeof b.meta === "object" && "pdf" in b.meta) {
    delete b.meta.pdf;
  }
}
fs.writeFileSync(dest, JSON.stringify(doc), "utf-8");
const stat = fs.statSync(dest);
console.log("[ensure-curriculum-catalog] Wrote", dest, `(${(stat.size / 1024).toFixed(0)} KB)`);

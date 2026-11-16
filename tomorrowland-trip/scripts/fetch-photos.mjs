/**
 * Fetch Deezer artist profile pictures into assets/artists and write js/photos.js
 * Uses curl.exe for better Windows network compatibility.
 * Run: node scripts/fetch-photos.mjs
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "artists");
const list = JSON.parse(fs.readFileSync(path.join(__dirname, "base-artists.json"), "utf8"));
const tmp = path.join(__dirname, "_tmp.json");

fs.mkdirSync(outDir, { recursive: true });

function slug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function curlJson(url) {
  const r = spawnSync(
    "curl.exe",
    ["-fsSL", "--connect-timeout", "20", "--max-time", "40", "-A", "Mozilla/5.0", "-o", tmp, url],
    { encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error(r.stderr || "curl failed");
  return JSON.parse(fs.readFileSync(tmp, "utf8"));
}

function curlFile(url, dest) {
  const r = spawnSync(
    "curl.exe",
    ["-fsSL", "--connect-timeout", "20", "--max-time", "40", "-A", "Mozilla/5.0", "-o", dest, url],
    { encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error(r.stderr || "curl download failed");
  const size = fs.statSync(dest).size;
  if (size < 500) {
    fs.unlinkSync(dest);
    throw new Error("file too small");
  }
}

const map = {};
const failed = [];

for (const name of list) {
  const key = name.toUpperCase();
  const file = `${slug(name)}.jpg`;
  const dest = path.join(outDir, file);
  process.stdout.write(`→ ${name} ... `);
  try {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
      map[key] = `assets/artists/${file}`;
      console.log("cached");
      continue;
    }
    const q = encodeURIComponent(name.replace(/\./g, " "));
    const data = curlJson(`https://api.deezer.com/search/artist?q=${q}&limit=8`);
    const items = data.data || [];
    const lower = name.toLowerCase();
    const firstToken = lower.split(/\s+/)[0];
    const best =
      items.find((a) => (a.name || "").toLowerCase() === lower) ||
      items.find((a) => (a.name || "").toLowerCase().startsWith(firstToken)) ||
      items.find((a) => (a.name || "").toLowerCase().includes(firstToken)) ||
      items[0];
    const pic = best?.picture_medium || best?.picture_big;
    if (!pic) throw new Error("no picture");
    curlFile(pic, dest);
    map[key] = `assets/artists/${file}`;
    console.log("OK");
  } catch (e) {
    console.log("FAIL", e.message);
    failed.push(name);
  }
}

try {
  fs.unlinkSync(tmp);
} catch (_) {}

const js = `/* Auto-generated Deezer artist profile photos (not album covers). */\nwindow.ARTIST_PHOTOS = ${JSON.stringify(map, null, 2)};\n`;
fs.writeFileSync(path.join(root, "js", "photos.js"), js);
console.log("\nSaved", Object.keys(map).length, "photos;", failed.length, "failed");
if (failed.length) console.log(failed.join(", "));

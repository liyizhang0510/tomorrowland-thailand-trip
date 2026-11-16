/**
 * 从网易云拉取艺人头像到 assets/artists，并生成 js/photos.js
 * node scripts/fetch-photos-cn.mjs
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "artists");
const list = JSON.parse(fs.readFileSync(path.join(__dirname, "base-artists.json"), "utf8"));
const tmpJson = path.join(__dirname, "_ne.json");
const tmpImg = path.join(__dirname, "_ne.jpg");

fs.mkdirSync(outDir, { recursive: true });

function slug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function curlTo(url, dest, extra = []) {
  const r = spawnSync(
    "curl.exe",
    [
      "-fsSL",
      "--connect-timeout",
      "15",
      "--max-time",
      "35",
      "-A",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "-H",
      "Referer: https://music.163.com/",
      ...extra,
      "-o",
      dest,
      url,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error((r.stderr || "curl failed").trim() || "curl failed");
}

function searchArtist(name) {
  const q = encodeURIComponent(name);
  const url = `https://music.163.com/api/search/get/web?csrf_token=&type=100&s=${q}&offset=0&limit=8`;
  curlTo(url, tmpJson);
  const data = JSON.parse(fs.readFileSync(tmpJson, "utf8"));
  const items = data?.result?.artists || [];
  if (!items.length) return null;
  const lower = name.toLowerCase();
  const first = lower.split(/\s+/)[0];
  return (
    items.find((a) => (a.name || "").toLowerCase() === lower) ||
    items.find((a) => (a.name || "").toLowerCase().startsWith(first)) ||
    items.find((a) => (a.alias || []).some((x) => String(x).toLowerCase().includes(first))) ||
    items[0]
  );
}

function pickUrl(artist) {
  let url = artist.img1v1Url || artist.picUrl;
  if (!url) return null;
  // 去掉默认占位
  if (url.includes("default") || url.includes("569227")) return artist.picUrl || url;
  // 统一成稍大尺寸参数（网易云支持 param）
  if (!url.includes("param=")) url = `${url}?param=200y200`;
  else url = url.replace(/param=\d+y\d+/, "param=200y200");
  return url;
}

function sleep(ms) {
  spawnSync("powershell", ["-NoProfile", "-Command", `Start-Sleep -Milliseconds ${ms}`], {
    stdio: "ignore",
  });
}

const map = {};
const failed = [];

for (const name of list) {
  const key = name.toUpperCase();
  const file = `${slug(name)}.jpg`;
  const dest = path.join(outDir, file);
  process.stdout.write(`→ ${name} ... `);
  try {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 800) {
      map[key] = `assets/artists/${file}`;
      console.log("cached");
      continue;
    }
    let artist = null;
    for (let attempt = 0; attempt < 3 && !artist; attempt++) {
      if (attempt) sleep(1200 * attempt);
      artist = searchArtist(name);
      if (!artist) sleep(800);
    }
    if (!artist) throw new Error("not found");
    const url = pickUrl(artist);
    if (!url) throw new Error("no url");
    curlTo(url, tmpImg);
    const size = fs.statSync(tmpImg).size;
    if (size < 800) throw new Error("tiny file");
    fs.copyFileSync(tmpImg, dest);
    map[key] = `assets/artists/${file}`;
    console.log("OK", artist.name);
  } catch (e) {
    console.log("FAIL", e.message);
    failed.push(name);
  }
  sleep(700);
}

for (const f of [tmpJson, tmpImg]) {
  try {
    fs.unlinkSync(f);
  } catch (_) {}
}

const js = `/* 网易云艺人头像（本地缓存）。个别不准可再替换。 */\nwindow.ARTIST_PHOTOS = ${JSON.stringify(map, null, 2)};\n`;
fs.writeFileSync(path.join(root, "js", "photos.js"), js);
console.log(`\nDone: ${Object.keys(map).length} ok, ${failed.length} failed`);
if (failed.length) console.log("Failed:", failed.join(", "));

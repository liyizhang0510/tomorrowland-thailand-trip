/**
 * 用 QQ 音乐搜歌手 mid，下载国内 CDN 头像到 assets/artists，生成 js/photos.js
 * node scripts/fetch-photos-qq.mjs
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "artists");
const list = JSON.parse(fs.readFileSync(path.join(__dirname, "base-artists.json"), "utf8"));
const tmpJson = path.join(__dirname, "_qq.json");
const tmpImg = path.join(__dirname, "_qq.jpg");

fs.mkdirSync(outDir, { recursive: true });

function slug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sleep(ms) {
  spawnSync("powershell", ["-NoProfile", "-Command", `Start-Sleep -Milliseconds ${ms}`], {
    stdio: "ignore",
  });
}

function curlTo(url, dest, extra = []) {
  const r = spawnSync(
    "curl.exe",
    [
      "-fsSL",
      "--connect-timeout",
      "15",
      "--max-time",
      "40",
      "-A",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      ...extra,
      "-o",
      dest,
      url,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error((r.stderr || "curl failed").toString().trim() || "curl failed");
}

function findSingerMid(name) {
  const q = encodeURIComponent(name.replace(/\./g, " "));
  const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${q}&format=json&p=1&n=8&cr=1&t=0`;
  curlTo(url, tmpJson, ["-H", "Referer: https://y.qq.com/"]);
  const data = JSON.parse(fs.readFileSync(tmpJson, "utf8"));
  const songs = data?.data?.song?.list || [];
  const lower = name.toLowerCase();
  const first = lower.split(/\s+/)[0];

  // 优先精确匹配歌手名
  for (const song of songs) {
    const singers = song.singer || [];
    const hit =
      singers.find((s) => (s.name || "").toLowerCase() === lower) ||
      singers.find((s) => (s.name || "").toLowerCase().includes(lower)) ||
      singers.find((s) => (s.name || "").toLowerCase().startsWith(first));
    if (hit?.mid) return { mid: hit.mid, name: hit.name };
  }
  // 退而取第一首歌的第一歌手（仅当名字沾边）
  const s0 = songs[0]?.singer?.[0];
  if (s0?.mid && (s0.name || "").toLowerCase().includes(first)) {
    return { mid: s0.mid, name: s0.name };
  }
  return null;
}

function avatarUrl(mid) {
  return `https://y.gtimg.cn/music/photo_new/T001R300x300M000${mid}.jpg`;
}

const map = {};
const failed = [];

// 已有文件先收进 map
for (const name of list) {
  const key = name.toUpperCase();
  const file = `${slug(name)}.jpg`;
  const dest = path.join(outDir, file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) {
    map[key] = `assets/artists/${file}`;
  }
}

for (const name of list) {
  const key = name.toUpperCase();
  const file = `${slug(name)}.jpg`;
  const dest = path.join(outDir, file);
  process.stdout.write(`→ ${name} ... `);

  if (map[key] && fs.existsSync(dest) && fs.statSync(dest).size > 800) {
    console.log("cached");
    continue;
  }

  try {
    let singer = null;
    for (let i = 0; i < 3 && !singer; i++) {
      if (i) sleep(1000 * i);
      singer = findSingerMid(name);
    }
    if (!singer) throw new Error("no singer");
    const url = avatarUrl(singer.mid);
    curlTo(url, tmpImg, ["-H", "Referer: https://y.qq.com/"]);
    const size = fs.statSync(tmpImg).size;
    if (size < 800) throw new Error("tiny " + size);
    fs.copyFileSync(tmpImg, dest);
    map[key] = `assets/artists/${file}`;
    console.log("OK", singer.name);
  } catch (e) {
    console.log("FAIL", e.message);
    failed.push(name);
  }
  sleep(450);
}

for (const f of [tmpJson, tmpImg]) {
  try {
    fs.unlinkSync(f);
  } catch (_) {}
}

const js = `/* QQ音乐歌手头像本地缓存（国内可访问）。个别不准可再换。 */\nwindow.ARTIST_PHOTOS = ${JSON.stringify(map, null, 2)};\n`;
fs.writeFileSync(path.join(root, "js", "photos.js"), js);
console.log(`\nDone: ${Object.keys(map).length} ok, ${failed.length} failed`);
if (failed.length) console.log("Failed:", failed.join(", "));

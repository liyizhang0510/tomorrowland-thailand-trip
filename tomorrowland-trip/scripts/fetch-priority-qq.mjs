/**
 * 优先：Main + Freedom 18:00 后艺人（QQ音乐头像）
 * node scripts/fetch-priority-qq.mjs
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "artists");
const list = JSON.parse(fs.readFileSync(path.join(__dirname, "priority-artists.json"), "utf8"));
const tmpJson = path.join(__dirname, "_qq.json");
const tmpImg = path.join(__dirname, "_qq.jpg");
const photosPath = path.join(root, "js", "photos.js");

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
  for (const song of songs) {
    const singers = song.singer || [];
    const hit =
      singers.find((s) => (s.name || "").toLowerCase() === lower) ||
      singers.find((s) => (s.name || "").toLowerCase().includes(lower)) ||
      singers.find((s) => (s.name || "").toLowerCase().startsWith(first));
    if (hit?.mid) return { mid: hit.mid, name: hit.name };
  }
  const s0 = songs[0]?.singer?.[0];
  if (s0?.mid && (s0.name || "").toLowerCase().includes(first)) {
    return { mid: s0.mid, name: s0.name };
  }
  return null;
}

function rebuildPhotosJs() {
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".jpg"));
  const byName = {};
  const bySlug = {};
  const aliases = {
    "MARTIN GARRIX": "martin-garrix",
    "STEVE AOKI": "steve-aoki",
    "ALAN WALKER": "alan-walker",
    "DIMITRI VEGAS & LIKE MIKE": "dimitri-vegas-and-like-mike",
    "SWEDISH HOUSE MAFIA": "swedish-house-mafia",
    "SUB ZERO PROJECT": "sub-zero-project",
    "LOST FREQUENCIES": "lost-frequencies",
    "DA TWEEKAZ": "da-tweekaz",
    "YELLOW CLAW": "yellow-claw",
    "KEVIN DE VRIES": "kevin-de-vries",
    "JOHN NEWMAN": "john-newman",
    "VINI VICI": "vini-vici",
    "HONEY GEE": "honey-gee",
    "AGENTS OF TIME": "agents-of-time",
    "HENRI BERGMANN": "henri-bergmann",
    "HANNAH LAING": "hannah-laing",
    "NICO MORENO": "nico-moreno",
    "AMBER BROOS": "amber-broos",
    "SPACE 92": "space-92",
    "ALY & FILA": "aly-and-fila",
    "AMÉMÉ": "am-m",
    "R3HAB": "r3hab",
  };

  for (const f of files) {
    const s = f.replace(/\.jpg$/, "");
    const p = `assets/artists/${f}`;
    bySlug[s] = p;
    const guess = s.replace(/-/g, " ").toUpperCase().replace(/ AND /g, " & ");
    byName[guess] = p;
  }
  for (const [k, s] of Object.entries(aliases)) {
    if (bySlug[s]) byName[k] = bySlug[s];
  }
  // ensure priority names map to their slug file
  for (const name of list) {
    const s = slug(name);
    if (bySlug[s]) byName[name.toUpperCase()] = bySlug[s];
  }

  const out =
    `/* 本地艺人头像（QQ音乐优先缓存） */\n` +
    `window.ARTIST_PHOTOS = ${JSON.stringify(byName, null, 2)};\n` +
    `window.ARTIST_PHOTO_BY_SLUG = ${JSON.stringify(bySlug, null, 2)};\n`;
  fs.writeFileSync(photosPath, out);
}

const ok = [];
const failed = [];

for (const name of list) {
  const key = name.toUpperCase();
  const file = `${slug(name)}.jpg`;
  const dest = path.join(outDir, file);
  process.stdout.write(`→ ${name} ... `);

  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) {
    console.log("cached");
    ok.push(name);
    continue;
  }

  try {
    let singer = null;
    for (let i = 0; i < 3 && !singer; i++) {
      if (i) sleep(900 * i);
      singer = findSingerMid(name);
    }
    if (!singer) throw new Error("no singer");
    const url = `https://y.gtimg.cn/music/photo_new/T001R300x300M000${singer.mid}.jpg`;
    curlTo(url, tmpImg, ["-H", "Referer: https://y.qq.com/"]);
    const size = fs.statSync(tmpImg).size;
    if (size < 800) throw new Error("tiny " + size);
    fs.copyFileSync(tmpImg, dest);
    console.log("OK", singer.name);
    ok.push(name);
  } catch (e) {
    console.log("FAIL", e.message);
    failed.push(name);
  }
  sleep(500);
}

rebuildPhotosJs();

for (const f of [tmpJson, tmpImg]) {
  try {
    fs.unlinkSync(f);
  } catch (_) {}
}

console.log(`\nPriority done: ${ok.length} ok, ${failed.length} failed`);
if (failed.length) console.log("Failed:", failed.join(", "));

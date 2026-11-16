/* 艺人头像：优先本地网易云缓存；无缓存则运行时再试网易云（经国内可访问方式）。 */
window.ARTIST_IMG = (() => {
  const photos = () => window.ARTIST_PHOTOS || {};

  const cache = new Map();
  const inflight = new Map();
  const queue = [];
  let active = 0;
  const MAX = 3;

  function normalize(name) {
    return String(name || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
  }

  function baseName(artist) {
    return artist.split(/\s+B2B\s+/i)[0].trim();
  }

  function toSlug(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function localPath(artist) {
    const map = photos();
    const bySlug = window.ARTIST_PHOTO_BY_SLUG || {};
    const key = normalize(artist);
    if (map[key]) return map[key];
    const left = normalize(baseName(artist));
    if (map[left]) return map[left];
    const slug = toSlug(baseName(artist));
    if (bySlug[slug]) return bySlug[slug];
    // 约定路径：即使 photos.js 未登记，也尝试本地文件
    if (bySlug[slug] === undefined) {
      // 有 slug 表时以表为准；无表时仍返回约定路径供浏览器尝试
    }
    return bySlug[slug] || null;
  }

  function pump() {
    while (active < MAX && queue.length) {
      const job = queue.shift();
      active += 1;
      Promise.resolve()
        .then(job)
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  }

  function enqueue(fn) {
    return new Promise((resolve) => {
      queue.push(async () => resolve(await fn()));
      pump();
    });
  }

  /** 网易云搜索（可能受 CORS 限制；失败则忽略） */
  async function fromNetEase(artist) {
    const q = encodeURIComponent(baseName(artist));
    const url = `https://music.163.com/api/search/get/web?csrf_token=&type=100&s=${q}&offset=0&limit=5`;
    // 部分环境可通过 no-cors 无法读 body；直接 fetch 试 CORS
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.result?.artists || [];
    if (!items.length) return null;
    const lower = baseName(artist).toLowerCase();
    const first = lower.split(/\s+/)[0];
    const best =
      items.find((a) => (a.name || "").toLowerCase() === lower) ||
      items.find((a) => (a.name || "").toLowerCase().startsWith(first)) ||
      items[0];
    let img = best?.img1v1Url || best?.picUrl;
    if (!img) return null;
    if (!img.includes("param=")) img += "?param=200y200";
    return img;
  }

  async function resolve(artist) {
    const key = normalize(artist);
    if (cache.has(key)) return cache.get(key);
    if (inflight.has(key)) return inflight.get(key);

    const p = enqueue(async () => {
      const local = localPath(artist);
      if (local) {
        cache.set(key, local);
        return local;
      }
      let src = null;
      try {
        src = await fromNetEase(artist);
      } catch (_) {}
      cache.set(key, src);
      return src;
    });

    inflight.set(key, p);
    p.finally(() => inflight.delete(key));
    return p;
  }

  function initials(artist) {
    const parts = String(artist)
      .replace(/\s+B2B\s+.*/i, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function bindLazy(root = document) {
    const nodes = [...root.querySelectorAll("img.dj-photo[data-artist]")];
    if (!nodes.length) return;

    const loadOne = async (img) => {
      if (img.dataset.loaded === "1") return;
      img.dataset.loaded = "1";
      const src = await resolve(img.dataset.artist);
      if (!src) {
        img.classList.add("fail");
        return;
      }
      img.src = src;
      img.referrerPolicy = "no-referrer";
      img.onload = () => img.classList.add("ready");
      img.onerror = () => {
        img.classList.add("fail");
        img.removeAttribute("src");
      };
    };

    // 本地图立即加载；外网图懒加载
    const eager = [];
    const lazy = [];
    nodes.forEach((img) => {
      const local = localPath(img.dataset.artist);
      if (local) eager.push(img);
      else lazy.push(img);
    });

    eager.forEach((img, i) => setTimeout(() => loadOne(img), i * 16));

    if (!lazy.length) return;

    if (!("IntersectionObserver" in window)) {
      lazy.forEach((img, i) => setTimeout(() => loadOne(img), 200 + i * 80));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          io.unobserve(img);
          loadOne(img);
        });
      },
      { rootMargin: "260px 0px", threshold: 0.01 }
    );
    lazy.forEach((img) => io.observe(img));
  }

  return { resolve, initials, bindLazy, localPath };
})();

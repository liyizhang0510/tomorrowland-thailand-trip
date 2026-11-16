(() => {
  const STORE_KEY = "tml-thailand-2026-v3";
  const TARGET = new Date("2026-12-11T13:00:00+07:00");
  const TAB_DEFS = [
    { id: "overview", label: "总览" },
    { id: "days", label: "日程" },
    { id: "ops", label: "出行" },
    { id: "lineup", label: "阵容" },
    { id: "must", label: "必看" },
  ];

  const PERSON_MIGRATE = {
    liyi: "leo",
    liangjie: "ken",
    yang: "ocreedy",
  };

  const state = {
    tab: "overview",
    person: "leo",
    dayId: "d11",
    festDay: "day1",
    stage: "all",
    onlyMine: false,
    stars: {},
    checks: {},
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function migratePersonId(id) {
    return PERSON_MIGRATE[id] || id;
  }

  function load() {
    try {
      const raw =
        localStorage.getItem(STORE_KEY) ||
        localStorage.getItem("tml-thailand-2026-v2") ||
        localStorage.getItem("tml-thailand-2026-v1");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.person) state.person = migratePersonId(data.person);
      if (data.stars) {
        const next = {};
        Object.entries(data.stars).forEach(([key, who]) => {
          next[key] = (who || []).map(migratePersonId);
        });
        state.stars = next;
      }
      if (data.checks) state.checks = data.checks;
    } catch (_) {}
  }

  function save() {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        person: state.person,
        stars: state.stars,
        checks: state.checks,
      })
    );
  }

  function setKey(day, stage, artist) {
    return `${day}|${stage}|${artist}`;
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function person() {
    return TRIP.friends.find((f) => f.id === state.person) || TRIP.friends[0];
  }

  function updateWhoBtn() {
    const p = person();
    $("#whoDot").style.background = p.color;
    $("#whoName").textContent = p.name;
  }

  function tickCountdown() {
    let diff = Math.max(0, TARGET - Date.now());
    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000);
    diff -= hours * 3600000;
    const mins = Math.floor(diff / 60000);
    diff -= mins * 60000;
    const secs = Math.floor(diff / 1000);
    $("#cdD").textContent = String(days);
    $("#cdH").textContent = String(hours).padStart(2, "0");
    $("#cdM").textContent = String(mins).padStart(2, "0");
    $("#cdS").textContent = String(secs).padStart(2, "0");
  }

  function renderTabs() {
    $$("[data-tabs]").forEach((nav) => {
      nav.innerHTML = TAB_DEFS.map(
        (t) =>
          `<button class="tab ${state.tab === t.id ? "active" : ""}" type="button" data-tab="${t.id}">${t.label}</button>`
      ).join("");
      $$(".tab", nav).forEach((btn) => {
        btn.onclick = () => switchTab(btn.dataset.tab);
      });
    });
  }

  function switchTab(tab) {
    state.tab = tab;
    $$(".panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
    renderTabs();
    if (tab === "lineup") renderLineup();
    if (tab === "days") renderDays();
    if (tab === "must") renderMust();
    if (tab === "ops") renderFlights();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function parseYMD(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function fmtYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function dayIdByDate(dateStr) {
    return TRIP.days.find((d) => d.date === dateStr)?.id || null;
  }

  function renderCalendar(mountId, opts = {}) {
    const el = $(mountId);
    if (!el) return;
    const interactive = !!opts.interactive;
    const selectedDayId = opts.selectedDayId || null;
    const selectedDate = selectedDayId
      ? TRIP.days.find((d) => d.id === selectedDayId)?.date
      : null;
    const start = parseYMD(TRIP.calendar.start);
    const marks = TRIP.calendar.marks || {};
    const days = [];
    for (let i = 0; i < TRIP.calendar.weeks * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }

    const legend = `
      <div class="cal-legend">
        <span><i style="background:#003476"></i>出发/返程</span>
        <span><i style="background:#b8860b"></i>电音节</span>
        <span><i style="background:#2a9d8f"></i>芭提雅</span>
        <span><i style="background:#5a5a8c"></i>曼谷自由</span>
      </div>`;

    el.innerHTML = `
      <div class="cal-head">
        <div class="card-title">12/07 – 12/20</div>
        <div class="card-sub">${interactive ? "点击行程日查看详情" : "覆盖全程 6 天关键节点"}</div>
      </div>
      <div class="cal-weekdays">
        <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
      </div>
      <div class="cal-grid">
        ${days
          .map((d) => {
            const key = fmtYMD(d);
            const mark = marks[key];
            const dayId = dayIdByDate(key);
            const inTrip = !!dayId;
            const cls = [
              "cal-cell",
              mark ? mark.tone : "",
              inTrip ? "trip-range" : "",
              interactive && inTrip ? "clickable" : "",
              selectedDate === key ? "selected" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const tag = interactive && inTrip ? "button" : "div";
            const attrs =
              interactive && inTrip
                ? `type="button" data-day="${dayId}" data-date="${key}"`
                : "";
            return `<${tag} class="${cls}" ${attrs}>
              <span class="n">${d.getDate()}</span>
              ${mark ? `<span class="m">${mark.label}</span>` : ""}
            </${tag}>`;
          })
          .join("")}
      </div>
      ${legend}
    `;

    if (interactive) {
      $$(".cal-cell.clickable", el).forEach((btn) => {
        btn.onclick = () => {
          state.dayId = btn.dataset.day;
          renderDays();
          const detail = $("#dayDetail");
          if (detail) detail.scrollIntoView({ behavior: "smooth", block: "start" });
        };
      });
    }
  }

  function renderHomeFlights() {
    const el = $("#homeFlights");
    const out = TRIP.flights.outbound;
    const inn = TRIP.flights.inbound;
    const outSegs = out.segments;
    const inSegs = inn.segments;

    el.innerHTML = `
      <div class="card home-flight">
        <div class="card-head">
          <div>
            <div class="card-title">去程 · ${out.date.slice(5).replace("-", "/")} ${out.weekday}</div>
            <div class="card-sub">${out.title}</div>
          </div>
          <span class="badge badge-cyan">出票</span>
        </div>
        <div class="route-line">
          <span class="big">${outSegs[0].dep} ${outSegs[0].from.code}</span>
          <span class="sub">→</span>
          <span class="big">${outSegs[0].arr} ${outSegs[0].to.code}</span>
        </div>
        <div class="sub">${outSegs[0].flight} · ${outSegs[0].aircraft || ""}</div>
        <div class="layover-bar">中转等待 ${out.layover}</div>
        <div class="route-line">
          <span class="big">${outSegs[1].dep} ${outSegs[1].from.code}</span>
          <span class="sub">→</span>
          <span class="big">${outSegs[1].arr} ${outSegs[1].to.code}</span>
        </div>
        <div class="sub">${outSegs[1].flight} · ${outSegs[1].aircraft || ""}</div>
      </div>
      <div class="card home-flight">
        <div class="card-head">
          <div>
            <div class="card-title">回程 · ${inn.date.slice(5).replace("-", "/")} ${inn.weekday}</div>
            <div class="card-sub">${inn.title}</div>
          </div>
          <span class="badge badge-cyan">出票</span>
        </div>
        <div class="route-line">
          <span class="big">${inSegs[0].dep} ${inSegs[0].from.code}</span>
          <span class="sub">→</span>
          <span class="big">${inSegs[0].arr} ${inSegs[0].to.code}</span>
        </div>
        <div class="sub">${inSegs[0].flight} · ${inSegs[0].aircraft || ""}</div>
        <div class="layover-bar">中转等待 ${inn.layover}</div>
        <div class="route-line">
          <span class="big">${inSegs[1].dep} ${inSegs[1].from.code}</span>
          <span class="sub">→</span>
          <span class="big">${inSegs[1].arr} ${inSegs[1].to.code}</span>
        </div>
        <div class="sub">${inSegs[1].flight} · ${inSegs[1].aircraft || ""}</div>
      </div>
    `;
  }

  function renderOverview() {
    $("#friendsRow").innerHTML = TRIP.friends
      .map(
        (f) =>
          `<span class="friend-chip"><i style="background:${f.color}"></i>${f.name}</span>`
      )
      .join("");

    $("#gapsBox").innerHTML = TRIP.gaps
      .map((g) => `<div class="alert"><strong>${g.title}</strong><p>${g.text}</p></div>`)
      .join("");

    renderCalendar("#calOverview");
    renderHomeFlights();

    $("#hotelCard").innerHTML = `
      <div class="card-head">
        <div>
          <div class="card-title">${TRIP.hotel.name}</div>
          <div class="card-sub">${TRIP.hotel.room}</div>
        </div>
        <span class="badge badge-gold">住宿</span>
      </div>
      <div class="kv">
        <div class="kv-row"><span>入住</span><span>12/11 周五</span></div>
        <div class="kv-row"><span>退房</span><span>12/14 周一</span></div>
        <div class="kv-row"><span>地址</span><span>${TRIP.hotel.address}</span></div>
        <div class="kv-row"><span>电话</span><span>${TRIP.hotel.phone}</span></div>
      </div>
      <p class="muted" style="margin-top:10px">${TRIP.hotel.note}</p>
      <a class="link-btn" target="_blank" rel="noopener"
        href="https://maps.apple.com/?q=${encodeURIComponent(TRIP.hotel.mapsQuery)}">打开地图导航</a>
    `;

    $("#eventCard").innerHTML = `
      <div class="card-head">
        <div>
          <div class="card-title">${TRIP.event.name}</div>
          <div class="card-sub">${TRIP.event.pass}</div>
        </div>
        <span class="badge badge-cyan">电音节</span>
      </div>
      <div class="kv">
        <div class="kv-row"><span>场地</span><span>${TRIP.event.venue}</span></div>
        <div class="kv-row"><span>周五六</span><span>${TRIP.event.hours.friSat}</span></div>
        <div class="kv-row"><span>周日</span><span>${TRIP.event.hours.sun}</span></div>
        <div class="kv-row"><span>核验截止</span><span>五六 ${TRIP.event.checkInClose.friSat} / 日 ${TRIP.event.checkInClose.sun}</span></div>
      </div>
      <p class="muted" style="margin-top:10px">${TRIP.event.venueNote}</p>
      <ul class="tip-list" style="margin-top:12px">
        ${TRIP.event.rules.map((r) => `<li>${r}</li>`).join("")}
      </ul>
      <a class="link-btn" target="_blank" rel="noopener"
        href="https://maps.apple.com/?q=${encodeURIComponent(TRIP.event.venueAddress)}">导航到会场</a>
    `;

    $("#tipsList").innerHTML = TRIP.tips.map((t) => `<li>${t}</li>`).join("");
  }

  function renderDays() {
    renderCalendar("#calDays", {
      interactive: true,
      selectedDayId: state.dayId,
    });

    const day = TRIP.days.find((d) => d.id === state.dayId);
    const box = $("#dayDetail");
    if (!day) return;

    const highlights = day.highlights
      ? `<div class="chips">${day.highlights.map((h) => `<span class="chip">${h}</span>`).join("")}</div>`
      : "";
    const lineupBtn = day.festival
      ? `<button class="link-btn" id="gotoLineup">查看当日完整阵容</button>`
      : "";

    box.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${day.label} ${day.weekday} · ${day.theme}</div>
            <div class="card-sub">${day.summary}</div>
          </div>
          <span class="badge badge-gold">${day.tag}</span>
        </div>
        <div class="timeline">
          ${day.blocks
            .map(
              (b) => `
            <div class="tl-item">
              <div class="tl-time">${b.time}</div>
              <div class="tl-title">${b.title}</div>
              <div class="tl-detail">${b.detail}</div>
            </div>`
            )
            .join("")}
        </div>
        ${highlights}
        ${lineupBtn}
      </div>
    `;

    const go = $("#gotoLineup");
    if (go) {
      go.onclick = () => {
        state.festDay = day.festival;
        state.stage = "all";
        state.onlyMine = false;
        switchTab("lineup");
      };
    }
  }

  function segmentCard(s) {
    return `
      <div class="card flight-card">
        ${s.changeNote ? `<div class="flight-change">航班变更 · ${s.changeNote}</div>` : ""}
        <div class="card-head">
          <div>
            <div class="card-title">${s.flight} · ${s.airline}</div>
            <div class="card-sub">${s.from.city} → ${s.to.city}${s.aircraft ? ` · ${s.aircraft}` : ""}</div>
          </div>
          <span class="badge badge-ok">出票完成</span>
        </div>
        <div class="flight-route">
          <div class="airport">
            <div class="time">${s.dep}</div>
            <div class="code">${s.from.code}</div>
            <div class="name">${s.from.name}</div>
          </div>
          <div class="flight-mid">
            <div class="plane">✈</div>
            <div>${s.duration}</div>
          </div>
          <div class="airport right">
            <div class="time">${s.arr}</div>
            <div class="code">${s.to.code}</div>
            <div class="name">${s.to.name}</div>
          </div>
        </div>
        <div class="flight-meta">
          ${s.aircraft ? `<span>机型 ${s.aircraft}</span>` : ""}
          <span>${s.baggage}</span>
          ${s.timezoneNote ? `<span>${s.timezoneNote}</span>` : ""}
          ${s.aircraftNote ? `<span>${s.aircraftNote}</span>` : ""}
        </div>
      </div>`;
  }

  function renderFlight(leg, mountId) {
    const el = $(mountId);
    const [a, b] = leg.segments;
    el.innerHTML = `
      <div class="section-label" style="margin-top:4px">${leg.date.slice(5).replace("-", "/")} ${leg.weekday} · ${leg.title}</div>
      ${segmentCard(a)}
      <div class="layover-bar">中转等待 ${leg.layover}${leg.layoverNote ? ` · ${leg.layoverNote}` : ""}</div>
      ${segmentCard(b)}
      <div class="card">
        <div class="card-title" style="margin-bottom:8px">出行提醒</div>
        <ul class="tip-list">
          ${leg.tips.map((t) => `<li>${t}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderFlights() {
    renderFlight(TRIP.flights.outbound, "#flightOut");
    renderFlight(TRIP.flights.inbound, "#flightIn");
  }

  function avatarHtml(artist) {
    const mono = ARTIST_IMG.initials(artist);
    return `
      <div class="dj-avatar" aria-hidden="true">
        <span class="mono">${mono}</span>
        <img class="dj-photo" alt="" data-artist="${artist.replace(/"/g, "&quot;")}" loading="lazy" decoding="async" width="52" height="52" />
      </div>`;
  }

  function genresFor(artist, stage) {
    const map = TRIP.genres || {};
    let tags = map[artist];
    if (!tags) {
      const left = artist.split(/\s+B2B\s+/i)[0].trim();
      tags = map[left];
    }
    if (!tags || !tags.length) {
      tags = (TRIP.stageGenreFallback && TRIP.stageGenreFallback[stage]) || ["EDM"];
    }
    return tags.slice(0, 3);
  }

  function genreHtml(artist, stage) {
    const tags = genresFor(artist, stage);
    return `<div class="genre-row">${tags
      .map((g) => `<span class="genre-tag">${g}</span>`)
      .join("")}</div>`;
  }

  function djMagRank(artist) {
    const map = TRIP.djMag || {};
    const key = String(artist || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    if (map[key]) return map[key];
    const left = key.split(/\s+B2B\s+/)[0];
    return map[left] || null;
  }

  function artistTitleHtml(artist) {
    const rank = djMagRank(artist);
    const badge = rank
      ? `<span class="djmag-badge" title="DJ Mag Top 100 ${TRIP.djMagYear || 2026}">DJ Mag No.${rank}</span>`
      : "";
    return `<div class="set-artist-row"><div class="set-artist">${artist}</div>${badge}</div>`;
  }

  function timeVal(t) {
    const [h, m] = t.split(":").map(Number);
    const hh = h < 6 ? h + 24 : h;
    return hh * 60 + m;
  }

  function renderLineup() {
    const dayTabs = $("#festDays");
    const days = [
      { id: "day1", label: "12/11 周五" },
      { id: "day2", label: "12/12 周六" },
      { id: "day3", label: "12/13 周日" },
    ];
    dayTabs.innerHTML = days
      .map(
        (d) =>
          `<button class="filter-btn ${state.festDay === d.id ? "active" : ""}" data-fd="${d.id}">${d.label}</button>`
      )
      .join("");
    $$(".filter-btn", dayTabs).forEach((b) => {
      b.onclick = () => {
        state.festDay = b.dataset.fd;
        renderLineup();
      };
    });

    const stageRow = $("#stageFilters");
    stageRow.innerHTML =
      `<button class="filter-btn ${state.stage === "all" ? "active" : ""}" data-st="all">全部舞台</button>` +
      TRIP.stages
        .map(
          (s) =>
            `<button class="filter-btn ${state.stage === s.id ? "active" : ""}" data-st="${s.id}">${s.short}</button>`
        )
        .join("");
    $$(".filter-btn", stageRow).forEach((b) => {
      b.onclick = () => {
        state.stage = b.dataset.st;
        renderLineup();
      };
    });

    const mineBtn = $("#onlyMineBtn");
    mineBtn.classList.toggle("active", state.onlyMine);
    mineBtn.textContent = state.onlyMine ? "只看我的 ★" : "全部场次";

    const stageName = (id) => TRIP.stages.find((s) => s.id === id)?.name || id;
    let sets = (TRIP.lineup[state.festDay] || []).filter(
      (x) => state.stage === "all" || x.stage === state.stage
    );
    if (state.onlyMine) {
      sets = sets.filter((x) =>
        (state.stars[setKey(state.festDay, x.stage, x.artist)] || []).includes(state.person)
      );
    }
    // 倒序：越晚出场越靠前（头牌在上）
    sets = [...sets].sort((a, b) => timeVal(b.start) - timeVal(a.start));

    const mount = $("#setList");
    if (!sets.length) {
      mount.innerHTML = `<div class="empty">暂无场次 · 试试切换舞台或取消「只看我的」</div>`;
      return;
    }

    mount.innerHTML = sets
      .map((x) => {
        const key = setKey(state.festDay, x.stage, x.artist);
        const who = state.stars[key] || [];
        const on = who.includes(state.person);
        const dots = who
          .map((id) => {
            const f = TRIP.friends.find((p) => p.id === id);
            return f ? `<span style="background:${f.color}" title="${f.name}"></span>` : "";
          })
          .join("");
        return `
        <div class="set-item ${on ? "starred" : ""}">
          ${avatarHtml(x.artist)}
          <div>
            ${artistTitleHtml(x.artist)}
            ${genreHtml(x.artist, x.stage)}
            <div class="set-meta">${x.start}–${x.end} · ${stageName(x.stage)}</div>
            <div class="stars-who">${dots}</div>
          </div>
          <button class="star-btn ${on ? "on" : ""}" aria-label="收藏" data-key="${key}">★</button>
        </div>`;
      })
      .join("");

    $$(".star-btn", mount).forEach((btn) => {
      btn.onclick = () => toggleStar(btn.dataset.key);
    });

    updateMustCount();
    ARTIST_IMG.bindLazy(mount);
  }

  function toggleStar(key) {
    const arr = new Set(state.stars[key] || []);
    if (arr.has(state.person)) arr.delete(state.person);
    else arr.add(state.person);
    state.stars[key] = [...arr];
    if (!state.stars[key].length) delete state.stars[key];
    save();
    renderLineup();
    if (state.tab === "must") renderMust();
  }

  function updateMustCount() {
    const n = Object.values(state.stars).filter((arr) => arr.includes(state.person)).length;
    $("#mustCount").textContent = `${person().name} · ${n} 场`;
  }

  function renderMust() {
    updateMustCount();
    const mount = $("#mustList");
    const entries = Object.entries(state.stars)
      .filter(([, who]) => who.length)
      .map(([key, who]) => {
        const [day, stage, artist] = key.split("|");
        return { key, day, stage, artist, who };
      })
      .sort(
        (a, b) =>
          a.day.localeCompare(b.day) ||
          timeVal(
            (TRIP.lineup[b.day] || []).find((x) => x.artist === b.artist && x.stage === b.stage)
              ?.start || "13:00"
          ) -
            timeVal(
              (TRIP.lineup[a.day] || []).find((x) => x.artist === a.artist && x.stage === a.stage)
                ?.start || "13:00"
            )
      );

    if (!entries.length) {
      mount.innerHTML = `<div class="empty">还没有必看场次。<br>去「阵容」页点 ★ 收藏吧。</div>`;
      return;
    }

    const dayLabel = { day1: "12/11 周五", day2: "12/12 周六", day3: "12/13 周日" };
    const stageName = (id) => TRIP.stages.find((s) => s.id === id)?.short || id;

    mount.innerHTML = entries
      .map((e) => {
        const set = (TRIP.lineup[e.day] || []).find(
          (x) => x.artist === e.artist && x.stage === e.stage
        );
        const dots = e.who
          .map((id) => {
            const f = TRIP.friends.find((p) => p.id === id);
            return f ? `<span style="background:${f.color}"></span>` : "";
          })
          .join("");
        const mine = e.who.includes(state.person);
        return `
        <div class="set-item ${mine ? "starred" : ""}">
          ${avatarHtml(e.artist)}
          <div>
            ${artistTitleHtml(e.artist)}
            ${genreHtml(e.artist, e.stage)}
            <div class="set-meta">${dayLabel[e.day] || e.day} · ${set ? `${set.start}–${set.end}` : ""} · ${stageName(e.stage)}</div>
            <div class="stars-who">${dots}</div>
          </div>
          <button class="star-btn ${mine ? "on" : ""}" data-key="${e.key}">★</button>
        </div>`;
      })
      .join("");

    $$(".star-btn", mount).forEach((btn) => {
      btn.onclick = () => {
        toggleStar(btn.dataset.key);
        renderMust();
      };
    });
    ARTIST_IMG.bindLazy(mount);
  }

  function renderChecklist() {
    const groups = {};
    TRIP.checklist.forEach((c) => {
      (groups[c.group] ||= []).push(c);
    });
    const mount = $("#checkList");
    mount.innerHTML = Object.entries(groups)
      .map(
        ([group, items]) => `
        <div class="check-group">${group}</div>
        ${items
          .map((c) => {
            const done = !!state.checks[c.id];
            return `
            <label class="check-item ${done ? "done" : ""}" data-id="${c.id}">
              <span class="check-box">✓</span>
              <span class="check-text">${c.text}</span>
            </label>`;
          })
          .join("")}`
      )
      .join("");

    $$(".check-item", mount).forEach((el) => {
      el.onclick = (e) => {
        e.preventDefault();
        state.checks[el.dataset.id] = !state.checks[el.dataset.id];
        save();
        renderChecklist();
      };
    });
  }

  function openPersonSheet() {
    const list = $("#personList");
    list.innerHTML = TRIP.friends
      .map(
        (f) => `
      <button class="person-option ${f.id === state.person ? "active" : ""}" data-id="${f.id}">
        <i class="who-dot" style="background:${f.color}"></i>
        <span>${f.name}</span>
      </button>`
      )
      .join("");
    $$(".person-option", list).forEach((b) => {
      b.onclick = () => {
        state.person = b.dataset.id;
        save();
        updateWhoBtn();
        closePersonSheet();
        renderLineup();
        renderMust();
        toast(`Switched to ${person().name}`);
      };
    });
    $("#personSheet").classList.add("open");
  }

  function closePersonSheet() {
    $("#personSheet").classList.remove("open");
  }

  function exportStars() {
    const encoded = btoa(
      unescape(encodeURIComponent(JSON.stringify({ v: 1, person: state.person, stars: state.stars })))
    );
    const url = `${location.origin}${location.pathname}#sync=${encoded}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => toast("同步链接已复制"),
        () => prompt("复制此链接发给朋友：", url)
      );
    } else prompt("复制此链接发给朋友：", url);
  }

  function importFromHash() {
    const m = (location.hash || "").match(/sync=([^&]+)/);
    if (!m) return;
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      if (data.stars) {
        Object.entries(data.stars).forEach(([key, who]) => {
          state.stars[key] = [...new Set([...(state.stars[key] || []), ...who])];
        });
        save();
        toast("已合并朋友的必看清单");
      }
      history.replaceState(null, "", location.pathname + location.search);
    } catch (_) {
      toast("同步链接无效");
    }
  }

  function init() {
    load();
    importFromHash();
    renderTabs();
    updateWhoBtn();
    renderOverview();
    renderDays();
    renderFlights();
    renderLineup();
    renderMust();
    renderChecklist();
    tickCountdown();
    setInterval(tickCountdown, 1000);

    $("#whoBtn").onclick = openPersonSheet;
    $("#personSheet").onclick = (e) => {
      if (e.target.id === "personSheet") closePersonSheet();
    };
    $("#onlyMineBtn").onclick = () => {
      state.onlyMine = !state.onlyMine;
      renderLineup();
    };
    $("#shareStarsBtn").onclick = exportStars;
    $("#clearMineBtn").onclick = () => {
      if (!confirm(`Clear all stars for ${person().name}?`)) return;
      Object.keys(state.stars).forEach((key) => {
        state.stars[key] = (state.stars[key] || []).filter((id) => id !== state.person);
        if (!state.stars[key].length) delete state.stars[key];
      });
      save();
      renderLineup();
      renderMust();
      toast("已清除");
    };
  }

  document.addEventListener("DOMContentLoaded", init);
})();

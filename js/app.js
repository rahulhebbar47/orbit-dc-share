/* ORBIT DC — calendar, filters, drawer */

(function () {
  "use strict";

  var TZ = "America/New_York";
  var CATS = [
    { key: "tennis", label: "Tennis" },
    { key: "dance", label: "Dance" },
    { key: "run", label: "Run" },
    { key: "sports", label: "Sports" },
    { key: "trivia", label: "Trivia" },
    { key: "mixer", label: "Mixer" },
    { key: "civic", label: "Civic" },
    { key: "nightlife", label: "Nightlife" },
    { key: "arts", label: "Arts" },
    { key: "other", label: "Other" }
  ];
  var CAT_KEYS = CATS.map(function (c) { return c.key; });
  var CAT_LABEL = {};
  CATS.forEach(function (c) { CAT_LABEL[c.key] = c.label; });
  var WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  var MO = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  var state = {
    view: "week",
    cursor: todayYmd(),
    selectedDay: null,
    selectedEventId: null,
    agendaFocus: null,
    filtersOpen: false,
    filters: {
      cats: new Set(),
      neighborhoods: new Set(),
      costs: new Set()
    },
    data: { updated: null, events: [] },
    loadError: null
  };

  var el = {
    app: $("app"),
    board: $("board"),
    filters: $("filters"),
    showing: $("showing"),
    btnClear: $("btn-clear"),
    btnFilters: $("btn-filters"),
    filterbar: $("filterbar"),
    filtersToggleLabel: $("filters-toggle-label"),
    period: $("period"),
    updated: $("updated"),
    stat: $("stat"),
    pulse: $("pulse"),
    colophon: $("colophon"),
    drawer: $("drawer"),
    scrim: $("scrim"),
    btnAgenda: $("btn-agenda"),
    btnWeek: $("btn-week"),
    btnMonth: $("btn-month"),
    btnToday: $("btn-today"),
    filterBrand: $("filter-brand"),
    dayNav: $("day-nav"),
    btnDayUp: $("btn-day-up"),
    btnDayDown: $("btn-day-down"),
    btnPrev: $("btn-prev"),
    btnNext: $("btn-next")
  };

  function $(id) { return document.getElementById(id); }

  function todayYmd() {
    return ymdInTz(new Date());
  }

  function ymdInTz(date) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    var get = function (t) {
      return parts.find(function (p) { return p.type === t; }).value;
    };
    return get("year") + "-" + get("month") + "-" + get("day");
  }

  function eventDay(ev) {
    return ymdInTz(new Date(ev.start));
  }

  function parseYmd(ymd) {
    var p = ymd.split("-").map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }

  function addDays(ymd, n) {
    var p = parseYmd(ymd);
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  function startOfWeek(ymd) {
    var p = parseYmd(ymd);
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    var dow = dt.getUTCDay();
    return addDays(ymd, -dow);
  }

  function startOfMonth(ymd) {
    return ymd.slice(0, 7) + "-01";
  }

  function fmtTime(iso) {
    if (!iso) return "";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(iso));
  }

  function fmtUpdated(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(d);
    var get = function (t) {
      var f = parts.find(function (p) { return p.type === t; });
      return f ? f.value : "";
    };
    return (get("day") + " " + get("month") + " " + get("year") + "  " + get("hour") + ":" + get("minute") + " ET").toUpperCase();
  }

  function fmtDayLong(ymd) {
    var p = parseYmd(ymd);
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    var dow = WD[dt.getUTCDay()];
    return dow + "  " + p.d + "  " + MO[p.m - 1] + "  " + p.y;
  }

  function fmtRangeWeek(start) {
    var end = addDays(start, 6);
    var a = parseYmd(start);
    var b = parseYmd(end);
    if (a.y === b.y && a.m === b.m) {
      return a.d + "–" + b.d + "  " + MO[a.m - 1] + "  " + a.y;
    }
    if (a.y === b.y) {
      return a.d + " " + MO[a.m - 1] + "  –  " + b.d + " " + MO[b.m - 1] + "  " + a.y;
    }
    return a.d + " " + MO[a.m - 1] + " " + a.y + "  –  " + b.d + " " + MO[b.m - 1] + " " + b.y;
  }

  function fmtMonthTitle(ymd) {
    var p = parseYmd(ymd);
    return MO[p.m - 1] + "  " + p.y;
  }

  function catsOf(ev) {
    var list = ev.categories;
    if (Array.isArray(list) && list.length) {
      return list.map(function (c) { return String(c).toLowerCase(); });
    }
    return ["other"];
  }

  function primaryCat(ev) {
    var c = catsOf(ev)[0];
    return CAT_KEYS.indexOf(c) >= 0 ? c : "other";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sortEvents(list) {
    return list.slice().sort(function (a, b) {
      var sa = new Date(a.start).getTime();
      var sb = new Date(b.start).getTime();
      if (sa !== sb) return sa - sb;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  function passes(ev) {
    var f = state.filters;
    if (f.cats.size) {
      var hit = false;
      var cats = catsOf(ev);
      for (var i = 0; i < cats.length; i++) {
        if (f.cats.has(cats[i])) { hit = true; break; }
      }
      if (!hit) return false;
    }
    if (f.costs.size && !f.costs.has(ev.cost)) return false;
    if (f.neighborhoods.size && !f.neighborhoods.has(ev.neighborhood)) return false;
    return true;
  }

  function visibleEvents() {
    return sortEvents(state.data.events.filter(passes));
  }

  function eventsOn(ymd) {
    return visibleEvents().filter(function (ev) { return eventDay(ev) === ymd; });
  }

  function unique(arr) {
    var out = [];
    var seen = {};
    arr.forEach(function (v) {
      if (v && !seen[v]) { seen[v] = true; out.push(v); }
    });
    return out.sort(function (a, b) { return String(a).localeCompare(String(b)); });
  }

  function filterActive() {
    var f = state.filters;
    return f.cats.size + f.neighborhoods.size + f.costs.size;
  }

  function paramList(params, key) {
    var out = [];
    params.getAll(key).forEach(function (raw) {
      String(raw).split(",").forEach(function (p) {
        p = p.trim();
        if (p) out.push(p);
      });
    });
    return out;
  }

  function readUrl() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    var view = params.get("view");
    if (view === "month" || view === "week" || view === "agenda") {
      state.view = view;
    }
    paramList(params, "cat").forEach(function (v) {
      v = v.toLowerCase();
      if (CAT_KEYS.indexOf(v) >= 0) state.filters.cats.add(v);
    });
    paramList(params, "hood").forEach(function (v) {
      if (v) state.filters.neighborhoods.add(v);
    });
    paramList(params, "cost").forEach(function (v) {
      if (v === "free" || v === "paid") state.filters.costs.add(v);
    });
  }

  function writeUrl() {
    var params = new URLSearchParams();
    state.filters.cats.forEach(function (v) { params.append("cat", v); });
    state.filters.neighborhoods.forEach(function (v) { params.append("hood", v); });
    state.filters.costs.forEach(function (v) { params.append("cost", v); });
    if (state.view === "month") params.set("view", "month");
    if (state.view === "agenda") params.set("view", "agenda");
    if (state.view === "week" && isMobile()) params.set("view", "week");
    var qs = params.toString();
    var next = location.pathname + (qs ? "?" + qs : "") + location.hash;
    if (location.pathname + location.search + location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }

  /* ——— render ——— */

  function renderAll(animate) {
    writeUrl();
    renderMast();
    renderFilters();
    renderBoard(!!animate);
    renderColophon();
    renderDrawer();
  }

  function renderMast() {
    var time = el.updated.querySelector("time");
    var iso = state.data.updated || "";
    time.setAttribute("datetime", iso);
    time.textContent = fmtUpdated(iso);
    var n = visibleEvents().length;
    var total = state.data.events.length;
    el.stat.textContent = n === total
      ? n + (n === 1 ? " EVENT" : " EVENTS")
      : n + " OF " + total;
    el.showing.textContent = "SHOWING  " + n + "  OF  " + total;
    el.btnClear.hidden = !filterActive();
    if (state.loadError) {
      el.pulse.hidden = false;
      el.pulse.classList.add("warn");
    } else {
      el.pulse.hidden = true;
      el.pulse.classList.remove("warn");
    }
  }

  function chip(label, on, attrs, extraClass) {
    var extra = attrs || "";
    var cls = "chip" + (on ? " on" : "") + (extraClass ? " " + extraClass : "");
    return '<button type="button" class="' + cls + '" ' + extra + ">" + label + "</button>";
  }

  function renderFilters() {
    var events = state.data.events;
    var hoods = unique(events.map(function (ev) { return ev.neighborhood; }));
    var f = state.filters;
    var html = "";

    html += '<div class="filt-row"><span class="filt-k">Category</span><div class="chips">';
    CATS.forEach(function (c) {
      html += chip(
        '<span class="tick"></span>' + esc(c.label),
        f.cats.has(c.key),
        'data-filter="cat" data-cat="' + c.key + '" data-value="' + c.key + '"'
      );
    });
    html += "</div></div>";

    if (hoods.length) {
      html += '<div class="filt-row"><span class="filt-k">Area</span><div class="chips">';
      hoods.forEach(function (h) {
        html += chip(esc(h), f.neighborhoods.has(h), 'data-filter="hood" data-value="' + esc(h) + '"');
      });
      html += "</div></div>";
    }

    html += '<div class="filt-row"><span class="filt-k">Cost</span><div class="chips">';
    html += chip("Free", f.costs.has("free"), 'data-filter="cost" data-value="free"');
    html += chip("Paid", f.costs.has("paid"), 'data-filter="cost" data-value="paid"');
    html += "</div></div>";

    el.filters.innerHTML = html;
  }

  function renderBoard(animate) {
    if (animate) {
      el.board.classList.remove("swap");
      void el.board.offsetWidth;
      el.board.classList.add("swap");
    }
    if (state.loadError && !state.data.events.length) {
      el.period.textContent = "—";
      el.board.innerHTML =
        '<div class="load-fail">' +
        "<h2>events.json is locked</h2>" +
        "<p>This browser will not read a local JSON file over <code>file://</code>. " +
        "From this folder run <code>python3 -m http.server 8080</code> and open " +
        "<code>http://localhost:8080</code>.</p></div>";
      return;
    }
    if (isMobile() && state.view === "agenda") renderAgenda();
    else if (isMobile() && state.view === "month") renderMonthHeatmap();
    else if (state.view === "week") renderWeek();
    else renderMonth();
    updateDayNav();
  }

  function evCard(ev, compact) {
    var cat = primaryCat(ev);
    var flags = "";
    if (ev.recurring) flags += '<span class="flag">Recurring</span>';
    var meta = [ev.venue, ev.neighborhood].filter(Boolean).join("  ·  ");
    return (
      '<button type="button" class="ev cat-' + cat + '" data-event="' + esc(ev.id) + '">' +
        '<span class="ev-time">' + esc(fmtTime(ev.start)) + (ev.end ? "–" + esc(fmtTime(ev.end)) : "") + "</span>" +
        '<span class="ev-name">' + esc(ev.name) + "</span>" +
        (compact
          ? (ev.neighborhood ? '<span class="ev-meta">' + esc(ev.neighborhood) + "</span>" : "")
          : '<span class="ev-meta">' + esc(meta) + "</span>") +
        (flags ? '<span class="ev-flags">' + flags + "</span>" : "") +
      "</button>"
    );
  }

  function prettyDay(ymd) {
    var today = todayYmd();
    if (ymd === today) return "Today";
    if (ymd === addDays(today, 1)) return "Tomorrow";
    if (ymd === addDays(today, -1)) return "Yesterday";
    var p = parseYmd(ymd);
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    var wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()];
    return wd + " " + MO[p.m - 1].slice(0, 1) + MO[p.m - 1].slice(1).toLowerCase() + " " + p.d;
  }

  function nextUpEvent() {
    var now = Date.now();
    var list = visibleEvents();
    for (var i = 0; i < list.length; i++) {
      if (new Date(list[i].start).getTime() >= now) return list[i];
    }
    return null;
  }

  function agendaStart() {
    var today = todayYmd();
    return state.cursor && state.cursor < today ? state.cursor : (state.cursor || today);
  }

  function renderAgenda() {
    var start = agendaStart();
    var today = todayYmd();
    if (!state.cursor || state.cursor > addDays(today, 60)) start = today;
    var days = [];
    var last = addDays(start, 20);
    var ymd = start;
    while (ymd <= last) {
      var list = eventsOn(ymd);
      if (list.length || ymd === start || ymd === today) days.push(ymd);
      ymd = addDays(ymd, 1);
    }
    var first = days[0] || start;
    var end = days.length ? days[days.length - 1] : last;
    el.period.textContent = days.length ? prettyDay(first) + "  –  " + prettyDay(end) : "Upcoming";

    var html = '<div class="agenda">';
    var next = nextUpEvent();
    if (next && start <= today) {
      var meta = [next.venue, next.neighborhood].filter(Boolean).join("  ·  ");
      html +=
        '<button type="button" class="next-up cat-' + primaryCat(next) + '" data-event="' + esc(next.id) + '">' +
          '<span class="next-kicker">Next up</span>' +
          '<span class="next-when">' + esc(prettyDay(eventDay(next))) + "  ·  " + esc(fmtTime(next.start)) + "</span>" +
          '<span class="next-name">' + esc(next.name) + "</span>" +
          (meta ? '<span class="next-meta">' + esc(meta) + "</span>" : "") +
        "</button>";
    }

    if (!days.length) {
      html += '<div class="quiet">Nothing coming up in this stretch.</div>';
    }

    days.forEach(function (day) {
      var list = eventsOn(day);
      var cls = "agenda-day";
      if (day === today) cls += " is-today";
      if (day === state.selectedDay) cls += " is-selected";
      html +=
        '<section class="' + cls + '" id="agenda-' + day + '" data-day="' + day + '">' +
          '<header class="agenda-head" data-day="' + day + '">' +
            '<div class="agenda-title">' + esc(prettyDay(day)) + "</div>" +
            (list.length ? '<div class="agenda-count">' + list.length + "</div>" : "") +
          "</header>" +
          (list.length
            ? '<div class="agenda-list">' + list.map(function (ev) { return evCard(ev, false); }).join("") + "</div>"
            : '<div class="quiet">Nothing on the board.</div>') +
        "</section>";
    });
    html += "</div>";
    el.board.innerHTML = html;
    requestAnimationFrame(function () {
      scrollAgendaTo(state.selectedDay || (start === today ? today : start));
    });
  }

  function scrollAgendaTo(ymd) {
    if (!ymd) return;
    var node = document.getElementById("agenda-" + ymd);
    if (!node) return;
    var bar = el.filterbar.getBoundingClientRect();
    var top = node.getBoundingClientRect().top + window.scrollY - bar.height - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function renderMonthHeatmap() {
    var monthStart = startOfMonth(state.cursor);
    el.period.textContent = fmtMonthTitle(monthStart);
    var gridStart = startOfWeek(monthStart);
    var html = '<div class="heat-wrap">';
    html += '<div class="heat-wd">';
    ["S", "M", "T", "W", "T", "F", "S"].forEach(function (w) {
      html += "<span>" + w + "</span>";
    });
    html += "</div>";
    html += '<div class="heat">';
    for (var i = 0; i < 42; i++) {
      var ymd = addDays(gridStart, i);
      var p = parseYmd(ymd);
      var n = eventsOn(ymd).length;
      var cls = "heat-day";
      if (ymd.slice(0, 7) !== monthStart.slice(0, 7)) cls += " is-outside";
      if (ymd === todayYmd()) cls += " is-today";
      if (ymd === state.selectedDay) cls += " is-selected";
      if (!n) cls += " is-empty";
      html +=
        '<button type="button" class="' + cls + '" data-day="' + ymd + '" data-open-agenda="1">' +
          '<span class="heat-num">' + p.d + "</span>" +
          '<span class="heat-count">' + (n ? n : "") + "</span>" +
        "</button>";
    }
    html += "</div></div>";
    el.board.innerHTML = html;
  }

  function openAgendaDay(ymd) {
    state.cursor = ymd;
    state.selectedDay = ymd;
    state.agendaFocus = ymd;
    state.selectedEventId = null;
    state.view = "agenda";
    syncViewButtons();
    renderAll();
  }

  function weekdayLabel(ymd) {
    var p = parseYmd(ymd);
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    return WD[dt.getUTCDay()];
  }

  function renderWeek() {
    var start = isMobile() ? (state.cursor || todayYmd()) : startOfWeek(state.cursor);
    el.period.textContent = fmtRangeWeek(start);
    var html = '<div class="cal week">';
    for (var i = 0; i < 7; i++) {
      var ymd = addDays(start, i);
      var p = parseYmd(ymd);
      var list = eventsOn(ymd);
      var cls = "day";
      if (ymd === todayYmd()) cls += " is-today";
      if (ymd === state.selectedDay) cls += " is-selected";
      html +=
        '<article class="' + cls + '" data-day="' + ymd + '">' +
          '<header class="d-head" data-day="' + ymd + '">' +
            '<div><div class="d-wd">' + weekdayLabel(ymd) + "</div>" +
            '<div class="d-num">' + p.d + "</div></div>" +
            (list.length ? '<div class="d-count">' + list.length + "</div>" : "") +
          "</header>" +
          '<div class="d-body">' +
            list.map(function (ev) { return evCard(ev, true); }).join("") +
          "</div>" +
        "</article>";
    }
    html += "</div>";
    el.board.innerHTML = html;
  }

  function renderMonth() {
    var monthStart = startOfMonth(state.cursor);
    el.period.textContent = fmtMonthTitle(monthStart);
    var gridStart = startOfWeek(monthStart);
    var html = '<div class="month-wrap">';
    html += '<div class="wd-row">';
    WD.forEach(function (w) { html += "<span>" + w + "</span>"; });
    html += "</div>";
    html += '<div class="cal month">';
    for (var i = 0; i < 42; i++) {
      var ymd = addDays(gridStart, i);
      var p = parseYmd(ymd);
      var list = eventsOn(ymd);
      var cls = "m-day";
      if (ymd.slice(0, 7) !== monthStart.slice(0, 7)) cls += " is-outside";
      if (ymd === todayYmd()) cls += " is-today";
      if (ymd === state.selectedDay) cls += " is-selected";
      var ticks = list.slice(0, 5).map(function (ev) {
        return '<span class="tick-sq cat-' + primaryCat(ev) + '"></span>';
      }).join("");
      if (list.length > 5) ticks += '<span class="tick-more">+' + (list.length - 5) + "</span>";
      html +=
        '<button type="button" class="' + cls + '" data-day="' + ymd + '">' +
          '<span class="m-num">' + p.d + "</span>" +
          '<span class="ticks">' + ticks + "</span>" +
        "</button>";
    }
    html += "</div></div>";
    el.board.innerHTML = html;
  }

  function renderColophon() {
    var n = state.data.events.length;
    el.colophon.innerHTML =
      "<span>" + n + (n === 1 ? " event" : " events") + "  ·  America/New_York</span>" +
      "<span>ORBIT DC</span>";
  }

  function findEvent(id) {
    return state.data.events.find(function (ev) { return ev.id === id; }) || null;
  }

  function renderDrawer() {
    var open = !!(state.selectedDay || state.selectedEventId);
    el.drawer.hidden = false;
    el.scrim.hidden = false;
    requestAnimationFrame(function () {
      el.drawer.classList.toggle("show", open);
      el.scrim.classList.toggle("show", open);
      el.drawer.setAttribute("aria-hidden", open ? "false" : "true");
    });
    if (!open) {
      el.drawer.innerHTML = "";
      return;
    }

    var ev = state.selectedEventId ? findEvent(state.selectedEventId) : null;
    if (ev) {
      el.drawer.innerHTML = drawerEvent(ev);
      return;
    }
    el.drawer.innerHTML = drawerDay(state.selectedDay);
  }

  function closeIcon() {
    return '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  }

  function drawerDay(ymd) {
    var list = eventsOn(ymd);
    var cards = list.length
      ? '<div class="day-list">' + list.map(function (ev) { return evCard(ev, false); }).join("") + "</div>"
      : '<div class="quiet">Nothing on the board.</div>';
    return (
      '<div class="drawer-inner">' +
        '<div class="drawer-nav">' +
          '<div class="drawer-kicker">' + esc(fmtDayLong(ymd)) + "</div>" +
          '<button type="button" class="x" data-close="1" aria-label="Close">' + closeIcon() + "</button>" +
        "</div>" +
        "<h2>" + (list.length ? list.length + (list.length === 1 ? " event" : " events") : "Quiet") + "</h2>" +
        cards +
      "</div>"
    );
  }

  function drawerEvent(ev) {
    var day = eventDay(ev);
    var when = fmtTime(ev.start) + (ev.end ? "  –  " + fmtTime(ev.end) : "") + "  ET";
    var flags = [];
    if (ev.recurring) flags.push('<span class="flag">Recurring</span>');
    var catPills = catsOf(ev).map(function (c) {
      var key = CAT_KEYS.indexOf(c) >= 0 ? c : "other";
      return '<span class="cat-pill cat-' + key + '"><span class="tick"></span>' + esc(CAT_LABEL[key] || key) + "</span>";
    }).join("");
    var tags = (ev.tags || []).map(function (x) {
      return '<span class="tag">' + esc(x) + "</span>";
    }).join("");
    var link = ev.link
      ? '<a class="out" href="' + esc(ev.link) + '" target="_blank" rel="noopener noreferrer">Open source  →</a>'
      : "";
    var cost = (ev.cost || "") + (ev.cost_detail ? "  ·  " + ev.cost_detail : "");
    return (
      '<div class="drawer-inner">' +
        '<div class="drawer-nav">' +
          '<button type="button" class="ghost" data-day="' + day + '">←  ' + esc(fmtDayLong(day)) + "</button>" +
          '<button type="button" class="x" data-close="1" aria-label="Close">' + closeIcon() + "</button>" +
        "</div>" +
        "<h2>" + esc(ev.name) + "</h2>" +
        '<div class="cat-row">' + catPills + flags.join("") + "</div>" +
        '<div class="dl">' +
          row("When", when) +
          row("Venue", ev.venue || "unknown") +
          row("Area", ev.neighborhood || "unknown") +
          row("Cost", cost) +
        "</div>" +
        (tags ? '<div class="tag-list">' + tags + "</div>" : "") +
        link +
      "</div>"
    );
  }

  function row(k, v) {
    return '<div class="dl-row"><span class="dl-k">' + esc(k) + '</span><span class="dl-v">' + esc(v) + "</span></div>";
  }

  /* ——— actions ——— */

  function syncViewButtons() {
    if (el.btnAgenda) el.btnAgenda.setAttribute("aria-selected", state.view === "agenda" ? "true" : "false");
    el.btnWeek.setAttribute("aria-selected", state.view === "week" ? "true" : "false");
    el.btnMonth.setAttribute("aria-selected", state.view === "month" ? "true" : "false");
  }

  function setView(view) {
    if (state.view === view) return;
    state.view = view;
    if (view === "agenda") {
      state.cursor = todayYmd();
      state.agendaFocus = todayYmd();
    }
    if (view === "week" && isMobile()) {
      state.cursor = todayYmd();
    }
    syncViewButtons();
    renderAll(true);
  }

  function step(dir) {
    if (isMobile() && state.view === "agenda") {
      state.cursor = addDays(agendaStart(), dir * 7);
      state.selectedDay = state.cursor;
      state.agendaFocus = state.cursor;
    } else if (isMobile() && state.view === "week") {
      state.cursor = addDays(state.cursor || todayYmd(), dir * 7);
    } else if (state.view === "week") {
      state.cursor = addDays(startOfWeek(state.cursor), dir * 7);
    } else {
      var p = parseYmd(startOfMonth(state.cursor));
      var dt = new Date(Date.UTC(p.y, p.m - 1 + dir, 1));
      state.cursor = dt.toISOString().slice(0, 10);
    }
    renderAll(true);
  }

  function goToday() {
    state.cursor = todayYmd();
    state.selectedDay = todayYmd();
    state.agendaFocus = todayYmd();
    state.selectedEventId = null;
    renderAll(true);
  }

  function openDay(ymd) {
    if (isMobile() && state.view === "agenda") {
      state.agendaFocus = ymd;
      scrollAgendaTo(ymd);
      updateDayNav();
      return;
    }
    state.selectedDay = ymd;
    state.selectedEventId = null;
    renderAll();
  }

  function openEvent(id) {
    var ev = findEvent(id);
    if (!ev) return;
    state.selectedEventId = id;
    state.selectedDay = eventDay(ev);
    renderAll();
  }

  function closeDrawer() {
    state.selectedEventId = null;
    state.selectedDay = null;
    renderDrawer();
    renderBoard(false);
  }

  function toggleSet(set, value) {
    if (set.has(value)) set.delete(value);
    else set.add(value);
  }

  function clearFilters() {
    state.filters.cats.clear();
    state.filters.neighborhoods.clear();
    state.filters.costs.clear();
    renderAll();
  }

  function onFilterClick(btn) {
    var kind = btn.getAttribute("data-filter");
    var value = btn.getAttribute("data-value");
    if (kind === "clear") clearFilters();
    else if (kind === "cat") toggleSet(state.filters.cats, value);
    else if (kind === "hood") toggleSet(state.filters.neighborhoods, value);
    else if (kind === "cost") toggleSet(state.filters.costs, value);
    else return;
    if (kind !== "clear") renderAll();
  }

  function isMobile() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function agendaDayIds() {
    return Array.prototype.map.call(document.querySelectorAll(".agenda-day"), function (n) {
      return n.getAttribute("data-day");
    });
  }

  function focusedAgendaDay() {
    var nodes = document.querySelectorAll(".agenda-day");
    if (!nodes.length) return state.agendaFocus || todayYmd();
    var mark = el.filterbar.getBoundingClientRect().bottom + 12;
    var current = nodes[0].getAttribute("data-day");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getBoundingClientRect().top <= mark + 20) {
        current = nodes[i].getAttribute("data-day");
      }
    }
    return current;
  }

  function updateDayNav() {
    var show = isMobile() && state.view === "agenda" && !!document.querySelector(".agenda");
    el.dayNav.hidden = !show;
    if (!show) return;
    var days = agendaDayIds();
    var cur = state.agendaFocus || focusedAgendaDay();
    var i = days.indexOf(cur);
    if (i < 0) i = 0;
    var today = todayYmd();
    var atToday = !days[i] || days[i] === today || cur === today;
    el.btnDayUp.hidden = atToday || i <= 0;
    el.btnDayDown.hidden = i < 0 || i >= days.length - 1;
  }

  function stepAgendaDay(dir) {
    var days = agendaDayIds();
    var cur = state.agendaFocus || focusedAgendaDay();
    var i = days.indexOf(cur);
    if (i < 0) i = 0;
    var next = days[i + dir];
    if (!next) return;
    if (dir < 0 && next < todayYmd()) return;
    state.agendaFocus = next;
    scrollAgendaTo(next);
    updateDayNav();
  }

  function onWindowScroll() {
    var scrolled = window.scrollY > 36;
    el.filterbar.classList.toggle("is-scrolled", scrolled);
    if (el.filterBrand) el.filterBrand.setAttribute("aria-hidden", scrolled ? "false" : "true");
    if (isMobile() && state.view === "agenda") {
      var focus = focusedAgendaDay();
      if (focus && focus !== state.agendaFocus) {
        state.agendaFocus = focus;
        updateDayNav();
      }
    }
  }

  function setFiltersOpen(open, persist) {
    state.filtersOpen = !!open;
    el.filterbar.classList.toggle("is-collapsed", !state.filtersOpen);
    el.filterbar.classList.add("is-ready");
    el.btnFilters.setAttribute("aria-expanded", state.filtersOpen ? "true" : "false");
    el.filtersToggleLabel.textContent = state.filtersOpen ? "HIDE" : "FILTERS";
    if (persist !== false) {
      try { localStorage.setItem("orbit-filters", state.filtersOpen ? "1" : "0"); } catch (e) {}
    }
  }

  function initFiltersOpen() {
    el.filterbar.classList.add("no-motion");
    var stored = null;
    try { stored = localStorage.getItem("orbit-filters"); } catch (e) {}
    if (stored === "1") setFiltersOpen(true, false);
    else if (stored === "0") setFiltersOpen(false, false);
    else setFiltersOpen(!isMobile(), false);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.filterbar.classList.remove("no-motion");
      });
    });
  }

  function bind() {
    if (el.btnAgenda) el.btnAgenda.addEventListener("click", function () { setView("agenda"); });
    el.btnWeek.addEventListener("click", function () { setView("week"); });
    el.btnMonth.addEventListener("click", function () { setView("month"); });
    el.btnDayUp.addEventListener("click", function () { stepAgendaDay(-1); });
    el.btnDayDown.addEventListener("click", function () { stepAgendaDay(1); });
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    el.btnToday.addEventListener("click", goToday);
    el.btnPrev.addEventListener("click", function () { step(-1); });
    el.btnNext.addEventListener("click", function () { step(1); });
    el.scrim.addEventListener("click", closeDrawer);
    el.btnClear.addEventListener("click", clearFilters);
    el.btnFilters.addEventListener("click", function () {
      setFiltersOpen(!state.filtersOpen);
    });

    el.filters.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-filter]");
      if (btn) onFilterClick(btn);
    });

    el.board.addEventListener("click", function (e) {
      var evBtn = e.target.closest("[data-event]");
      if (evBtn) {
        openEvent(evBtn.getAttribute("data-event"));
        return;
      }
      var dayBtn = e.target.closest("[data-day]");
      if (dayBtn) {
        if (isMobile() && dayBtn.getAttribute("data-open-agenda")) {
          openAgendaDay(dayBtn.getAttribute("data-day"));
          return;
        }
        openDay(dayBtn.getAttribute("data-day"));
      }
    });

    el.drawer.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) {
        closeDrawer();
        return;
      }
      var evBtn = e.target.closest("[data-event]");
      if (evBtn) {
        openEvent(evBtn.getAttribute("data-event"));
        return;
      }
      var dayBtn = e.target.closest("[data-day]");
      if (dayBtn) openDay(dayBtn.getAttribute("data-day"));
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "w" || e.key === "W") setView("week");
      if (e.key === "m" || e.key === "M") setView("month");
      if (e.key === "t" || e.key === "T") goToday();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
  }

  function load() {
    return fetch("events.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.data = {
          updated: data.updated || null,
          events: Array.isArray(data.events) ? data.events : []
        };
        state.loadError = null;
      })
      .catch(function (err) {
        state.loadError = String(err && err.message ? err.message : err);
      });
  }

  readUrl();
  if (isMobile() && state.view === "week" && !/view=/.test(location.search)) {
    state.view = "agenda";
  }
  syncViewButtons();
  bind();
  initFiltersOpen();
  onWindowScroll();
  load().then(renderAll);
})();

// STATE
const state = {
    data: null,
    bookmarks: [],
    themes: ["void","obsidian","aurora","synth","magma","tdr-future","tdr-x","terminal-green","terminal-amber","terminal-orange"],
    currentTheme: 0,
    spreadIdx: 0,
    colIdx: 0,
    toastTimer: null
};

// INIT
document.addEventListener("DOMContentLoaded", init);

async function init() {
    try {
        const res = await fetch("websites.json");
        state.data = await res.json();
        render(state.data);
        renderMobileCatNav(state.data);
        initClock();
        initKeyboard();
        initSearch();
        initTheme();
        initMobileDock();
        window.addEventListener("resize", () => updateSpreadVisibility());
        document.querySelector(".loading-state")?.remove();
    } catch (err) {
        console.error(err);
        const g = document.getElementById("gallery");
        if (g) g.innerHTML = `<div class="error-state"><span>Failed to load bookmarks</span><span>${err.message}</span></div>`;
    }
}

// ── RENDER ──────────────────────────────────────────────────────────────────
function render(data) {
    const gallery = document.getElementById("gallery");
    gallery.innerHTML = "";
    data.categories.forEach((cat, i) => gallery.appendChild(createSpread(cat, i + 1)));
    state.bookmarks = Array.from(document.querySelectorAll(".bookmark"));
    updateSpreadVisibility();
    setTimeout(() => navigate(0, 0), 50);
}

function createSpread(cat, index) {
    const spread = document.createElement("section");
    spread.className = "spread";
    spread.id = `spread-${index}`;
    spread.innerHTML = `
        <div class="spread-title-container">
            <div class="spread-index">No. ${String(index).padStart(2, "0")}</div>
            <div class="spread-name">${cat.name}</div>
            <div class="spread-label">${cat.name}</div>
        </div>`;

    const content = document.createElement("div");
    content.className = "spread-content";

    const track = document.createElement("div");
    track.className = "column-track";

    const columns = [];
    function collect(node) {
        if (node.websites?.length) columns.push(node);
        node.subcategories?.forEach(collect);
    }
    collect(cat);
    columns.forEach(col => track.appendChild(createColumn(col)));

    content.appendChild(track);
    spread.appendChild(content);
    return spread;
}

function createColumn(sub) {
    const col = document.createElement("div");
    col.className = "column";
    col.innerHTML = `
        <div class="column-header">
            <span class="ch-name">${sub.name}</span>
            <span class="ch-count">${(sub.websites || []).length}</span>
        </div>`;
    const list = document.createElement("div");
    list.className = "bookmark-list";
    (sub.websites || []).forEach((w, i) => {
        const b = createBookmark(w);
        if (i < 9) b.setAttribute("data-index", i + 1);
        list.appendChild(b);
    });
    col.appendChild(list);
    return col;
}

function createBookmark(w) {
    const a = document.createElement("a");
    a.className = "bookmark";
    a.href = w.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (w.favorite) a.classList.add("is-favorite");
    if (w.mobile) a.classList.add("is-mobile-link");
    a.innerHTML = `
        <span class="b-name">${w.name}</span>
        <span class="b-meta">${getDomain(w.url)}</span>
        ${w.favorite ? `<p class="b-desc">${w.description || "Curated resource."}</p>` : ""}`;
    return a;
}

// ── CAROUSEL NAVIGATION ─────────────────────────────────────────────────────
// Core principle: column.offsetLeft is a LAYOUT property — unaffected by CSS
// transition animation state. With column-track { position: relative }, it is
// always the column's natural position within the track.
// Formula: tx = marginLeft - col.offsetLeft  →  moves track left so the column
// lands at exactly marginLeft from the spread-content's left edge.

function navigate(spreadIdx, colIdx) {
    const spreads = document.querySelectorAll(".spread");
    const spread = spreads[Math.max(0, Math.min(spreads.length - 1, spreadIdx))];
    if (!spread) return;

    const cols = Array.from(spread.querySelectorAll(".column"));
    if (!cols.length) return;

    state.spreadIdx = spreadIdx;
    state.colIdx = Math.max(0, Math.min(cols.length - 1, colIdx));

    const col = cols[state.colIdx];
    const track = spread.querySelector(".column-track");

    updateSpreadVisibility();
    col.querySelector(".bookmark")?.focus({ preventScroll: true });

    // rAF ensures the display:flex layout is committed before we read offsetLeft
    requestAnimationFrame(() => {
        if (window.innerWidth > 640 && track) {
            applyCarousel(track, col);
        }
        updateMobileCatNav();
    });
}

function applyCarousel(track, col) {
    if (!track || !col) return;
    const margin = parseFloat(getComputedStyle(col).marginLeft) || 0;
    // tx brings col's left border to `margin`px from spread-content's left edge.
    // Math.min(0, …) prevents the track from sliding right of its natural start.
    const tx = Math.min(0, margin - col.offsetLeft);
    track.style.transform = `translateX(${tx}px)`;
}

function updateSpreadVisibility() {
    document.querySelectorAll(".spread").forEach((s, i) => {
        const active = i === state.spreadIdx;
        s.classList.toggle("is-active", active);
        s.style.display = active ? "flex" : "none";
    });
}

// ── KEYBOARD ────────────────────────────────────────────────────────────────
function initKeyboard() {
    window.addEventListener("keydown", e => {
        const input = document.getElementById("global-search");

        if (e.key === "Escape") {
            if (input.value) { input.value = ""; input.dispatchEvent(new Event("input")); }
            input.blur();
            return;
        }

        if (e.key === "/") {
            if (document.activeElement !== input) {
                e.preventDefault();
                input.focus();
                input.select();
            }
            return;
        }

        if (e.target.tagName === "INPUT") return;

        if (e.key.toLowerCase() === "t") { cycleTheme(); return; }

        switch (e.key) {
            case "ArrowUp":    case "k": e.preventDefault(); jumpSpread(-1); break;
            case "ArrowDown":  case "j": e.preventDefault(); jumpSpread(1);  break;
            case "ArrowLeft":  case "h": e.preventDefault(); jumpColumn(-1); break;
            case "ArrowRight": case "l": e.preventDefault(); jumpColumn(1);  break;
        }

        // 1–9 to focus bookmark by position in active column
        if (e.code.startsWith("Digit") || e.code.startsWith("Numpad")) {
            const n = parseInt(e.key);
            if (n >= 1 && n <= 9) {
                e.preventDefault();
                const spread = document.querySelectorAll(".spread")[state.spreadIdx];
                const col = spread?.querySelectorAll(".column")[state.colIdx];
                col?.querySelectorAll(".bookmark")[n - 1]?.focus();
            }
        }
    });
}

function jumpSpread(delta) {
    const count = document.querySelectorAll(".spread").length;
    const next = Math.max(0, Math.min(count - 1, state.spreadIdx + delta));
    if (next !== state.spreadIdx) navigate(next, 0);
}

function jumpColumn(delta) {
    const spread = document.querySelectorAll(".spread")[state.spreadIdx];
    if (!spread) return;
    const cols = Array.from(spread.querySelectorAll(".column"));

    // If user clicked into a column, sync the tracked index first
    const focused = document.activeElement?.closest(".column");
    const focusedIdx = focused ? cols.indexOf(focused) : -1;
    const current = focusedIdx !== -1 ? focusedIdx : state.colIdx;

    const next = Math.max(0, Math.min(cols.length - 1, current + delta));
    navigate(state.spreadIdx, next);
}

// ── SEARCH ──────────────────────────────────────────────────────────────────
function initSearch() {
    const input = document.getElementById("global-search");
    input.addEventListener("input", e => {
        const val = e.target.value.toLowerCase().trim();

        if (val.length < 2) {
            document.body.classList.remove("is-searching");
            state.bookmarks.forEach(b => (b.style.display = ""));
            document.querySelectorAll(".column, .spread").forEach(el => (el.style.display = ""));
            updateSpreadVisibility();
            // Re-apply carousel for active spread after search exit
            requestAnimationFrame(() => {
                const spread = document.querySelectorAll(".spread")[state.spreadIdx];
                const track = spread?.querySelector(".column-track");
                const col = spread?.querySelectorAll(".column")[state.colIdx];
                if (window.innerWidth > 640) applyCarousel(track, col);
            });
            return;
        }

        document.body.classList.add("is-searching");

        state.bookmarks.forEach(b => {
            b.style.display = b.textContent.toLowerCase().includes(val) ? "" : "none";
        });

        document.querySelectorAll(".column").forEach(col => {
            col.style.display = col.querySelector(".bookmark:not([style*='display: none'])") ? "" : "none";
        });

        document.querySelectorAll(".spread").forEach(s => {
            const visible = !!s.querySelector(".bookmark:not([style*='display: none'])");
            s.style.display = visible ? "flex" : "none";
            s.classList.toggle("is-active", visible);
        });
    });
}

// ── MOBILE ──────────────────────────────────────────────────────────────────
function renderMobileCatNav(data) {
    const nav = document.getElementById("mobile-cat-nav");
    if (!nav) return;
    nav.innerHTML = "";
    data.categories.forEach((cat, i) => {
        const btn = document.createElement("button");
        btn.className = "m-cat-btn";
        btn.textContent = cat.name;
        btn.addEventListener("click", () => {
            state.spreadIdx = i;
            state.colIdx = 0;
            updateSpreadVisibility();
            updateMobileCatNav();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
        nav.appendChild(btn);
    });
    updateMobileCatNav();
}

function updateMobileCatNav() {
    document.querySelectorAll(".m-cat-btn").forEach((btn, i) => {
        btn.classList.toggle("is-active", i === state.spreadIdx);
        if (i === state.spreadIdx) {
            btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    });
}

function initMobileDock() {
    document.getElementById("dock-home")?.addEventListener("click", () =>
        window.scrollTo({ top: 0, behavior: "smooth" })
    );
    document.getElementById("dock-search")?.addEventListener("click", () =>
        document.getElementById("global-search").focus()
    );
    document.getElementById("dock-theme")?.addEventListener("click", cycleTheme);
}

// ── CLOCK ───────────────────────────────────────────────────────────────────
function initClock() {
    const timeEl = document.getElementById("c-time");
    const dateEl = document.getElementById("c-date");
    const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
    const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    function tick() {
        const d = new Date();
        timeEl.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        dateEl.textContent = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    }
    tick();
    setInterval(tick, 1000);
}

// ── THEMES ──────────────────────────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem("h-theme");
    if (saved) {
        const idx = state.themes.indexOf(saved);
        state.currentTheme = idx !== -1 ? idx : 0;
    }
    document.body.dataset.theme = state.themes[state.currentTheme];
}

function cycleTheme() {
    state.currentTheme = (state.currentTheme + 1) % state.themes.length;
    const theme = state.themes[state.currentTheme];
    document.body.dataset.theme = theme;
    localStorage.setItem("h-theme", theme);
    showToast(theme);
}

function showToast(name) {
    const toast = document.getElementById("theme-toast");
    if (!toast) return;
    if (state.toastTimer) clearTimeout(state.toastTimer);
    toast.textContent = `Theme: ${name.replace(/-/g, " ")}`;
    toast.classList.add("is-visible");
    state.toastTimer = setTimeout(() => {
        toast.classList.remove("is-visible");
        state.toastTimer = null;
    }, 1500);
}

// ── UTILS ────────────────────────────────────────────────────────────────────
function getDomain(url) {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; }
}

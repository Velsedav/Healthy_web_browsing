/**
 * ═══════════════════════════════════════════════════════════
 * HEALTHY BROWSING — THE EDITORIAL DASHBOARD (REBOOT)
 * ═══════════════════════════════════════════════════════════
 */

// STATE
const state = {
    data: null,
    focusedIndex: -1,
    bookmarks: [],
    themes: ["void", "obsidian", "aurora", "synth", "magma", "tdr-future", "tdr-x", "terminal-green", "terminal-amber", "terminal-orange"],
    currentTheme: 0,
    currentSpreadIndex: 0, // Track active "page"
    toastTimer: null
};

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
    init();
});

async function init() {
    try {
        const response = await fetch("websites.json");
        state.data = await response.json();

        render(state.data);
        renderMobileCatNav(state.data);
        initClock();
        initKeyboardUI();
        initSearch();
        initTheme();
        initMobileDock();
        window.addEventListener("resize", handleResize);

        // Remove loading state
        document.querySelector(".loading-state")?.remove();
    } catch (err) {
        console.error("Dashboard failed to initialize:", err);
    }
}

// RENDERING
function render(data) {
    const gallery = document.getElementById("gallery");
    gallery.innerHTML = "";

    data.categories.forEach((cat, index) => {
        const spread = createSpread(cat, index + 1);
        gallery.appendChild(spread);
    });

    state.bookmarks = Array.from(document.querySelectorAll(".bookmark"));
    updateSpreadVisibility();

    setTimeout(() => {
        focusFirstInActiveSpread();
    }, 500);
}

function updateSpreadVisibility() {
    const isMobile = window.innerWidth <= 1024;
    const spreads = document.querySelectorAll(".spread");
    const dockItems = document.querySelectorAll(".dock-item");
    
    spreads.forEach((spread, i) => {
        if (isMobile) {
            if (i === state.currentSpreadIndex) {
                spread.classList.add("is-active");
                spread.style.display = "flex";
                spread.style.opacity = "1";
                spread.style.pointerEvents = "auto";
            } else {
                spread.classList.remove("is-active");
                spread.style.display = "none";
            }
        } else {
            // Immersive horizontal mode on desktop
            if (i === state.currentSpreadIndex) {
                spread.classList.add("is-active");
                spread.style.display = "flex";
            } else {
                spread.classList.remove("is-active");
                spread.style.display = "none";
            }
        }
    });

    // Update Dock active state
    if (isMobile) {
        dockItems.forEach((item, idx) => {
            item.classList.toggle("is-active", idx === 0 && !document.body.classList.contains("is-searching"));
        });
    }
}

function focusFirstInActiveSpread() {
    const activeSpread = document.querySelectorAll(".spread")[state.currentSpreadIndex];
    if (activeSpread) {
        const firstB = activeSpread.querySelector(".bookmark:not([style*='display: none'])");
        if (firstB) firstB.focus();
    }
}

function createSpread(cat, index) {
    const spread = document.createElement("section");
    spread.className = "spread";
    spread.id = `spread-${index}`;

    spread.innerHTML = `
        <div class="spread-title-container">
            <div class="spread-index">No. ${index.toString().padStart(2, '0')}</div>
            <div class="spread-name">${cat.name}</div>
            <div class="spread-label">${cat.name}</div>
        </div>
    `;

    const content = document.createElement("div");
    content.className = "spread-content";

    // Recursively find all "columns" (folders with websites)
    const columns = [];
    function collectColumns(node) {
        if (node.websites && node.websites.length > 0) {
            columns.push(node);
        }
        if (node.subcategories) {
            node.subcategories.forEach(collectColumns);
        }
    }

    collectColumns(cat);

    columns.forEach(colData => {
        const column = createColumn(colData);
        content.appendChild(column);
    });

    spread.appendChild(content);
    return spread;
}

function renderMobileCatNav(data) {
    const nav = document.getElementById("mobile-cat-nav");
    if (!nav) return;

    nav.innerHTML = "";
    data.categories.forEach((cat, index) => {
        const btn = document.createElement("button");
        btn.className = "m-cat-btn";
        if (index === state.currentSpreadIndex) btn.classList.add("is-active");
        btn.textContent = cat.name;
        btn.addEventListener("click", () => {
            state.currentSpreadIndex = index;
            updateSpreadVisibility();
            updateMobileCatNav();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        nav.appendChild(btn);
    });
}

function updateMobileCatNav() {
    const btns = document.querySelectorAll(".m-cat-btn");
    btns.forEach((btn, i) => {
        btn.classList.toggle("is-active", i === state.currentSpreadIndex);
        if (i === state.currentSpreadIndex) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    });
}

function createColumn(sub) {
    const col = document.createElement("div");
    col.className = "column";

    const websites = sub.websites || [];

    col.innerHTML = `
        <div class="column-header">
            <span class="ch-name">${sub.name}</span>
            <span class="ch-count">${websites.length}</span>
        </div>
    `;

    const list = document.createElement("div");
    list.className = "bookmark-list";

    websites.forEach((w, i) => {
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

    const domain = getDomain(w.url);

    a.innerHTML = `
        <span class="b-name">${w.name}</span>
        <span class="b-meta">${domain}</span>
        ${w.favorite ? `<p class="b-desc">${w.description || 'Curated high-quality resource.'}</p>` : ''}
    `;

    return a;
}

// KEYBOARD NAVIGATION
function initKeyboardUI() {
    window.addEventListener("keydown", (e) => {
        // 1. GLOBAL HOTKEYS (Handle even inside Search Bar)
        if (e.key === "Escape") {
            const searchInput = document.getElementById("global-search");
            const val = searchInput.value;

            if (val.length > 0) {
                // If there's text, clear it but stay in the bar? 
                // Or clear and exit? Usually ESC = clear and exit.
                searchInput.value = "";
                // Manually trigger input event to reset filter
                searchInput.dispatchEvent(new Event('input'));
                searchInput.blur();
            } else {
                searchInput.blur();
            }
            return;
        }

        if (e.key.toLowerCase() === "t") {
            cycleTheme();
            return;
        }

        // 2. SEARCH FOCUS
        if (e.key === "/") {
            const input = document.getElementById("global-search");
            if (document.activeElement !== input) {
                e.preventDefault();
                input.focus();
                input.select();
                return;
            }
        }

        // 3. IGNORE NAVIGATION KEYS IF TYPING
        if (e.target.tagName === "INPUT") return;

        // 4. NAVIGATION
        const spread = document.activeElement?.closest(".spread") || document.querySelector(".spread");
        if (!spread) return;

        switch (e.key) {
            case "ArrowDown":
            case "j":
                e.preventDefault();
                moveFocus(1);
                break;
            case "ArrowUp":
            case "k":
                e.preventDefault();
                moveFocus(-1);
                break;
            case "ArrowRight":
            case "l":
                e.preventDefault();
                jumpSpread(1);
                break;
            case "ArrowLeft":
            case "h":
                e.preventDefault();
                jumpSpread(-1);
                break;
        }

        // Numpad & Digit Bookmark Selection (1-9) within current spread
        if (e.code.startsWith("Digit") || e.code.startsWith("Numpad")) {
            const num = parseInt(e.key);
            if (!isNaN(num) && num > 0) {
                e.preventDefault();
                selectBookmarkInCurrentSpread(num - 1);
            }
        }
    });
}

function moveFocus(delta) {
    const activeSpread = document.querySelectorAll(".spread")[state.currentSpreadIndex];
    if (!activeSpread) return;

    const visibleCols = Array.from(activeSpread.querySelectorAll(".column:not([style*='display: none'])"));
    if (visibleCols.length === 0) return;

    let currentCol = document.activeElement?.closest(".column");
    let idx = visibleCols.indexOf(currentCol);
    if (idx === -1) idx = (delta > 0) ? -1 : 0;

    idx = Math.max(0, Math.min(visibleCols.length - 1, idx + delta));
    const targetCol = visibleCols[idx];

    if (targetCol) {
        const firstB = targetCol.querySelector(".bookmark:not([style*='display: none'])");
        if (firstB) {
            firstB.focus();
            // In single spread mode, we may still need horizontal scroll if the spread is very wide (IT)
            targetCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
    }
}

function selectBookmarkInCurrentSpread(idx) {
    // Target the active spread
    const gallery = document.getElementById("gallery");
    const spreads = Array.from(document.querySelectorAll(".spread:not([style*='display: none'])"));
    const viewWidth = gallery.offsetWidth;

    let activeSpread = spreads.find(s => {
        const rect = s.getBoundingClientRect();
        return rect.left >= -200 && rect.left < viewWidth / 2;
    }) || spreads[0];

    // Target the active column (either focused or first visible)
    const activeCol = document.activeElement?.closest(".column") || activeSpread.querySelector(".column:not([style*='display: none'])");

    if (activeCol) {
        const visibleBookmarks = Array.from(activeCol.querySelectorAll(".bookmark:not([style*='display: none'])"));
        const target = visibleBookmarks[idx];
        if (target) {
            target.focus();
        }
    }
}

function jumpSpread(delta) {
    const spreads = document.querySelectorAll(".spread");
    const count = spreads.length;

    state.currentSpreadIndex = Math.max(0, Math.min(count - 1, state.currentSpreadIndex + delta));
    updateSpreadVisibility();
    focusFirstInActiveSpread();
}

function scrollToElement(el) {
    if (!el) return;
    const spread = el.closest(".spread") || el;
    spread.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
}

// SEARCH
function initSearch() {
    const input = document.getElementById("global-search");
    input.addEventListener("input", (e) => {
        const val = e.target.value.toLowerCase().trim();
        const body = document.body;

        // Reset visibility first
        state.bookmarks.forEach(b => b.style.display = "flex");
        document.querySelectorAll(".column, .spread").forEach(el => el.style.display = "flex");

        if (val.length < 2) {
            body.classList.remove("is-searching");
            updateSpreadVisibility(); // Return to focused mode
            return;
        }

        body.classList.add("is-searching");

        // Filter bookmarks
        state.bookmarks.forEach(b => {
            const text = b.textContent.toLowerCase();
            const hit = text.includes(val);
            b.style.display = hit ? "flex" : "none";
        });

        // Hide empty columns
        document.querySelectorAll(".column").forEach(col => {
            const hasVisible = col.querySelector(".bookmark:not([style*='display: none'])");
            col.style.display = hasVisible ? "flex" : "none";
        });

        // Hide empty spreads & make them visible (ignore immersive index)
        document.querySelectorAll(".spread").forEach(spread => {
            const hasVisible = spread.querySelector(".bookmark:not([style*='display: none'])");
            spread.style.display = hasVisible ? "flex" : "none";
            spread.style.opacity = hasVisible ? "1" : "0";
            spread.style.pointerEvents = hasVisible ? "auto" : "none";
        });
    });
}

// UTILS
function getDomain(url) {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; }
}

function initClock() {
    const timeEl = document.getElementById("c-time");
    const dateEl = document.getElementById("c-date");
    const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    function tick() {
        const d = new Date();
        timeEl.textContent = d.getHours().toString().padStart(2, '0') + ":" +
            d.getMinutes().toString().padStart(2, '0');
        dateEl.textContent = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    }

    tick();
    setInterval(tick, 1000);
}

function initTheme() {
    const saved = localStorage.getItem("h-theme");
    if (saved) {
        state.currentTheme = state.themes.indexOf(saved);
        if (state.currentTheme === -1) state.currentTheme = 0;
        document.body.dataset.theme = state.themes[state.currentTheme];
    }
}

function cycleTheme() {
    state.currentTheme = (state.currentTheme + 1) % state.themes.length;
    const theme = state.themes[state.currentTheme];
    document.body.dataset.theme = theme;
    localStorage.setItem("h-theme", theme);
    showToast(theme);
}

function showToast(themeName) {
    const toast = document.getElementById("theme-toast");
    if (!toast) return;

    // Clear existing timer to replace immediately if switching fast
    if (state.toastTimer) clearTimeout(state.toastTimer);

    toast.textContent = `Theme: ${themeName.replace("-", " ")}`;
    toast.classList.add("is-visible");

    state.toastTimer = setTimeout(() => {
        toast.classList.remove("is-visible");
        state.toastTimer = null;
    }, 1500);
}

function handleResize() {
    updateSpreadVisibility();
}

function initMobileDock() {
    const dockHome = document.getElementById("dock-home");
    const dockSearch = document.getElementById("dock-search");
    const dockTheme = document.getElementById("dock-theme");
    const searchInput = document.getElementById("global-search");

    dockHome?.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        document.getElementById("gallery")?.scrollTo({ top: 0, behavior: "smooth" });
    });

    dockSearch?.addEventListener("click", () => {
        searchInput.focus();
    });

    dockTheme?.addEventListener("click", () => {
        cycleTheme();
    });
}

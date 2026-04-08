/* ============================================================
   CONSTANTS
============================================================ */
const MODE_STATIC  = "static";
const MODE_FLUID   = "fluid";
const MODE_SHUFFLE = "shuffle";

const mobileQuery = window.matchMedia("(max-width: 768px)");
const isMobile = mobileQuery.matches;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Reload when crossing the mobile breakpoint so layout + card filtering update correctly
mobileQuery.addEventListener("change", () => location.reload());

let currentMode = MODE_STATIC;

const shuffleIntervals = new Map();
const wormIntervals    = new Map();

/* ============================================================
   THEMES
============================================================ */
const THEMES = [
  {
    id: "aurora",   label: "Aurora",   color: "#00ffb3",
    preview: "linear-gradient(135deg, #01090f 35%, #00c876 70%, #00ffb3 100%)"
  },
  {
    id: "synth",    label: "Synth",    color: "#ff006e",
    preview: "linear-gradient(135deg, #0a0015 0%, #ff006e 55%, #00f5ff 100%)"
  },
  {
    id: "obsidian", label: "Obsidian", color: "#d4a017",
    preview: "linear-gradient(135deg, #060500 35%, #8a6200 70%, #d4a017 100%)"
  },
  {
    id: "abyss",    label: "Abyss",    color: "#00ffe1",
    preview: "linear-gradient(135deg, #000810 35%, #00a898 70%, #00ffe1 100%)"
  },
  {
    id: "solar",    label: "Solar",    color: "#ffe066",
    preview: "radial-gradient(ellipse at 30% 100%, #020100 40%, #c87800 70%, #ffe066 100%)"
  },
  {
    id: "sakura",   label: "Sakura",   color: "#ff9eb5",
    preview: "linear-gradient(135deg, #08060e 35%, #c0406a 70%, #ff9eb5 100%)"
  },
  {
    id: "void",     label: "Void",     color: "#c8c8ff",
    preview: "radial-gradient(ellipse at 80% 20%, #000000 50%, #2a1a5e 80%, #c8c8ff 100%)"
  },
  {
    id: "ember",    label: "Ember",    color: "#ff8c00",
    preview: "linear-gradient(135deg, #050200 35%, #a03800 70%, #ff8c00 100%)"
  }
];

/* ============================================================
   CATEGORY ICONS
============================================================ */
const CAT_ICONS = {
  "mooc":          "🎓",
  "i.t.":          "💻",
  "emploi":        "💼",
  "education":     "📖",
  "design & art":  "🎨",
  "general":       "🌐",
  "cool websites": "✨",
  "finance":       "💰",
  "media":         "📰",
};

function getCategoryIcon(name) {
  return CAT_ICONS[name.toLowerCase()] || "📁";
}

/* ============================================================
   UTILITY
============================================================ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/* ============================================================
   SKELETON LOADING
============================================================ */
function buildSkeletonHTML() {
  const count = 12;
  const cards = Array.from({ length: count }, () => `<div class="skeleton-card"></div>`).join("");
  return `<div class="skeleton-grid">${cards}</div>`.repeat(3);
}

/* ============================================================
   ENTRANCE ANIMATIONS
============================================================ */
function initEntranceAnimations() {
  if (prefersReducedMotion) {
    // Skip animation — mark everything visible immediately
    document.querySelectorAll(".bento-grid, .cat-section").forEach(el => {
      el.classList.add("is-visible");
    });
    return;
  }

  // Observe each bento-grid: when it enters the viewport, play the card entrance
  const gridObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      gridObserver.unobserve(entry.target);
    });
  }, { threshold: 0.05 });

  // Observe cat-sections for the heading slide-in
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      sectionObserver.unobserve(entry.target);
    });
  }, { threshold: 0.01 });

  document.querySelectorAll(".bento-grid").forEach(el => gridObserver.observe(el));
  document.querySelectorAll(".cat-section").forEach(el => sectionObserver.observe(el));
}

/* ============================================================
   INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.toggle("is-mobile", isMobile);

  // Desktop: restore sidebar state
  if (!isMobile && localStorage.getItem("sidebarClosed") === "true") {
    document.body.classList.add("sidebar-closed");
    document.getElementById("sidebar-toggle")
      .setAttribute("aria-expanded", "false");
  }

  const main = document.getElementById("main-content");

  // Show skeleton loading state while JSON fetches
  main.innerHTML = buildSkeletonHTML();

  fetch("websites.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      // Clear loading state
      main.innerHTML = "";

      // Build UI
      buildPinnedSection(data.categories, main);
      buildCategorySections(data.categories, main);
      buildSidebar(data.categories);

      // Build controls first, then restore state into them
      buildThemePanel();
      restoreTheme();
      restoreMode();
      initClock();
      initSidebarToggle();
      initThemePanelToggle();
      initSearch();
      initScrollSpy();
      initKeyboardNav();
      initKeyboardHelp();

      initEntranceAnimations();

      if (!isMobile && !prefersReducedMotion) {
        initTiltEffect();
        initHoloEffect();
      }
    })
    .catch(err => {
      main.innerHTML = `
        <p style="color:#ef4444;padding:3rem 0;font-family:monospace;font-size:0.85rem;line-height:1.8">
          Could not load bookmarks.<br>
          <span style="color:#6b7280;font-size:0.8rem">${escapeHtml(err.message)}</span>
        </p>`;
    });
});

/* ============================================================
   PINNED / FAVORITES SECTION
============================================================ */
function collectFavorites(categories) {
  const favs = [];
  function walk(cats) {
    cats.forEach(cat => {
      if (cat.websites) {
        cat.websites.forEach(w => { if (w.favorite) favs.push(w); });
      }
      if (cat.subcategories) walk(cat.subcategories);
    });
  }
  walk(categories);
  return isMobile ? favs.filter(w => w.mobile) : favs;
}

function buildPinnedSection(categories, container) {
  const favs = collectFavorites(categories);
  if (!favs.length) return;

  const section = document.createElement("div");
  section.id = "pinned-section";

  section.innerHTML = `
    <div class="pinned-header">
      <span class="pinned-label">Pinned</span>
      <span class="pinned-line"></span>
    </div>
  `;
  section.appendChild(createBentoGrid(favs));
  container.appendChild(section);
}

/* ============================================================
   CATEGORY SECTIONS
============================================================ */
function buildCategorySections(categories, container) {
  categories.forEach(cat => {
    const section = buildCategorySection(cat);
    if (section) container.appendChild(section);
  });
}

function buildCategorySection(cat) {
  const slug = `s-${toSlug(cat.name)}`;

  const section = document.createElement("section");
  section.id = slug;
  section.className = "cat-section";
  section.dataset.spy = "true";

  const h2 = document.createElement("h2");
  h2.className = "cat-heading";
  h2.textContent = cat.name;
  section.appendChild(h2);

  // Direct websites on this category
  if (cat.websites) {
    const list = isMobile ? cat.websites.filter(w => w.mobile) : cat.websites;
    if (list.length) section.appendChild(createBentoGrid(list));
  }

  // Subcategories
  if (cat.subcategories) {
    cat.subcategories.forEach(sub => {
      const subEl = buildSubcatSection(sub, slug, 1);
      if (subEl) section.appendChild(subEl);
    });
  }

  // Don't render an empty section
  const hasCards = section.querySelector(".website-card");
  if (!hasCards && !cat.websites) return null;

  return section;
}

function buildSubcatSection(sub, parentId, depth) {
  const id = `${parentId}-${toSlug(sub.name)}`;

  const websites = sub.websites
    ? (isMobile ? sub.websites.filter(w => w.mobile) : sub.websites)
    : [];

  const hasSubs = sub.subcategories && sub.subcategories.length > 0;
  if (!websites.length && !hasSubs) return null;

  const div = document.createElement("div");
  div.id = id;
  div.className = `subcat subcat-depth-${depth}`;
  div.dataset.spy = "true";

  const h = document.createElement(depth === 1 ? "h3" : "h4");
  h.className = "subcat-heading";
  h.textContent = sub.name;
  div.appendChild(h);

  if (websites.length) div.appendChild(createBentoGrid(websites));

  if (hasSubs) {
    sub.subcategories.forEach(child => {
      const childEl = buildSubcatSection(child, id, depth + 1);
      if (childEl) div.appendChild(childEl);
    });
  }

  return div;
}

/* ============================================================
   BENTO GRID
============================================================ */
function createBentoGrid(websites) {
  const grid = document.createElement("div");
  grid.className = "bento-grid";
  websites.forEach((w, i) => {
    const card = createCard(w);
    card.style.setProperty("--card-i", i);
    grid.appendChild(card);
  });
  return grid;
}

/* ============================================================
   CARD
============================================================ */
function createCard(website) {
  const card = document.createElement("a");
  card.className = "website-card";
  card.href = website.url;
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  if (website.favorite) card.classList.add("favorite");

  const domain = getDomain(website.url);
  let icon = website.icon || `https://www.google.com/s2/favicons?domain=${domain}`;

  const name = escapeHtml(website.name);
  const desc = website.description ? escapeHtml(website.description) : "";

  card.innerHTML = `
    <div class="card-inner">
      ${website.favorite ? '<span class="fav-dot" aria-hidden="true"></span>' : ""}
      <div class="card-header">
        <img src="${escapeHtml(icon)}" class="favicon" alt="" loading="lazy" onerror="this.style.display='none'">
        <h3>${name}</h3>
      </div>
      ${desc ? `<p>${desc}</p>` : ""}
      ${domain ? `<span class="card-domain">${escapeHtml(domain)}</span>` : ""}
    </div>
  `;

  return card;
}

/* ============================================================
   SIDEBAR
============================================================ */
function buildSidebar(categories) {
  const navList = document.getElementById("nav-list");

  categories.forEach((cat, i) => {
    const slug = `s-${toSlug(cat.name)}`;
    const hasSubs = cat.subcategories && cat.subcategories.length > 0;
    const icon = getCategoryIcon(cat.name);

    const li = document.createElement("li");
    li.className = "nav-item" + (hasSubs ? " has-children" : "");
    li.dataset.section = slug;

    if (hasSubs) {
      // Expandable group
      li.innerHTML = `
        <button class="nav-link" aria-expanded="false" data-target="${slug}" data-section="${slug}">
          <span class="nav-icon" aria-hidden="true">${icon}</span>
          <span class="nav-label">${escapeHtml(cat.name)}</span>
          <span class="nav-chevron" aria-hidden="true">›</span>
        </button>
        <ul class="nav-children" role="list"></ul>
      `;

      const btn = li.querySelector(".nav-link");
      const children = li.querySelector(".nav-children");

      // Subcategory links
      cat.subcategories.forEach(sub => {
        const subSlug = `${slug}-${toSlug(sub.name)}`;
        const subLi = document.createElement("li");
        const subLink = document.createElement("a");
        subLink.className = "nav-child-link";
        subLink.href = `#${subSlug}`;
        subLink.textContent = sub.name;
        subLink.dataset.target = subSlug;
        subLink.addEventListener("click", e => { e.preventDefault(); scrollToSection(subSlug); });
        subLi.appendChild(subLink);
        children.appendChild(subLi);
      });

      // Toggle expand/collapse
      btn.addEventListener("click", () => {
        const isOpen = li.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(isOpen));
        // Scroll to section on first click if not yet open
        if (isOpen) scrollToSection(slug);
      });

    } else {
      // Simple link
      li.innerHTML = `
        <a class="nav-link" href="#${slug}" data-target="${slug}">
          <span class="nav-icon" aria-hidden="true">${icon}</span>
          <span class="nav-label">${escapeHtml(cat.name)}</span>
        </a>
      `;
      li.querySelector(".nav-link").addEventListener("click", e => {
        e.preventDefault();
        scrollToSection(slug);
        if (isMobile) closeSidebar();
      });
    }

    // Divider before last item
    if (i === categories.length - 1) {
      const div = document.createElement("li");
      div.className = "nav-divider";
      div.setAttribute("aria-hidden", "true");
      navList.appendChild(div);
    }

    navList.appendChild(li);
  });
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const headerH = document.getElementById("site-header").offsetHeight;
  const top = el.getBoundingClientRect().top + window.scrollY - headerH - 20;
  window.scrollTo({ top, behavior: "smooth" });
}

/* ============================================================
   SCROLL SPY
============================================================ */
function initScrollSpy() {
  const spyEls  = document.querySelectorAll("[data-spy]");
  const headerH = document.getElementById("site-header").offsetHeight;
  const anchor  = headerH + 24; // trigger line: just below the fixed header

  let ticking = false;

  function update() {
    // Pick the spy element whose top edge is closest to (but not below) the anchor.
    // This is the section that has most recently scrolled in — reliable for any height.
    let best = null, bestDist = Infinity;
    spyEls.forEach(el => {
      if (el.hidden) return;
      const top = el.getBoundingClientRect().top;
      if (top <= anchor) {
        const dist = anchor - top; // smaller = more recently passed the line
        if (dist < bestDist) { bestDist = dist; best = el; }
      }
    });
    if (best) setActiveNav(best.id);
    ticking = false;
  }

  document.addEventListener("scroll", () => {
    _toastReady = true; // enable toast once user actually scrolls
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });

  // Fire on load for initial state (no toast)
  update();
}

let _lastToastSection = null;
let _toastTimer = null;
let _toastReady = false; // suppress toast on initial page load

function showSectionToast(label) {
  let toast = document.getElementById("section-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "section-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = label;
  toast.classList.add("visible");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove("visible"), 1800);
}

function setActiveNav(id) {
  // ── Sidebar links ──────────────────────────────────────────
  document.querySelectorAll(".nav-link, .nav-child-link").forEach(el => {
    el.classList.remove("active");
  });
  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.remove("has-active-child");
  });

  const target = document.querySelector(`[data-target="${id}"]`);
  if (target) {
    target.classList.add("active");
    const parentItem = target.closest(".nav-item.has-children");
    if (parentItem) {
      parentItem.classList.add("has-active-child");
      if (!parentItem.classList.contains("is-open")) {
        parentItem.classList.add("is-open");
        const btn = parentItem.querySelector(".nav-link[aria-expanded]");
        if (btn) btn.setAttribute("aria-expanded", "true");
      }
    }
  }

  // ── Section / subcat is-active classes ────────────────────
  document.querySelectorAll(".cat-section.is-active").forEach(el => el.classList.remove("is-active"));
  document.querySelectorAll(".subcat.is-active").forEach(el => el.classList.remove("is-active"));

  const spyEl = document.getElementById(id);
  if (!spyEl) return;

  // Mark the cat-section (and optionally the subcat)
  const catSection = spyEl.classList.contains("cat-section")
    ? spyEl
    : spyEl.closest(".cat-section");
  if (catSection) catSection.classList.add("is-active");

  const subcat = spyEl.classList.contains("subcat") ? spyEl : null;
  if (subcat) subcat.classList.add("is-active");

  // ── Section name toast — fires when crossing into a new cat-section ──
  if (catSection) {
    const sectionId = catSection.id;
    if (sectionId !== _lastToastSection) {
      _lastToastSection = sectionId;
      if (_toastReady) {
        const navLabel = document.querySelector(`[data-target="${sectionId}"] .nav-label`)?.textContent
                      || catSection.querySelector(".cat-heading")?.textContent
                      || "";
        if (navLabel) showSectionToast(navLabel);
      }
    }
  }
}

/* ============================================================
   SIDEBAR TOGGLE
============================================================ */
function initSidebarToggle() {
  const toggle  = document.getElementById("sidebar-toggle");
  const overlay = document.getElementById("sidebar-overlay");

  toggle.addEventListener("click", () => {
    if (isMobile) {
      toggleMobileSidebar();
    } else {
      toggleDesktopSidebar();
    }
  });

  overlay.addEventListener("click", closeSidebar);

  // Escape closes sidebar
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSidebar();
  });
}

function toggleDesktopSidebar() {
  const isClosed = document.body.classList.toggle("sidebar-closed");
  localStorage.setItem("sidebarClosed", isClosed);
  document.getElementById("sidebar-toggle")
    .setAttribute("aria-expanded", String(!isClosed));
}

function toggleMobileSidebar() {
  const isOpen = document.body.classList.toggle("sidebar-open");
  document.getElementById("sidebar-overlay").setAttribute("aria-hidden", String(!isOpen));
  document.getElementById("sidebar-toggle").setAttribute("aria-expanded", String(isOpen));
}

function closeSidebar() {
  if (isMobile) {
    document.body.classList.remove("sidebar-open");
    document.getElementById("sidebar-overlay").setAttribute("aria-hidden", "true");
    document.getElementById("sidebar-toggle").setAttribute("aria-expanded", "false");
  }
}

/* ============================================================
   CLOCK
============================================================ */
function initClock() {
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function tick() {
    const now = new Date();
    const h   = String(now.getHours()).padStart(2, "0");
    const m   = String(now.getMinutes()).padStart(2, "0");
    timeEl.textContent = `${h}:${m}`;
    dateEl.textContent = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  }

  tick();
  setInterval(tick, 1000);
}

/* ============================================================
   THEME PANEL
============================================================ */
function buildThemePanel() {
  // Theme grid
  const grid = document.getElementById("theme-grid");
  THEMES.forEach(t => {
    const card = document.createElement("button");
    card.className = "theme-card";
    card.dataset.theme = t.id;
    card.setAttribute("role", "radio");
    card.setAttribute("aria-checked", "false");
    card.setAttribute("aria-label", `${t.label} theme`);
    card.innerHTML = `
      <span class="theme-swatch" style="background:${t.preview}" aria-hidden="true"></span>
      <span class="theme-name">${t.label}</span>
    `;
    card.addEventListener("click", () => applyTheme(t.id));
    grid.appendChild(card);
  });

  // Motion pills
  const motionDiv = document.getElementById("motion-pills");
  [
    { id: MODE_STATIC,  label: "Off"     },
    { id: MODE_FLUID,   label: "Flow"    },
    { id: MODE_SHUFFLE, label: "Shuffle" }
  ].forEach(m => {
    const btn = document.createElement("button");
    btn.className = "motion-pill";
    btn.textContent = m.label;
    btn.dataset.mode = m.id;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => applyMode(m.id));
    motionDiv.appendChild(btn);
  });
}

function initThemePanelToggle() {
  const panel   = document.getElementById("theme-panel");
  const overlay = document.getElementById("theme-overlay");
  const btn     = document.getElementById("theme-btn");
  const close   = document.getElementById("theme-panel-close");

  // Focus trap helpers
  function getFocusable() {
    return [...panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter(el => !el.disabled && el.offsetParent !== null);
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const focusable = getFocusable();
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }

  function openPanel() {
    panel.setAttribute("aria-hidden", "false");
    panel.setAttribute("aria-modal", "true");
    btn.setAttribute("aria-expanded", "true");
    panel.addEventListener("keydown", trapFocus);
    close.focus();
  }

  function closePanel() {
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("aria-modal", "false");
    btn.setAttribute("aria-expanded", "false");
    panel.removeEventListener("keydown", trapFocus);
    btn.focus();
  }

  btn.addEventListener("click", () => {
    panel.getAttribute("aria-hidden") === "false" ? closePanel() : openPanel();
  });

  close.addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && panel.getAttribute("aria-hidden") === "false") {
      closePanel();
    }
  });
}

/* ============================================================
   THEMES
============================================================ */
function applyTheme(id) {
  const valid = THEMES.some(t => t.id === id);
  const theme = valid ? id : "aurora";

  document.body.dataset.theme = theme;
  localStorage.setItem("activeTheme", theme);

  document.querySelectorAll(".theme-card").forEach(card => {
    const active = card.dataset.theme === theme;
    card.classList.toggle("active", active);
    card.setAttribute("aria-checked", String(active));
  });
}

function restoreTheme() {
  const saved = localStorage.getItem("activeTheme");
  const valid = THEMES.some(t => t.id === saved);
  applyTheme(valid ? saved : "aurora");
}

/* ============================================================
   ANIMATION MODES
============================================================ */
function applyMode(mode) {
  currentMode = mode;
  sessionStorage.setItem("activeMode", mode);

  document.querySelectorAll(".motion-pill").forEach(pill => {
    const active = pill.dataset.mode === mode;
    pill.classList.toggle("active", active);
    pill.setAttribute("aria-pressed", String(active));
  });

  stopAllTimers();
  if (mode === MODE_STATIC || isMobile || prefersReducedMotion) return;

  const grids = document.querySelectorAll(".bento-grid");

  if (mode === MODE_SHUFFLE) {
    grids.forEach(grid => {
      shuffleIntervals.set(grid, setInterval(() => smoothShuffle(grid), 2000));
    });
  }

  if (mode === MODE_FLUID) {
    grids.forEach(grid => {
      wormIntervals.set(grid, setInterval(() => wormSwap(grid), 1250));
    });
  }
}

function restoreMode() {
  const saved = sessionStorage.getItem("activeMode") || MODE_STATIC;
  applyMode(saved);
}

function stopAllTimers() {
  shuffleIntervals.forEach(clearInterval);
  wormIntervals.forEach(clearInterval);
  shuffleIntervals.clear();
  wormIntervals.clear();
}

/* ============================================================
   SHUFFLE MODE
============================================================ */
function smoothShuffle(grid) {
  if (grid.matches(":hover") || currentMode !== MODE_SHUFFLE) return;
  const cards = [...grid.children];
  if (cards.length < 2) return;
  animateGrid(grid, () => {
    cards.sort(() => Math.random() - 0.5).forEach(c => grid.appendChild(c));
  });
}

/* ============================================================
   WORM / FLOW MODE
============================================================ */
function wormSwap(grid) {
  if (grid.matches(":hover") || currentMode !== MODE_FLUID) return;
  const cards = [...grid.children];
  if (cards.length < 2) return;

  let i = Math.floor(Math.random() * cards.length);
  for (let x = 0; x < 6 && cards[i].matches(":hover"); x++)
    i = Math.floor(Math.random() * cards.length);

  const a = cards[i];
  if (!a || a.matches(":hover")) return;

  const j = Math.random() < 0.5 ? i - 1 : i + 1;
  if (!cards[j] || cards[j].matches(":hover")) return;
  const b = cards[j];

  animateGrid(grid, () => {
    const next = a.nextSibling === b ? a : a.nextSibling;
    grid.insertBefore(b, a);
    grid.insertBefore(a, next);
  });
}

/* ============================================================
   FLIP ANIMATION
============================================================ */
function animateGrid(grid, mutate) {
  const cards = [...grid.children];
  if (!cards.length) return;

  const first = new Map();
  cards.forEach(c => first.set(c, c.getBoundingClientRect()));

  mutate();

  const last = new Map();
  cards.forEach(c => last.set(c, c.getBoundingClientRect()));

  cards.forEach(card => {
    const a = first.get(card), b = last.get(card);
    const dx = a.left - b.left;
    const dy = a.top  - b.top;
    if (dx === 0 && dy === 0) return;

    card.style.transition = "transform 0s";
    card.style.transform  = `translate(${dx}px, ${dy}px)`;

    requestAnimationFrame(() => {
      card.style.transition = "transform 500ms cubic-bezier(0.22, 0.61, 0.36, 1)";
      card.style.transform  = "translate(0, 0)";
      setTimeout(() => {
        card.style.transition = "";
        card.style.transform  = "";
      }, 520);
    });
  });
}

/* ============================================================
   TILT EFFECT
============================================================ */
function initTiltEffect() {
  document.querySelectorAll(".card-inner").forEach(inner => {
    inner.addEventListener("mousemove", e => {
      const r = inner.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
      const y = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
      inner.style.transform =
        `rotateX(${-y * 10}deg) rotateY(${x * 10}deg) translateZ(8px)`;
    });
    inner.addEventListener("mouseleave", () => {
      inner.style.transform = "";
    });
  });
}

/* ============================================================
   HOLOGRAPHIC FOIL  (favourite cards only)
============================================================ */
function initHoloEffect() {
  document.querySelectorAll(".website-card.favorite .card-inner").forEach(inner => {
    inner.addEventListener("mousemove", e => {
      const r = inner.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width  * 100).toFixed(1) + "%";
      const y = ((e.clientY - r.top)  / r.height * 100).toFixed(1) + "%";
      inner.style.setProperty("--pointer-x", x);
      inner.style.setProperty("--pointer-y", y);
    });
    inner.addEventListener("mouseleave", () => {
      inner.style.setProperty("--pointer-x", "50%");
      inner.style.setProperty("--pointer-y", "50%");
    });
  });
}

/* ============================================================
   KEYBOARD NAVIGATION  (ZQSD + arrow keys)
   Q / ←  → previous section   (top-level category)
   D / →  → next section
   Z / ↑  → previous subsection (any spy target)
   S / ↓  → next subsection
============================================================ */
function initKeyboardNav() {
  // Ordered list of all spy-target IDs in DOM order
  function getTargetIds(selector) {
    return [...document.querySelectorAll(selector)]
      .filter(el => el.id && !el.hidden)
      .map(el => el.id);
  }

  // Find which target is currently nearest the top of the viewport.
  // If the user already explicitly navigated to a section, use that
  // as the anchor — bottom sections can't scroll to the top anchor line.
  function getCurrentIdx(ids) {
    // If we already have an explicit active section, prefer that
    if (activeSectionId) {
      const explicit = ids.indexOf(activeSectionId);
      if (explicit !== -1) return explicit;
    }

    const headerH = document.getElementById("site-header").offsetHeight;
    const anchor  = headerH + 40;

    let best = 0, bestDist = Infinity;
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el || el.hidden) return;
      const dist = Math.abs(el.getBoundingClientRect().top - anchor);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }

  // ── Card number badges ──────────────────────────────────────
  let activeSectionId  = null;   // currently numbered section/subcat
  let numberedCards    = [];     // ordered list of cards with badges
  let focusedCardIdx   = null;   // which card is keyboard-focused (-1 = none)

  function getDirectCards(sectionId) {
    const el = document.getElementById(sectionId);
    if (!el) return [];
    // Only grab cards in the DIRECT bento-grid child (never recurse into subcats)
    const directGrid = el.querySelector(":scope > .bento-grid");
    if (directGrid) return [...directGrid.querySelectorAll(".website-card:not([hidden])")];
    // No direct grid (section uses only subcategories) — show no badges at this level
    return [];
  }

  function attachBadges(sectionId) {
    if (sectionId === activeSectionId) return; // already numbered
    clearBadges();
    activeSectionId = sectionId;
    numberedCards   = getDirectCards(sectionId);
    focusedCardIdx  = null;

    numberedCards.forEach((card, i) => {
      const badge = document.createElement("span");
      badge.className = "kbd-badge";
      badge.textContent = i < 9 ? String(i + 1) : (i === 9 ? "0" : "");
      if (i >= 10) { badge.textContent = ""; badge.hidden = true; }
      card.appendChild(badge);
    });
  }

  function clearBadges() {
    numberedCards.forEach(card => {
      card.querySelector(".kbd-badge")?.remove();
      card.classList.remove("kbd-focused");
    });
    numberedCards  = [];
    activeSectionId = null;
    focusedCardIdx  = null;
  }

  function focusCard(idx) {
    numberedCards.forEach(c => c.classList.remove("kbd-focused"));
    if (idx === null || !numberedCards[idx]) return;
    focusedCardIdx = idx;
    numberedCards[idx].classList.add("kbd-focused");
    numberedCards[idx].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // HUD toast
  function showHud(text, persist = false) {
    let hud = document.getElementById("nav-hud");
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "nav-hud";
      document.body.appendChild(hud);
    }
    hud.innerHTML = text;
    hud.classList.add("visible");
    clearTimeout(hud._t);
    if (!persist) hud._t = setTimeout(() => hud.classList.remove("visible"), 1500);
  }

  function hideHud() {
    const hud = document.getElementById("nav-hud");
    if (hud) { clearTimeout(hud._t); hud.classList.remove("visible"); }
  }

  function navigateTo(id, hudText) {
    scrollToSection(id);
    attachBadges(id);
    const count = numberedCards.length;
    const hint  = count ? `<span class="hud-hint">1–${Math.min(count, 10)} to pick · Enter to open</span>` : "";
    showHud(hudText + hint, true);
    // Auto-hide after 3s if user doesn't press a number
    const hud = document.getElementById("nav-hud");
    clearTimeout(hud._t);
    hud._t = setTimeout(() => hud.classList.remove("visible"), 3000);
  }

  document.addEventListener("keydown", e => {
    const active = document.activeElement;
    if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") return;

    const key = e.key;

    // ── Escape: clear badges and focus ───────────────────────
    if (key === "Escape") {
      clearBadges();
      hideHud();
      return;
    }

    // ── Enter: open focused card ──────────────────────────────
    if (key === "Enter" && focusedCardIdx !== null) {
      e.preventDefault();
      const card = numberedCards[focusedCardIdx];
      if (card) card.click();
      return;
    }

    // ── Number keys 1–9, 0 (=10): pick card ──────────────────
    if (/^[0-9]$/.test(key) && activeSectionId) {
      const idx = key === "0" ? 9 : parseInt(key, 10) - 1;
      if (numberedCards[idx]) {
        e.preventDefault();
        focusCard(idx);
        // Keep HUD alive while a card is focused
        const hud = document.getElementById("nav-hud");
        if (hud) { clearTimeout(hud._t); hud._t = setTimeout(() => hud.classList.remove("visible"), 3000); }
      }
      return;
    }

    // ── Section jump (Q / ← / D / →) ─────────────────────────
    if (key === "q" || key === "Q" || key === "ArrowLeft") {
      e.preventDefault();
      const ids = getTargetIds(".cat-section");
      const idx = Math.max(0, getCurrentIdx(ids) - 1);
      const id  = ids[idx];
      const label = document.getElementById(id)?.querySelector(".cat-heading")?.textContent || id;
      navigateTo(id, "← " + label + " ");
      return;
    }

    if (key === "d" || key === "D" || key === "ArrowRight") {
      e.preventDefault();
      const ids = getTargetIds(".cat-section");
      const idx = Math.min(ids.length - 1, getCurrentIdx(ids) + 1);
      const id  = ids[idx];
      const label = document.getElementById(id)?.querySelector(".cat-heading")?.textContent || id;
      navigateTo(id, label + " →" + " ");
      return;
    }

    // ── Subsection step (Z / ↑ / S / ↓) ──────────────────────
    if (key === "z" || key === "Z" || key === "ArrowUp") {
      e.preventDefault();
      const ids = getTargetIds(".cat-section, .subcat");
      const idx = Math.max(0, getCurrentIdx(ids) - 1);
      const id  = ids[idx];
      const heading = document.getElementById(id)?.querySelector(".cat-heading, .subcat-heading");
      navigateTo(id, "↑ " + (heading?.textContent || id) + " ");
      return;
    }

    if (key === "s" || key === "S" || key === "ArrowDown") {
      e.preventDefault();
      const ids = getTargetIds(".cat-section, .subcat");
      const idx = Math.min(ids.length - 1, getCurrentIdx(ids) + 1);
      const id  = ids[idx];
      const heading = document.getElementById(id)?.querySelector(".cat-heading, .subcat-heading");
      navigateTo(id, "↓ " + (heading?.textContent || id) + " ");
    }
  });
}


/* ============================================================
   KEYBOARD HELP OVERLAY  (press ?)
============================================================ */
function initKeyboardHelp() {
  const SHORTCUTS = [
    { keys: "/ ",          desc: "Focus search" },
    { keys: "Esc",         desc: "Clear search / close" },
    { keys: "← Q",         desc: "Previous section" },
    { keys: "→ D",         desc: "Next section" },
    { keys: "↑ Z",         desc: "Previous subsection" },
    { keys: "↓ S",         desc: "Next subsection" },
    { keys: "1 – 9  0",    desc: "Jump to card in section" },
    { keys: "Enter",       desc: "Open focused card" },
    { keys: "?",           desc: "Toggle this help" },
  ];

  const overlay = document.createElement("div");
  overlay.id = "kbd-help-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Keyboard shortcuts");
  overlay.setAttribute("aria-modal", "true");
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="kbd-help-box">
      <div class="kbd-help-head">
        <span class="kbd-help-title">Keyboard shortcuts</span>
        <button class="kbd-help-close" aria-label="Close">✕</button>
      </div>
      <ul class="kbd-help-list">
        ${SHORTCUTS.map(s => `
          <li>
            <span class="kbd-help-keys">${s.keys.split(" ").map(k => k.trim() ? `<kbd>${k}</kbd>` : `<span class="kbd-sep">or</span>`).join(" ")}</span>
            <span class="kbd-help-desc">${s.desc}</span>
          </li>
        `).join("")}
      </ul>
    </div>
  `;

  document.body.appendChild(overlay);

  function openHelp() {
    overlay.hidden = false;
    overlay.querySelector(".kbd-help-close").focus();
  }
  function closeHelp() {
    overlay.hidden = true;
  }

  overlay.querySelector(".kbd-help-close").addEventListener("click", closeHelp);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeHelp(); });

  document.addEventListener("keydown", e => {
    const active = document.activeElement;
    if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") return;
    if (e.key === "?") { overlay.hidden ? openHelp() : closeHelp(); return; }
    if (e.key === "Escape" && !overlay.hidden) { closeHelp(); return; }
  });
}

function initSearch() {
  const input   = document.getElementById("search-input");
  const countEl = document.getElementById("search-count");
  const hint    = document.getElementById("search-hint");

  // '/' focuses the search
  document.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement !== input
        && document.activeElement.tagName !== "INPUT") {
      e.preventDefault();
      input.focus();
      input.select();
    }
    if (e.key === "Escape" && document.activeElement === input) {
      input.value = "";
      filterCards("", countEl);
      input.blur();
    }
  });

  input.addEventListener("input", () => filterCards(input.value, countEl));

  // Show/hide the "/" hint
  input.addEventListener("focus", () => { if (hint) hint.style.display = "none"; });
  input.addEventListener("blur",  () => {
    if (hint && !input.value) hint.style.display = "";
  });
}

function filterCards(query, countEl) {
  const q = query.toLowerCase().trim();

  // Phase 1: animate cards out or immediately restore them
  document.querySelectorAll(".website-card").forEach(card => {
    const match = q === "" || card.textContent.toLowerCase().includes(q);
    if (match) {
      card.classList.remove("is-filtered");
      card.hidden = false;
    } else {
      card.classList.add("is-filtered");
    }
  });

  // Phase 2: after transition, set hidden and collapse empty containers
  const TRANSITION_MS = 170;
  setTimeout(() => {
    document.querySelectorAll(".website-card.is-filtered").forEach(card => {
      card.hidden = true;
    });

    // Collapse empty grids
    document.querySelectorAll(".bento-grid").forEach(grid => {
      grid.hidden = q !== "" && [...grid.children].every(c => c.hidden);
    });

    // Collapse empty subcats and sections (bottom-up)
    ["subcat", "cat-section"].forEach(cls => {
      document.querySelectorAll("." + cls).forEach(el => {
        if (q === "") { el.hidden = false; return; }
        el.hidden = !el.querySelector(".website-card:not([hidden])");
      });
    });

    // Collapse pinned if empty
    const pinned = document.getElementById("pinned-section");
    if (pinned) {
      pinned.hidden = q !== "" && !pinned.querySelector(".website-card:not([hidden])");
    }

    // Count + empty state
    const n = document.querySelectorAll(".website-card:not([hidden])").length;
    if (countEl) countEl.textContent = q ? `${n}` : "";

    const main = document.getElementById("main-content");
    let emptyEl = document.getElementById("search-empty");
    if (q && n === 0) {
      if (!emptyEl) {
        emptyEl = document.createElement("p");
        emptyEl.id = "search-empty";
        emptyEl.className = "search-empty-state";
        main.appendChild(emptyEl);
      }
      emptyEl.innerHTML = `No bookmarks match &ldquo;<em>${escapeHtml(q)}</em>&rdquo;`;
    } else if (emptyEl) {
      emptyEl.remove();
    }
  }, TRANSITION_MS);
}

/* ============================================================
   ANIMATION MODES
============================================================ */
const MODE_SHUFFLE = "shuffle";
const MODE_FLUID   = "fluid"; // worm mode

let currentMode = MODE_FLUID;

const SHUFFLE_SPEED = 2000;
const WORM_SPEED    = 1250;

const shuffleIntervals = new Map();
const wormIntervals    = new Map();

/* ============================================================
   THEME LIST
============================================================ */
const THEMES = [
  { id: "neon",     label: "Neon",     color: "#7dc8ff" },
  { id: "akira",    label: "Akira",    color: "#ff3b3b" },
  { id: "eva",      label: "EVA",      color: "#ff7b2f" },
  { id: "gits",     label: "GITS",     color: "#00f2ff" },
  { id: "terminal", label: "Terminal", color: "#00ff88" },
  { id: "vhs",      label: "VHS",      color: "#ff00e0" },
  { id: "sf",       label: "SF",       color: "#ffb300" },
  { id: "crest",    label: "Crest",    color: "#ff0030" }
];

/* ============================================================
   INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {

  fetch("websites.json")
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("categories-container");

      loadCategories(data.categories, container);
      createControlDeck();
      restoreTheme();
      initTiltEffect();
      attachCardSFX();
      applyMode(currentMode);
    });

});

/* ============================================================
   CATEGORY BUILDER
============================================================ */
function loadCategories(categories, container, depth = 0) {
  categories.forEach(item => {
    const wrap = document.createElement("div");
    wrap.className = `category-level-${depth}`;

    const title = document.createElement(depth === 0 ? "h2" : "h3");
    title.className = depth === 0 ? "category-title" : "subcategory-title";
    title.textContent = item.name;
    wrap.appendChild(title);

    // MOBILE ONLY CATEGORY SUPPORT
    if (item.mobileOnly && window.innerWidth > 480) return;
    if (!item.mobileOnly && window.innerWidth <= 480 && item.hideOnMobile) return;

    if (item.subcategories) {
      loadCategories(item.subcategories, wrap, depth + 1);
    }

    if (item.websites) {
      wrap.appendChild(createBentoGrid(item.websites));
    }

    container.appendChild(wrap);
  });
}

/* ============================================================
   GRID + FAVORITES
============================================================ */
function createBentoGrid(websites) {
  const grid = document.createElement("div");
  grid.className = "bento-grid";

  websites.forEach((website, i) => {
    const card = document.createElement("a");
    card.className = "website-card";
    card.href = website.url;
    card.target = "_blank";

    if (website.favorite) card.classList.add("favorite");

    // Desktop bento layout
    if (i % 7 === 0) card.classList.add("bento-wide");
    else if (i % 9 === 0) card.classList.add("bento-tall");

    // Disable bento spans on mobile
    if (window.innerWidth <= 480) {
      card.classList.remove("bento-wide", "bento-tall");
    }

    let domain = "";
    try { domain = new URL(website.url).hostname; } catch {}

    const icon = website.icon ||
      `https://www.google.com/s2/favicons?domain=${domain}`;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <img src="${icon}" class="favicon">
          <h3>${website.name}</h3>
        </div>
        ${website.description ? `<p>${website.description}</p>` : ""}
      </div>
    `;

    grid.appendChild(card);
  });

  return grid;
}

/* ============================================================
   CONTROL PANEL
============================================================ */
function createControlDeck() {
  const box = document.createElement("div");
  box.id = "control-deck";

  box.innerHTML = `
    <div class="deck-collapsed">CONTROL ▸</div>
    <div class="deck-shell">
      <div class="deck-header">CONTROL PANEL</div>

      <div class="deck-tabs">
        <button class="deck-tab active" data-panel="themes">Themes</button>
        <button class="deck-tab" data-panel="modes">Modes</button>
      </div>

      <div class="deck-panels">
        <div class="deck-panel deck-panel-themes active"></div>
        <div class="deck-panel deck-panel-modes"></div>
      </div>
    </div>
  `;

  document.body.appendChild(box);

  const themesPanel = box.querySelector(".deck-panel-themes");
  const modesPanel  = box.querySelector(".deck-panel-modes");

  THEMES.forEach(t => {
    const pill = document.createElement("button");
    pill.className = "deck-pill deck-theme-pill";
    pill.textContent = t.label;
    pill.dataset.theme = t.id;
    pill.style.setProperty("--pill-color", t.color);

    pill.onclick = () => applyTheme(t.id);
    themesPanel.appendChild(pill);
  });

  [
    { id: MODE_SHUFFLE, label: "Shuffle" },
    { id: MODE_FLUID,   label: "Worm" }
  ].forEach(m => {
    const pill = document.createElement("button");
    pill.className = "deck-pill deck-mode-pill";
    pill.textContent = m.label;
    pill.dataset.mode = m.id;

    pill.onclick = () => applyMode(m.id);
    modesPanel.appendChild(pill);
  });

  box.querySelectorAll(".deck-tab").forEach(tab => {
    tab.onclick = () => {
      box.querySelectorAll(".deck-tab")
        .forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const panelName = tab.dataset.panel;

      box.querySelectorAll(".deck-panel")
        .forEach(p => p.classList.remove("active"));

      box.querySelector(`.deck-panel-${panelName}`).classList.add("active");
    };
  });
}

/* ============================================================
   THEMES
============================================================ */
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("activeTheme", theme);

  document.querySelectorAll(".deck-theme-pill").forEach(p =>
    p.classList.toggle("active", p.dataset.theme === theme)
  );
}

function restoreTheme() {
  applyTheme(localStorage.getItem("activeTheme") || "neon");
}

/* ============================================================
   ANIMATION MODES
============================================================ */
function applyMode(mode) {

  currentMode = mode;

  document.querySelectorAll(".deck-mode-pill").forEach(p =>
    p.classList.toggle("active", p.dataset.mode === mode)
  );

  stopAllTimers();

  const grids = document.querySelectorAll(".bento-grid");

  if (mode === MODE_SHUFFLE) {
    grids.forEach(grid => {
      shuffleIntervals.set(
        grid,
        setInterval(() => smoothShuffle(grid), SHUFFLE_SPEED)
      );
    });
  }

  if (mode === MODE_FLUID) {
    grids.forEach(grid => {
      wormIntervals.set(
        grid,
        setInterval(() => wormSwap(grid), WORM_SPEED)
      );
    });
  }
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
    cards.sort(() => Math.random() - 0.5)
         .forEach(c => grid.appendChild(c));
  });
}

/* ============================================================
   WORM MODE
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
      card.style.transition =
        "transform 500ms cubic-bezier(0.22, 0.61, 0.36, 1)";
      card.style.transform = "translate(0,0)";

      setTimeout(() => {
        card.style.transition = "";
        card.style.transform = "";
      }, 520);
    });
  });
}

/* ============================================================
   TILT EFFECT
============================================================ */
function initTiltEffect() {
  document.querySelectorAll(".card-inner").forEach(card => {
    card.onmousemove = e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const y = (e.clientY - r.top  - r.height/ 2) / (r.height/ 2);

      card.style.transform =
        `rotateX(${ -y * 12 }deg)
         rotateY(${  x * 12 }deg)
         translateZ(10px)`;
    };

    card.onmouseleave = () => card.style.transform = "";
  });
}

/* ============================================================
   SFX
============================================================ */
function attachCardSFX() {
  document.querySelectorAll(".website-card").forEach(card => {
    card.onmouseenter = () => {}; // disabled
    card.onclick      = () => {};
  });
}
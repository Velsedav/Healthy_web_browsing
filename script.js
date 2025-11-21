/* ============================================================
   ANIMATION MODES
============================================================ */
const MODE_SHUFFLE = "shuffle";
const MODE_FLUID   = "fluid"; // default

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
   SIMPLE SFX (Base64 embedded)
============================================================ */
const sfx = {
  hover: new Audio(
    "data:audio/mp3;base64,//uQxAAAAAADYQAAAeQCAOZJDhAAAD//wAALgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
  ),
  click: new Audio(
    "data:audio/mp3;base64,//uQxAAAAAADYQAAAeQCAOZJDhAAAD//wAALgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
  )
};

function playSound(key) {
  const base = sfx[key];
  if (!base) return;
  try {
    const clone = base.cloneNode();
    clone.volume = 0.45;
    clone.currentTime = 0;
    clone.play().catch(() => {});
  } catch (e) {}
}

/* ============================================================
   DOMContentLoaded — INIT
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
   CATEGORY HIERARCHY
============================================================ */
function loadCategories(categories, container, depth = 0) {
  categories.forEach(item => {
    const wrap = document.createElement("div");
    wrap.className = `category-level-${depth}`;

    const title = document.createElement(depth === 0 ? "h2" : "h3");
    title.className = depth === 0 ? "category-title" : "subcategory-title";
    title.textContent = item.name;
    wrap.appendChild(title);

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
   BENTO GRID + FAVORITES
============================================================ */
function createBentoGrid(websites) {
  const grid = document.createElement("div");
  grid.className = "bento-grid";

  websites.forEach((website, i) => {
    const card = document.createElement("a");
    card.className = "website-card";
    card.href = website.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    if (website.favorite) card.classList.add("favorite");

    if (i % 7 === 0) card.classList.add("bento-wide");
    else if (i % 9 === 0) card.classList.add("bento-tall");

    let domain = "";
    try { domain = new URL(website.url).hostname; } catch {}
    const icon = website.icon || `https://www.google.com/s2/favicons?domain=${domain}`;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <img src="${icon}" class="favicon" alt="">
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
   CONTROL DECK
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
    pill.dataset.theme = t.id;
    pill.textContent = t.label;
    pill.style.setProperty("--pill-color", t.color);

    pill.addEventListener("click", () => {
      playSound("click");
      applyTheme(t.id);
    });
    pill.addEventListener("mouseenter", () => playSound("hover"));

    themesPanel.appendChild(pill);
  });

  [
    { id: MODE_SHUFFLE, label: "Shuffle" },
    { id: MODE_FLUID,   label: "Worm" }
  ].forEach(m => {
    const pill = document.createElement("button");
    pill.className = "deck-pill deck-mode-pill";
    pill.dataset.mode = m.id;
    pill.textContent = m.label;

    pill.addEventListener("click", () => {
      playSound("click");
      applyMode(m.id);
    });
    pill.addEventListener("mouseenter", () => playSound("hover"));

    modesPanel.appendChild(pill);
  });

  const tabs = box.querySelectorAll(".deck-tab");
  const panels = box.querySelectorAll(".deck-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      playSound("click");
      const name = tab.dataset.panel;
      tabs.forEach(t => t.classList.toggle("active", t === tab));
      panels.forEach(p =>
        p.classList.toggle("active", p.classList.contains(`deck-panel-${name}`))
      );
    });
  });
}

/* ============================================================
   THEME HANDLING
============================================================ */
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("activeTheme", theme);

  document.querySelectorAll(".deck-theme-pill").forEach(p =>
    p.classList.toggle("active", p.dataset.theme === theme)
  );
}

function restoreTheme() {
  const saved = localStorage.getItem("activeTheme") || "neon";
  applyTheme(saved);
}

/* ============================================================
   ANIMATION MODES
============================================================ */
function applyMode(mode) {
  currentMode = mode;

  document.querySelectorAll(".deck-mode-pill").forEach(p =>
    p.classList.toggle("active", p.dataset.mode === mode)
  );

  stopAllCategoryTimers();

  const grids = document.querySelectorAll(".bento-grid");

  if (mode === MODE_SHUFFLE) {
    grids.forEach(grid => {
      const id = setInterval(() => smoothShuffle(grid), SHUFFLE_SPEED);
      shuffleIntervals.set(grid, id);
    });
  }

  if (mode === MODE_FLUID) {
    grids.forEach(grid => {
      const id = setInterval(() => wormSwap(grid), WORM_SPEED);
      wormIntervals.set(grid, id);
    });
  }
}

function stopAllCategoryTimers() {
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
   WORM MODE
============================================================ */
function wormSwap(grid) {
  if (grid.matches(":hover") || currentMode !== MODE_FLUID) return;
  const cards = [...grid.children];
  if (cards.length < 2) return;

  let i = Math.floor(Math.random() * cards.length);
  for (let x = 0; x < 10 && cards[i].matches(":hover"); x++) {
    i = Math.floor(Math.random() * cards.length);
  }

  const c1 = cards[i];
  if (!c1 || c1.matches(":hover")) return;

  let j = i + (Math.random() < 0.5 ? -1 : 1);
  if (j < 0 || j >= cards.length) return;

  const c2 = cards[j];
  if (!c2 || c2.matches(":hover")) return;

  animateGrid(grid, () => swap(grid, c1, c2));
}

function swap(parent, a, b) {
  const next = a.nextSibling === b ? a : a.nextSibling;
  parent.insertBefore(b, a);
  parent.insertBefore(a, next);
}

/* ============================================================
   FLIP ENGINE
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
    const dy = a.top - b.top;
    if (dx === 0 && dy === 0) return;

    card.style.transition = "transform 0s";
    card.style.transform = `translate(${dx}px,${dy}px)`;

    requestAnimationFrame(() => {
      card.style.transition = "transform 500ms cubic-bezier(0.22, 0.61, 0.36, 1)";
      card.style.transform = "translate(0,0)";

      setTimeout(() => {
        card.style.transition = "";
        card.style.transform = "";
      }, 550);
    });
  });
}

/* ============================================================
   TILT EFFECT
============================================================ */
function initTiltEffect() {
  document.querySelectorAll(".card-inner").forEach(card => {
    card.addEventListener("mousemove", e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);

      card.style.transform =
        `rotateX(${-y * 12}deg) rotateY(${x * 12}deg) translateZ(10px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

/* ============================================================
   APPLY SFX TO CARDS
============================================================ */
function attachCardSFX() {
  document.querySelectorAll(".website-card").forEach(card => {
    card.addEventListener("mouseenter", () => playSound("hover"));
    card.addEventListener("click", () => playSound("click"));
  });
}

/* ============================================================
   UNLOCK AUDIO ON FIRST USER CLICK
============================================================ */
document.addEventListener("click", () => {
  Object.values(sfx).forEach(sound => {
    const clone = sound.cloneNode();
    clone.volume = 0;
    clone.play().catch(() => {});
    clone.pause();
  });
}, { once: true });

/* ============================================================
   MOBILE MODE ACTIVATION
============================================================ */
function isMobile() {
  return window.innerWidth <= 480;
}

document.addEventListener("DOMContentLoaded", () => {
  if (isMobile()) {
    document.body.classList.add("mobile-mode");
  }
});

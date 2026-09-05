const CONFIG_KEY = "enlaces:config";
const TAG_CLASSES = ["tag-1", "tag-2", "tag-3", "tag-4", "tag-5", "tag-6"];

const DEFAULT_CATEGORIES = [
  { name: "Noticias", filename: "noticias.json" },
  { name: "Recetas", filename: "recetas.json" },
  { name: "Cursos", filename: "cursos.json" },
  { name: "Enlaces útiles", filename: "enlaces-utiles.json" },
];

const els = {
  tabs: document.getElementById("category-tabs"),
  list: document.getElementById("link-list"),
  empty: document.getElementById("empty-state"),
  refreshBtn: document.getElementById("refresh-btn"),
  settingsBtn: document.getElementById("settings-btn"),
  overlay: document.getElementById("settings-overlay"),
  catBody: document.getElementById("cfg-cat-body"),
  addCatBtn: document.getElementById("cfg-add-cat"),
  saveBtn: document.getElementById("cfg-save"),
  cancelBtn: document.getElementById("cfg-cancel"),
  status: document.getElementById("cfg-status"),
  owner: document.getElementById("cfg-owner"),
  repo: document.getElementById("cfg-repo"),
  branch: document.getElementById("cfg-branch"),
  installBanner: document.getElementById("install-banner"),
  installBtn: document.getElementById("install-btn"),
  dismissInstallBtn: document.getElementById("dismiss-install-btn"),
};

let state = { config: null, activeFilename: null, entries: {} };

// ---------- Configuración ----------

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function slugify(text) {
  return (
    text
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || "categoria"
  );
}

function openSettings() {
  const cfg = state.config || { owner: "", repo: "", branch: "main", categories: DEFAULT_CATEGORIES };
  els.owner.value = cfg.owner || "";
  els.repo.value = cfg.repo || "";
  els.branch.value = cfg.branch || "main";
  els.catBody.innerHTML = "";
  (cfg.categories && cfg.categories.length ? cfg.categories : DEFAULT_CATEGORIES).forEach(addCatRow);
  els.status.textContent = "";
  els.overlay.hidden = false;
}

function closeSettings() {
  els.overlay.hidden = true;
}

function addCatRow(cat = { name: "", filename: "" }) {
  const tr = document.createElement("tr");

  const nameTd = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = cat.name;
  nameInput.placeholder = "Recetas";
  nameTd.appendChild(nameInput);

  const fileTd = document.createElement("td");
  const fileInput = document.createElement("input");
  fileInput.type = "text";
  fileInput.value = cat.filename;
  fileInput.placeholder = "recetas.json";
  fileTd.appendChild(fileInput);
  nameInput.addEventListener("input", () => {
    if (!fileInput.dataset.manual) fileInput.value = `${slugify(nameInput.value)}.json`;
  });
  fileInput.addEventListener("input", () => (fileInput.dataset.manual = "1"));

  const delTd = document.createElement("td");
  const delBtn = document.createElement("button");
  delBtn.textContent = "✕";
  delBtn.type = "button";
  delBtn.className = "row-del";
  delBtn.addEventListener("click", () => tr.remove());
  delTd.appendChild(delBtn);

  tr.appendChild(nameTd);
  tr.appendChild(fileTd);
  tr.appendChild(delTd);
  els.catBody.appendChild(tr);
}

function readCategoriesFromForm() {
  return [...els.catBody.querySelectorAll("tr")]
    .map((tr) => {
      const [nameInput, fileInput] = tr.querySelectorAll("input");
      const name = nameInput.value.trim();
      if (!name) return null;
      let filename = fileInput.value.trim() || `${slugify(name)}.json`;
      if (!filename.endsWith(".json")) filename += ".json";
      return { name, filename };
    })
    .filter(Boolean);
}

els.addCatBtn.addEventListener("click", () => addCatRow());
els.settingsBtn.addEventListener("click", openSettings);
els.cancelBtn.addEventListener("click", closeSettings);

els.saveBtn.addEventListener("click", () => {
  const owner = els.owner.value.trim();
  const repo = els.repo.value.trim();
  const branch = els.branch.value.trim() || "main";
  const categories = readCategoriesFromForm();

  if (!owner || !repo) {
    els.status.textContent = "Indica usuario y repositorio.";
    els.status.className = "status err";
    return;
  }
  if (categories.length === 0) {
    els.status.textContent = "Añade al menos una categoría.";
    els.status.className = "status err";
    return;
  }

  const cfg = { ...(state.config || {}), owner, repo, branch, categories };
  saveConfig(cfg);
  state.config = cfg;
  els.status.textContent = "Guardado.";
  els.status.className = "status ok";
  closeSettings();
  init();
});

// ---------- Datos ----------

function rawUrl(cfg, filename) {
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${filename}`;
}

async function fetchCategory(cfg, filename, { force = false } = {}) {
  const url = rawUrl(cfg, filename);
  try {
    const res = await fetch(url, { cache: force ? "reload" : "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Formato nuevo: { tags: [...], entries: [...] }. Formato antiguo: array plano.
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.entries)) return data.entries;
    return [];
  } catch (err) {
    console.warn("No se pudo obtener", filename, err);
    return null; // null = fallo (posible offline); el service worker puede servir caché
  }
}

function domainFrom(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

// ---------- Render ----------

function renderTabs() {
  els.tabs.innerHTML = "";
  state.config.categories.forEach((cat, i) => {
    const btn = document.createElement("button");
    btn.className = "cat-tab";
    btn.textContent = cat.name;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", cat.filename === state.activeFilename ? "true" : "false");
    btn.addEventListener("click", () => {
      state.activeFilename = cat.filename;
      renderTabs();
      renderList();
    });
    els.tabs.appendChild(btn);
  });
}

function renderList() {
  const entries = state.entries[state.activeFilename];
  els.list.innerHTML = "";

  if (!entries || entries.length === 0) {
    els.empty.hidden = false;
    els.list.hidden = true;
    return;
  }

  els.empty.hidden = true;
  els.list.hidden = false;

  const catIndex = state.config.categories.findIndex((c) => c.filename === state.activeFilename);
  const tagClass = TAG_CLASSES[catIndex % TAG_CLASSES.length];

  entries.forEach((entry) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "link-card";
    a.href = entry.url;
    a.target = "_blank";
    a.rel = "noopener";

    const top = document.createElement("div");
    top.className = "link-card-top";

    const title = document.createElement("p");
    title.className = "link-title";
    title.textContent = entry.title || entry.url;

    const tag = document.createElement("span");
    tag.className = "link-tag";
    tag.style.background = `var(--${tagClass})`;
    tag.style.color = `var(--${tagClass}-ink)`;
    tag.textContent = domainFrom(entry.url) || "enlace";

    top.appendChild(title);
    top.appendChild(tag);

    const meta = document.createElement("div");
    meta.className = "link-meta";
    meta.innerHTML = `<span>${formatDate(entry.date)}</span>`;

    a.appendChild(top);
    a.appendChild(meta);
    li.appendChild(a);
    els.list.appendChild(li);
  });
}

async function loadAll({ force = false } = {}) {
  const results = await Promise.all(
    state.config.categories.map((cat) => fetchCategory(state.config, cat.filename, { force }))
  );
  state.config.categories.forEach((cat, i) => {
    if (results[i] !== null) state.entries[cat.filename] = results[i];
  });
  renderList();
}

els.refreshBtn.addEventListener("click", () => loadAll({ force: true }));

// ---------- Instalación (beforeinstallprompt) ----------

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem("enlaces:install-dismissed")) {
    els.installBanner.hidden = false;
  }
});
els.installBtn.addEventListener("click", async () => {
  els.installBanner.hidden = true;
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  }
});
els.dismissInstallBtn.addEventListener("click", () => {
  els.installBanner.hidden = true;
  localStorage.setItem("enlaces:install-dismissed", "1");
});

// ---------- Arranque ----------

async function init() {
  state.config = loadConfig();
  if (!state.config) {
    openSettings();
    return;
  }
  state.activeFilename = state.config.categories[0]?.filename;
  renderTabs();
  await loadAll();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW no registrado", e));
  });
}

init();

const FILENAME_KEY = "enlaces:noticias:filename";
const DEFAULT_FILENAME = "noticias.json";

const els = {
  loading: document.getElementById("loading"),
  empty: document.getElementById("empty-state"),
  errorState: document.getElementById("error-state"),
  errorMsg: document.getElementById("error-msg"),
  list: document.getElementById("link-list"),
  countNote: document.getElementById("count-note"),
  search: document.getElementById("search-input"),
  sortGroup: document.getElementById("sort-group"),
  tagFilter: document.getElementById("tag-filter"),
  selectBtn: document.getElementById("select-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  settingsBtn: document.getElementById("settings-btn"),
  manageTagsBtn: document.getElementById("manage-tags-btn"),
  addFab: document.getElementById("add-fab"),
  bulkBar: document.getElementById("bulk-bar"),
  bulkCount: document.getElementById("bulk-count"),
  bulkCancel: document.getElementById("bulk-cancel"),
  bulkDelete: document.getElementById("bulk-delete"),

  settingsOverlay: document.getElementById("settings-overlay"),
  cfgOwner: document.getElementById("cfg-owner"),
  cfgRepo: document.getElementById("cfg-repo"),
  cfgBranch: document.getElementById("cfg-branch"),
  cfgToken: document.getElementById("cfg-token"),
  cfgFilename: document.getElementById("cfg-filename"),
  cfgSave: document.getElementById("cfg-save"),
  cfgCancel: document.getElementById("cfg-cancel"),
  cfgStatus: document.getElementById("cfg-status"),

  entryOverlay: document.getElementById("entry-overlay"),
  entryTitleEl: document.getElementById("entry-title"),
  entryUrl: document.getElementById("entry-url"),
  entryName: document.getElementById("entry-name"),
  entryTags: document.getElementById("entry-tags"),
  entrySave: document.getElementById("entry-save"),
  entryCancel: document.getElementById("entry-cancel"),
  entryStatus: document.getElementById("entry-status"),

  tagsOverlay: document.getElementById("tags-overlay"),
  tagsManageList: document.getElementById("tags-manage-list"),
  newTagInput: document.getElementById("new-tag-input"),
  newTagAdd: document.getElementById("new-tag-add"),
  tagsClose: document.getElementById("tags-close"),
  tagsStatus: document.getElementById("tags-status"),
};

let state = {
  config: null,
  filename: localStorage.getItem(FILENAME_KEY) || DEFAULT_FILENAME,
  data: { tags: [], entries: [], sha: null },
  sort: "recientes",
  search: "",
  activeTagFilters: new Set(),
  selectMode: false,
  selectedIds: new Set(),
  editingEntryId: null, // null = modo "añadir"
};

// ---------- Config ----------

function openSettings() {
  const cfg = state.config || {};
  els.cfgOwner.value = cfg.owner || "";
  els.cfgRepo.value = cfg.repo || "";
  els.cfgBranch.value = cfg.branch || "main";
  els.cfgToken.value = cfg.token || "";
  els.cfgFilename.value = state.filename;
  els.cfgStatus.textContent = "";
  els.settingsOverlay.hidden = false;
}
els.settingsBtn.addEventListener("click", openSettings);
els.cfgCancel.addEventListener("click", () => (els.settingsOverlay.hidden = true));

els.cfgSave.addEventListener("click", async () => {
  const owner = els.cfgOwner.value.trim();
  const repo = els.cfgRepo.value.trim();
  const branch = els.cfgBranch.value.trim() || "main";
  const token = els.cfgToken.value.trim();
  const filename = els.cfgFilename.value.trim() || DEFAULT_FILENAME;

  if (!owner || !repo || !token) {
    els.cfgStatus.textContent = "Usuario, repositorio y token son obligatorios.";
    els.cfgStatus.className = "status err";
    return;
  }

  const cfg = { ...(state.config || {}), owner, repo, branch, token };
  GithubStore.saveConfig(cfg);
  state.config = cfg;
  state.filename = filename;
  localStorage.setItem(FILENAME_KEY, filename);

  els.settingsOverlay.hidden = true;
  await loadData();
});

// ---------- Carga de datos ----------

async function loadData() {
  showOnly("loading");
  try {
    const data = await GithubStore.fetchFile(state.config, state.filename);
    state.data = data;
    renderTagFilterChips();
    render();
  } catch (err) {
    els.errorMsg.textContent = String(err.message || err);
    showOnly("error");
  }
}

function showOnly(which) {
  els.loading.hidden = which !== "loading";
  els.empty.hidden = true;
  els.errorState.hidden = which !== "error";
  els.list.hidden = which !== "list";
}

els.refreshBtn.addEventListener("click", () => {
  if (state.config) loadData();
});

// ---------- Guardar (un commit por acción) ----------

async function persist(message) {
  const result = await GithubStore.saveFile(
    state.config,
    state.filename,
    state.data,
    state.data.sha,
    message
  );
  state.data.sha = result.content?.sha || state.data.sha;
}

// ---------- Render ----------

function domainFrom(url) {
  return GithubStore.domainFrom(url);
}

function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

function initialsColor(seed) {
  const palette = ["#0f6e56", "#a5401e", "#3c3489", "#0c447c", "#72243e", "#633806"];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return palette[Math.abs(hash) % palette.length];
}

function renderTagFilterChips() {
  els.tagFilter.innerHTML = "";
  state.data.tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "chip-btn" + (state.activeTagFilters.has(tag) ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      if (state.activeTagFilters.has(tag)) state.activeTagFilters.delete(tag);
      else state.activeTagFilters.add(tag);
      renderTagFilterChips();
      render();
    });
    els.tagFilter.appendChild(btn);
  });
}

function getFilteredSorted() {
  const q = state.search.trim().toLowerCase();
  let items = state.data.entries.filter((e) => {
    const matchesSearch =
      !q ||
      (e.title || "").toLowerCase().includes(q) ||
      domainFrom(e.url).toLowerCase().includes(q);
    const matchesTags =
      state.activeTagFilters.size === 0 ||
      (e.tags || []).some((t) => state.activeTagFilters.has(t));
    return matchesSearch && matchesTags;
  });

  if (state.sort === "titulo") {
    items = items.slice().sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url));
  } else {
    items = items.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  return items;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function render() {
  const items = getFilteredSorted();

  els.countNote.textContent = `${items.length} noticia${items.length === 1 ? "" : "s"}${
    state.activeTagFilters.size ? " · filtrado por etiqueta" : ""
  }`;

  if (items.length === 0) {
    els.list.hidden = true;
    els.empty.hidden = false;
    els.loading.hidden = true;
    els.errorState.hidden = true;
    return;
  }
  els.loading.hidden = true;
  els.errorState.hidden = true;
  els.empty.hidden = true;
  els.list.hidden = false;

  els.list.innerHTML = "";
  items.forEach((entry) => {
    const li = document.createElement("li");
    const card = document.createElement("div");
    card.className = "news-card" + (state.selectMode ? " selecting" : "");

    if (state.selectMode) {
      const check = document.createElement("div");
      check.className = "select-check" + (state.selectedIds.has(entry.id) ? " checked" : "");
      check.addEventListener("click", () => {
        if (state.selectedIds.has(entry.id)) state.selectedIds.delete(entry.id);
        else state.selectedIds.add(entry.id);
        updateBulkBar();
        render();
      });
      card.appendChild(check);
    }

    const domain = domainFrom(entry.url);
    const thumb = document.createElement("div");
    thumb.className = "news-thumb";
    thumb.style.background = initialsColor(domain || entry.title || entry.id);
    const img = document.createElement("img");
    img.src = faviconUrl(domain);
    img.alt = "";
    img.onerror = () => {
      img.remove();
      thumb.textContent = (domain || "?").slice(0, 1).toUpperCase();
    };
    thumb.appendChild(img);

    const body = document.createElement("div");
    body.className = "news-body";

    const titleLink = document.createElement("a");
    titleLink.className = "news-title-link";
    titleLink.href = entry.url;
    titleLink.target = "_blank";
    titleLink.rel = "noopener";
    if (state.selectMode) {
      titleLink.addEventListener("click", (e) => e.preventDefault());
    }
    const title = document.createElement("p");
    title.className = "news-title";
    title.textContent = entry.title || entry.url;
    titleLink.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "news-meta";
    meta.innerHTML = `<span>${domain || "enlace"}</span><span>${formatDate(entry.date)}</span>`;

    body.appendChild(titleLink);
    body.appendChild(meta);

    if ((entry.tags || []).length) {
      const tagsWrap = document.createElement("div");
      tagsWrap.className = "news-tags";
      entry.tags.forEach((t) => {
        const pill = document.createElement("span");
        pill.className = "news-tag-pill";
        pill.textContent = t;
        tagsWrap.appendChild(pill);
      });
      body.appendChild(tagsWrap);
    }

    const actions = document.createElement("div");
    actions.className = "news-actions";
    if (!state.selectMode) {
      const editBtn = document.createElement("button");
      editBtn.className = "icon-btn-sm";
      editBtn.textContent = "✎";
      editBtn.title = "Editar";
      editBtn.addEventListener("click", () => openEntryModal(entry));
      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn-sm";
      delBtn.textContent = "✕";
      delBtn.title = "Eliminar";
      delBtn.addEventListener("click", () => deleteOne(entry.id));
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
    }

    card.appendChild(thumb);
    card.appendChild(body);
    card.appendChild(actions);
    li.appendChild(card);
    els.list.appendChild(li);
  });
}

// ---------- Búsqueda y orden ----------

els.search.addEventListener("input", (e) => {
  state.search = e.target.value;
  render();
});
els.sortGroup.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-sort]");
  if (!btn) return;
  [...els.sortGroup.children].forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.sort = btn.dataset.sort;
  render();
});

// ---------- Selección múltiple ----------

els.selectBtn.addEventListener("click", () => {
  state.selectMode = !state.selectMode;
  state.selectedIds.clear();
  updateBulkBar();
  render();
});

function updateBulkBar() {
  els.bulkBar.hidden = !state.selectMode || state.selectedIds.size === 0;
  els.bulkCount.textContent = `${state.selectedIds.size} seleccionada${state.selectedIds.size === 1 ? "" : "s"}`;
}

els.bulkCancel.addEventListener("click", () => {
  state.selectMode = false;
  state.selectedIds.clear();
  updateBulkBar();
  render();
});

els.bulkDelete.addEventListener("click", async () => {
  if (state.selectedIds.size === 0) return;
  if (!confirm(`¿Eliminar ${state.selectedIds.size} noticias seleccionadas?`)) return;

  const count = state.selectedIds.size;
  state.data.entries = state.data.entries.filter((e) => !state.selectedIds.has(e.id));
  try {
    await persist(`Elimina ${count} entradas de ${state.filename}`);
    state.selectMode = false;
    state.selectedIds.clear();
    updateBulkBar();
    render();
  } catch (err) {
    alert("Error al guardar: " + (err.message || err));
  }
});

// ---------- Borrado individual ----------

async function deleteOne(id) {
  const entry = state.data.entries.find((e) => e.id === id);
  if (!entry) return;
  if (!confirm(`¿Eliminar "${entry.title || entry.url}"?`)) return;

  state.data.entries = state.data.entries.filter((e) => e.id !== id);
  try {
    await persist(`Elimina entrada de ${state.filename}`);
    render();
  } catch (err) {
    alert("Error al guardar: " + (err.message || err));
  }
}

// ---------- Añadir / editar entrada ----------

function renderEntryTagToggles(selectedTags) {
  els.entryTags.innerHTML = "";
  state.data.tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-toggle" + (selectedTags.includes(tag) ? " on" : "");
    btn.textContent = tag;
    btn.dataset.tag = tag;
    btn.addEventListener("click", () => {
      btn.classList.toggle("on");
    });
    els.entryTags.appendChild(btn);
  });
  if (state.data.tags.length === 0) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No hay etiquetas todavía — créalas con el botón 🏷 Etiquetas.";
    els.entryTags.appendChild(p);
  }
}

function openEntryModal(entry = null) {
  state.editingEntryId = entry ? entry.id : null;
  els.entryTitleEl.textContent = entry ? "Editar enlace" : "Añadir enlace";
  els.entryUrl.value = entry ? entry.url : "";
  els.entryName.value = entry ? entry.title : "";
  els.entryStatus.textContent = "";
  renderEntryTagToggles(entry ? entry.tags || [] : []);
  els.entryOverlay.hidden = false;
}
els.addFab.addEventListener("click", () => openEntryModal(null));
els.entryCancel.addEventListener("click", () => (els.entryOverlay.hidden = true));

els.entrySave.addEventListener("click", async () => {
  const url = els.entryUrl.value.trim();
  if (!url) {
    els.entryStatus.textContent = "La URL es obligatoria.";
    els.entryStatus.className = "status err";
    return;
  }
  const title = els.entryName.value.trim();
  const selectedTags = [...els.entryTags.querySelectorAll(".tag-toggle.on")].map((b) => b.dataset.tag);

  els.entryStatus.textContent = "Guardando…";
  els.entryStatus.className = "status";

  try {
    if (state.editingEntryId) {
      const entry = state.data.entries.find((e) => e.id === state.editingEntryId);
      entry.url = url;
      entry.title = title;
      entry.pageUrl = url;
      entry.tags = selectedTags;
      await persist(`Edita entrada en ${state.filename}`);
    } else {
      state.data.entries.unshift({
        id: GithubStore.generateId(),
        url,
        title,
        pageUrl: url,
        date: new Date().toISOString(),
        tags: selectedTags,
      });
      await persist(`Añade enlace manual a ${state.filename}`);
    }
    els.entryOverlay.hidden = true;
    render();
  } catch (err) {
    els.entryStatus.textContent = "Error: " + (err.message || err);
    els.entryStatus.className = "status err";
  }
});

// ---------- Gestionar etiquetas del archivo ----------

function renderTagsManageList() {
  els.tagsManageList.innerHTML = "";
  state.data.tags.forEach((tag) => {
    const row = document.createElement("div");
    row.className = "tag-manage-row";
    const span = document.createElement("span");
    span.textContent = tag;
    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`¿Quitar la etiqueta "${tag}"? Se quitará también de todas las noticias que la tengan.`)) return;
      state.data.tags = state.data.tags.filter((t) => t !== tag);
      state.data.entries.forEach((e) => {
        if (e.tags) e.tags = e.tags.filter((t) => t !== tag);
      });
      try {
        await persist(`Elimina etiqueta "${tag}" de ${state.filename}`);
        renderTagsManageList();
        renderTagFilterChips();
        render();
      } catch (err) {
        els.tagsStatus.textContent = "Error: " + (err.message || err);
        els.tagsStatus.className = "status err";
      }
    });
    row.appendChild(span);
    row.appendChild(delBtn);
    els.tagsManageList.appendChild(row);
  });
}

els.manageTagsBtn.addEventListener("click", () => {
  els.tagsStatus.textContent = "";
  renderTagsManageList();
  els.tagsOverlay.hidden = false;
});
els.tagsClose.addEventListener("click", () => (els.tagsOverlay.hidden = true));

els.newTagAdd.addEventListener("click", async () => {
  const name = els.newTagInput.value.trim();
  if (!name) return;
  if (state.data.tags.includes(name)) {
    els.tagsStatus.textContent = "Esa etiqueta ya existe.";
    els.tagsStatus.className = "status err";
    return;
  }
  state.data.tags.push(name);
  try {
    await persist(`Añade etiqueta "${name}" a ${state.filename}`);
    els.newTagInput.value = "";
    renderTagsManageList();
    renderTagFilterChips();
    els.tagsStatus.textContent = "Añadida.";
    els.tagsStatus.className = "status ok";
  } catch (err) {
    els.tagsStatus.textContent = "Error: " + (err.message || err);
    els.tagsStatus.className = "status err";
  }
});

// ---------- Arranque ----------

async function init() {
  state.config = GithubStore.loadConfig();
  if (!state.config || !state.config.token) {
    openSettings();
    return;
  }
  await loadData();
}

init();

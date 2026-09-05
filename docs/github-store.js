/**
 * GithubStore — lectura/escritura de los archivos <categoria>.json en GitHub.
 * Lo usan por igual noticias.html, recetas.html, y cualquier interfaz futura,
 * para no reimplementar la llamada a la API en cada una.
 */
const GithubStore = (() => {
  const CONFIG_KEY = "enlaces:config"; // misma clave que usa la PWA de lectura

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  function base64ToUtf8(b64) {
    const binary = atob(b64.replace(/\n/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function apiRequest(cfg, path, options = {}) {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    };
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
    return fetch(url, { ...options, headers });
  }

  /** Lee un archivo de categoría. Devuelve { tags, entries, sha }. */
  async function fetchFile(cfg, filename) {
    const res = await apiRequest(
      cfg,
      `${filename}?ref=${encodeURIComponent(cfg.branch || "main")}`
    );
    if (res.status === 404) return { tags: [], entries: [], sha: null };
    if (!res.ok) throw new Error(`GitHub GET ${res.status}: ${await res.text()}`);

    const json = await res.json();
    let parsed;
    try {
      parsed = JSON.parse(base64ToUtf8(json.content));
    } catch {
      parsed = { tags: [], entries: [] };
    }
    if (Array.isArray(parsed)) parsed = { tags: [], entries: parsed }; // formato antiguo
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      sha: json.sha,
    };
  }

  /** Escribe el archivo completo de vuelta (un commit). */
  async function saveFile(cfg, filename, data, sha, message) {
    const body = {
      message: message || `Actualiza ${filename}`,
      content: utf8ToBase64(
        JSON.stringify({ tags: data.tags, entries: data.entries }, null, 2)
      ),
      branch: cfg.branch || "main",
    };
    if (sha) body.sha = sha;

    const res = await apiRequest(cfg, filename, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`GitHub PUT ${res.status}: ${await res.text()}`);
    return res.json(); // incluye el nuevo sha, para futuras escrituras
  }

  function generateId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map((b) => b.toString(36))
      .join("")
      .slice(0, 8);
  }

  function domainFrom(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  return { loadConfig, saveConfig, fetchFile, saveFile, generateId, domainFrom };
})();

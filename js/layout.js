"use strict";
/* ============ Fucina Sprite — layout in stile SpikeCut ============
 *
 *   ┌ topbar ───────────────────────────────────────────────────────────┐
 *   │ ☰  ⚒FucinaSprite  [nome] ✓Pronto            ⇪ ?  File▾ Vista▾ ⋯ │
 *   ├ barra schede: Immagine 2D · Modello 3D · Ripara sprite ───────────┤
 *   │ rail │              anteprima               │ pannello a schede  │
 *   ├ status bar ───────────────────────────────────────────────────────┤
 *
 * Topbar, rail e menu si configurano qui sotto (LAYOUT). Gli id degli elementi
 * sono quelli usati da app.js, quindi la logica dell'applicazione non cambia.
 * Questo file va caricato prima di app.js: crea #name, #gridBtn e #cmpBtn.
 */

// Versione e mese di rilascio: da aggiornare a ogni rilascio insieme al README.
const APP_VERSION = "3.1";
const APP_RELEASE = "Ott 2026";

// Icone in stile SpikeCut (viewBox 22, tratto 1.6)
const SC_ICON = (d, extra = "") =>
  `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${extra}<path d="${d}"/></svg>`;

const LAYOUT_ICONS = {
  menu: `<svg viewBox="0 0 22 22" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h14M4 11h14M4 16h14"/></svg>`,
  image: SC_ICON("M3 4h16v14H3z M3 15l5-5 4 4 2-2 5 5", `<circle cx="14.5" cy="8.5" r="1.5"/>`),
  model: SC_ICON("M11 2l8 4.5v9L11 20l-8-4.5v-9z M3 6.5l8 4.5 8-4.5 M11 11v9"),
  repair: SC_ICON("M14 4a4 4 0 0 0-4.6 5.2L3.5 15a1.8 1.8 0 0 0 2.5 2.5l5.8-5.9A4 4 0 0 0 17 7l-2.5 2.5-2-.5-.5-2z"),
  demo: SC_ICON("M5 17L15 7 M13 5l4 4 M4 18l2-2 M7 13l2 2 M17 3l2 2-3 1z"),
  grid: SC_ICON("M3 3h7v7H3z M12 3h7v7h-7z M3 12h7v7H3z M12 12h7v7h-7z"),
  compare: SC_ICON("M11 3v16 M3 5h5v12H3z M14 5h5v12h-5z"),
  skeleton: SC_ICON("M11 6v7 M7 9h8 M11 13l-3 6 M11 13l3 6", `<circle cx="11" cy="4" r="2"/>`),
  zip: SC_ICON("M6 3h7l4 4v12H6z M13 3v4h4 M10 3v2 M10 7v2 M10 11v2 M9 15h2v2H9z"),
  png: SC_ICON("M3 3h16v16H3z M3 9h16 M3 14h16 M9 3v16 M14 3v16"),
  json: SC_ICON("M8 4c-2 0-2 1.5-2 3s-1 3-2.5 4c1.5 1 2.5 2 2.5 4s0 3 2 3 M14 4c2 0 2 1.5 2 3s1 3 2.5 4c-1.5 1-2.5 2-2.5 4s0 3-2 3"),
  panel: SC_ICON("M3 4h16v14H3z M13 4v14")
};

const $q = (s) => document.querySelector(s);
const clickEl = (s) => { const el = $q(s); if (el && !el.disabled) el.click(); };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
};
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");

const LAYOUT = {
  // ------------------------------------------------------------ TOPBAR
  topbar: [
    [{ type: "button", id: "btnSidebar", cls: "sidebar-btn", html: LAYOUT_ICONS.menu, title: "Comprimi o espandi la barra degli strumenti", onClick: () => SpriteLayout.toggleRailExpanded() }],
    [{ type: "brand", html: `<span class="brand-mark">⚒</span><span class="brand-name">Fucina<b>Sprite</b></span>` }],
    [{ type: "input", id: "name", value: "personaggio", title: "Nome dello sprite: è il nome dei file esportati" }],
    [{ type: "button", id: "btnReady", text: "● Nessuno sprite", title: "Stato · clic per esportare il pacchetto completo (Ctrl+S)", onClick: () => clickEl("#expZip") }],
    "spacer",
    [
      { type: "button", id: "btnOpenTop", text: "⇪ Apri", title: "Apri un file per la sorgente attiva (O)", onClick: () => SpriteLayout.open() },
      { type: "button", id: "btnHelpTop", text: "?", title: "Guida e scorciatoie (F1)", onClick: () => SpriteLayout.showHelp() }
    ]
  ],

  // -------------------------------------------- MENU A TENDINA (topbar)
  menus: [
    {
      label: "File ▾", pill: true, items: [
        { icon: "🖼", label: "Apri immagine…", shortcut: "O", onClick: () => SpriteLayout.open("image") },
        { icon: "🧊", label: "Apri modello 3D…", onClick: () => SpriteLayout.open("model") },
        { icon: "🩹", label: "Apri sprite da riparare…", onClick: () => SpriteLayout.open("repair") },
        { icon: "⚔", label: "Cavaliere di esempio", onClick: () => SpriteLayout.demo() },
        { separator: true },
        { icon: "📦", label: "Scarica pacchetto completo (.zip)", shortcut: "Ctrl+S", onClick: () => clickEl("#expZip") },
        { icon: "🖼", label: "Scarica sprite sheet (.png)", onClick: () => clickEl("#expPng") },
        { icon: "🧾", label: "Scarica dati frame (.json)", onClick: () => clickEl("#expJson") }
      ]
    },
    {
      label: "Vista ▾", pill: true, items: [
        { icon: "▦", label: "Tutte le direzioni insieme", shortcut: "G", onClick: () => clickEl("#gridBtn") },
        { icon: "⇆", label: "Confronta prima e dopo", shortcut: "C", onClick: () => clickEl("#cmpBtn") },
        { separator: true },
        { icon: "1", label: "1 direzione", onClick: () => SpriteLayout.segPick("#dirSeg", "1") },
        { icon: "2", label: "2 lati", onClick: () => SpriteLayout.segPick("#dirSeg", "2") },
        { icon: "4", label: "4 direzioni", onClick: () => SpriteLayout.segPick("#dirSeg", "4") },
        { icon: "8", label: "8 direzioni", onClick: () => SpriteLayout.segPick("#dirSeg", "8") },
        { separator: true },
        { icon: "📷", label: "Camera di lato", onClick: () => SpriteLayout.segPick("#elevSeg", "0") },
        { icon: "📷", label: "Camera dall'alto", onClick: () => SpriteLayout.segPick("#elevSeg", "30") },
        { icon: "📷", label: "Camera isometrica", onClick: () => SpriteLayout.segPick("#elevSeg", "35.26") },
        { separator: true },
        { icon: "◧", label: "Mostra/nascondi strumenti", shortcut: "[", onClick: () => SpriteLayout.toggleSide("left") },
        { icon: "◨", label: "Mostra/nascondi pannello", shortcut: "]", onClick: () => SpriteLayout.toggleSide("right") }
      ]
    },
    {
      label: "⋯", more: true, items: [
        { icon: "📖", label: "Guida e scorciatoie", shortcut: "F1", onClick: () => SpriteLayout.showHelp() },
        { icon: "ℹ️", label: "Informazioni", onClick: () => SpriteLayout.showAbout() }
      ]
    }
  ],

  // --------------------------------------- RAIL SINISTRA (come SpikeCut)
  rail: [
    { section: "Sorgente" },
    { id: "railImage", icon: "image", label: "Apri immagine…", key: "O", title: "Carica un'immagine 2D", onClick: () => SpriteLayout.open("image") },
    { id: "railModel", icon: "model", label: "Apri modello 3D…", title: "Carica un modello .glb / .fbx con le animazioni", onClick: () => SpriteLayout.open("model") },
    { id: "railRepair", icon: "repair", label: "Ripara sprite…", title: "Carica uno sprite sheet, una GIF o più frame", onClick: () => SpriteLayout.open("repair") },
    { id: "railDemo", icon: "demo", label: "Esempio", title: "Prova con il cavaliere di esempio", onClick: () => SpriteLayout.demo() },

    { section: "Anteprima" },
    // #gridBtn e #cmpBtn sono i pulsanti veri usati da app.js (aria-pressed / hidden)
    { id: "gridBtn", icon: "grid", label: "Tutte le direzioni", key: "G", title: "Tutte le direzioni insieme", pressed: false },
    { id: "cmpBtn", icon: "compare", label: "Prima e dopo", key: "C", title: "Confronta prima e dopo", pressed: true, hidden: true },

    { section: "Scheletro", cls: "imgOnly" },
    { id: "railAutoJ", icon: "skeleton", label: "Rileva scheletro", cls: "imgOnly", title: "Rileva di nuovo le articolazioni dalla sagoma", onClick: () => { SpriteLayout.showPanelTab("skel"); clickEl("#autoJ"); } },

    { section: "Esporta" },
    { id: "railZip", icon: "zip", label: "Pacchetto .zip", key: "Ctrl+S", title: "Scarica il pacchetto completo (.zip)", onClick: () => clickEl("#expZip") },
    { id: "railPng", icon: "png", label: "Sprite sheet .png", title: "Scarica solo lo sprite sheet (.png)", onClick: () => clickEl("#expPng") },
    { id: "railJson", icon: "json", label: "Dati .json", title: "Scarica solo i dati dei frame (.json)", onClick: () => clickEl("#expJson") },

    "spacer",
    { id: "railPanel", icon: "panel", label: "Pannello", key: "]", title: "Mostra/nascondi il pannello delle impostazioni", onClick: () => SpriteLayout.toggleSide("right") }
  ],

  // Nomi delle modalità (barra schede e status bar)
  modes: { image: "Immagine 2D", model: "Modello 3D", repair: "Ripara sprite" }
};

const SpriteLayout = {
  RAIL_EXPANDED_MIN: 130,

  // =================================================================
  // COSTRUZIONE (subito, prima di app.js)
  // =================================================================
  build() {
    this.buildTopbar();
    this.buildMenus();
    this.buildRail();
    this.buildPanel();
    this.buildStatus();
    this.buildSideControls();
    this.bindEmptyState();
    this.bindStageDrop();
    this.bindScrollbarReveal();
    this.bindShortcuts();
  },

  /** Dopo app.js: collega gli indicatori allo stato dell'applicazione */
  afterInit() {
    $q("#srcSeg").addEventListener("click", (e) => { if (e.target.closest("button")) this.syncMode(); });
    const obs = (el, fn, opts) => el && new MutationObserver(fn).observe(el, opts);
    obs($q("#empty"), () => this.syncReady(), { attributes: true, attributeFilter: ["hidden"] });
    obs($q("#info"), () => this.syncInfo(), { attributes: true, childList: true, characterData: true, subtree: true });
    obs($q("#dirName"), () => this.syncInfo(), { childList: true, characterData: true, subtree: true });
    obs($q("#curName"), () => this.syncInfo(), { childList: true, characterData: true, subtree: true });
    this.syncMode();
    this.syncReady();
    this.syncInfo();
  },

  // ---------------------------------------------------------- topbar
  buildTopbar() {
    const left = $q("#topbarLeft");
    LAYOUT.topbar.forEach((group) => {
      if (group === "spacer") { left.insertAdjacentHTML("beforeend", `<div class="spacer"></div>`); return; }
      const grp = document.createElement("div");
      grp.className = "grp";
      group.forEach((item) => {
        if (item.type === "brand") { grp.classList.add("brand"); grp.innerHTML = item.html; return; }
        if (item.type === "input") {
          const inp = document.createElement("input");
          inp.type = "text"; inp.id = item.id; inp.value = item.value || ""; inp.title = item.title || "";
          inp.setAttribute("aria-label", item.title || item.id);
          inp.spellcheck = false;
          grp.appendChild(inp);
          return;
        }
        const b = document.createElement("button");
        b.type = "button"; b.id = item.id; b.className = "iconbtn" + (item.cls ? " " + item.cls : "");
        if (item.html) b.innerHTML = item.html; else b.textContent = item.text;
        b.title = item.title || "";
        b.addEventListener("click", (ev) => item.onClick(ev));
        grp.appendChild(b);
      });
      if (group[0] && group[0].cls === "sidebar-btn") grp.classList.add("sidebar-grp");
      left.appendChild(grp);
    });
  },

  // ----------------------------------------------- menu a tendina
  buildMenus() {
    const bar = $q("#menu");
    LAYOUT.menus.forEach((menu) => {
      const item = document.createElement("div");
      item.className = "menu-item grp" + (menu.pill ? " pill" : "") + (menu.more ? " more" : "");
      const label = document.createElement("button");
      label.type = "button";
      label.className = "menu-label " + (menu.pill ? "btn primary" : "iconbtn");
      label.textContent = menu.label;
      label.setAttribute("aria-haspopup", "true");
      item.appendChild(label);

      const dd = document.createElement("div");
      dd.className = "menu-dropdown";
      dd.setAttribute("role", "menu");
      menu.items.forEach((entry) => {
        if (entry.separator) { dd.insertAdjacentHTML("beforeend", `<div class="menu-dropdown-separator"></div>`); return; }
        const row = document.createElement("button");
        row.type = "button";
        row.className = "menu-dropdown-item";
        row.setAttribute("role", "menuitem");
        row.innerHTML = `<span class="mi-icon">${entry.icon || ""}</span><span class="mi-label"></span>`
          + (entry.shortcut ? `<span class="shortcut">${entry.shortcut}</span>` : "");
        row.querySelector(".mi-label").textContent = entry.label;
        row.addEventListener("click", (e) => { e.stopPropagation(); this.closeMenus(); entry.onClick(); });
        dd.appendChild(row);
      });
      item.appendChild(dd);

      label.addEventListener("click", (e) => {
        e.stopPropagation();
        const was = item.classList.contains("active");
        this.closeMenus();
        if (!was) item.classList.add("active");
      });
      bar.appendChild(item);
    });
    document.addEventListener("click", () => this.closeMenus());
  },

  closeMenus() {
    document.querySelectorAll(".menu-item.active").forEach((m) => m.classList.remove("active"));
  },

  // ------------------------------------------------------------ rail
  buildRail() {
    const rail = $q("#rail");
    LAYOUT.rail.forEach((entry) => {
      if (entry === "spacer") {
        rail.insertAdjacentHTML("beforeend", `<div class="rail-spacer"></div><div class="rail-sep end"></div>`);
        return;
      }
      if (entry.section) {
        const c = entry.cls ? ` ${entry.cls}` : "";
        rail.insertAdjacentHTML("beforeend", `<div class="rail-title${c}">${entry.section}</div><div class="rail-sep${c}"></div>`);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.id = entry.id;
      b.className = "tool" + (entry.cls ? " " + entry.cls : "");
      b.title = entry.title + (entry.key ? ` (${entry.key})` : "");
      b.setAttribute("aria-label", entry.title);
      b.innerHTML = (LAYOUT_ICONS[entry.icon] || "")
        + `<span class="tlabel">${entry.label}</span>`
        + (entry.key ? `<span class="kbd${entry.key.length > 1 ? " kbd-long" : ""}">${entry.key}</span>` : "");
      if (entry.pressed !== undefined) b.setAttribute("aria-pressed", String(entry.pressed));
      if (entry.hidden) b.hidden = true;
      if (entry.onClick) b.addEventListener("click", (ev) => entry.onClick(ev));
      rail.appendChild(b);
    });
    this.rail = rail;
    const v = store.get("fs-rail-expanded");
    this.setRailExpanded(v === null ? true : v === "1");
  },

  setRailExpanded(expanded, width) {
    const side = $q("#sidebar");
    this.rail.classList.toggle("expanded", expanded);
    side.classList.toggle("rail-compact", !expanded);
    let w = width;
    if (w == null) {
      const saved = parseInt(store.get("fs-rail-w"), 10) || 0;
      w = expanded ? (saved >= this.RAIL_EXPANDED_MIN ? saved : 188) : 52;
    }
    side.style.width = w + "px";
    $q("#btnSidebar")?.classList.toggle("on", expanded);
    store.set("fs-rail-expanded", expanded ? "1" : "0");
  },

  toggleRailExpanded() {
    if ($q("#sidebar").classList.contains("hidden")) this.toggleSide("left");
    this.setRailExpanded(!this.rail.classList.contains("expanded"));
  },

  // ------------------------------------------- pannello destro a schede
  buildPanel() {
    const tabs = $q("#panelTabs");
    this.pages = [...document.querySelectorAll("#rightSidebar > .tabpage")];
    this.pages.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.tab = p.dataset.tab;
      b.textContent = p.dataset.label;
      b.addEventListener("click", () => this.showPanelTab(p.dataset.tab));
      tabs.appendChild(b);
      // una sezione nascosta da app.js (es. Scheletro con il Modello 3D) nasconde anche la sua scheda
      new MutationObserver(() => this.syncPanelTabs()).observe(p, { attributes: true, attributeFilter: ["hidden"] });
    });
    const pw = parseInt(store.get("fs-panel-w"), 10);
    if (pw >= 260 && pw <= 560) $q("#rightSidebar").style.width = pw + "px";
    this.showPanelTab(store.get("fs-panel-tab") || "src");
  },

  showPanelTab(id) {
    const page = this.pages.find((p) => p.dataset.tab === id && !p.hidden) || this.pages.find((p) => !p.hidden);
    if (!page) return;
    // sul telefono il pannello copre l'anteprima: si apre solo quando lo chiedi
    if ($q("#rightSidebar").classList.contains("hidden") && !window.matchMedia("(max-width: 760px)").matches) this.toggleSide("right");
    this.activeTab = page.dataset.tab;
    this.pages.forEach((p) => p.classList.toggle("active", p === page));
    $q("#panelTabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === this.activeTab));
    store.set("fs-panel-tab", this.activeTab);
  },

  syncPanelTabs() {
    $q("#panelTabs").querySelectorAll("button").forEach((b) => {
      b.hidden = !!this.pages.find((p) => p.dataset.tab === b.dataset.tab)?.hidden;
    });
    const cur = this.pages.find((p) => p.dataset.tab === this.activeTab);
    if (!cur || cur.hidden) {
      const first = this.pages.find((p) => !p.hidden);
      if (first) {
        this.activeTab = first.dataset.tab;
        this.pages.forEach((p) => p.classList.toggle("active", p === first));
        $q("#panelTabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === this.activeTab));
      }
    }
  },

  // ------------------------------------------------------- status bar
  buildStatus() {
    const st = $q("#status");
    st.innerHTML = `
      <span id="statusMode"></span>
      <span id="statusAnim"></span>
      <span id="statusInfo"></span>
      <span class="spacer"></span>
      <span class="toggle" id="stRail" title="Mostra/nascondi la barra degli strumenti ([)">◧ Strumenti</span>
      <span class="toggle" id="stPanel" title="Mostra/nascondi il pannello (])">◨ Pannello</span>
      <span class="status-sign"><span class="sign-by">Fucina Sprite by <a href="https://www.filippomorano.com" target="_blank" rel="noopener">SpikeCode AI</a> · </span>${APP_RELEASE} · Ver: ${APP_VERSION}</span>`;
    st.querySelector("#stRail").addEventListener("click", () => this.toggleSide("left"));
    st.querySelector("#stPanel").addEventListener("click", () => this.toggleSide("right"));
  },

  mode() { return $q('#srcSeg [aria-pressed="true"]')?.dataset.v || "image"; },

  syncMode() {
    const m = this.mode();
    $q("#statusMode").textContent = LAYOUT.modes[m];
    document.querySelectorAll("#srcSeg .tab").forEach((t) => t.classList.toggle("active", t.dataset.v === m));
    // le voci del rail legate all'immagine 2D seguono le sezioni .imgOnly
    document.querySelectorAll("#rail .imgOnly").forEach((el) => { el.hidden = m !== "image"; });
    this.syncPanelTabs();
  },

  syncReady() {
    const ready = $q("#empty").hidden;
    const b = $q("#btnReady");
    b.textContent = ready ? "✓ Pronto" : "● Nessuno sprite";
    b.classList.toggle("ready", ready);
    document.body.classList.toggle("no-docs", !ready);
    this.syncInfo();
  },

  syncInfo() {
    const ready = $q("#empty").hidden, info = $q("#info");
    $q("#statusInfo").textContent = ready && !info.hidden ? info.textContent : "";
    $q("#statusAnim").textContent = ready ? `${$q("#curName").textContent} · ${$q("#dirName").textContent}` : "";
  },

  // --------------------------------------------- comandi
  setMode(v) {
    const b = $q(`#srcSeg button[data-v="${v}"]`);
    if (b && b.getAttribute("aria-pressed") !== "true") b.click();
  },

  open(v) {
    if (v) this.setMode(v);
    this.showPanelTab("src");
    clickEl({ image: "#file", model: "#file3", repair: "#rFile" }[this.mode()]);
  },

  demo() {
    this.setMode("image");
    this.showPanelTab("src");
    clickEl("#demo");
  },

  /** Seleziona un'opzione di un gruppo segmentato di app.js (es. #dirSeg) */
  segPick(seg, v) {
    const b = $q(`${seg} button[data-v="${v}"]`);
    if (b && !b.closest("[hidden]")) b.click();
    else toast("Questa opzione non è disponibile nella modalità attuale.");
  },

  // ---------------------------- pannelli laterali (come SpikeCut)
  // Maniglia di 6 px tra barra e anteprima e tra anteprima e pannello (trascina = larghezza,
  // doppio clic = nascondi); linguette ‹ › attaccate ai bordi dell'anteprima.
  buildSideControls() {
    const main = $q("#mainContent"), side = $q("#sidebar"), panel = $q("#rightSidebar");
    const railR = $q("#railResizer"), panelR = $q("#panelResizer");

    this.makeResizable(railR, side, 52, 300, 1, (w, end) => {
      const expanded = w >= this.RAIL_EXPANDED_MIN;
      if (expanded !== this.rail.classList.contains("expanded")) this.setRailExpanded(expanded, w);
      if (end && expanded) store.set("fs-rail-w", String(Math.round(w)));
    });
    this.makeResizable(panelR, panel, 260, 560, -1, (w, end) => {
      if (end) store.set("fs-panel-w", String(Math.round(w)));
    });
    railR.addEventListener("dblclick", () => this.toggleSide("left"));
    panelR.addEventListener("dblclick", () => this.toggleSide("right"));

    this.switches = {};
    [["left", "Mostra/nascondi la barra degli strumenti"], ["right", "Mostra/nascondi il pannello"]].forEach(([pos, title]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sidetoggle " + pos;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.addEventListener("click", () => this.toggleSide(pos));
      main.appendChild(b);
      this.switches[pos] = b;
    });

    // su schermi stretti il pannello parte chiuso (si sovrappone all'anteprima)
    const narrow = window.matchMedia("(max-width: 760px)").matches;
    this.setSide("left", store.get("fs-left-hidden") !== "1");
    this.setSide("right", narrow ? false : store.get("fs-right-hidden") !== "1");
  },

  setSide(pos, visible) {
    const el = pos === "left" ? $q("#sidebar") : $q("#rightSidebar");
    const res = pos === "left" ? $q("#railResizer") : $q("#panelResizer");
    el.classList.toggle("hidden", !visible);
    res.style.display = visible ? "" : "none";
    const sw = this.switches[pos];
    sw.textContent = (pos === "left") === visible ? "‹" : "›";
    $q(pos === "left" ? "#stRail" : "#stPanel")?.classList.toggle("active", visible);
    if (pos === "right") $q("#railPanel")?.classList.toggle("active", visible);
    store.set(`fs-${pos}-hidden`, visible ? "0" : "1");
  },

  toggleSide(pos) {
    const el = pos === "left" ? $q("#sidebar") : $q("#rightSidebar");
    this.setSide(pos, el.classList.contains("hidden"));
  },

  makeResizable(handle, target, minW, maxW, sign, onChange) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX, startW = target.getBoundingClientRect().width;
      handle.classList.add("active");
      document.body.classList.add("resizing-sidebar");
      const onMove = (ev) => {
        const w = Math.max(minW, Math.min(maxW, startW + (ev.clientX - startX) * sign));
        target.style.width = w + "px";
        onChange(w, false);
      };
      const onUp = () => {
        handle.classList.remove("active");
        document.body.classList.remove("resizing-sidebar");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        onChange(parseFloat(target.style.width) || target.getBoundingClientRect().width, true);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  },

  // ------------------------------------- schermata vuota e trascinamento
  bindEmptyState() {
    $q("#empty").addEventListener("click", (e) => {
      const b = e.target.closest("[data-es]");
      if (!b) return;
      if (b.dataset.es === "demo") this.demo(); else this.open(b.dataset.es);
    });
  },

  /** I file trascinati sull'anteprima vanno alla sorgente giusta */
  bindStageDrop() {
    const stage = $q("#stage");
    let depth = 0;
    const has = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    stage.addEventListener("dragenter", (e) => { if (!has(e)) return; e.preventDefault(); depth++; stage.classList.add("over"); });
    stage.addEventListener("dragover", (e) => { if (has(e)) e.preventDefault(); });
    stage.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; stage.classList.remove("over"); } });
    stage.addEventListener("drop", (e) => {
      if (!has(e)) return;
      e.preventDefault();
      depth = 0;
      stage.classList.remove("over");
      const fs = [...e.dataTransfer.files];
      if (!fs.length) return;
      const is3D = fs.some((f) => /\.(glb|gltf|fbx)$/i.test(f.name));
      if (is3D) { this.setMode("model"); loadModelFiles(fs); return; }
      if (this.mode() === "repair") { loadRepairFiles(fs); return; }
      this.setMode("image");
      loadFile(fs[0]);
    });
  },

  /** Mentre scorri la barra di scorrimento resta visibile per un attimo */
  bindScrollbarReveal() {
    document.addEventListener("scroll", (e) => {
      const t = e.target === document ? document.scrollingElement : e.target;
      if (!t || !t.classList) return;
      t.classList.add("is-scrolling");
      clearTimeout(t._scrollHideT);
      t._scrollHideT = setTimeout(() => t.classList.remove("is-scrolling"), 900);
    }, { capture: true, passive: true });
  },

  // --------------------------------------------- scorciatoie da tastiera
  bindShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeMenus();
        if ($q(".modal-overlay.open")) { this.closeModal(); return; }
      }
      if (e.key === "F1") { e.preventDefault(); this.showHelp(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); clickEl("#expZip"); return; }
      const t = e.target || {};
      if (t.matches?.("input,select,textarea") || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ($q(".modal-overlay.open")) return;
      const map = {
        o: () => this.open(),
        g: () => clickEl("#gridBtn"),
        c: () => { const b = $q("#cmpBtn"); if (b && !b.hidden) b.click(); },
        "1": () => this.setMode("image"),
        "2": () => this.setMode("model"),
        "3": () => this.setMode("repair"),
        "[": () => this.toggleSide("left"),
        "]": () => this.toggleSide("right")
      };
      const fn = map[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(); }
    });
  },

  // ------------------------------------------- finestre (come .modal-box)
  modal(title, html) {
    let ov = $q(".modal-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "modal-overlay";
      ov.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><div class="modal-head"><h3></h3><button type="button" class="iconbtn" aria-label="Chiudi">✕</button></div><div class="modal-body"></div></div>`;
      ov.addEventListener("click", (e) => { if (e.target === ov) this.closeModal(); });
      ov.querySelector(".modal-head button").addEventListener("click", () => this.closeModal());
      document.body.appendChild(ov);
    }
    ov.querySelector("h3").textContent = title;
    ov.querySelector(".modal-body").innerHTML = html;
    ov.classList.add("open");
    ov.querySelector(".modal-head button").focus();
  },

  closeModal() { $q(".modal-overlay")?.classList.remove("open"); },

  showHelp() {
    const mod = isMac ? "⌘" : "Ctrl";
    const keys = [
      ["O", "Apri un file per la sorgente attiva"], ["1 · 2 · 3", "Immagine 2D · Modello 3D · Ripara sprite"],
      ["Spazio", "Riproduci / pausa"], ["← →", "Frame precedente / successivo"],
      ["G", "Tutte le direzioni insieme"], ["C", "Confronta prima e dopo (Ripara sprite)"],
      ["[  ]", "Mostra/nascondi strumenti e pannello"], [`${mod}+S`, "Scarica il pacchetto completo (.zip)"],
      [`${mod}+V`, "Incolla un'immagine"], ["F1", "Questa guida"], ["Esc", "Chiudi menu e finestre"]
    ];
    this.modal("Guida e scorciatoie", `
      <p>Scegli la sorgente nella barra delle schede, carica i file (anche trascinandoli sull'anteprima)
      e regola le opzioni nel pannello a destra: <b>Sorgente</b>, <b>Stile</b>, <b>Scheletro</b>,
      <b>Animazioni</b>, <b>Vista</b> ed <b>Esporta</b>. Le maniglie tra i riquadri si trascinano
      per cambiarne la larghezza; doppio clic per nasconderli.</p>
      <table class="keys">${keys.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join("")}</table>`);
  },

  showAbout() {
    this.modal("Informazioni", `
      <p><b>Fucina Sprite ${APP_VERSION}</b> · ${APP_RELEASE}</p>
      <p>Da un'immagine o da un modello 3D a sprite animati in 8 direzioni; ripara sprite sheet esistenti.</p>
      <p class="hint">Fucina Sprite by <a href="https://www.filippomorano.com" target="_blank" rel="noopener">SpikeCode AI</a>. Interfaccia nello stile di SpikeCut.</p>`);
  }
};

SpriteLayout.build();

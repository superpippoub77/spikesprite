"use strict";
/* ============ Da immagine a modello 3D con l'intelligenza artificiale (gratis) ============
 *
 * Usa i modelli open source pubblicati come Space gratuiti su Hugging Face (TRELLIS, TRELLIS.2,
 * Hunyuan3D, TripoSG) tramite il client ufficiale di Gradio (js/vendor/gradio-client.js). Non serve un server:
 * la richiesta parte dal browser di chi usa la pagina. Il risultato è un .glb con texture, da
 * vedere qui in 3D, scaricare o passare alla sorgente "Modello 3D" per farne sprite.
 *
 * Gli Space cambiano nel tempo: invece di fidarsi di un elenco fisso di parametri si legge l'API
 * dello Space (view_api) e si riempiono per nome. Ogni Space ha una ricetta di passi (endpoint);
 * se uno Space non ha gli endpoint attesi si cerca da solo quello "immagine → modello 3D".
 *
 * Limiti degli Space gratuiti: coda d'attesa, quota GPU giornaliera (più alta con un token
 * Hugging Face gratuito), Space a volte in pausa. Il pannello lo dice chiaramente.
 */
const AI3D = (() => {
  const VENDOR = (() => { try { return new URL("vendor/gradio-client.js", document.currentScript.src).href; } catch (e) { return "js/vendor/gradio-client.js"; } })();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { } }
  };

  // Ricette degli Space (verificate sulle API di ottobre 2026). Ogni Space ha una o più varianti di
  // passi: si usa la prima i cui endpoint esistono ancora. Valori = parametri da imporre per nome:
  // "$img" immagine caricata, "$prev" immagine prodotta dal passo prima, "$glb" modello del passo prima,
  // "$tex" lato della texture, "$simp" semplificazione (0-1), "$faces" triangoli, "$seed" seme.
  const SPACES = [
    {
      id: "trellis-community/TRELLIS", label: "TRELLIS · Microsoft",
      note: "Forma e texture fedeli, il più affidabile; 20-60 secondi.",
      variants: [
        [{ ep: "/start_session", optional: true },
         { ep: "/generate_and_extract_glb", args: { image: "$img", seed: "$seed", mesh_simplify: "$simp", texture_size: "$tex" }, out: "glb" }],
        [{ ep: "/start_session", optional: true },
         { ep: "/preprocess_image", args: { image: "$img" }, out: "image" },
         { ep: "/image_to_3d", args: { image: "$prev", is_multiimage: false, seed: "$seed" }, out: "none" },
         { ep: "/extract_glb", args: { mesh_simplify: "$simp", texture_size: "$tex" }, out: "glb" }]
      ]
    },
    {
      id: "microsoft/TRELLIS.2", label: "TRELLIS.2 · Microsoft (più dettagliato)",
      note: "La versione nuova, più dettagliata; chiede più quota GPU (meglio con un token).",
      variants: [
        [{ ep: "/start_session", optional: true },
         { ep: "/preprocess_image", args: { input: "$img" }, out: "image" },
         { ep: "/image_to_3d", args: { image: "$prev", seed: "$seed", resolution: "1024" }, out: "none" },
         { ep: "/extract_glb", args: { decimation_target: "$faces", texture_size: "$tex" }, out: "glb" }]
      ]
    },
    {
      id: "tencent/Hunyuan3D-2", label: "Hunyuan3D-2 · Tencent",
      note: "Forma molto pulita con texture; 1-3 minuti.",
      variants: [[{ ep: "/generation_all", args: { image: "$img", seed: "$seed", randomize_seed: false, check_box_rembg: true, steps: 30, guidance_scale: 5, octree_resolution: 256 }, out: "glb", prefer: "last" }]]
    },
    {
      id: "tencent/Hunyuan3D-2.1", label: "Hunyuan3D-2.1 · Tencent",
      note: "Versione nuova di Hunyuan3D, con materiali più realistici.",
      variants: [[{ ep: "/generation_all", args: { image: "$img", seed: "$seed", randomize_seed: false, check_box_rembg: true, steps: 30, guidance_scale: 5, octree_resolution: 256 }, out: "glb", prefer: "last" }]]
    },
    {
      id: "VAST-AI/TripoSG", label: "TripoSG · VAST (Tripo)",
      note: "Il modello open source di Tripo: forma molto precisa, poi la texture.",
      variants: [
        [{ ep: "/start_session", optional: true },
         { ep: "/run_segmentation", args: { image: "$img" }, out: "image" },
         { ep: "/image_to_3d", args: { image: "$prev", seed: "$seed", simplify: true, target_face_num: "$faces" }, out: "glb" },
         { ep: "/run_texture", args: { image: "$prev", mesh_path: "$glb", seed: "$seed" }, out: "glb", optional: true }]
      ]
    }
  ];
  const AUTO = "auto";

  const st = {
    file: null, url: null, glb: null, glbName: "", job: null, client: null, busy: false, cancelled: false,
    view: null
  };

  // ------------------------------------------------------------------ utilità
  const $ = (s) => document.querySelector(s);
  const say = (t, kind) => { const p = $("#aiStatus"); if (!p) return; p.textContent = t || ""; p.dataset.kind = kind || ""; };
  const isImageParam = (p) => /image/i.test(p.component || "") || (/image|img|picture|photo/i.test(p.parameter_name || p.label || "") && !/multi|gallery|images/i.test(p.parameter_name || ""));
  const fileName = (f) => String(f && (f.orig_name || f.path || f.url) || "");
  const isFile = (v) => v && typeof v === "object" && (typeof v.url === "string" || typeof v.path === "string");

  /** tutti i file (FileData) contenuti nel risultato, anche annidati (es. { value: {...} }) */
  function filesIn(v, out = []) {
    if (!v) return out;
    if (Array.isArray(v)) { v.forEach((x) => filesIn(x, out)); return out; }
    if (isFile(v)) { out.push(v); return out; }
    if (typeof v === "object") Object.values(v).forEach((x) => filesIn(x, out));
    return out;
  }

  function pickGlb(data, prefer) {
    const files = filesIn(data).filter((f) => /\.(glb|gltf)(\?|$)/i.test(fileName(f)));
    if (!files.length) return null;
    return prefer === "last" ? files[files.length - 1] : files[0];
  }
  const pickImage = (data) => filesIn(data).find((f) => /\.(png|jpe?g|webp)(\?|$)/i.test(fileName(f))) || filesIn(data)[0] || null;

  /** Argomenti per un endpoint: per nome dai valori della ricetta, l'immagine dove serve, il resto ai default */
  function buildArgs(info, wanted, ctx) {
    const out = {};
    const resolve = (v) => v === "$img" ? ctx.img : v === "$prev" ? (ctx.prev || ctx.img) : v === "$glb" ? ctx.glb : v === "$tex" ? ctx.tex : v === "$simp" ? ctx.simp : v === "$faces" ? ctx.faces : v === "$seed" ? ctx.seed : v;
    for (const p of info.parameters || []) {
      const n = p.parameter_name;
      if (!n) continue;
      if (wanted && Object.prototype.hasOwnProperty.call(wanted, n)) { out[n] = resolve(wanted[n]); continue; }
      // le immagini facoltative (es. viste multiple fronte/retro/lati di Hunyuan3D) restano vuote
      if (p.parameter_has_default) continue;
      if (isImageParam(p)) { out[n] = ctx.prev || ctx.img; continue; }
      if (/gallery|files/i.test(p.component || "")) { out[n] = []; continue; }
      if (/checkbox/i.test(p.component || "")) { out[n] = false; continue; }
      out[n] = null;
    }
    return out;
  }

  /** Space senza la ricetta attesa: endpoint che prende un'immagine e restituisce un modello o un file */
  function guessEndpoint(api) {
    const eps = Object.entries(api.named_endpoints || {});
    const score = ([name, e]) => {
      const inImg = (e.parameters || []).some(isImageParam);
      const outModel = (e.returns || []).some((r) => /model3d|file/i.test(r.component || ""));
      return (inImg ? 2 : 0) + (outModel ? 3 : 0) + (/3d|generat|mesh|glb/i.test(name) ? 1 : 0);
    };
    const best = eps.map((e) => [score(e), e]).sort((a, b) => b[0] - a[0])[0];
    return best && best[0] >= 5 ? best[1][0] : null;
  }

  function friendlyError(e) {
    const m = String((e && (e.message || e.title)) || e || "");
    if (/quota/i.test(m)) { const t = m.match(/try again in ([\d:]+)/i); return "quota GPU gratuita esaurita" + (t ? ` (si ricarica tra ${t[1]})` : ""); }
    if (/worker error|RuntimeError|CUDA|out of memory/i.test(m)) return "errore interno dello Space";
    if (/sleep|paused|PAUSED|not running|BUILD|RUNTIME_ERROR|CONFIG_ERROR|could not resolve|503|404/i.test(m)) return "Space in pausa o guasto in questo momento";
    if (/failed to fetch|NetworkError|network/i.test(m)) return "Hugging Face non risponde (controlla la connessione)";
    if (/queue|too many/i.test(m)) return "Space molto occupato";
    return m.length > 180 ? m.slice(0, 180) + "…" : m || "errore sconosciuto";
  }

  async function loadClient() {
    if (AI3D._Client) return AI3D._Client;            // sostituibile nei test
    const mod = await import(VENDOR);
    return mod.Client;
  }

  /** Esegue un endpoint con stato di avanzamento (coda, eta, progresso) */
  async function run(client, ep, args, label) {
    const job = client.submit(ep, args);
    st.job = job;
    let data = null;
    for await (const msg of job) {
      if (st.cancelled) break;
      if (msg.type === "status") {
        if (msg.stage === "error") throw new Error([msg.title, msg.message].filter(Boolean).join(": ") || "errore dello Space");
        if (msg.stage === "pending") {
          const q = msg.position != null ? `in coda, posizione ${msg.position + 1}${msg.size ? " di " + msg.size : ""}` : "in attesa";
          say(`${label}: ${q}${msg.eta ? ` · circa ${Math.round(msg.eta)} s` : ""}…`);
        } else if (msg.stage === "generating") {
          const p = (msg.progress_data || [])[0];
          const pct = p && p.length ? ` ${Math.round((p.index || 0) / p.length * 100)}%` : "";
          say(`${label}: elaborazione${pct}${p && p.desc ? " · " + p.desc : ""}…`);
        }
      } else if (msg.type === "data") {
        data = msg.data;
      }
    }
    st.job = null;
    if (st.cancelled) throw Object.assign(new Error("annullato"), { cancelled: true });
    return data;
  }

  // ------------------------------------------------------------------ generazione
  const FACES = { 0.98: 20000, 0.95: 50000, 0.9: 100000, 0.8: 200000 };

  /** Un tentativo su uno Space: restituisce il blob .glb o lancia l'errore vero dello Space */
  async function tryOn(recipe, token, ctx0) {
    const Client = await loadClient();
    const opts = {
      events: ["data", "status"],          // senza "status" gli errori (quota, guasti) non arrivano
      status_callback: (s) => { if (s && s.status && s.status !== "running") say(`${recipe.label}: ${s.status === "sleeping" ? "lo Space è in pausa, lo sto svegliando" : s.status === "building" ? "lo Space è in avvio" : "stato " + s.status}… (può volerci un minuto)`); }
    };
    if (/^hf_/.test(token)) opts.token = token;
    const client = await Client.connect(recipe.id, opts);
    st.client = client;
    try {
      const api = await client.view_api();
      const named = (api && api.named_endpoints) || {};
      if (!Object.keys(named).length) throw new Error("Lo Space è in pausa o guasto (CONFIG_ERROR)");
      const ctx = Object.assign({}, ctx0, { prev: null, glb: null });
      let steps = (recipe.variants || []).map((v) => v.filter((s) => named[s.ep] || !s.optional)).find((v) => v.length && v.every((s) => named[s.ep]));
      if (!steps) {
        const ep = guessEndpoint(api);
        if (!ep) throw new Error("Questo Space non ha un endpoint immagine → modello 3D riconoscibile.");
        steps = [{ ep, out: "glb", prefer: "last" }];
      }
      let glbFile = null;
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i], label = `${recipe.label} · passo ${i + 1} di ${steps.length}`;
        if (s.args && Object.values(s.args).includes("$glb") && !ctx.glb) continue;
        let data;
        try { data = await run(client, s.ep, buildArgs(named[s.ep], s.args, ctx), label); }
        catch (e) { if (s.optional && glbFile && !e.cancelled) break; throw e; }   // texture facoltativa: si tiene la forma
        if (s.out === "image") ctx.prev = pickImage(data) || ctx.prev;
        if (s.out === "glb") { const g = pickGlb(data, s.prefer); if (g) { glbFile = g; ctx.glb = g; } }
      }
      if (!glbFile) throw new Error("lo Space non ha restituito un modello 3D");
      say(`${recipe.label}: scarico il modello…`);
      const res = await fetch(glbFile.url || glbFile.path, token ? { headers: { Authorization: "Bearer " + token } } : undefined);
      if (!res.ok) throw new Error("download del modello non riuscito (" + res.status + ")");
      return await res.blob();
    } finally {
      try { client.close && client.close(); } catch (e) { }
      st.client = null;
    }
  }

  async function generate() {
    if (st.busy) return;
    if (!st.file) { say("Carica prima un'immagine.", "warn"); return; }
    const custom = $("#aiCustom").value.trim().replace(/^https?:\/\/huggingface\.co\/spaces\//, "").replace(/\/$/, "");
    const choice = $("#aiSpace").value;
    const list = custom ? [SPACES.find((s) => s.id === custom) || { id: custom, label: custom, variants: [] }]
      : choice === AUTO ? SPACES : [SPACES.find((s) => s.id === choice) || SPACES[0]];
    const token = $("#aiToken").value.trim();
    store.set("fs-ai-space", choice);
    store.set("fs-ai-token", token);
    st.busy = true; st.cancelled = false; setBusy(true);
    const t0 = performance.now();
    const simp = +$("#aiSimp").value;
    const ctx = { img: st.file, tex: +$("#aiTex").value, simp, faces: FACES[simp] || 50000, seed: Math.floor(Math.random() * 100000) };
    const failures = [];
    try {
      for (const recipe of list) {
        say(`Provo ${recipe.label}…`);
        try {
          const blob = await tryOn(recipe, token, ctx);
          await showModel(blob, baseName() + ".glb");
          say(`Modello pronto in ${Math.round((performance.now() - t0) / 1000)} s con ${recipe.label}. Trascinalo per girarlo.`, "ok");
          return;
        } catch (e) {
          if (e.cancelled || st.cancelled) { say("Generazione annullata."); return; }
          console.warn(recipe.id, e);
          failures.push(`• ${recipe.label}: ${friendlyError(e)}`);
          if (list.length > 1) say(failures.join("\n") + "\nProvo il prossimo…", "warn");
        }
      }
      const quota = failures.some((f) => /quota/i.test(f));
      say((list.length > 1 ? "Nessun modello AI ha funzionato adesso:\n" : "Generazione non riuscita:\n") + failures.join("\n")
        + (quota && !/^hf_/.test(token) ? "\n\nLa quota GPU gratuita senza account è piccola: crea un token Hugging Face gratuito (huggingface.co → Settings → Access Tokens, tipo «Read») e incollalo in «Altre opzioni». La quota sale molto." : "\n\nRiprova tra qualche minuto o scegli un altro modello."), "err");
    } finally {
      st.busy = false; setBusy(false);
    }
  }

  function cancel() {
    st.cancelled = true;
    try { st.job && st.job.cancel && st.job.cancel(); } catch (e) { }
  }

  function setBusy(b) {
    $("#aiGo").disabled = b;
    $("#aiCancel").hidden = !b;
    $("#aiPanel").classList.toggle("busy", b);
  }

  const baseName = () => (($("#name") && $("#name").value.trim()) || "modello").replace(/[^\w\-]+/g, "_");

  // ------------------------------------------------------------------ immagine
  function setImage(f) {
    if (!f || !/^image\//.test(f.type)) { say("Scegli un file immagine (PNG, JPG, WebP).", "warn"); return; }
    st.file = f;
    if (st.url) URL.revokeObjectURL(st.url);
    st.url = URL.createObjectURL(f);
    const t = $("#aiThumb"); t.src = st.url; t.hidden = false;
    if ($("#name") && (!$("#name").value || $("#name").value === "personaggio")) $("#name").value = f.name.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "_").slice(0, 40);
    say("Immagine pronta. Scegli il modello e premi «Genera modello 3D».");
  }

  // ------------------------------------------------------------------ anteprima 3D
  function ensureView() {
    if (st.view) return st.view;
    const host = $("#aiStage"), cv = $("#aiView");
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    r.outputEncoding = THREE.sRGBEncoding;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(2, 4, 3); scene.add(sun);
    const grid = new THREE.GridHelper(4, 16, 0x8a6a30, 0x3a3b3e); scene.add(grid);
    const ctl = THREE.OrbitControls ? new THREE.OrbitControls(cam, cv) : null;
    if (ctl) { ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 1.6; }
    cam.position.set(0, 1, 3);
    const v = { r, scene, cam, ctl, grid, model: null, host, on: false };
    const size = () => { const b = host.getBoundingClientRect(); if (!b.width || !b.height) return; r.setSize(b.width, b.height, false); cam.aspect = b.width / b.height; cam.updateProjectionMatrix(); };
    new ResizeObserver(size).observe(host); size();
    const loop = () => { requestAnimationFrame(loop); if (!v.on) return; ctl && ctl.update(); r.render(scene, cam); };
    loop();
    st.view = v;
    return v;
  }

  async function showModel(blob, name) {
    if (!THREE.GLTFLoader) throw new Error("il lettore GLB non si è caricato");
    const buf = await blob.arrayBuffer();
    const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, "", res, rej));
    const v = ensureView();
    if (v.model) { v.scene.remove(v.model); disposeTree(v.model); }
    const m = gltf.scene;
    m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((mm) => { if (mm.map) mm.map.encoding = THREE.sRGBEncoding; mm.side = THREE.DoubleSide; }); } });
    // centrato e appoggiato sulla griglia, alto 1.6
    let box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3()), s = 1.6 / (Math.max(size.x, size.y, size.z) || 1);
    m.scale.setScalar(s); m.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    m.position.set(-c.x, -box.min.y, -c.z);
    v.scene.add(m); v.model = m;
    const h = box.max.y - box.min.y;
    v.cam.position.set(0, h * 0.8, 3.8); if (v.ctl) { v.ctl.target.set(0, h * 0.45, 0); v.ctl.update(); }
    let tris = 0; m.traverse((o) => { if (o.isMesh && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    st.glb = blob; st.glbName = name;
    $("#aiResult").hidden = false;
    $("#aiInfo").textContent = `${Math.round(tris).toLocaleString("it-IT")} triangoli · ${(blob.size / 1048576).toFixed(1)} MB`;
    $("#aiEmpty").hidden = true;
  }

  function disposeTree(o) {
    o.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { if (x.map) x.map.dispose(); x.dispose(); }); });
  }

  /** Mostra l'anteprima solo nella sorgente AI */
  function setActive(on) {
    $("#aiStage").hidden = !on;
    document.body.classList.toggle("mode-ai", on);
    if (on) { const v = ensureView(); v.on = true; window.dispatchEvent(new Event("resize")); }
    else if (st.view) st.view.on = false;
  }

  // ------------------------------------------------------------------ uscite
  function download() {
    if (!st.glb) return;
    if (typeof saveFile === "function") saveFile(baseName() + ".glb", st.glb);
  }

  function useForSprites() {
    if (!st.glb) return;
    const f = new File([st.glb], baseName() + ".glb", { type: "model/gltf-binary" });
    if (typeof SpriteLayout !== "undefined") SpriteLayout.setMode("model");
    if (typeof loadModelFiles === "function") loadModelFiles([f]);
  }

  // ------------------------------------------------------------------ pannello
  function init() {
    const sel = $("#aiSpace");
    sel.innerHTML = `<option value="${AUTO}">Automatico: prova i modelli finché uno funziona (consigliato)</option>`
      + SPACES.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
    const saved = store.get("fs-ai-space");
    sel.value = saved && SPACES.some((s) => s.id === saved) ? saved : AUTO;
    const note = () => { const s = SPACES.find((x) => x.id === sel.value); $("#aiNote").textContent = s ? s.note : "TRELLIS, poi TRELLIS.2, Hunyuan3D e TripoSG: se uno è occupato, guasto o senza quota si passa al successivo."; };
    sel.addEventListener("change", note); note();
    $("#aiToken").value = store.get("fs-ai-token") || "";

    $("#aiFile").addEventListener("change", (e) => setImage(e.target.files[0]));
    const drop = $("#aiDrop");
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => setImage(e.dataTransfer.files[0]));
    window.addEventListener("paste", (e) => {
      if (!document.body.classList.contains("mode-ai")) return;
      const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
      if (it) setImage(it.getAsFile());
    });
    $("#aiGo").addEventListener("click", generate);
    $("#aiCancel").addEventListener("click", cancel);
    $("#aiDownload").addEventListener("click", download);
    $("#aiUse").addEventListener("click", useForSprites);
    $("#aiOpenGlb").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { await showModel(f, f.name); say("Modello caricato: puoi scaricarlo di nuovo o usarlo per gli sprite.", "ok"); }
      catch (err) { console.error(err); say("Questo file non è un .glb leggibile.", "err"); }
    });
  }

  return { init, setActive, setImage, generate, cancel, SPACES, _Client: null, _buildArgs: buildArgs, _pickGlb: pickGlb, _guessEndpoint: guessEndpoint, get state() { return st; } };
})();

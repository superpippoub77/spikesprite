// Diagnostica (temporanea): cosa rispondono davvero gli Space gratuiti immagine → 3D.
import { Client, handle_file } from "@gradio/client";
import zlib from "node:zlib";

// immagine di prova: il cavaliere di esempio di Fucina Sprite (PNG generato qui, niente download)
function knightPng() {
  const W = 24 * 8, H = 48 * 8, px = Buffer.alloc(W * H * 4, 255);
  const R = (a, b, w, h, c) => { const [r, g, bl] = [c >> 16, (c >> 8) & 255, c & 255];
    for (let y = b * 8; y < (b + h) * 8; y++) for (let x = a * 8; x < (a + w) * 8; x++) { const i = (y * W + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = bl; px[i + 3] = 255; } };
  R(10,0,4,2,0xd94a3a);R(7,1,10,12,0x8f9bb3);R(8,6,8,2,0x2a2f45);R(8,14,8,14,0x3a5bdb);R(11,17,2,4,0xf0c040);R(8,24,8,2,0x7a4a22);
  R(4,14,4,3,0x8f9bb3);R(16,14,4,3,0x8f9bb3);R(4,17,3,12,0x2c48b3);R(17,17,3,12,0x2c48b3);R(4,29,3,2,0xf2c29a);R(17,29,3,2,0xf2c29a);
  R(9,28,3,15,0x4b5268);R(13,28,3,15,0x4b5268);R(8,43,4,5,0x5a3a1e);R(13,43,4,5,0x5a3a1e);
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const img = new Blob([knightPng()], { type: "image/png" });
const short = (v) => JSON.stringify(v, (k, x) => typeof x === "string" && x.length > 300 ? x.slice(0, 300) + "…" : x);

const SPACES = (process.env.SPACES || "trellis-community/TRELLIS,JeffreyXiang/TRELLIS,tencent/Hunyuan3D-2,stabilityai/TripoSR,tencent/Hunyuan3D-2.1,VAST-AI/TripoSG,microsoft/TRELLIS.2").split(",");
for (const id of SPACES) {
  console.log("\n==================== " + id);
  try {
    const c = await Client.connect(id, { status_callback: (s) => console.log("  space status:", short(s)) });
    console.log("  root:", c.config?.root, "version:", c.config?.version, "api_prefix:", c.api_prefix);
    const api = await c.view_api();
    for (const [ep, e] of Object.entries(api.named_endpoints || {}))
      console.log("  EP", ep, "\n     params:", short((e.parameters || []).map((p) => [p.parameter_name, p.component, p.parameter_has_default ? "def=" + short(p.parameter_default) : "REQ", p.python_type?.type])),
        "\n     returns:", short((e.returns || []).map((r) => [r.label, r.component, r.python_type?.type])));
  } catch (e) { console.log("  CONNECT/API ERROR:", e?.message || short(e)); }
}

// prova reale di generazione sui due candidati principali
async function run(c, ep, args) {
  console.log("  >>", ep, short(Object.fromEntries(Object.entries(args).map(([k, v]) => [k, v instanceof Blob ? "BLOB" : v]))));
  const job = c.submit(ep, args); let data = null;
  for await (const m of job) { if (m.type === "status") { if (m.stage === "error") throw new Error("status error: " + short(m)); } if (m.type === "data") { data = m.data; console.log("  << data:", short(data)); } }
  return data;
}
const T0 = Date.now();
if (!process.env.SKIP_RUN) {
  for (const id of ["trellis-community/TRELLIS", "tencent/Hunyuan3D-2", "stabilityai/TripoSR"]) {
    console.log("\n#################### RUN " + id);
    try {
      const c = await Client.connect(id);
      const api = await c.view_api(); const N = api.named_endpoints;
      if (id.includes("TRELLIS")) {
        if (N["/start_session"]) await run(c, "/start_session", {});
        const pre = await run(c, "/preprocess_image", { image: handle_file(img) });
        await run(c, "/image_to_3d", { image: pre?.[0] ?? handle_file(img), multiimages: [], is_multiimage: false, seed: 0, ss_guidance_strength: 7.5, ss_sampling_steps: 12, slat_guidance_strength: 3, slat_sampling_steps: 12, multiimage_algo: "stochastic" });
        await run(c, "/extract_glb", { mesh_simplify: 0.95, texture_size: 1024 });
      } else if (id.includes("Hunyuan")) {
        await run(c, "/generation_all", { image: handle_file(img), seed: 1234, randomize_seed: false, check_box_rembg: true, steps: 30, guidance_scale: 5, octree_resolution: 256 });
      } else {
        const pre = await run(c, "/preprocess", { input_image: handle_file(img), do_remove_background: true, foreground_ratio: 0.85 });
        await run(c, "/generate", { image: pre?.[0] ?? handle_file(img), mc_resolution: 256 });
      }
    } catch (e) { console.log("  RUN ERROR:", e?.message || short(e)); }
    console.log("  tempo:", Math.round((Date.now() - T0) / 1000), "s");
  }
}
process.exit(0);

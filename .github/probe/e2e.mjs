// Prova completa (temporanea): la pagina vera nel browser, gli Space veri di Hugging Face.
import { chromium } from "playwright";
import fs from "node:fs";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on("console", (m) => { if (/error|warn/.test(m.type())) console.log("  [console]", m.type(), m.text().slice(0, 300)); });
p.on("pageerror", (e) => console.log("  [pageerror]", e.message));
await p.goto("http://localhost:8000/index.html", { waitUntil: "load" });
await p.keyboard.press("4");
await p.setInputFiles("#aiFile", process.env.IMG);
for (const choice of (process.env.CHOICES || "auto").split(",")) {
  console.log("\n===== scelta:", choice);
  await p.selectOption("#aiSpace", choice);
  const t0 = Date.now();
  await p.click("#aiGo");
  let last = "";
  while (Date.now() - t0 < 9 * 60e3) {
    await p.waitForTimeout(3000);
    const s = await p.textContent("#aiStatus");
    if (s !== last) { console.log(`  [${Math.round((Date.now() - t0) / 1000)}s]`, s); last = s; }
    if (await p.$eval("#aiGo", (b) => !b.disabled)) break;
  }
  console.log("  RISULTATO:", await p.$eval("#aiResult", (r) => r.hidden ? "nessun modello" : "MODELLO OK"), "|", await p.textContent("#aiInfo"));
  await p.screenshot({ path: `shot-${choice.replace(/\W+/g, "_")}.png` });
}
await b.close();

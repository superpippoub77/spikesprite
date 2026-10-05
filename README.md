# Fucina Sprite 3

Generatore di sprite animati in 8 direzioni, in HTML + JavaScript (nessuna build).
Apri `index.html` nel browser (serve internet per three.js, JSZip e i font).

## Interfaccia (stile SpikeCut)
- **Topbar**: ☰ comprime/espande la barra strumenti, nome dello sprite (nome dei file esportati),
  stato (✓ Pronto), Apri, Guida e i menu **File ▾**, **Vista ▾**, **⋯**.
- **Barra schede**: la sorgente — Immagine 2D, Modello 3D, Ripara sprite.
- **Rail a sinistra**: strumenti a sezioni (Sorgente, Anteprima, Scheletro, Esporta), icona + nome + tasto.
- **Anteprima** al centro: direzione, riproduzione, frame; i file si possono trascinare qui.
- **Pannello a schede** a destra: Sorgente, Stile, Scheletro, Animazioni, Vista, Esporta.
- **Status bar**: modalità, animazione e direzione, cella, mostra/nascondi barre, versione.
- Le maniglie tra i riquadri si trascinano per cambiarne la larghezza (doppio clic = nascondi);
  le linguette ‹ › li mostrano e nascondono. Larghezze e scheda attiva restano memorizzate.
- Scorciatoie: O apri · 1/2/3 sorgente · Spazio riproduci · ←/→ frame · G tutte le direzioni ·
  C prima/dopo · [ ] barre · Ctrl+S pacchetto .zip · F1 guida.

## Due sorgenti
**Immagine 2D**
1. Pulizia: sfondo e ombra rimossi, risoluzione originale dei pixel rilevata, riduzione "a moda" (nitida).
2. Scheletro a 27 articolazioni: testa, collo, petto, vita, bacino; per lato clavicola, spalla, gomito, polso,
   nocche, punta delle dita, anca, ginocchio, caviglia, pianta del piede, punta del piede (22 parti),
   rilevato dalla sagoma (percorso centrale dentro ogni arto, punto di massima piega per gomiti e ginocchia).
   In claude.ai c'è anche "Rileva con Claude" (analisi visiva). I punti si correggono trascinandoli.
3. 22 parti: assegnazione per vicinanza alle ossa + zone di colore chiuse dai contorni.
   Busto nascosto dalle braccia ricostruito, sovrapposizioni alle articolazioni (niente buchi), retro generato.
4. Pupazzo 3D: ogni parte ha volume a sezione circolare attorno al suo osso; davanti l'immagine, dietro il retro.
   Di fronte il risultato è identico all'originale; di lato e di spalle è un'interpretazione.
5. Animazioni con angoli articolari e piedi sempre appoggiati a terra.

**Modello 3D** (.glb / .fbx, anche Mixamo)
Carica il modello e le animazioni insieme; renderizzate in 8 direzioni e convertite in pixel art.

**Ripara sprite** (sprite sheet PNG, GIF animata o frame separati)
1. Rilevamento automatico dei frame (righe/colonne vuote) o griglia manuale.
2. Pulizia: sfondo, aloni, pixel sparsi, frame doppi, palette unica per tutti i frame.
3. Stabilizzazione sul punto d'appoggio (piedi o centro): il tremolio sparisce,
   salti e affondi voluti vengono solo levigati.
4. Frame fuori sequenza: riconosciuti e ricostruiti dai vicini.
5. Frame intermedi: movimento stimato pixel per pixel e ricostruzione senza sfumature;
   se il movimento non è affidabile il frame viene tenuto fermo invece di inventarlo.
6. Confronto prima/dopo nell'anteprima.
7. Contenuto delle righe: nell'elenco Animazioni ogni riga ha un menu (Fermo, Camminata, Corsa, Salto,
   Attacco, Sparo, Colpito, Sconfitta, Saluto). Il nome scelto diventa il nome dell'animazione esportata
   e decide se va in loop.
8. Animazioni mancanti: si spuntano quelle da creare; vengono generate dal frame scelto (riga/frame),
   con lo stesso personaggio, la stessa palette, la stessa cella e lo stesso punto d'appoggio.
   Funziona con sprite di lato (verso destra o sinistra) e di fronte; lo scheletro si corregge a mano.

## File
- `js/imaging.js` pulizia immagine, palette, contorni
- `js/skeleton.js` articolazioni, parti, ricostruzione
- `js/puppet.js` pupazzo 3D e posa
- `js/anims.js` animazioni procedurali
- `js/sources.js` sorgenti (pupazzo e modelli 3D)
- `js/repair.js` riparazione di sprite esistenti
- `js/render.js` render 8 direzioni e conversione in pixel art
- `js/layout.js` layout stile SpikeCut: topbar, menu, rail, pannello a schede, status bar
- `js/app.js` interfaccia ed esportazione

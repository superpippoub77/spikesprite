"use strict";
/* ============ Fucina Sprite — applicazione ============ */
const S={mode:'image',sub:'char',img:null,base:null,ownOutline:false,palette:null,J:null,jManual:false,P2:null,G:null,source:null,model:null,detected:null,
  opt:{bg:'auto',tol:20,shadowRm:true,flip:false,pixel:true,autoRes:true,height:48,colors:24,outline:true,outlineC:'#1a1424',
    pose:'neutral',thick:1,dirs:'8',elev:0,shade:true,shadow:true,scale:1,mHeight:64,inPlace:true,flat:false},
  cur:'idle',dir:'S',frame:0,playing:true,grid:false,cache:new Map(),cell:null,dirty:true,ready:false};

if(!window.THREE){document.addEventListener('DOMContentLoaded',()=>toast('La libreria 3D non si è caricata: serve la connessione internet.'))}
const has3D=!!window.THREE&&initRenderer();

/* ---------- Immagine ---------- */
function processImage(){
  if(!S.img)return false;
  const o=S.opt;let w=S.img.naturalWidth||S.img.width,h=S.img.naturalHeight||S.img.height;
  const k=Math.min(1,2048/Math.max(w,h));w=Math.max(1,Math.round(w*k));h=Math.max(1,Math.round(h*k));
  const c=mk(w,h),x=ctx2(c);if(o.flip){x.translate(w,0);x.scale(-1,1)}x.drawImage(S.img,0,0,w,h);x.setTransform(1,0,0,1,0,0);
  const id=x.getImageData(0,0,w,h);if(o.bg==='auto')removeBg(id,o.tol,o.shadowRm);
  const d=id.data;let x0=w,y0=h,x1=-1,y1=-1;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(d[(yy*w+xx)*4+3]>10){if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(yy<y0)y0=yy;if(yy>y1)y1=yy}
  if(x1<0){toast("Dopo la rimozione dello sfondo non resta nulla: abbassa la tolleranza.");return false}
  x.putImageData(id,0,0);const cw=x1-x0+1,chh=y1-y0+1,crop=x.getImageData(x0,y0,cw,chh);
  let H,W,rd;
  if(o.pixel){
    if(o.autoRes){const u=estimateUnit(crop),ok=u>=1.5&&chh/u<=200;H=ok?Math.round(chh/u):Math.min(chh,128);H=Math.max(24,Math.min(256,H));S.detected=ok;o.height=H;$('#height').value=H}
    else H=o.height;
    W=Math.max(1,Math.round(cw*H/chh));
    if(chh/H>=1.5)rd=modeDownscale(crop,W,H);
    else{const cc=mk(cw,chh);cc.getContext('2d').putImageData(crop,0,0);const t=mk(W,H),tx=ctx2(t);tx.imageSmoothingEnabled=false;tx.drawImage(cc,0,0,W,H);rd=tx.getImageData(0,0,W,H);for(let i=3;i<rd.data.length;i+=4)rd.data[i]=rd.data[i]<128?0:255}
    keepMainComponents(rd,.04);
  }else{
    H=Math.max(32,o.height);W=Math.max(1,Math.round(cw*H/chh));const cc=mk(cw,chh);cc.getContext('2d').putImageData(crop,0,0);
    rd=getID(downscaleSmooth(cc,W,H));for(let i=3;i<rd.data.length;i+=4)rd.data[i]=rd.data[i]<110?0:255;keepMainComponents(rd,.04);
  }
  if(o.pixel&&o.colors>0)quantize(rd,o.colors);
  let a0=W,b0=H,a1=-1,b1=-1;for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)if(rd.data[(yy*W+xx)*4+3]){if(xx<a0)a0=xx;if(xx>a1)a1=xx;if(yy<b0)b0=yy;if(yy>b1)b1=yy}
  const r=mk(a1-a0+1,b1-b0+1);r.getContext('2d').putImageData(rd,-a0,-b0);
  S.crop={x0:x0+a0*cw/W,y0:y0+b0*chh/H,s:W/cw,k};
  S.ownOutline=hasOwnOutline(getID(r));S.base=r;S.outlineCol=edgeDarkColor(getID(r));
  S.palette=o.pixel?buildPalette(getID(r),o.colors||32):null;
  syncOutputs();return true;
}
function rebuild(full){
  if(S.mode==='repair'){if(S.repairRes)assemble();else runRepair();return}
  if(!has3D){toast('Il motore 3D non è disponibile in questo browser.');return}
  disposeSource();
  const prev=S.source?.anim;
  try{
    if(S.mode==='image'){
      if(!S.base)return;
      if(full&&!processImage())return;
      const W=S.base.width,H=S.base.height,opt={thick:S.opt.thick,shade:S.opt.shade,pixel:S.opt.pixel,pose:S.opt.pose};
      if(S.sub==='char'){
        if(!S.J||(full&&!S.jManual))S.J=autoJoints(S.base);
        completeJoints(S.J);S.P2=buildParts2D(S.base,S.J,W,H);S.G=buildPuppet(S.P2,S.J,W,H,opt);
        const rc=$('#recon');if(S.P2.filled){rc.hidden=false;rc.textContent=`Ricostruite ${S.P2.filled} zone di busto nascoste dalle braccia. Il retro di testa e corpo è ricostruito dai colori principali.`}else rc.hidden=true;
      }else S.G=buildObject(S.base,opt);
      S.source=puppetSource(S.G,S.sub,S.palette,S.ownOutline,prev&&S.source?.sub===S.sub?prev:null);S.source.outlineCol=S.outlineCol;
      drawJoints();
    }else{
      if(!S.model)return;
      S.source=modelSource(S.model,{height:S.opt.mHeight,inPlace:S.opt.inPlace,flat:S.opt.flat},prev&&S.source?.kind==='model'?prev:null);
    }
  }catch(e){console.error(e);toast('Errore nella costruzione: '+(e.message||e));return}
  if(!S.source.anim[S.cur])S.cur=Object.keys(S.source.anim)[0];
  S.ready=true;$('#empty').hidden=true;buildAnimList();invalidate();
}
function disposeSource(){const t=S.source?.turn;if(!t||S.source.kind==='model')return;t.traverse(o=>{if(o.isMesh){o.geometry.dispose();const m=o.material;if(m.map)m.map.dispose();m.dispose()}});t.parent?.remove(t)}
function invalidate(){S.cache.clear();S.cell=null;S.frame=0;S.dirty=true;S.stripKey='';updateInfo()}

/* ---------- Frame ---------- */
const enabledKeys=()=>Object.keys(S.source.anim).filter(k=>S.source.anim[k].on);
const dirList=()=>S.source?.kind==='frames'?['S']:DIRSETS[S.opt.dirs];
function getCell(){
  if(S.source.kind==='frames')return S.source.cell;
  if(!S.cell){const keys=[...new Set([...enabledKeys(),S.cur])],dirs=[...new Set([...dirList(),S.dir,...(S.grid?DIRSETS['8']:[])])];S.cell=computeCell(S.source,keys,dirs,S.opt.elev)}
  return S.cell;
}
function ensurePalette(){
  if(S.source.kind!=='model'||!S.opt.pixel||S.source.palette)return;
  const cell=getCell(),k=Object.keys(S.source.anim)[0];const c=renderFrame(S.source,k,0,'S',cell,{...S.opt,pixel:true,outline:false,shadow:false});
  S.source.palette=buildPalette(getID(c),S.opt.colors||24);
}
function getFrames(key,dir){
  if(S.source.kind==='frames')return S.source.frames[key];
  const ck=key+'|'+dir;if(S.cache.has(ck))return S.cache.get(ck);
  ensurePalette();const cell=getCell(),n=S.source.anim[key].n,fr=[];
  for(let i=0;i<n;i++)fr.push(renderFrame(S.source,key,i,dir,cell,S.opt));
  S.cache.set(ck,fr);return fr;
}

/* ---------- Anteprima ---------- */
const view=$('#view');
function sizeView(){const r=$('#stage').getBoundingClientRect(),dpr=window.devicePixelRatio||1;view.width=Math.round(r.width*dpr);view.height=Math.round(r.height*dpr);S.dirty=true}
new ResizeObserver(sizeView).observe($('#stage'));
function drawStage(){
  const x=view.getContext('2d');x.clearRect(0,0,view.width,view.height);if(!S.ready)return;
  const dpr=window.devicePixelRatio||1,n=S.source.anim[S.cur].n,f=S.frame%n;
  if(S.source.kind==='frames'&&S.compare){drawCompare(x,dpr,f)}
  else if(S.grid&&S.source.kind!=='frames'){
    const order=['NW','N','NE','W','S','E','SW','SE'],cols=4,rows=2,cell=getCell(),gw=view.width/cols,gh=view.height/rows;
    const z=Math.max(1,Math.floor(Math.min((gw-16)/cell.cw,(gh-26*dpr)/cell.ch)));
    ['S','SE','E','NE','N','NW','W','SW'].forEach((d,k)=>{const c=getFrames(S.cur,d)[f],cx=(k%cols)*gw,cy=Math.floor(k/cols)*gh;x.imageSmoothingEnabled=false;
      const w=cell.cw*z,h=cell.ch*z;x.drawImage(c,Math.round(cx+(gw-w)/2),Math.round(cy+(gh-h)/2+8*dpr),w,h);
      x.fillStyle=cssVar('--muted');x.font=`${12*dpr}px Chivo, sans-serif`;x.fillText(DIRS.find(o=>o.k===d).l,cx+10*dpr,cy+18*dpr)});
  }else{
    const c=getFrames(S.cur,S.dir)[f],cell=getCell(),z=Math.max(1,Math.floor(Math.min((view.width-40)/cell.cw,(view.height-40)/cell.ch)));
    const w=cell.cw*z,h=cell.ch*z,ox=Math.round((view.width-w)/2),oy=Math.round((view.height-h)/2);
    x.imageSmoothingEnabled=false;x.drawImage(c,ox,oy,w,h);x.lineWidth=dpr;x.setLineDash([4*dpr,4*dpr]);x.strokeStyle=cssVar('--muted');x.strokeRect(ox+.5,oy+.5,w-1,h-1);
    x.strokeStyle=cssVar('--amber');x.beginPath();x.moveTo(ox,oy+cell.oy*z+.5);x.lineTo(ox+w,oy+cell.oy*z+.5);x.stroke();x.setLineDash([]);
  }
  $('#count').textContent=`${f+1} / ${n}`;
}
function drawCompare(x,dpr,f){
  const src=S.source,after=src.frames[S.cur][f],raw=src.raw[src.keyIndex[S.cur]]||[],fac=src.factor[S.cur]||1,before=raw[Math.floor(f/fac)%Math.max(1,raw.length)];
  const half=view.width/2;[[before,'Prima',0],[after,'Dopo',half]].forEach(([c,l,ox])=>{if(!c)return;const z=Math.max(1,Math.floor(Math.min((half-30)/c.width,(view.height-60*dpr)/c.height)));
    x.imageSmoothingEnabled=false;const w=c.width*z,h=c.height*z;x.drawImage(c,Math.round(ox+(half-w)/2),Math.round((view.height-h)/2+10*dpr),w,h);
    x.fillStyle=cssVar('--ink');x.font=`700 ${14*dpr}px Chivo, sans-serif`;x.fillText(l,ox+14*dpr,24*dpr)});
  x.strokeStyle=cssVar('--line');x.beginPath();x.moveTo(half,0);x.lineTo(half,view.height);x.stroke();
}
function updateStrip(){
  const st=$('#strip');if(!S.ready){st.innerHTML='';return}
  const fr=getFrames(S.cur,S.dir),key=S.cur+'|'+S.dir+'|'+fr.length+'|'+S.cache.size;
  if(S.stripKey!==key){S.stripKey=key;st.innerHTML='';fr.forEach((c,i)=>{const b=document.createElement('button'),cv=mk(c.width,c.height);cv.getContext('2d').drawImage(c,0,0);
    b.append(cv);const s=document.createElement('small');s.textContent=String(i+1).padStart(2,'0');b.append(s);b.setAttribute('aria-label','Frame '+(i+1));
    b.onclick=()=>{setPlay(false);S.frame=i;S.dirty=true};st.append(b)})}
  [...st.children].forEach((b,i)=>b.classList.toggle('on',i===S.frame%fr.length));
}
let last=0;
function tick(ts){requestAnimationFrame(tick);if(!S.ready)return;const a=S.source.anim[S.cur];
  if(S.playing&&ts-last>=1000/a.fps){last=ts;S.frame=(S.frame+1)%a.n;S.dirty=true}
  if(S.dirty){S.dirty=false;try{drawStage();updateStrip()}catch(e){console.error(e)}}}
requestAnimationFrame(tick);
function setPlay(v){S.playing=v;$('#play').textContent=v?'❚❚':'►';$('#play').setAttribute('aria-label',v?'Pausa':'Riproduci')}
$('#play').onclick=()=>setPlay(!S.playing);
$('#prev').onclick=()=>{if(!S.ready)return;setPlay(false);const n=S.source.anim[S.cur].n;S.frame=(S.frame-1+n)%n;S.dirty=true};
$('#next').onclick=()=>{if(!S.ready)return;setPlay(false);S.frame=(S.frame+1)%S.source.anim[S.cur].n;S.dirty=true};
$('#gridBtn').onclick=e=>{S.grid=!S.grid;e.currentTarget.setAttribute('aria-pressed',S.grid);S.cell=null;S.cache.clear();S.stripKey='';S.dirty=true};
$('#dirPad').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.dir=b.dataset.d;
  [...$('#dirPad').querySelectorAll('button')].forEach(x=>x.setAttribute('aria-pressed',x===b));$('#dirName').textContent=S.dir;
  if(!dirList().includes(S.dir)){S.cell=null;S.cache.clear()}S.stripKey='';S.dirty=true});
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;
  if(e.code==='Space'){e.preventDefault();setPlay(!S.playing)}else if(e.key==='ArrowRight')$('#next').click();else if(e.key==='ArrowLeft')$('#prev').click()});
function updateInfo(){const i=$('#info');if(!S.ready){i.hidden=true;return}i.hidden=false;
  const c=S.cell||getCell();if(S.source.kind==='frames'){i.textContent=`Cella ${c.cw}×${c.ch} px`;return}i.textContent=S.mode==='image'?`Sprite ${S.base.width}×${S.base.height} px, cella ${c.cw}×${c.ch} px`:`Modello alto ${S.opt.mHeight} px, cella ${c.cw}×${c.ch} px`}

/* ---------- Elenco animazioni ---------- */
function buildAnimList(){
  const box=$('#anims');box.innerHTML='';const A=S.source.anim;
  for(const[k,a]of Object.entries(A)){const row=document.createElement('div');row.className='anim'+(k===S.cur?' sel':'');
    row.innerHTML=`<input type="checkbox" ${a.on?'checked':''}><button class="name"></button>
    <div class="ctl">${S.source.kind==='frames'?`<span>${a.n} frame</span>`:`<label>frame <input type="number" min="2" max="32" value="${a.n}" data-f="n"></label>`}<label>fps <input type="number" min="1" max="30" value="${a.fps}" data-f="fps"></label>${S.source.kind==='puppet'?`<label>forza <input type="range" min="0.2" max="1.6" step="0.1" value="${a.amp}" data-f="amp"></label>`:''}</div>`;
    row.querySelector('.name').textContent=a.label;
    if(S.source.kind==='frames'){const ctl=row.querySelector('.ctl');
      if(!a.gen){const sel=document.createElement('select');sel.setAttribute('aria-label','Contenuto della riga');sel.style.fontSize='12px';
        sel.innerHTML=ROW_TYPES.map(([t,l])=>`<option value="${t}" ${t===a.type?'selected':''}>${t==='other'?'Contenuto…':l}</option>`).join('');
        sel.onchange=()=>{S.rowTypes[a.row]=sel.value;runRepair()};ctl.prepend(sel)}
      else{const rm=document.createElement('button');rm.className='link';rm.style.margin='0';rm.textContent='Rimuovi';rm.onclick=()=>{S.genList=S.genList.filter(t=>t!==a.type);assemble()};ctl.append(rm)}}row.querySelector('input[type=checkbox]').setAttribute('aria-label','Esporta '+a.label);
    row.querySelector('input[type=checkbox]').onchange=e=>{a.on=e.target.checked;S.cell=null;S.cache.clear();S.dirty=true};
    row.querySelector('.name').onclick=()=>selectAnim(k);
    row.querySelectorAll('[data-f]').forEach(inp=>inp.onchange=()=>{const f=inp.dataset.f;let v=+inp.value;if(f==='n')v=Math.max(2,Math.min(32,v|0));if(f==='fps')v=Math.max(1,Math.min(30,v|0));if(!v)return;a[f]=v;
      if(f!=='fps'){S.cell=null;S.cache.clear()}if(S.cur!==k)selectAnim(k);if(S.frame>=a.n)S.frame=0;S.stripKey='';S.dirty=true});
    box.append(row)}
  $('#curName').textContent=A[S.cur].label;
}
function selectAnim(k){S.cur=k;S.frame=0;S.stripKey='';S.dirty=true;[...$('#anims').children].forEach((r,i)=>r.classList.toggle('sel',Object.keys(S.source.anim)[i]===k));$('#curName').textContent=S.source.anim[k].label;
  if(!S.source.anim[k].on){S.cell=null;S.cache.clear()}}

/* ---------- Editor dello scheletro ---------- */
const jc=$('#joints');let jz=1,dragJ=null,hoverJ=null;
const BONE_LINES=Object.values(BONES).map(b=>[b[0],b[1]]);
function drawJoints(){
  if(!S.base||S.sub!=='char'||!S.J)return;const W=S.base.width,H=S.base.height;jz=Math.max(1,Math.floor(320/Math.max(W,H)));
  jc.width=W*jz;jc.height=H*jz;const x=jc.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(S.base,0,0,W*jz,H*jz);
  if($('#showParts').checked&&S.P2){const ov=mk(W,H),ox=ov.getContext('2d'),id=ox.createImageData(W,H),cols=PARTS.map(p=>{const h=PART_COLORS[p];return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]});
    for(let i=0;i<W*H;i++){const m=S.P2.lab[i];if(m===255)continue;const c=cols[m];id.data[i*4]=c[0];id.data[i*4+1]=c[1];id.data[i*4+2]=c[2];id.data[i*4+3]=110}
    ox.putImageData(id,0,0);x.drawImage(ov,0,0,W*jz,H*jz)}
  const J=S.J,P=p=>[p.x*jz,p.y*jz];x.lineWidth=2;x.strokeStyle='rgba(20,24,40,.85)';
  for(const[a,b]of BONE_LINES){x.beginPath();x.moveTo(...P(J[a]));x.lineTo(...P(J[b]));x.stroke()}
  x.lineWidth=1;x.strokeStyle='#fff';x.beginPath();for(const[a,b]of BONE_LINES){x.moveTo(...P(J[a]));x.lineTo(...P(J[b]))}x.stroke();
  for(const[k]of JOINTS){const[px,py]=P(J[k]),tip=/^(ha|ft|head)/.test(k);x.fillStyle=k===dragJ||k===hoverJ?cssVar('--amber'):(tip?'#fff':'#ffb524');x.strokeStyle='#1c2540';x.lineWidth=1.5;
    x.beginPath();x.arc(px,py,tip?4:5,0,TAU);x.fill();x.stroke()}
}
const JB=()=>S.mode==='repair'?S.genBase:S.base,JJ=()=>S.mode==='repair'?S.genJ:S.J;
function jPos(e){const b=JB(),r=jc.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*b.width,y:(e.clientY-r.top)/r.height*b.height,k:r.width/b.width}}
function nearestJ(p){const J=JJ();let b=null,bd=1e9;for(const[k]of JOINTS){const d=Math.hypot(J[k].x-p.x,J[k].y-p.y)*p.k;if(d<bd){bd=d;b=k}}return bd<14?b:null}
jc.addEventListener('pointerdown',e=>{if(!JJ())return;const p=jPos(e),k=nearestJ(p);if(k){dragJ=k;jc.setPointerCapture(e.pointerId);jc.style.cursor='grabbing';S.mode==='repair'?drawGenJoints():drawJoints()}});
jc.addEventListener('pointermove',e=>{if(!JJ())return;const p=jPos(e),b=JB();
  if(dragJ){JJ()[dragJ]={x:Math.max(0,Math.min(b.width,p.x)),y:Math.max(0,Math.min(b.height,p.y))};S.mode==='repair'?drawGenJoints():drawJoints()}
  else{const k=nearestJ(p);if(k!==hoverJ){hoverJ=k;$('#jlabel').textContent=k?JOINTS.find(j=>j[0]===k)[1]:'Trascina i punti per correggere le articolazioni.';S.mode==='repair'?drawGenJoints():drawJoints()}}});
const endJ=()=>{if(!dragJ)return;dragJ=null;jc.style.cursor='grab';if(S.mode==='repair'){assemble();return}S.jManual=true;rebuild(false)};
jc.addEventListener('pointerup',endJ);jc.addEventListener('pointercancel',endJ);
$('#showParts').onchange=drawJoints;
$('#autoJ').onclick=()=>{if(S.mode==='repair'){S.genJ=null;S.genKey=null;assemble();return}if(!S.base)return;S.jManual=false;S.J=autoJoints(S.base);rebuild(false);toast('Articolazioni rilevate di nuovo.')};

/* ---------- Claude: articolazioni dalla foto ---------- */
let sampleFn=null;
(async()=>{try{if(!window.claude?.use)return;const s=await claude.use('sample');if(!s)return;const lim=await s.limits().catch(()=>null);if(!lim?.images)return;sampleFn=s;$('#aiJ').hidden=false}catch(e){}})();
$('#aiJ').onclick=async()=>{
  if(!sampleFn||!S.base)return;const btn=$('#aiJ');btn.disabled=true;btn.textContent='Sto analizzando…';
  try{const W=S.base.width,H=S.base.height,z=Math.max(1,Math.floor(640/Math.max(W,H))),c=mk(W*z,H*z),x=c.getContext('2d');
    x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.imageSmoothingEnabled=false;x.drawImage(S.base,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const names=JOINTS.map(([k,l])=>`"${k}": ${l}`).join('; ');
    const prompt=`L'immagine allegata è un personaggio di un videogioco su sfondo bianco, ${c.width}x${c.height} pixel. Individua con precisione le articolazioni dello scheletro.
Restituisci SOLO un oggetto JSON. Per ogni chiave il valore è [x, y] in frazioni (0-1) della larghezza e dell'altezza dell'immagine, misurate da sinistra e dall'alto.
"sx" e "dx" si riferiscono al lato SINISTRO e DESTRO DELL'IMMAGINE (non del personaggio). Se una parte è nascosta (es. braccia incrociate davanti al petto, un braccio dietro la schiena) indica comunque la posizione più plausibile.
Chiavi: ${names}.`;
    const r=await sampleFn.json(prompt,{images:blob,modelTier:'complex'});
    const J={},opt2=['waist','clL','clR','kuL','kuR','baL','baR'];for(const[k]of JOINTS){const v=r?.[k];if(!Array.isArray(v)||!isFinite(+v[0])||!isFinite(+v[1])){if(opt2.includes(k))continue;throw{message:'manca '+k}}J[k]={x:Math.max(0,Math.min(1,+v[0]))*W,y:Math.max(0,Math.min(1,+v[1]))*H}}completeJoints(J);
    S.J=J;S.jManual=true;rebuild(false);toast('Articolazioni rilevate. Correggi i punti se serve.');
  }catch(e){if(e?.code==='not_granted'){btn.hidden=true;toast('Rilevamento con Claude non autorizzato.')}else if(e?.code==='rate_limited')toast('Troppe richieste ravvicinate: riprova tra poco.');else toast('Rilevamento non riuscito: usa quello automatico o i punti a mano.')}
  finally{btn.disabled=false;btn.textContent='Rileva con Claude'}
};

/* ---------- Input ---------- */
function loadImage(src,name){const im=new Image();im.onload=()=>{S.img=im;S.jManual=false;S.J=null;const t=$('#thumb');t.src=src;t.hidden=false;if(name)$('#name').value=name;
  if(!processImage())return;rebuild(false)};im.onerror=()=>toast("Questo file non è un'immagine leggibile.");im.src=src}
function loadFile(f){if(!f||!f.type.startsWith('image/')){toast('Scegli un file immagine (PNG, JPG, WebP, GIF).');return}const r=new FileReader();
  r.onload=()=>loadImage(r.result,f.name.replace(/\.[^.]+$/,'').replace(/[^\w\-]+/g,'_').slice(0,40));r.readAsDataURL(f)}
$('#file').onchange=e=>loadFile(e.target.files[0]);
function dropZone(el,fn){['dragenter','dragover'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.remove('over')}));el.addEventListener('drop',e=>fn(e.dataTransfer.files))}
dropZone($('#drop'),fs=>loadFile(fs[0]));
window.addEventListener('paste',e=>{if(S.mode!=='image')return;const it=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));if(it)loadFile(it.getAsFile())});
async function loadModelFiles(fs){
  fs=[...fs];if(!fs.length)return;if(!has3D){toast('Il motore 3D non è disponibile.');return}
  $('#modelInfo').textContent='Carico '+fs.map(f=>f.name).join(', ')+'…';
  try{S.model=await loadModel(fs,S.opt);$('#modelInfo').textContent=`Modello caricato con ${S.model.clips.length} animazion${S.model.clips.length===1?'e':'i'}: ${S.model.clips.map(c=>c.name).join(', ')}.`;
    $('#name').value=fs[0].name.replace(/\.[^.]+$/,'').replace(/[^\w\-]+/g,'_').slice(0,40);S.source=null;rebuild(false)}
  catch(e){console.error(e);$('#modelInfo').textContent='';toast(e.message||'Modello non leggibile.')}
}
$('#file3').onchange=e=>loadModelFiles(e.target.files);dropZone($('#drop3'),loadModelFiles);

function demoKnight(){
  const c=mk(24*6,48*6),x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,c.width,c.height);
  const R=(a,b,w,h,col)=>{x.fillStyle=col;x.fillRect(a*6,b*6,w*6,h*6)};
  R(10,0,4,2,'#d94a3a');R(7,1,10,12,'#8f9bb3');R(8,2,3,3,'#c7d0e2');R(8,6,8,2,'#2a2f45');R(11,9,2,3,'#6b7690');
  R(10,13,4,1,'#6b7690');R(8,14,8,14,'#3a5bdb');R(9,15,2,8,'#5b7cf0');R(11,17,2,4,'#f0c040');R(8,24,8,2,'#7a4a22');R(11,24,2,2,'#f0c040');
  R(4,14,4,3,'#8f9bb3');R(16,14,4,3,'#8f9bb3');R(4,17,3,12,'#2c48b3');R(17,17,3,12,'#2c48b3');R(4,29,3,2,'#f2c29a');R(17,29,3,2,'#f2c29a');
  R(9,28,3,15,'#4b5268');R(13,28,3,15,'#4b5268');R(8,43,4,5,'#5a3a1e');R(13,43,4,5,'#5a3a1e');
  return c.toDataURL();
}
$('#demo').onclick=()=>{setOpt('autoRes',false);setOpt('height',48);loadImage(demoKnight(),'cavaliere')};

/* ---------- Opzioni ---------- */
function setOpt(k,v){S.opt[k]=v;const el=$('#'+k);if(el){if(el.type==='checkbox')el.checked=v;else el.value=v}syncOutputs()}
function syncOutputs(){$('#tolO').textContent=S.opt.tol;$('#heightO').textContent=S.opt.height+' px'+(S.opt.autoRes&&S.detected?' (rilevata)':'');$('#colorsO').textContent=S.opt.colors?S.opt.colors:'tutti';
  $('#mHeightO').textContent=S.opt.mHeight+' px';$('#thickO').textContent=Math.round(S.opt.thick*100)+'%'}
let rbT=0;const later=(full)=>{clearTimeout(rbT);rbT=setTimeout(()=>{if(S.mode==='image'&&S.img){if(full)S.J=S.jManual?S.J:null;if(full&&!processImage())return;rebuild(false)}else if(S.mode==='model'&&S.model)rebuild(false);else if(S.mode==='repair'&&S.repairInput){S.repairPal=null;runRepair()}},160)};
const bind=(id,kind,full,after)=>$('#'+id).addEventListener(kind==='chk'?'change':'input',e=>{S.opt[id]=kind==='chk'?e.target.checked:kind==='num'?+e.target.value:e.target.value;after&&after();syncOutputs();later(full)});
bind('bg','val',true);bind('tol','num',true);bind('shadowRm','chk',true);bind('flip','chk',true);bind('pixel','chk',true);bind('autoRes','chk',true);
bind('height','num',true,()=>{if(S.opt.autoRes){S.opt.autoRes=false;$('#autoRes').checked=false}});bind('colors','num',true);bind('outlineC','val',false);
$('#outline').onchange=e=>{S.opt.outline=e.target.checked;if(S.ready){S.cache.clear();S.dirty=true;S.stripKey=''}};
$('#outlineC').addEventListener('input',()=>{if(S.ready){S.cache.clear();S.dirty=true;S.stripKey=''}});
$('#thick').addEventListener('input',e=>{S.opt.thick=+e.target.value/100;syncOutputs();later(false)});
bind('mHeight','num',false);bind('inPlace','chk',false);bind('flat','chk',false);
$('#shade').onchange=e=>{S.opt.shade=e.target.checked;later(false)};
$('#shadow').onchange=e=>{S.opt.shadow=e.target.checked;if(S.ready){S.cache.clear();S.dirty=true;S.stripKey=''}};
function seg(id,fn){$(id).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;[...$(id).children].forEach(x=>x.setAttribute('aria-pressed',x===b));fn(b.dataset.v)})}
seg('#srcSeg',v=>{S.mode=v;moveJointEditor(v==='repair');$('#pImage').hidden=v!=='image';$('#pModel').hidden=v!=='model';$('#pRepair').hidden=v!=='repair';document.querySelectorAll('.imgOnly').forEach(el=>el.hidden=v!=='image');
  document.querySelectorAll('.notRepair').forEach(el=>el.hidden=v==='repair');$('#cmpBtn').hidden=v!=='repair';$('#gridBtn').hidden=v==='repair';$('#dirPad').style.visibility=v==='repair'?'hidden':'';
  S.ready=false;S.dirty=true;$('#empty').hidden=false;if(v==='image'&&S.base)rebuild(false);if(v==='model'&&S.model)rebuild(false);if(v==='repair'&&S.repairInput)runRepair()});
seg('#subSeg',v=>{S.sub=v;$('#charOnly').hidden=v!=='char';$('#objHint').hidden=v==='char';S.source=null;S.cur=v==='char'?'idle':'float';if(S.base)rebuild(false)});
seg('#poseSeg',v=>{S.opt.pose=v;later(false)});
seg('#dirSeg',v=>{S.opt.dirs=v;if(!DIRSETS[v].includes(S.dir)){S.dir=DIRSETS[v][0];[...$('#dirPad').querySelectorAll('button')].forEach(x=>x.setAttribute('aria-pressed',x.dataset.d===S.dir));$('#dirName').textContent=S.dir}
  if(S.ready)invalidate()});
seg('#elevSeg',v=>{S.opt.elev=+v;if(S.ready)invalidate()});
seg('#scaleSeg',v=>{S.opt.scale=+v});

/* ---------- Esportazione ---------- */
let dlP=null;const getDl=()=>dlP||(dlP=(window.claude?.use?claude.use('downloads'):Promise.resolve(null)).catch(()=>null));
async function saveFile(name,data){
  const blob=data instanceof Blob?data:new Blob([data]);const dl=await getDl();
  if(dl){try{await dl.save({filename:name,data:blob});toast('Salvato: '+name)}catch(e){
      if(e?.code==='declined')toast('Salvataggio annullato.');else if(e?.code==='rate_limited')toast('C\'è già una richiesta di salvataggio aperta.');else toast('Salvataggio non disponibile in questa vista.')}return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Salvato: '+name);
}
const toBlob=c=>new Promise(r=>c.toBlob(r,'image/png'));
const safeName=()=>($('#name').value.trim()||'sprite').replace(/[^\w\-]+/g,'_');
function scaled(c,s){if(s===1)return c;const o=mk(c.width*s,c.height*s),x=o.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(c,0,0,o.width,o.height);return o}
const nextTick=()=>new Promise(r=>setTimeout(r,0));
async function buildExport(){
  if(!S.ready)throw new Error('Carica prima un\'immagine o un modello.');
  const keys=enabledKeys();if(!keys.length)throw new Error('Attiva almeno un\'animazione da esportare.');
  S.cell=null;S.cache.clear();const dirs=dirList(),cell=getCell(),sc=S.opt.scale,cw=cell.cw*sc,ch=cell.ch*sc,name=safeName(),A=S.source.anim,rows=[];
  let done=0;const tot=keys.length*dirs.length;
  for(const k of keys)for(const d of dirs){$('#progress').textContent=`Genero ${A[k].label} ${d} (${++done}/${tot})…`;await nextTick();rows.push({name:S.source.kind==='frames'?k:`${k}_${d}`,key:k,dir:d,frames:getFrames(k,d).map(f=>scaled(f,sc))})}
  $('#progress').textContent='';
  const cols=Math.max(...rows.map(r=>r.frames.length)),sheet=mk(cols*cw,rows.length*ch),sx=sheet.getContext('2d');sx.imageSmoothingEnabled=false;
  const json={frames:{},animations:{},meta:{app:'Fucina Sprite',version:'3.0',image:name+'_sheet.png',format:'RGBA8888',size:{w:sheet.width,h:sheet.height},scale:'1',
    frameWidth:cw,frameHeight:ch,pivot:{x:+(cell.ox/cell.cw).toFixed(4),y:+(cell.oy/cell.ch).toFixed(4)},directions:dirs,frameTags:[]}};
  let idx=0;
  rows.forEach((r,ri)=>{const a=A[r.key],names=[];r.frames.forEach((f,i)=>{const fx=i*cw,fy=ri*ch;sx.drawImage(f,fx,fy);const fn=`${r.name}_${i}`;names.push(fn);
      json.frames[fn]={frame:{x:fx,y:fy,w:cw,h:ch},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:cw,h:ch},sourceSize:{w:cw,h:ch},duration:Math.round(1000/a.fps)}});
    json.animations[r.name]=names;json.meta.frameTags.push({name:r.name,from:idx,to:idx+names.length-1,direction:'forward',fps:a.fps,loop:!!a.loop});idx+=names.length});
  const subs=[],anims=[];let sid=0;
  rows.forEach((r,ri)=>{const fr=[];r.frames.forEach((f,i)=>{const id='AtlasTexture_'+(sid++);subs.push(`[sub_resource type="AtlasTexture" id="${id}"]\natlas = ExtResource("1_sheet")\nregion = Rect2(${i*cw}, ${ri*ch}, ${cw}, ${ch})\n`);
      fr.push(`{\n"duration": 1.0,\n"texture": SubResource("${id}")\n}`)});
    anims.push(`{\n"frames": [${fr.join(', ')}],\n"loop": ${A[r.key].loop?'true':'false'},\n"name": &"${r.name}",\n"speed": ${A[r.key].fps}.0\n}`)});
  const tres=`[gd_resource type="SpriteFrames" load_steps=${subs.length+2} format=3]\n\n[ext_resource type="Texture2D" path="res://${name}_sheet.png" id="1_sheet"]\n\n${subs.join('\n')}\n[resource]\nanimations = [${anims.join(', ')}]\n`;
  return{name,sheet,json,tres,rows,cw,ch,cols,dirs};
}
async function guard(btn,fn){const t=btn.textContent;btn.disabled=true;try{await fn()}catch(e){console.error(e);toast(e.message||'Esportazione non riuscita.')}finally{btn.disabled=false;btn.textContent=t;$('#progress').textContent=''}}
$('#expPng').onclick=e=>guard(e.currentTarget,async()=>{const x=await buildExport();await saveFile(x.name+'_sheet.png',await toBlob(x.sheet))});
$('#expJson').onclick=e=>guard(e.currentTarget,async()=>{const x=await buildExport();await saveFile(x.name+'_sheet.json',JSON.stringify(x.json,null,2))});
$('#expZip').onclick=e=>guard(e.currentTarget,async()=>{
  if(!window.JSZip)throw new Error('La libreria ZIP non si è caricata: scarica PNG e JSON separatamente.');
  const x=await buildExport(),z=new JSZip(),n=x.name;$('#progress').textContent='Comprimo il pacchetto…';
  z.file(`${n}_sheet.png`,await toBlob(x.sheet));z.file(`${n}_sheet.json`,JSON.stringify(x.json,null,2));z.file(`${n}_spriteframes.tres`,x.tres);
  if(S.base&&S.mode==='image')z.file(`sorgente/${n}_base.png`,await toBlob(S.base));
  if(S.mode==='repair'&&S.repairReport)z.file('sorgente/riparazione.txt',reportText(S.repairReport));
  if(S.mode==='image'&&S.J)z.file(`sorgente/${n}_scheletro.json`,JSON.stringify(S.J,null,1));
  for(const r of x.rows)for(let i=0;i<r.frames.length;i++)z.file(`frame/${r.name}/${r.name}_${String(i).padStart(2,'0')}.png`,await toBlob(r.frames[i]));
  const list=x.rows.map((r,i)=>`  riga ${i}: ${r.name} (${r.frames.length} frame, ${S.source.anim[r.key].fps} fps${S.source.anim[r.key].loop?', in loop':''})`).join('\n');
  z.file('LEGGIMI.txt',`Sprite "${n}" creato con Fucina Sprite 3

Cella: ${x.cw} x ${x.ch} px, ${x.cols} colonne, ${x.rows.length} righe.
Punto d'appoggio (piedi): x=${x.json.meta.pivot.x}, y=${x.json.meta.pivot.y} (frazioni della cella).
Direzioni: ${x.dirs.join(', ')}  (S=fronte, N=retro, E=destra, W=sinistra; le altre sono le diagonali)

Righe dello sprite sheet (animazione_direzione):
${list}

PHASER 3
  this.load.atlas('${n}', '${n}_sheet.png', '${n}_sheet.json');
  this.anims.create({ key:'walk_E', frames:this.anims.generateFrameNames('${n}', {prefix:'walk_E_', start:0, end:7}), frameRate:10, repeat:-1 });

PIXIJS
  Dopo Assets.load('${n}_sheet.json') usa sheet.animations['walk_E'] con AnimatedSprite.

GODOT 4
  Copia ${n}_sheet.png e ${n}_spriteframes.tres in res://, assegna il .tres a un AnimatedSprite2D.
  Importa il PNG con Filter: Nearest per la pixel art.

UNITY
  Sprite Mode: Multiple, Filter Mode: Point, Sprite Editor > Slice > Grid By Cell Size ${x.cw} x ${x.ch}.
`);
  await saveFile(`${n}_sprite.zip`,await z.generateAsync({type:'blob'}));
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{drawJoints();S.dirty=true});
syncOutputs();sizeView();

/* ---------- Ripara sprite ---------- */
S.compare=true;
function reportText(r){const L=[`Frame trovati: ${r.found}`];
  if(r.removedPx)L.push(`Pixel sparsi e aloni rimossi: ${r.removedPx}`);if(r.dups)L.push(`Frame doppi eliminati: ${r.dups}`);
  if(r.jitterBefore>.3)L.push(`Tremolio medio prima: ${r.jitterBefore.toFixed(1)} px, ora allineato`);
  if(r.fixed.length)L.push(`Frame fuori sequenza ricostruiti: ${r.fixed.map(v=>{const[a,b]=v.split(':');return 'riga '+(+a+1)+' frame '+b}).join(', ')}`);
  if(r.inserted)L.push(`Frame intermedi aggiunti: ${r.inserted}`+(r.held?` (${r.held} tenuti fermi perché il movimento era troppo diverso per interpolarlo bene)`:''));return L.join('\n')}
const ropt=()=>({tol:S.opt.tol,pixel:S.opt.pixel,colors:S.opt.colors,clean:$('#rClean').checked,minPx:+$('#rMin').value,dedup:$('#rDedup').checked,
  fixOutliers:$('#rFix').checked,loop:$('#rLoop').checked,oneAnim:$('#rOne').checked,anchor:S.rAnchor||'feet',stab:S.rStab||'auto',tween:$('#rTween').value,
  grid:$('#rGrid').checked?{cols:+$('#rCols').value,rows:+$('#rRows').value}:null});
let repBusy=false,repAgain=false;
const ROW_TYPES=[['other','Non specificata'],['idle','Fermo'],['walk','Camminata'],['run','Corsa'],['jump','Salto'],['attack','Attacco'],['shoot','Sparo'],['hurt','Colpito'],['death','Sconfitta'],['wave','Saluto']];
const NOLOOP=new Set(['jump','attack','shoot','hurt','death']);
const typeLabel=t=>(ROW_TYPES.find(r=>r[0]===t)||[0,t])[1];
S.rowTypes=[];S.genList=[];
async function runRepair(){
  if(!S.repairInput)return;if(repBusy){repAgain=true;return}repBusy=true;const info=$('#rReport');
  try{info.textContent='Riparo…';
    const o=ropt();o.rowLoop=i=>{const t=S.rowTypes[i];return t&&t!=='other'?!NOLOOP.has(t):o.loop};
    S.repairRes=await repairSprites(S.repairInput,o,m=>info.textContent=m);S.repairReport=S.repairRes.report;
    info.textContent=reportText(S.repairRes.report);assemble();
  }catch(e){console.error(e);info.textContent='';toast(e.message||'Riparazione non riuscita.')}
  finally{repBusy=false;if(repAgain){repAgain=false;runRepair()}}
}
/* Mette insieme le righe riparate e le animazioni generate, nella stessa cella e con lo stesso punto d'appoggio. */
function assemble(){
  const res=S.repairRes;if(!res)return;const prev=S.source?.kind==='frames'?S.source.anim:null;
  let left=res.anchor.x,up=res.anchor.y,right=res.cell.cw-res.anchor.x,down=res.cell.ch-res.anchor.y;
  const rows=res.anims.map((a,i)=>({frames:a.frames,ax:res.anchor.x,ay:res.anchor.y,factor:a.factor,type:S.rowTypes[i]||'other',i,raw:res.report.raw[i]||[]}));
  if(S.genList.length){try{const g=generateRows();for(const r of g){rows.push(r);left=Math.max(left,r.ax);up=Math.max(up,r.ay);right=Math.max(right,r.frames[0].width-r.ax);down=Math.max(down,r.frames[0].height-r.ay)}}
    catch(e){console.error(e);toast('Generazione non riuscita: '+(e.message||e))}}
  left=Math.ceil(left);up=Math.ceil(up);right=Math.ceil(right);down=Math.ceil(down);
  const cw=left+right,ch=up+down,anim={},frames={},raw=[],keyIndex={},factor={},used={};
  rows.forEach((r,ri)=>{let k=r.type==='other'?(res.anims.length===1&&!r.gen?'anim':'riga_'+(r.i+1)):r.type;if(used[k])k+='_'+(++used[k]);else used[k]=1;
    const fr=r.frames.map(f=>{const c=mk(cw,ch);c.getContext('2d').drawImage(f,Math.round(left-r.ax),Math.round(up-r.ay));return c});
    const baseFps=r.gen?r.fps:(S.repairInput.fps||10),pk=prev?.[k];
    anim[k]={label:(r.gen?'+ ':'')+(r.type==='other'?'Riga '+(r.i+1):typeLabel(r.type)+(r.gen?'':' (riga '+(r.i+1)+')')),n:fr.length,fps:pk?.fps??Math.min(30,baseFps*(r.factor||1)),baseFps,
      loop:r.type!=='other'?!NOLOOP.has(r.type):$('#rLoop').checked,on:pk?.on??true,amp:1,type:r.type,row:r.i,gen:!!r.gen};
    frames[k]=fr;raw.push(r.raw||[]);keyIndex[k]=ri;factor[k]=r.factor||1});
  if($('#rOne').checked&&raw.length)raw[0]=res.report.raw.flat();
  S.source={kind:'frames',anim,frames,raw,keyIndex,factor,cell:{cw,ch,ox:left,oy:up,elev:0},H:ch,W:cw};
  if(!anim[S.cur])S.cur=Object.keys(anim)[0];S.ready=true;$('#empty').hidden=true;buildAnimList();buildGenBox();S.frame=0;S.stripKey='';S.dirty=true;updateInfo();
}
/* Genera le animazioni mancanti partendo da un frame del foglio: stesso personaggio, stessi colori, stessa scala. */
function generateRows(){
  const res=S.repairRes,ri=Math.min(+$('#gRow').value-1,res.anims.length-1),fi=Math.min(+$('#gFrame').value-1,res.anims[ri].frames.length-1),face=$('#gFace').value;
  let src=res.anims[ri].frames[fi];
  // ritaglio sul contenuto, girato verso destra se serve
  const id=getID(src),inf=frameInfo(id);if(!inf)throw new Error('il frame scelto è vuoto');
  let base=mk(inf.x1-inf.x0+1,inf.y1-inf.y0+1);base.getContext('2d').drawImage(src,-inf.x0,-inf.y0);
  if(face==='left'){const f=mk(base.width,base.height),x=f.getContext('2d');x.translate(base.width,0);x.scale(-1,1);x.drawImage(base,0,0);base=f}
  // l'ombra a terra (grigia, in basso) non fa parte del personaggio
  {const id2=getID(base),d=id2.data,W2=base.width,H2=base.height;for(let y=Math.floor(H2*.86);y<H2;y++)for(let x=0;x<W2;x++){const i=(y*W2+x)*4;if(!d[i+3])continue;
    const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]),l=(d[i]+d[i+1]+d[i+2])/3;if(mx-mn<=22&&l>=70&&l<=215)d[i+3]=0}
   keepMainComponents(id2,.03);base.getContext('2d').putImageData(id2,0,0)}
  const key=ri+':'+fi+':'+face;
  if(S.genKey!==key||!S.genJ){S.genJ=face==='front'?autoJoints(base):autoJointsSide(base);S.genKey=key}
  S.genBase=base;completeJoints(S.genJ);
  const P2=buildParts2D(base,S.genJ),own=hasOwnOutline(getID(base));
  const G=buildPuppet(P2,S.genJ,base.width,base.height,{thick:S.opt.thick,shade:false,pixel:S.opt.pixel,pose:S.opt.pose});G.side=face==='front'?0:1;
  S.genP2=P2;
  const pal=S.opt.pixel?(S.repairPal||(S.repairPal=buildPalette(getID(sheetOf(res)),S.opt.colors||32))):null;
  const source=puppetSource(G,'char',pal,own,null);source.outlineCol=edgeDarkColor(getID(base));
  const cell=computeCell(source,S.genList,['S'],0);
  // dove sono i "piedi" nel frame originale rispetto al bacino del pupazzo
  const bi=frameInfo(getID(base)),dx=(face==='left'?base.width-bi.feetX:bi.feetX)-S.genJ.pelvis.x;
  const rows=[];
  for(const t of S.genList){const a=source.anim[t],fr=[];for(let i=0;i<a.n;i++){let c=renderFrame(source,t,i,'S',cell,{...S.opt,outline:false,shadow:false,shade:false});
      {const id=getID(c);cleanFrame(id,4);c.getContext('2d').putImageData(id,0,0)} // via i frammenti staccati
      if(face==='left'){const f=mk(c.width,c.height),x=f.getContext('2d');x.translate(c.width,0);x.scale(-1,1);x.drawImage(c,0,0);c=f}fr.push(c)}
    const ax=face==='left'?cell.cw-cell.ox-dx:cell.ox+dx;
    rows.push({frames:fr,ax,ay:cell.oy,type:t,gen:true,fps:a.fps,i:res.anims.length+rows.length})}
  disposeTurn(G.turn);drawGenJoints();
  return rows;
}
function sheetOf(res){const all=res.anims.flatMap(a=>a.frames).slice(0,64),c=mk(all[0].width*all.length,all[0].height),x=c.getContext('2d');all.forEach((f,i)=>x.drawImage(f,i*f.width,0));return c}
function disposeTurn(t){t.traverse(o=>{if(o.isMesh){o.geometry.dispose();const m=o.material;['a','b'].forEach(k=>m.userData?.[k]?.dispose());m.dispose()}});t.parent?.remove(t)}
/* Riquadro "Aggiungi animazioni" */
function buildGenBox(){
  const box=$('#genList');if(!box||!S.repairRes)return;const have=new Set(S.rowTypes.filter(Boolean));box.innerHTML='';
  for(const[t,l]of ROW_TYPES){if(t==='other')continue;const lab=document.createElement('label');lab.className='check';
    lab.innerHTML=`<input type="checkbox" value="${t}" ${S.genList.includes(t)?'checked':''}>${l}${have.has(t)?' <span class="hint" style="margin:0">(già nel foglio)</span>':''}`;box.append(lab)}
  $('#gRow').max=S.repairRes.anims.length;$('#gSkel').hidden=!S.genList.length;
}
function drawGenJoints(){if(S.mode!=='repair'||!S.genBase)return;const sb=S.base,sj=S.J,sp=S.P2,ss=S.sub;S.base=S.genBase;S.J=S.genJ;S.P2=S.genP2;S.sub='char';drawJoints();S.base=sb;S.J=sj;S.P2=sp;S.sub=ss}
async function loadRepairFiles(fs){
  fs=[...fs];if(!fs.length)return;
  try{S.repairInput=await readSheetFiles(fs);$('#name').value=fs[0].name.replace(/\.[^.]+$/,'').replace(/[^\w\-]+/g,'_').slice(0,40)+'_riparato';
    if(S.repairInput.kind==='sheet'){const t=$('#rThumb');t.src=S.repairInput.sheet.toDataURL();t.hidden=false}
    S.source=null;S.rowTypes=[];S.genList=[];S.genJ=null;S.genKey=null;S.repairPal=null;S.repairRes=null;runRepair()}
  catch(e){console.error(e);toast(e.message||'File non leggibile.')}
}
$('#rFile').onchange=e=>loadRepairFiles(e.target.files);dropZone($('#rDrop'),loadRepairFiles);
['rClean','rMin','rDedup','rFix','rLoop','rOne','rTween','rGrid','rCols','rRows'].forEach(id=>$('#'+id).addEventListener('change',()=>{$('#rGridBox').hidden=!$('#rGrid').checked;runRepair()}));
seg('#rAnchorSeg',v=>{S.rAnchor=v;runRepair()});seg('#rStabSeg',v=>{S.rStab=v;runRepair()});
$('#cmpBtn').onclick=e=>{S.compare=!S.compare;e.currentTarget.setAttribute('aria-pressed',S.compare);S.dirty=true};

$('#genList').addEventListener('change',e=>{const c=e.target;if(c.type!=='checkbox')return;S.genList=[...$('#genList').querySelectorAll('input:checked')].map(i=>i.value);$('#gSkel').hidden=!S.genList.length;assemble()});
['gRow','gFrame','gFace'].forEach(id=>$('#'+id).addEventListener('change',()=>{if(S.genList.length)assemble()}));
$('#showParts').addEventListener('change',()=>{if(S.mode==='repair')drawGenJoints()});

/* L'editor dello scheletro si sposta nel pannello Ripara quando serve */
const jHome=$('#jointsBox').parentNode,jAnchor=$('#showParts').closest('label').nextSibling;
function moveJointEditor(toRepair){const box=$('#jointsBox'),lab=$('#jlabel'),sp=$('#showParts').closest('label');
  if(toRepair){$('#gSkelSlot').append(box,lab,sp)}else if(box.parentNode!==jHome){jHome.insertBefore(box,jAnchor);jHome.insertBefore(lab,jAnchor);jHome.insertBefore(sp,jAnchor)}}
$('#gAuto').onclick=()=>{S.genJ=null;S.genKey=null;assemble()};

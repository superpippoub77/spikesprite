"use strict";
/* ============ Riparazione di sprite esistenti ============
   1. Lettura: sprite sheet PNG, GIF animata o frame separati.
   2. Rilevamento dei frame (righe e colonne vuote) o griglia manuale.
   3. Pulizia: sfondo, aloni, pixel sparsi, palette unica per tutti i frame.
   4. Stabilizzazione: ogni frame viene allineato sul punto d'appoggio (piedi o centro);
      il tremolio sparisce, i movimenti voluti (salti, affondi) vengono solo levigati.
   5. Frame fuori sequenza: se un frame "salta" rispetto ai vicini, viene ricostruito interpolando.
   6. Frame intermedi: stima del movimento pixel per pixel (block matching) e ricostruzione
      senza sfumature, così resta pixel art. */

/* ---------- Lettura ---------- */
const loadImg=src=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src});
const fileURL=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
async function decodeGif(f){
  if(!('ImageDecoder' in window))return null;
  const dec=new ImageDecoder({data:await f.arrayBuffer(),type:f.type||'image/gif'});await dec.tracks.ready;
  const n=dec.tracks.selectedTrack.frameCount,frames=[];let dur=0;
  for(let i=0;i<n;i++){const{image}=await dec.decode({frameIndex:i});const c=mk(image.displayWidth,image.displayHeight);c.getContext('2d').drawImage(image,0,0);dur+=image.duration||100000;image.close();frames.push(c)}
  return{frames,fps:Math.max(1,Math.min(30,Math.round(n/(dur/1e6))))};
}
async function readSheetFiles(files){
  files=[...files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  if(files.length===1&&/gif$/i.test(files[0].type)){const g=await decodeGif(files[0]);if(g)return{kind:'frames',rows:[g.frames],fps:g.fps,name:files[0].name}}
  if(files.length===1){const im=await loadImg(await fileURL(files[0]));const c=mk(im.naturalWidth,im.naturalHeight);c.getContext('2d').drawImage(im,0,0);return{kind:'sheet',sheet:c,name:files[0].name}}
  const fr=[];for(const f of files){if(!f.type.startsWith('image/'))continue;const im=await loadImg(await fileURL(f));const c=mk(im.naturalWidth,im.naturalHeight);c.getContext('2d').drawImage(im,0,0);fr.push(c)}
  if(!fr.length)throw new Error('Nessuna immagine tra i file scelti.');
  return{kind:'frames',rows:[fr],name:files[0].name};
}

/* ---------- Sfondo ---------- */
function keyBackground(img,tol){
  const d=img.data,W=img.width,H=img.height;let tr=0;for(let i=3;i<d.length;i+=4)if(d[i]<20)tr++;
  if(tr>W*H*.05){for(let i=3;i<d.length;i+=4)d[i]=d[i]<128?0:255;return null}
  const cnt=new Map();const add=(x,y)=>{const i=(y*W+x)*4,k=d[i]<<16|d[i+1]<<8|d[i+2];cnt.set(k,(cnt.get(k)||0)+1)};
  for(let x=0;x<W;x++){add(x,0);add(x,H-1)}for(let y=0;y<H;y++){add(0,y);add(W-1,y)}
  let key=0,bv=0;for(const[k,v]of cnt)if(v>bv){bv=v;key=k}
  const kr=key>>16&255,kg=key>>8&255,kb=key&255,thr=(tol*2.2)**2,dist=i=>(d[i]-kr)**2+(d[i+1]-kg)**2+(d[i+2]-kb)**2;
  for(let i=0;i<d.length;i+=4)if(dist(i)<=thr)d[i+3]=0;
  // aloni: pixel di bordo ancora simili allo sfondo
  const rm=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(!d[i+3])continue;
    const nb=(x>0&&!d[i-1])||(x<W-1&&!d[i+7])||(y>0&&!d[i-W*4+3])||(y<H-1&&!d[i+W*4+3]);if(nb&&dist(i)<=thr*4.5)rm.push(i)}
  rm.forEach(i=>d[i+3]=0);
  return[kr,kg,kb];
}

/* ---------- Rilevamento dei frame ---------- */
function runs(arr,minGap){const out=[];let s=-1,gap=0;
  for(let i=0;i<=arr.length;i++){const v=i<arr.length&&arr[i];if(v){if(s<0)s=i;gap=0}else if(s>=0){gap++;if(gap>minGap||i===arr.length){out.push([s,i-gap]);s=-1;gap=0}}}
  return out}
function mergeSmall(rs,frac){if(rs.length<2)return rs;const sz=rs.map(r=>r[1]-r[0]+1),mxs=Math.max(...sz),big=sz.filter(v=>v>=mxs*.3).sort((a,b)=>a-b),med=big[big.length>>1];let out=rs.map(r=>[...r]);
  for(let k=0;k<20;k++){const i=out.findIndex(r=>r[1]-r[0]+1<med*frac);if(i<0||out.length<2)break;
    const j=i===0?1:i===out.length-1?i-1:(out[i][0]-out[i-1][1]<out[i+1][0]-out[i][1]?i-1:i+1);
    out[j]=[Math.min(out[i][0],out[j][0]),Math.max(out[i][1],out[j][1])];out.splice(i,1)}
  return out}
function detectFrames(img,grid){
  const W=img.width,H=img.height,d=img.data;
  if(grid&&grid.cols>0&&grid.rows>0){const cw=W/grid.cols,ch=H/grid.rows,rows=[];
    for(let r=0;r<grid.rows;r++){const row=[];for(let c=0;c<grid.cols;c++){const b={x:Math.round(c*cw),y:Math.round(r*ch),w:Math.round(cw),h:Math.round(ch)};if(hasPixels(img,b))row.push(b)}if(row.length)rows.push(row)}
    return rows}
  const rowHas=new Uint8Array(H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(d[(y*W+x)*4+3]){rowHas[y]=1;break}
  const bands=mergeSmall(runs(rowHas,1),.3),rows=[];
  for(const[y0,y1]of bands){const colHas=new Uint8Array(W);for(let x=0;x<W;x++)for(let y=y0;y<=y1;y++)if(d[(y*W+x)*4+3]){colHas[x]=1;break}
    const cs=mergeSmall(runs(colHas,1),.3);rows.push(cs.map(([x0,x1])=>({x:x0,y:y0,w:x1-x0+1,h:y1-y0+1})))}
  return rows;
}
function hasPixels(img,b){const d=img.data,W=img.width;for(let y=b.y;y<b.y+b.h&&y<img.height;y++)for(let x=b.x;x<b.x+b.w&&x<W;x++)if(d[(y*W+x)*4+3])return true;return false}
function cropID(img,b){const c=mk(b.w,b.h),t=mk(img.width,img.height);t.getContext('2d').putImageData(img,0,0);c.getContext('2d').drawImage(t,-b.x,-b.y);return getID(c)}

/* ---------- Pulizia di un frame ---------- */
function cleanFrame(id,minPx){
  const W=id.width,H=id.height,d=id.data;for(let i=3;i<d.length;i+=4)d[i]=d[i]<128?0:255;
  const lab=new Int32Array(W*H).fill(-1),sizes=[],q=new Int32Array(W*H);
  for(let p=0;p<W*H;p++){if(!d[p*4+3]||lab[p]>=0)continue;const id2=sizes.length;let qh=0,qt=0;q[qt++]=p;lab[p]=id2;
    while(qh<qt){const c=q[qh++],x=c%W,y=(c/W)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const n=ny*W+nx;if(lab[n]<0&&d[n*4+3]){lab[n]=id2;q[qt++]=n}}}
    sizes.push(qt)}
  const mx=Math.max(0,...sizes);let removed=0;
  for(let p=0;p<W*H;p++)if(lab[p]>=0&&(sizes[lab[p]]<minPx||sizes[lab[p]]<mx*.015)){d[p*4+3]=0;removed++}
  return removed;
}
/* Pulizia preliminare del foglio intero: puntini isolati che altrimenti sembrerebbero frame. */
function cleanSheet(id,minPx){const W=id.width,H=id.height,d=id.data,lab=new Int32Array(W*H).fill(-1),sizes=[],q=new Int32Array(W*H);
  for(let p=0;p<W*H;p++){if(!d[p*4+3]||lab[p]>=0)continue;const k=sizes.length;let qh=0,qt=0;q[qt++]=p;lab[p]=k;
    while(qh<qt){const c=q[qh++],x=c%W,y=(c/W)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const n=ny*W+nx;if(lab[n]<0&&d[n*4+3]){lab[n]=k;q[qt++]=n}}}sizes.push(qt)}
  const mx=Math.max(0,...sizes);let r=0;for(let p=0;p<W*H;p++)if(lab[p]>=0&&sizes[lab[p]]<Math.max(minPx,mx*.004)){d[p*4+3]=0;r++}return r}
function frameInfo(id){
  const W=id.width,H=id.height,d=id.data;let x0=W,y0=H,x1=-1,y1=-1,sx=0,sy=0,n=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(d[(y*W+x)*4+3]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;sx+=x+.5;sy+=y+.5;n++}
  if(!n)return null;const band=Math.max(2,Math.round((y1-y0+1)*.08));let fx=0,fn=0;
  for(let y=y1-band+1;y<=y1;y++)for(let x=x0;x<=x1;x++)if(d[(y*W+x)*4+3]){fx+=x+.5;fn++}
  return{x0,y0,x1,y1,cx:sx/n,cy:sy/n,feetX:fx/fn,bottom:y1+1,n};
}

/* ---------- Levigatura di una traiettoria ---------- */
function smoothSeq(v,loop,passes=2){let a=[...v];const n=a.length;if(n<3)return a;
  for(let p=0;p<passes;p++){const b=[...a];for(let i=0;i<n;i++){const l=loop?a[(i-1+n)%n]:a[Math.max(0,i-1)],r=loop?a[(i+1)%n]:a[Math.min(n-1,i+1)];b[i]=(l+2*a[i]+r)/4}
    if(!loop){b[0]=a[0];b[n-1]=a[n-1]}a=b}
  return a}

/* ---------- Movimento tra due frame (block matching) ---------- */
function flowField(A,B,R){
  const W=A.width,H=A.height,a=A.data,b=B.data,fx=new Int8Array(W*H),fy=new Int8Array(W*H),has=new Uint8Array(W*H);
  const P=2,cost=(x,y,dx,dy)=>{let s=0;for(let j=-P;j<=P;j++)for(let i=-P;i<=P;i++){const ax=x+i,ay=y+j,bx=ax+dx,by=ay+dy;
      const ia=(ax<0||ay<0||ax>=W||ay>=H)?-1:(ay*W+ax)*4,ib=(bx<0||by<0||bx>=W||by>=H)?-1:(by*W+bx)*4;
      const oa=ia>=0&&a[ia+3],ob=ib>=0&&b[ib+3];if(!oa&&!ob)continue;if(oa!==ob){s+=180;continue}
      s+=Math.abs(a[ia]-b[ib])+Math.abs(a[ia+1]-b[ib+1])+Math.abs(a[ia+2]-b[ib+2])}return s};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!a[i*4+3])continue;has[i]=1;let best=cost(x,y,0,0),bx=0,by=0;
    if(best===0)continue;
    for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){if(!dx&&!dy)continue;const c=cost(x,y,dx,dy)+(Math.abs(dx)+Math.abs(dy))*6;if(c<best){best=c;bx=dx;by=dy}}
    fx[i]=bx;fy[i]=by}
  // filtro mediano: elimina vettori isolati sbagliati
  const mx=new Int8Array(fx),my=new Int8Array(fy);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!has[i])continue;const vx=[],vy=[];
    for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const nx=x+k,ny=y+j;if(nx<0||ny<0||nx>=W||ny>=H)continue;const n=ny*W+nx;if(has[n]){vx.push(fx[n]);vy.push(fy[n])}}
    vx.sort((p,q)=>p-q);vy.sort((p,q)=>p-q);mx[i]=vx[vx.length>>1];my[i]=vy[vy.length>>1]}
  let mag=0,n=0;for(let i=0;i<W*H;i++)if(has[i]){mag+=Math.hypot(mx[i],my[i]);n++}
  return{fx:mx,fy:my,has,mag:n?mag/n:0,W};
}
/* Frame intermedio al tempo t (0..1): i pixel di A e B vengono spostati lungo il movimento stimato
   e copiati senza sfumare; i piccoli buchi si chiudono col colore dei vicini. */
function inbetween(A,B,fAB,fBA,t){
  const W=A.width,H=A.height,o=new ImageData(W,H),od=o.data,pri=new Float32Array(W*H).fill(-1);
  const splat=(S,F,tt,p)=>{const d=S.data;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!F.has[i])continue;
    const nx=Math.round(x+F.fx[i]*tt),ny=Math.round(y+F.fy[i]*tt);if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;if(pri[j]>=p)continue;pri[j]=p;
    od[j*4]=d[i*4];od[j*4+1]=d[i*4+1];od[j*4+2]=d[i*4+2];od[j*4+3]=255}};
  if(t<=.5){splat(B,fBA,1-t,t);splat(A,fAB,t,1-t)}else{splat(A,fAB,t,1-t);splat(B,fBA,1-t,t)}
  // dove entrambi i frame hanno pixel ma lo spostamento ha lasciato un buco, si usa il frame più vicino nel tempo
  {const a=A.data,b=B.data,N=t<.5?a:b;for(let i=0;i<W*H;i++)if(!od[i*4+3]&&a[i*4+3]&&b[i*4+3]){od[i*4]=N[i*4];od[i*4+1]=N[i*4+1];od[i*4+2]=N[i*4+2];od[i*4+3]=255}}
  // chiusura buchi e rimozione pixel isolati
  for(let pass=0;pass<2;pass++){const add=[],del=[];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;let n=0;const cols=new Map();
      for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){if(!j&&!k)continue;const nx=x+k,ny=y+j;if(nx<0||ny<0||nx>=W||ny>=H)continue;const q=(ny*W+nx)*4;if(od[q+3]){n++;const key=od[q]<<16|od[q+1]<<8|od[q+2];cols.set(key,(cols.get(key)||0)+1)}}
      if(!od[i*4+3]&&n>=5){let b=0,bv=0;for(const[k2,v]of cols)if(v>bv){bv=v;b=k2}add.push([i,b])}
      else if(od[i*4+3]&&n<=1)del.push(i)}
    add.forEach(([i,c])=>{od[i*4]=c>>16&255;od[i*4+1]=c>>8&255;od[i*4+2]=c&255;od[i*4+3]=255});del.forEach(i=>od[i*4+3]=0)}
  return o;
}
function diffRatio(A,B){const a=A.data,b=B.data;let d=0,n=0;for(let i=0;i<a.length;i+=4){const oa=a[i+3]>0,ob=b[i+3]>0;if(!oa&&!ob)continue;n++;
  if(oa!==ob||Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>60)d++}return n?d/n:0}

/* ---------- Pipeline completa ---------- */
async function repairSprites(input,o,progress){
  const report={found:0,removedPx:0,dups:0,fixed:[],inserted:0,jitterBefore:0,jitterAfter:0};
  // 1) frame grezzi
  let rows;
  if(input.kind==='sheet'){const id=getID(input.sheet);keyBackground(id,o.tol);if(o.clean)report.removedPx+=cleanSheet(id,o.minPx);const boxes=detectFrames(id,o.grid);rows=boxes.map(r=>r.map(b=>cropID(id,b)))}
  else rows=input.rows.map(r=>r.map(c=>{const id=getID(c);keyBackground(id,o.tol);return id}));
  if(o.oneAnim)rows=[rows.flat()];
  report.raw=rows.map(r=>r.map(f=>{const c=mk(f.width,f.height);c.getContext('2d').putImageData(f,0,0);return c}));
  rows=rows.filter(r=>r.length);report.found=rows.reduce((s,r)=>s+r.length,0);
  if(!report.found)throw new Error('Nessun frame trovato: controlla lo sfondo o imposta la griglia a mano.');
  // 2) pulizia
  for(const r of rows)for(const f of r)report.removedPx+=o.clean?cleanFrame(f,o.minPx):0;
  // palette comune a tutti i frame (stessi colori in tutta l'animazione)
  if(o.pixel&&o.colors>0){const all=rows.flat(),tw=all.reduce((s,f)=>s+f.width,0),th=Math.max(...all.map(f=>f.height)),big=mk(tw,th),bx=big.getContext('2d');let x=0;
    for(const f of all){const t=mk(f.width,f.height);t.getContext('2d').putImageData(f,0,0);bx.drawImage(t,x,0);x+=f.width}
    const pal=buildPalette(getID(big),o.colors);for(const f of all)mapPalette(f,pal)}
  // 3) frame doppi consecutivi
  if(o.dedup)rows=rows.map(r=>{const out=[r[0]];for(let i=1;i<r.length;i++){const a=out[out.length-1],b=r[i];
    if(a.width===b.width&&a.height===b.height&&diffRatio(a,b)<.004){report.dups++;continue}out.push(b)}return out});
  // 4) allineamento nella cella comune
  const anims=[];
  rows.forEach((r,ri)=>r.loop=o.rowLoop?o.rowLoop(ri):o.loop);
  for(const r of rows){const inf=r.map(frameInfo).map((v,i)=>v||{x0:0,y0:0,x1:r[i].width-1,y1:r[i].height-1,cx:r[i].width/2,cy:r[i].height/2,feetX:r[i].width/2,bottom:r[i].height});
    const ax=inf.map(v=>o.anchor==='center'?v.cx:v.feetX),ay=inf.map(v=>o.anchor==='center'?v.cy:v.bottom);
    const hgt=Math.max(...inf.map(v=>v.y1-v.y0+1)),wid=Math.max(...inf.map(v=>v.x1-v.x0+1));
    // tremolio = differenza tra traiettoria e la sua versione levigata
    const jit=(arr)=>{const s=smoothSeq(arr,r.loop);return arr.reduce((m,v,i)=>m+Math.abs(v-s[i]),0)/arr.length};
    // "posizione assoluta" del punto d'appoggio nel foglio: per i frame ritagliati si usa solo la forma, quindi lo spostamento voluto
    // si misura dalla posizione del contenuto nel riquadro originale (per GIF e frame separati è affidabile)
    const gridded=input.kind!=='sheet'||(o.grid&&o.grid.cols>0);const relX=ax.map(v=>gridded?v:0),relY=ay.map((v,i)=>v+(r[i].bandY||0));
    report.jitterBefore=Math.max(report.jitterBefore,jit(relX)+jit(relY));
    let offX,offY;const mode=o.stab==='auto'?(Math.max(...relY)-Math.min(...relY)>hgt*.12||Math.max(...relX)-Math.min(...relX)>wid*.25?'smooth':'lock'):o.stab;
    if(mode==='lock'||mode==='none'){offX=r.map(()=>0);offY=r.map(()=>0)}
    else{const mxv=relX.reduce((a,b)=>a+b,0)/r.length,myv=Math.max(...relY);offX=smoothSeq(relX,r.loop).map(v=>v-mxv);offY=smoothSeq(relY,r.loop).map(v=>v-myv)}
    const place=r.map((f,i)=>o.stab==='none'?{x:0,y:0}:{x:Math.round(-ax[i]+offX[i]),y:Math.round(-ay[i]+offY[i])});
    anims.push({frames:r,place,loop:r.loop});
  }
  // cella unica
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  for(const a of anims)a.frames.forEach((f,i)=>{const p=a.place[i];minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x+f.width);maxY=Math.max(maxY,p.y+f.height)});
  const pad=1,cw=maxX-minX+pad*2,ch=maxY-minY+pad*2;
  const toCell=(f,p)=>{const c=mk(cw,ch),t=mk(f.width,f.height);t.getContext('2d').putImageData(f,0,0);c.getContext('2d').drawImage(t,p.x-minX+pad,p.y-minY+pad);return getID(c)};
  let seq=anims.map(a=>a.frames.map((f,i)=>toCell(f,a.place[i])));
  report.jitterAfter=0;
  // 5) frame fuori sequenza e 6) intermedi
  const R=Math.max(3,Math.min(10,Math.round(Math.max(cw,ch)*.08)));const out=[];
  for(let ai=0;ai<seq.length;ai++){let fr=seq[ai];const n=fr.length;const LOOP=anims[ai].loop;progress&&progress(`Analizzo il movimento (${ai+1}/${seq.length})…`);await nextFrame();
    if(o.fixOutliers&&n>=4){const repl=[];
      for(let i=0;i<n;i++){if(!LOOP&&(i===0||i===n-1))continue;const p=fr[(i-1+n)%n],q=fr[(i+1)%n],f=fr[i];
        // un frame è "fuori sequenza" se è molto più diverso dai due vicini di quanto i vicini lo siano tra loro
        const dpq=diffRatio(p,q),dp=diffRatio(f,p),dq=diffRatio(f,q);
        if(Math.min(dp,dq)>dpq*1.8+.06&&Math.min(dp,dq)>.15){const fpq=flowField(p,q,R),fqp=flowField(q,p,R);repl.push([i,consistency(fpq,fqp)<.35?inbetween(p,q,fpq,fqp,.5):(dp<dq?p:q)])}}
      repl.forEach(([i,c])=>{fr[i]=c;report.fixed.push(ai+':'+(i+1))})}
    let factor=1;
    if(o.tween!=='0'&&fr.length>=2){const pairs=LOOP?fr.length:fr.length-1,flows=[];let mag=0;
      for(let i=0;i<pairs;i++){const A=fr[i],B=fr[(i+1)%fr.length],fab=flowField(A,B,R),fba=flowField(B,A,R);flows.push([fab,fba,consistency(fab,fba)]);mag+=fab.mag}
      mag/=pairs;const k=o.tween==='auto'?(mag>1.2?1:0):+o.tween;
      if(k>0){const res=[];for(let i=0;i<fr.length;i++){res.push(fr[i]);if(i<pairs)for(let s=1;s<=k;s++){const t=s/(k+1),A=fr[i],B=fr[(i+1)%fr.length];if(flows[i][2]>.35){const c=new ImageData(new Uint8ClampedArray((t<.5?A:B).data),A.width,A.height);res.push(c);report.held=(report.held||0)+1}else res.push(inbetween(A,B,flows[i][0],flows[i][1],t));report.inserted++}}fr=res;factor=k+1}}
    out.push({frames:fr.map(id=>{const c=mk(cw,ch);c.getContext('2d').putImageData(id,0,0);return c}),factor});
  }
  return{anims:out,cell:{cw,ch,ox:Math.round(cw/2),oy:ch-pad,elev:0},anchor:{x:pad-minX,y:pad-minY},report};
}
/* Coerenza avanti-indietro: quota di pixel il cui movimento A→B non torna indietro con B→A (stima inaffidabile). */
function consistency(fab,fba){const W=Math.round(Math.sqrt(fab.has.length)),n=fab.has.length;let bad=0,tot=0;const w=fab.W;
  for(let i=0;i<n;i++){if(!fab.has[i])continue;tot++;const x=i%fab.W+fab.fx[i],y=Math.floor(i/fab.W)+fab.fy[i];if(x<0||y<0||x>=fab.W||y>=n/fab.W){bad++;continue}
    const j=y*fab.W+x;if(!fba.has[j]||Math.abs(fab.fx[i]+fba.fx[j])>1||Math.abs(fab.fy[i]+fba.fy[j])>1)bad++}
  return tot?bad/tot:1}
const nextFrame=()=>new Promise(r=>setTimeout(r,0));

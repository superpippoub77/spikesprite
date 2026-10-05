"use strict";
/* ============ Fucina Sprite — elaborazione immagini ============ */
const $=s=>document.querySelector(s);
const D2R=Math.PI/180, TAU=Math.PI*2;
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,w|0);c.height=Math.max(1,h|0);return c};
const toast=(m)=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),3200)};
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ctx2=c=>c.getContext('2d',{willReadFrequently:true});
const getID=c=>ctx2(c).getImageData(0,0,c.width,c.height);
const DEFAULT_RIG={neck:.29,hip:.58,armEnd:.66,armL:.3,armR:.7,legSplit:.5};
const PARTS6=['head','torso','armL','armR','legL','legR'];
function removeBg(img,tol,shadow){
  const{width:w,height:h,data:d}=img;let tr=0,bc=0;
  const border=[];for(let x=0;x<w;x++){border.push(x,(h-1)*w+x)}for(let y=1;y<h-1;y++){border.push(y*w,y*w+w-1)}
  for(const p of border){bc++;if(d[p*4+3]<20)tr++}
  if(tr>bc*.3){for(let i=3;i<d.length;i+=4)d[i]=d[i]<128?0:255;return}
  // colore di sfondo = mediana del bordo (robusta a oggetti che toccano il bordo)
  const ch=c=>{const v=border.map(p=>d[p*4+c]).sort((a,b)=>a-b);return v[v.length>>1]};
  const kr=ch(0),kg=ch(1),kb=ch(2),kl=(kr+kg+kb)/3,thr=(tol*2.2)**2;
  const bgLike=p=>{const i=p*4;if(d[i+3]===0)return true;const r=d[i],g=d[i+1],b=d[i+2],a=r-kr,bb=g-kg,e=b-kb;
    if(a*a+bb*bb+e*e<=thr)return true;
    if(shadow){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(r+g+b)/3;if(mx-mn<=22&&l>=105&&l<=kl+8)return true}
    return false};
  const seen=new Uint8Array(w*h),q=new Int32Array(w*h);let qh=0,qt=0;
  for(const p of border)if(!seen[p]&&bgLike(p)){seen[p]=1;q[qt++]=p}
  while(qh<qt){const p=q[qh++];d[p*4+3]=0;const x=p%w,y=(p/w)|0;
    if(x>0){const n=p-1;if(!seen[n]){seen[n]=1;if(bgLike(n))q[qt++]=n}}
    if(x<w-1){const n=p+1;if(!seen[n]){seen[n]=1;if(bgLike(n))q[qt++]=n}}
    if(y>0){const n=p-w;if(!seen[n]){seen[n]=1;if(bgLike(n))q[qt++]=n}}
    if(y<h-1){const n=p+w;if(!seen[n]){seen[n]=1;if(bgLike(n))q[qt++]=n}}}
}
/* Stima la dimensione del "pixel" originale: spessore tipico del contorno scuro
   (misurato in orizzontale e verticale) = 1 pixel reale della pixel art. */
function estimateUnit(img){
  const{width:w,height:h,data:d}=img,maxR=Math.max(8,Math.floor(Math.max(w,h)/12)),hist=new Float64Array(maxR+2);
  const dark=(x,y)=>{const i=(y*w+x)*4;return d[i+3]>0&&d[i]+d[i+1]+d[i+2]<210};
  const scan=(n1,n2,get)=>{for(let a=0;a<n1;a++){let run=0;for(let b=0;b<=n2;b++){if(b<n2&&get(a,b))run++;else{if(run>=2&&run<=maxR)hist[run]++;run=0}}}};
  scan(h,w,(y,x)=>dark(x,y));scan(w,h,(x,y)=>dark(x,y));
  // smussa e prendi il picco
  let best=0,bi=0;for(let r=2;r<=maxR;r++){const v=hist[r-1]*.5+hist[r]+hist[r+1]*.5;if(v>best){best=v;bi=r}}
  if(best<20)return 0;
  // baricentro attorno al picco per precisione sub-pixel
  let sw=0,sv=0;for(let r=Math.max(2,bi-3);r<=Math.min(maxR,bi+3);r++){sw+=hist[r];sv+=hist[r]*r}
  return sw?sv/sw:bi;
}
/* Riduzione "a moda": per ogni cella prende il colore DOMINANTE (non la media),
   così la pixel art resta nitida invece di diventare sfocata. */
function modeDownscale(img,W,H){
  const{width:w,height:h,data:d}=img,out=new ImageData(W,H),o=out.data,sx=w/W,sy=h/H;
  const cnt=new Map();
  for(let Y=0;Y<H;Y++)for(let X=0;X<W;X++){
    const x0=Math.floor(X*sx+sx*.2),x1=Math.max(x0+1,Math.ceil((X+1)*sx-sx*.2)),y0=Math.floor(Y*sy+sy*.2),y1=Math.max(y0+1,Math.ceil((Y+1)*sy-sy*.2));
    cnt.clear();let op=0,tot=0;
    for(let y=y0;y<y1&&y<h;y++)for(let x=x0;x<x1&&x<w;x++){const i=(y*w+x)*4;tot++;if(d[i+3]<128)continue;op++;
      const k=(d[i]>>4)<<8|(d[i+1]>>4)<<4|(d[i+2]>>4);let e=cnt.get(k);if(!e){e=[0,0,0,0];cnt.set(k,e)}e[0]++;e[1]+=d[i];e[2]+=d[i+1];e[3]+=d[i+2]}
    const j=(Y*W+X)*4;if(op*2<tot||!op){o[j+3]=0;continue}
    let best=null;for(const e of cnt.values())if(!best||e[0]>best[0])best=e;
    o[j]=Math.round(best[1]/best[0]);o[j+1]=Math.round(best[2]/best[0]);o[j+2]=Math.round(best[3]/best[0]);o[j+3]=255;
  }
  return out;
}
/* Tiene solo la figura principale: elimina macchie, scritte e rumore staccati. */
function keepMainComponents(img,minFrac){
  const{width:w,height:h,data:d}=img,lab=new Int32Array(w*h).fill(-1),sizes=[],q=new Int32Array(w*h);
  for(let p=0;p<w*h;p++){if(d[p*4+3]===0||lab[p]>=0)continue;const id=sizes.length;let qh=0,qt=0;q[qt++]=p;lab[p]=id;
    while(qh<qt){const c=q[qh++],x=c%w,y=(c/w)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(lab[n]<0&&d[n*4+3]>0){lab[n]=id;q[qt++]=n}}}
    sizes.push(qt)}
  if(sizes.length<2)return;const mx=Math.max(...sizes);
  for(let p=0;p<w*h;p++)if(lab[p]>=0&&sizes[lab[p]]<mx*minFrac)d[p*4+3]=0;
}
function quantize(img,k){
  const d=img.data,px=[];for(let i=0;i<d.length;i+=4)if(d[i+3]>0)px.push(i);
  if(px.length<=k)return;
  const step=Math.max(1,Math.floor(px.length/4000)),sm=[];for(let j=0;j<px.length;j+=step)sm.push(px[j]);
  const C=[[d[sm[0]],d[sm[0]+1],d[sm[0]+2]]],dist=new Float64Array(sm.length).fill(Infinity);
  while(C.length<k){const c=C[C.length-1];let best=-1,bi=0;
    for(let j=0;j<sm.length;j++){const q=sm[j],dd=(d[q]-c[0])**2+(d[q+1]-c[1])**2+(d[q+2]-c[2])**2;if(dd<dist[j])dist[j]=dd;if(dist[j]>best){best=dist[j];bi=j}}
    if(best<=0)break;const q=sm[bi];C.push([d[q],d[q+1],d[q+2]])}
  const near=q=>{let b=0,bd=Infinity;for(let ci=0;ci<C.length;ci++){const c=C[ci],dd=(d[q]-c[0])**2+(d[q+1]-c[1])**2+(d[q+2]-c[2])**2;if(dd<bd){bd=dd;b=ci}}return b};
  for(let it=0;it<8;it++){const sum=C.map(()=>[0,0,0,0]);for(const q of sm){const s=sum[near(q)];s[0]+=d[q];s[1]+=d[q+1];s[2]+=d[q+2];s[3]++}
    C.forEach((c,ci)=>{const s=sum[ci];if(s[3]){c[0]=s[0]/s[3];c[1]=s[1]/s[3];c[2]=s[2]/s[3]}})}
  for(const q of px){const c=C[near(q)];d[q]=Math.round(c[0]);d[q+1]=Math.round(c[1]);d[q+2]=Math.round(c[2])}
}
function addOutline(c,col){
  const w=c.width,h=c.height,o=mk(w+2,h+2),ox=o.getContext('2d');ox.drawImage(c,1,1);
  const id=ox.getImageData(0,0,w+2,h+2),d=id.data,W=w+2,H=h+2,src=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++)src[i]=d[i*4+3]>100?1:0;
  const r=parseInt(col.slice(1,3),16),g=parseInt(col.slice(3,5),16),b=parseInt(col.slice(5,7),16);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(src[p])continue;
    if((x>0&&src[p-1])||(x<W-1&&src[p+1])||(y>0&&src[p-W])||(y<H-1&&src[p+W])){const i=p*4;d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255}}
  ox.putImageData(id,0,0);return o;
}
function hasOwnOutline(img){
  const{width:w,height:h,data:d}=img;let edge=0,dark=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(!d[i+3])continue;
    if(x===0||y===0||x===w-1||y===h-1||!d[i-1]||!d[i+7]||!d[i-w*4+3]||!d[i+w*4+3]){edge++;if(d[i]+d[i+1]+d[i+2]<240)dark++}}
  return edge>0&&dark/edge>.6;
}
const isDark=(d,i)=>d[i+3]>0&&d[i]+d[i+1]+d[i+2]<240;
/* Rileva automaticamente collo, bacino, bordi del busto e separazione delle gambe
   analizzando la sagoma (larghezza per riga, spazio tra le gambe) e le linee di contorno verticali. */
function autoRig(b){
  const W=b.width,H=b.height,d=b.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
  const A=(x,y)=>d[(y*W+x)*4+3]>0,Dk=(x,y)=>isDark(d,(y*W+x)*4);
  const L=new Int32Array(H).fill(-1),Rr=new Int32Array(H).fill(-1);
  for(let y=0;y<H;y++){for(let x=0;x<W;x++)if(A(x,y)){L[y]=x;break}for(let x=W-1;x>=0;x--)if(A(x,y)){Rr[y]=x;break}}
  const wid=y=>L[y]<0?0:Rr[y]-L[y]+1,R={...DEFAULT_RIG};
  // 1) collo: riga più stretta tra testa e spalle (larghezza media su 3 righe)
  let neckY=Math.round(.29*H),best=1e9,maxAbove=0;
  for(let y=Math.max(2,Math.round(.06*H));y<=Math.round(.62*H);y++){
    for(let k=0;k<y;k++)maxAbove=Math.max(maxAbove,wid(k));
    const w3=(wid(y-1)+wid(y)+wid(y+1))/3;if(w3<best-.5&&w3<maxAbove*.92){best=w3;neckY=y}}
  R.neck=(neckY+1)/H;
  // 2) gambe: spazio vuoto centrale che sale dai piedi
  let gapTop=-1;const centers=[];
  for(let y=H-1;y>neckY+2;y--){
    if(L[y]<0)continue;const lo=L[y]+(wid(y))*.25,hi=Rr[y]-(wid(y))*.25;let found=null;
    for(let x=Math.ceil(lo);x<=hi;x++){if(!A(x,y)){let e=x;while(e+1<=Rr[y]&&!A(e+1,y))e++;if(x>L[y]&&e<Rr[y]){found=(x+e+1)/2;break}x=e}}
    if(found!==null){gapTop=y;centers.push(found)}else if(centers.length||y<H*.8)break;
  }
  if(gapTop>0&&H-gapTop>=H*.06&&gapTop>neckY+H*.1){
    centers.sort((a,b)=>a-b);R.legSplit=centers[centers.length>>1]/W;
    R.hip=Math.max(R.neck+.08,(gapTop-Math.max(1,Math.round(H*.02)))/H);
    R.armEnd=(gapTop+(H-gapTop)*.35)/H;
  }else{let sx=0,n=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(A(x,y)){sx+=x+.5;n++}R.legSplit=n?sx/n/W:.5;R.hip=Math.max(R.neck+.12,.6);R.armEnd=Math.min(.95,R.hip+.08)}
  // 3) bordi del busto: colonna con la linea di contorno verticale più lunga
  const y0=neckY+2,y1=Math.max(y0+2,Math.round(R.hip*H)-1);let minL=W,maxR=0,cs=0,cn=0;
  for(let y=y0;y<y1;y++)if(L[y]>=0){minL=Math.min(minL,L[y]);maxR=Math.max(maxR,Rr[y]);cs+=L[y]+Rr[y];cn+=2}
  const cx=cn?cs/cn:W/2;
  const runAt=x=>{let bestR=0,cur=0,miss=0;for(let y=y0;y<y1;y++){if(Dk(x,y)){cur+=1+miss;miss=0;if(cur>bestR)bestR=cur}else if(++miss>1){cur=0;miss=0}}return bestR};
  const pick=(a,z)=>{let bx=-1,bv=0;for(let x=Math.max(0,a);x<=Math.min(W-1,z);x++){const v=runAt(x);if(v>bv){bv=v;bx=x}}return bv>=(y1-y0)*.3?bx:-1};
  const xl=pick(minL+2,Math.floor(cx-3)),xr=pick(Math.ceil(cx+3),maxR-2);
  R.armL=xl>=0?xl/W:Math.max(.02,(L[neckY]-1)/W);
  R.armR=xr>=0?(xr+1)/W:Math.min(.98,(Rr[neckY]+2)/W);
  if(R.legSplit<=R.armL||R.legSplit>=R.armR)R.legSplit=(R.armL+R.armR)/2;
  return R;
}
/* Assegna i pixel alle parti seguendo i CONTORNI del disegno: ogni zona di colore
   delimitata da linee scure va tutta nella stessa parte; le linee scure prendono la parte
   della zona più vicina. Così un guanto o uno stivale non viene tagliato a metà. */
function segment(b,R){
  const W=b.width,H=b.height,d=b.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,N=W*H;
  const lab=new Int32Array(N).fill(-1),P=[],q=new Int32Array(N);
  for(let p=0;p<N;p++){const i=p*4;if(!d[i+3]||isDark(d,i)||lab[p]>=0)continue;const id=P.length;let qh=0,qt=0,sx=0,sy=0;q[qt++]=p;lab[p]=id;
    while(qh<qt){const c=q[qh++],x=c%W,y=(c/W)|0;sx+=x+.5;sy+=y+.5;
      for(const n of[x>0?c-1:-1,x<W-1?c+1:-1,y>0?c-W:-1,y<H-1?c+W:-1])if(n>=0&&lab[n]<0&&d[n*4+3]&&!isDark(d,n*4)){lab[n]=id;q[qt++]=n}}
    P.push({cx:sx/qt/W,cy:sy/qt/H,n:qt})}
  const part=new Uint8Array(N).fill(255),ix=n=>PARTS6.indexOf(n);
  const geo=(x,y)=>{const fx=(x+.5)/W,fy=(y+.5)/H;if(fy<R.neck)return ix('head');const side=fx<R.armL?'armL':fx>R.armR?'armR':null;
    if(side&&fy<R.armEnd)return ix(side);if(fy<R.hip)return ix('torso');return ix(fx<R.legSplit?'legL':'legR')};
  for(let p=0;p<N;p++){if(lab[p]<0)continue;const x=p%W,y=(p/W)|0,fx=(x+.5)/W,fy=(y+.5)/H,pt=P[lab[p]];
    if(fy<R.neck){part[p]=ix('head');continue}
    const big=pt.n>N*.08; // zone enormi (es. un mantello) si dividono per geometria
    if(!big&&pt.cy>=R.neck&&pt.cy<R.armEnd&&(pt.cx<R.armL||pt.cx>R.armR)){part[p]=ix(pt.cx<R.armL?'armL':'armR');continue}
    if(!big&&(pt.cx>=R.armL&&pt.cx<=R.armR)&&(fx<R.armL||fx>R.armR)){part[p]=fy<R.hip?ix('torso'):ix(fx<R.legSplit?'legL':'legR');continue}
    part[p]=geo(x,y)}
  // linee scure: BFS dalla parte più vicina
  let qh=0,qt=0;for(let p=0;p<N;p++)if(part[p]!==255)q[qt++]=p;
  while(qh<qt){const c=q[qh++],x=c%W,y=(c/W)|0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const n=ny*W+nx;
      if(part[n]===255&&d[n*4+3]){ // non attraversare la linea collo/bacino con le linee scure
        const g=geo(nx,ny),pc=part[c];part[n]=(g===ix('head'))!==(pc===ix('head'))?g:pc;q[qt++]=n}}}
  for(let p=0;p<N;p++)if(part[p]===255&&d[p*4+3])part[p]=geo(p%W,(p/W)|0);
  return{part,data:d};
}

/* Distanza (chamfer 3-4) di ogni pixel della maschera dal bordo. */
function distanceTransform(mask,W,H){
  const INF=1e9,d=new Float32Array(W*H);
  for(let i=0;i<W*H;i++)d[i]=mask[i]?INF:0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!d[i])continue;let v=d[i];
    v=Math.min(v,x>0?d[i-1]+3:3,y>0?d[i-W]+3:3,x>0&&y>0?d[i-W-1]+4:4,x<W-1&&y>0?d[i-W+1]+4:4);d[i]=v}
  for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;if(!d[i])continue;let v=d[i];
    v=Math.min(v,x<W-1?d[i+1]+3:3,y<H-1?d[i+W]+3:3,x<W-1&&y<H-1?d[i+W+1]+4:4,x>0&&y<H-1?d[i+W-1]+4:4);d[i]=v}
  for(let i=0;i<W*H;i++)d[i]/=3;
  return d;
}
/* Filtro "a moda": ogni pixel prende il colore più frequente nel suo intorno.
   Toglie i dettagli piccoli (occhi, bottoni) e lascia le grandi zone di colore. */
function modeFilter(src,W,H,r,keepEdge){
  const d=src.data,o=new ImageData(new Uint8ClampedArray(d),W,H),od=o.data,cnt=new Map();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(!d[i+3])continue;
    if(keepEdge&&(x===0||y===0||x===W-1||y===H-1||!d[i-1]||!d[i+7]||!d[i-W*4+3]||!d[i+W*4+3]))continue;
    cnt.clear();
    for(let yy=Math.max(0,y-r);yy<=Math.min(H-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(W-1,x+r);xx++){const j=(yy*W+xx)*4;if(!d[j+3])continue;
      const k=(d[j]>>4)<<8|(d[j+1]>>4)<<4|(d[j+2]>>4);let e=cnt.get(k);if(!e){e=[0,0,0,0];cnt.set(k,e)}e[0]++;e[1]+=d[j];e[2]+=d[j+1];e[3]+=d[j+2]}
    let b=null;for(const e of cnt.values())if(!b||e[0]>b[0])b=e;
    od[i]=b[1]/b[0];od[i+1]=b[2]/b[0];od[i+2]=b[3]/b[0]}
  return o;
}
/* Palette fissa: i colori dello sprite originale (o i k più rappresentativi). */
function buildPalette(img,k){
  const d=img.data,set=new Map();
  for(let i=0;i<d.length;i+=4)if(d[i+3])set.set(d[i]<<16|d[i+1]<<8|d[i+2],1);
  if(set.size<=Math.max(k,8)*2.5&&set.size<=96)return[...set.keys()].map(v=>[v>>16&255,v>>8&255,v&255]);
  const c=new ImageData(new Uint8ClampedArray(d),img.width,img.height);quantize(c,k);
  const s2=new Map();for(let i=0;i<c.data.length;i+=4)if(c.data[i+3])s2.set(c.data[i]<<16|c.data[i+1]<<8|c.data[i+2],1);
  return[...s2.keys()].map(v=>[v>>16&255,v>>8&255,v&255]);
}
function mapPalette(img,pal){
  const d=img.data,cache=new Map();
  for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const key=d[i]<<16|d[i+1]<<8|d[i+2];let c=cache.get(key);
    if(!c){let bd=1e9;for(const p of pal){const a=p[0]-d[i],b=p[1]-d[i+1],e=p[2]-d[i+2],v=a*a*.9+b*b*1.2+e*e*.7;if(v<bd){bd=v;c=p}}cache.set(key,c)}
    d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255}
}
function alphaMask(img){const d=img.data,m=new Uint8Array(img.width*img.height);for(let i=0;i<m.length;i++)m[i]=d[i*4+3]>0?1:0;return m}
function downscaleSmooth(c,W,H){let cur=c;while(cur.width/2>W&&cur.height/2>H){const n=mk(Math.round(cur.width/2),Math.round(cur.height/2)),x=n.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(cur,0,0,n.width,n.height);cur=n}
  const t=mk(W,H),tx=ctx2(t);tx.imageSmoothingQuality='high';tx.drawImage(cur,0,0,W,H);return t}
function edgeDarkColor(img){const{width:W,height:H,data:d}=img,cnt=new Map();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(!d[i+3]||!isDark(d,i))continue;
    if(!(x===0||y===0||x===W-1||y===H-1||!d[i-1]||!d[i+7]||!d[i-W*4+3]||!d[i+W*4+3]))continue;const k=d[i]<<16|d[i+1]<<8|d[i+2];cnt.set(k,(cnt.get(k)||0)+1)}
  let b=null,bv=0;for(const[k,v]of cnt)if(v>bv){bv=v;b=k}return b===null?null:'#'+b.toString(16).padStart(6,'0')}

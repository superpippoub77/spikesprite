"use strict";
/* ============ Scheletro 2D: 20 articolazioni, 15 parti ============ */
const JOINTS=[
  ['head','Cima della testa'],['neck','Collo'],['chest','Petto'],['waist','Vita'],['pelvis','Bacino'],
  ['clL','Clavicola sx'],['shL','Spalla sx'],['elL','Gomito sx'],['wrL','Polso sx'],['kuL','Nocche sx'],['haL','Punta dita sx'],
  ['clR','Clavicola dx'],['shR','Spalla dx'],['elR','Gomito dx'],['wrR','Polso dx'],['kuR','Nocche dx'],['haR','Punta dita dx'],
  ['hipL','Anca sx'],['knL','Ginocchio sx'],['anL','Caviglia sx'],['baL','Pianta piede sx'],['ftL','Punta piede sx'],
  ['hipR','Anca dx'],['knR','Ginocchio dx'],['anR','Caviglia dx'],['baR','Pianta piede dx'],['ftR','Punta piede dx']];
// parte: [articolazione di partenza (perno), articolazione finale, parte genitore, raggio relativo ad H]
const BONES={
  abd:['pelvis','waist',null,0],spn:['waist','chest','abd',0],chest:['chest','neck','spn',0],head:['neck','head','chest',0],
  clvL:['clL','shL','chest',.05],uaL:['shL','elL','clvL',.055],faL:['elL','wrL','uaL',.05],haL:['wrL','kuL','faL',.05],fiL:['kuL','haL','haL',.045],
  clvR:['clR','shR','chest',.05],uaR:['shR','elR','clvR',.055],faR:['elR','wrR','uaR',.05],haR:['wrR','kuR','faR',.05],fiR:['kuR','haR','haR',.045],
  thL:['hipL','knL','abd',.075],snL:['knL','anL','thL',.06],ftL:['anL','baL','snL',.065],toL:['baL','ftL','ftL',.055],
  thR:['hipR','knR','abd',.075],snR:['knR','anR','thR',.06],ftR:['anR','baR','snR',.065],toR:['baR','ftR','ftR',.055]};
const PARTS=Object.keys(BONES);
const PART_COLORS={spn:'#5f78e8',clvL:'#0e5c40',clvR:'#0e5c40',fiL:'#c8f1df',fiR:'#a6e6c8',toL:'#fff0cf',toR:'#f2d29a',abd:'#4a63d8',chest:'#7b8cf0',head:'#e2574c',uaL:'#2ba57a',faL:'#55c99b',haL:'#9be3c3',uaR:'#127a56',faR:'#1f9e70',haR:'#6fcfa5',
  thL:'#e39b2d',snL:'#f0bd62',ftL:'#f8dc9f',thR:'#a8661a',snR:'#c98a33',ftR:'#e0b46a'};

/* Percorso "centrale" dentro una regione: Dijkstra con costo alto vicino ai bordi,
   così il percorso segue l'asse dell'arto anche quando è piegato. */
function medialPath(mask,W,H,seed){
  const dt=distanceTransform(mask,W,H),N=W*H,dist=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1);
  const heap=[];const push=(p,v)=>{heap.push([v,p]);let i=heap.length-1;while(i>0){const q=(i-1)>>1;if(heap[q][0]<=heap[i][0])break;[heap[q],heap[i]]=[heap[i],heap[q]];i=q}};
  const pop=()=>{const t=heap[0],l=heap.pop();if(heap.length){heap[0]=l;let i=0;for(;;){const a=2*i+1,b=a+1;let m=i;if(a<heap.length&&heap[a][0]<heap[m][0])m=a;if(b<heap.length&&heap[b][0]<heap[m][0])m=b;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m}}return t};
  dist[seed]=0;push(seed,0);
  while(heap.length){const[v,p]=pop();if(v>dist[p])continue;const x=p%W,y=(p/W)|0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const n=ny*W+nx;if(!mask[n])continue;
      const nv=v+(dx&&dy?1.414:1)*(1+4/(dt[n]+.5));if(nv<dist[n]){dist[n]=nv;prev[n]=p;push(n,nv)}}}
  // punta = punto più lontano in linea d'aria lungo il percorso geodetico
  let tip=seed,best=-1;for(let p=0;p<N;p++)if(dist[p]<Infinity){const v=dist[p];if(v>best){best=v;tip=p}}
  const path=[];for(let p=tip;p>=0;p=prev[p])path.push({x:p%W+.5,y:((p/W)|0)+.5});path.reverse();
  const len=[0];for(let i=1;i<path.length;i++)len.push(len[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y));
  return{path,len,dt};
}
function along(mp,f){const L=mp.len[mp.len.length-1]*f;let i=0;while(i<mp.len.length-1&&mp.len[i+1]<L)i++;return{...mp.path[Math.min(i,mp.path.length-1)]}}
/* Gomito/ginocchio: punto di massima piega tra il 30% e il 65% del percorso; se l'arto è dritto, a metà. */
function bendPoint(mp,def,lo=.3,hi=.65){
  const P=mp.path,L=mp.len[mp.len.length-1];if(P.length<3)return along(mp,def);
  const a=P[0],b=P[P.length-1],lx=b.x-a.x,ly=b.y-a.y,ll=Math.hypot(lx,ly)||1;let bi=-1,bd=0;
  for(let i=0;i<P.length;i++){const f=mp.len[i]/L;if(f<lo||f>hi)continue;const d=Math.abs((P[i].x-a.x)*ly-(P[i].y-a.y)*lx)/ll;if(d>bd){bd=d;bi=i}}
  return bd>L*.09&&bi>=0?{...P[bi]}:along(mp,def);
}
/* Rilevamento automatico di tutte le articolazioni dalla sagoma. */
function autoJoints(base){
  const W=base.width,H=base.height,R=autoRig(base),{part}=segment(base,R),J={};
  const region=n=>{const m=new Uint8Array(W*H),k=PARTS6.indexOf(n);let c=0;for(let i=0;i<W*H;i++)if(part[i]===k){m[i]=1;c++}return{m,c}};
  const nearest=(m,x,y)=>{let b=-1,bd=1e18;for(let i=0;i<W*H;i++)if(m[i]){const d=(i%W+.5-x)**2+(((i/W)|0)+.5-y)**2;if(d<bd){bd=d;b=i}}return b};
  const neckY=R.neck*H,hipY=R.hip*H;
  // testa e busto
  const hd=region('head');let hx=0,hn=0,top=H;for(let i=0;i<W*H;i++)if(hd.m[i]){hx+=i%W+.5;hn++;top=Math.min(top,(i/W)|0)}
  const tor=region('torso');let tx=0,tn=0;for(let i=0;i<W*H;i++)if(tor.m[i]&&((i/W)|0)<neckY+H*.08){tx+=i%W+.5;tn++}
  const cx=tn?tx/tn:(hn?hx/hn:W/2);
  J.head={x:hn?hx/hn:cx,y:top};J.neck={x:cx,y:neckY};J.pelvis={x:R.legSplit*W,y:hipY};
  J.chest={x:(J.neck.x+J.pelvis.x)/2,y:J.neck.y+(J.pelvis.y-J.neck.y)*.45};
  // braccia
  const arm=(n,side)=>{const r=region(n),edgeX=(side<0?R.armL:R.armR)*W;
    if(r.c<H*.4){const sx=edgeX+side*H*.02,sy=neckY+H*.05;return{sh:{x:sx,y:sy},el:{x:sx+side*H*.02,y:sy+H*.17},wr:{x:sx+side*H*.03,y:sy+H*.31},ha:{x:sx+side*H*.03,y:sy+H*.37}}}
    const seed=nearest(r.m,edgeX,neckY+H*.02),mp=medialPath(r.m,W,H,seed);
    return{sh:along(mp,.06),el:bendPoint(mp,.44),wr:along(mp,.76),ha:mp.path[mp.path.length-1]}};
  const aL=arm('armL',-1),aR=arm('armR',1);
  Object.assign(J,{shL:aL.sh,elL:aL.el,wrL:aL.wr,haL:aL.ha,shR:aR.sh,elR:aR.el,wrR:aR.wr,haR:aR.ha});
  // gambe
  const leg=(n,side)=>{const r=region(n);
    if(r.c<H*.4){const hx2=J.pelvis.x+side*W*.12;return{hip:{x:hx2,y:hipY},kn:{x:hx2,y:hipY+(H-hipY)*.5},an:{x:hx2,y:H*.95},ft:{x:hx2,y:H-.5}}}
    let ty=H,sx=0,sn=0;for(let i=0;i<W*H;i++)if(r.m[i])ty=Math.min(ty,(i/W)|0);for(let i=0;i<W*H;i++)if(r.m[i]&&((i/W)|0)<=ty+1){sx+=i%W+.5;sn++}
    const seed=nearest(r.m,sx/sn,ty),mp=medialPath(r.m,W,H,seed);
    // la punta del piede: il punto più basso (non il più lontano, che può essere la punta laterale)
    let by=0;for(let i=0;i<W*H;i++)if(r.m[i])by=Math.max(by,(i/W)|0);let fx=0,fn=0;for(let i=0;i<W*H;i++)if(r.m[i]&&((i/W)|0)>=by-1){fx+=i%W+.5;fn++}const fb={x:fx/fn,y:by+.5};
    const hipP={x:mp.path[0].x,y:Math.max(hipY,mp.path[0].y)};
    return{hip:hipP,kn:bendPoint(mp,.5,.35,.65),an:along(mp,.84),ft:fb}};
  const lL=leg('legL',-1),lR=leg('legR',1);
  Object.assign(J,{hipL:lL.hip,knL:lL.kn,anL:lL.an,ftL:lL.ft,hipR:lR.hip,knR:lR.kn,anR:lR.an,ftR:lR.ft});
  J.pelvis={x:(J.hipL.x+J.hipR.x)/2,y:Math.min(J.hipL.y,J.hipR.y)};
  completeJoints(J);return J;
}
/* Personaggio disegnato DI LATO (verso destra): le braccia stanno sul busto e le gambe una davanti all'altra,
   quindi si usa la geometria della sagoma invece della ricerca di braccia separate. */
function autoJointsSide(base){
  const W=base.width,H=base.height,d=getID(base).data,A=(x,y)=>d[(y*W+x)*4+3]>0,R=autoRig(base),J={};
  const span=y=>{let l=-1,r=-1;for(let x=0;x<W;x++)if(A(x,y)){if(l<0)l=x;r=x}return[l,r]};
  const mid=y=>{const[l,r]=span(Math.max(0,Math.min(H-1,Math.round(y))));return l<0?W/2:(l+r+1)/2};
  let top=0;while(top<H&&span(top)[0]<0)top++;
  const neckY=R.neck*H,hipY=Math.max(R.hip*H,neckY+H*.2),cx=mid((neckY+hipY)/2);
  J.head={x:mid(top+2),y:top};J.neck={x:mid(neckY),y:neckY};J.pelvis={x:mid(hipY),y:hipY};
  J.chest={x:mid(neckY+(hipY-neckY)*.4),y:neckY+(hipY-neckY)*.4};J.waist={x:mid(neckY+(hipY-neckY)*.72),y:neckY+(hipY-neckY)*.72};
  const armLen=(hipY-neckY)*1.05;
  for(const[s,dz]of[['L',-1],['R',1]]){const sx=cx+dz*.5,sy=neckY+(hipY-neckY)*.12;
    J['cl'+s]={x:sx,y:sy-1};J['sh'+s]={x:sx,y:sy};J['el'+s]={x:sx,y:sy+armLen*.45};J['wr'+s]={x:sx+1,y:sy+armLen*.85};J['ku'+s]={x:sx+1,y:sy+armLen*.92};J['ha'+s]={x:sx+1,y:sy+armLen}}
  // gambe: se c'è uno spazio tra le gambe si usano i due lati, altrimenti sono sovrapposte
  let gap=null;for(let y=H-2;y>hipY;y--){const[l,r]=span(y);let inG=false,gs=-1;for(let x=l;x<=r;x++){if(!A(x,y)&&!inG){inG=true;gs=x}if(A(x,y)&&inG){gap={y,x:(gs+x)/2};break}}if(!gap&&y<H*.85)break}
  let bottom=H-1;while(bottom>0&&span(bottom)[0]<0)bottom--;const[bl,br]=span(bottom);
  const legs=gap?[[(bl+gap.x)/2,-1],[(gap.x+br)/2,1]]:[[mid(bottom-2)-.5,-1],[mid(bottom-2)+.5,1]];
  for(const[[fx],s]of legs.map((v,i)=>[v,i?'R':'L'])){const hx=J.pelvis.x+(s==='L'?-.5:.5);
    J['hip'+s]={x:hx,y:hipY};J['kn'+s]={x:(hx+fx)/2,y:hipY+(bottom-hipY)*.5};J['an'+s]={x:fx,y:bottom-(bottom-hipY)*.1};
    J['ba'+s]={x:fx+(bottom-hipY)*.08,y:bottom-1};J['ft'+s]={x:Math.min(W-.5,fx+(bottom-hipY)*.16),y:bottom}}
  return J;
}
/* Punti aggiuntivi ricavati dagli altri (vita, clavicole, nocche, pianta del piede). */
function completeJoints(J){
  const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  if(!J.waist)J.waist=mix(J.chest,J.pelvis,.5);
  for(const s of['L','R']){
    if(!J['cl'+s])J['cl'+s]=mix(J.neck,J['sh'+s],.3),J['cl'+s].y=Math.max(J['cl'+s].y,J.neck.y+(J.chest.y-J.neck.y)*.25);
    if(!J['ku'+s])J['ku'+s]=mix(J['wr'+s],J['ha'+s],.55);
    if(!J['ba'+s])J['ba'+s]=mix(J['an'+s],J['ft'+s],.6)}
  return J;
}
function segDist(px,py,a,b){const vx=b.x-a.x,vy=b.y-a.y,l=vx*vx+vy*vy||1;let t=((px-a.x)*vx+(py-a.y)*vy)/l;t=Math.max(0,Math.min(1,t));return Math.hypot(px-a.x-t*vx,py-a.y-t*vy)}
/* Divide lo sprite nelle 15 parti in base alla vicinanza alle ossa, poi:
   - le zone di colore chiuse da contorni restano intere (guanti, scarpe);
   - il busto nascosto dalle braccia viene ricostruito;
   - attorno alle articolazioni le parti si sovrappongono, così piegando non si aprono buchi;
   - per ogni parte si genera anche il retro (dettagli rimossi, capelli dietro la testa). */
function buildParts2D(base,J){
  const W=base.width,H=base.height,img=getID(base),d=img.data,N=W*H,mask=alphaMask(img),dt=distanceTransform(mask,W,H);
  const rad={};
  for(const[p,[a,b,,rr]]of Object.entries(BONES)){const A=J[a],B=J[b];
    const s=[.3,.5,.7].map(t=>{const x=Math.round(A.x+(B.x-A.x)*t),y=Math.round(A.y+(B.y-A.y)*t);return x>=0&&y>=0&&x<W&&y<H?dt[y*W+x]:0}).sort((u,v)=>u-v)[1];
    rad[p]=rr?Math.max(1.5,Math.min(s||rr*H,rr*H*1.6)):Math.max(2,s||H*.12);
    if(p==='head')rad[p]=Math.max(rad[p],Math.hypot(B.x-A.x,B.y-A.y)*.5)}
  // 1) assegnazione per distanza normalizzata dall'osso
  const lab=new Uint8Array(N).fill(255);
  for(let i=0;i<N;i++){if(!mask[i])continue;const x=i%W+.5,y=((i/W)|0)+.5;let bp=0,bv=1e9;
    PARTS.forEach((p,k)=>{const[a,b]=BONES[p];let v=segDist(x,y,J[a],J[b])/rad[p];if(p==='abd'||p==='spn'||p==='chest')v*=1.15;if(p==='clvL'||p==='clvR')v*=1.25;if(v<bv){bv=v;bp=k}});lab[i]=bp}
  // la testa sopra il collo, le parti del busto separate dal petto
  // 2) zone di colore delimitate da contorni: voto di maggioranza
  const pl=new Int32Array(N).fill(-1),q=new Int32Array(N);
  for(let p=0;p<N;p++){if(!mask[p]||isDark(d,p*4)||pl[p]>=0)continue;let qh=0,qt=0;q[qt++]=p;pl[p]=p;
    while(qh<qt){const c=q[qh++],x=c%W,y=(c/W)|0;for(const n of[x>0?c-1:-1,x<W-1?c+1:-1,y>0?c-W:-1,y<H-1?c+W:-1])if(n>=0&&pl[n]<0&&mask[n]&&!isDark(d,n*4)){pl[n]=p;q[qt++]=n}}
    if(qt>N*.035||qt<2)continue;const votes=new Map();for(let k=0;k<qt;k++){const v=lab[q[k]];votes.set(v,(votes.get(v)||0)+1)}
    let bv=-1,bl=0;for(const[k,v]of votes)if(v>bv){bv=v;bl=k}if(bv/qt>.5)for(let k=0;k<qt;k++)lab[q[k]]=bl}
  // contorni scuri: prendono la parte del vicino non scuro più simile per assegnazione geometrica
  // 3) maschere delle parti + ricostruzione busto
  const own=PARTS.map(()=>new Uint8Array(N));for(let i=0;i<N;i++)if(lab[i]!==255)own[lab[i]][i]=1;
  const tex={};PARTS.forEach(p=>tex[p]=new ImageData(W,H));
  const put=(p,i,src)=>{const t=tex[p].data,j=i*4,s=(src||d);t[j]=s[j];t[j+1]=s[j+1];t[j+2]=s[j+2];t[j+3]=255};
  for(let i=0;i<N;i++)if(lab[i]!==255)put(PARTS[lab[i]],i);
  const iA=PARTS.indexOf('abd'),iC=PARTS.indexOf('chest'),iS=PARTS.indexOf('spn');const isT=l=>l===iA||l===iC||l===iS;
  const fill=new Uint8Array(N);let filled=0;
  for(let y=Math.floor(J.neck.y);y<Math.min(H,Math.ceil(J.pelvis.y));y++){let a=W,b=-1;for(let x=0;x<W;x++){const l=lab[y*W+x];if(isT(l)){a=Math.min(a,x);b=Math.max(b,x)}}
    for(let x=a+1;x<b;x++){const i=y*W+x,l=lab[i];if(mask[i]&&!isT(l)&&l!==PARTS.indexOf('head')&&!/^clv/.test(PARTS[l])){fill[i]=1;filled++}}}
  if(filled){ // propagazione del colore del busto (dal bordo verso l'interno)
    const col=new Int32Array(N).fill(-1);let qh=0,qt=0;
    for(let i=0;i<N;i++)if(isT(lab[i])&&!isDark(d,i*4)){col[i]=i;q[qt++]=i}
    while(qh<qt){const c=q[qh++],x=c%W,y=(c/W)|0;for(const n of[x>0?c-1:-1,x<W-1?c+1:-1,y>0?c-W:-1,y<H-1?c+W:-1])if(n>=0&&fill[n]&&col[n]<0){col[n]=col[c];q[qt++]=n}}
    for(let i=0;i<N;i++)if(fill[i]&&col[i]>=0){const yy=(i/W)|0,p=yy<J.chest.y?'chest':yy<J.waist.y?'spn':'abd',t=tex[p].data,j=i*4,s=col[i]*4;t[j]=d[s];t[j+1]=d[s+1];t[j+2]=d[s+2];t[j+3]=255}
  }
  // 4) sovrapposizione attorno alle articolazioni (niente buchi quando si piega)
  for(const[p,[a,,par]]of Object.entries(BONES)){if(!par)continue;const j=J[a],r=Math.max(1.5,Math.min(rad[p],rad[par])*1.1),pi=PARTS.indexOf(p),qi=PARTS.indexOf(par);
    for(let y=Math.max(0,Math.floor(j.y-r));y<=Math.min(H-1,Math.ceil(j.y+r));y++)for(let x=Math.max(0,Math.floor(j.x-r));x<=Math.min(W-1,Math.ceil(j.x+r));x++){
      const i=y*W+x;if(Math.hypot(x+.5-j.x,y+.5-j.y)>r||!mask[i])continue;if(lab[i]===pi)put(par,i);else if(lab[i]===qi)put(p,i)}}
  // 5) retro di ogni parte
  const rr=Math.max(1,Math.round(H/32)),out={};
  for(const p of PARTS){const f=tex[p];let n=0;for(let i=3;i<f.data.length;i+=4)if(f.data[i])n++;if(!n){out[p]=null;continue}
    const back=modeFilter(f,W,H,rr,true);
    if(p==='head')hairBack(back,f,W,H);
    const fc=mk(W,H),bc=mk(W,H);fc.getContext('2d').putImageData(f,0,0);bc.getContext('2d').putImageData(back,0,0);
    out[p]={front:fc,back:bc,mask:alphaMask(f),count:n}}
  return{parts:out,lab,rad,filled};
}
/* Retro della testa: il colore dominante in alto (capelli o cappello) copre la nuca. */
function hairBack(back,front,W,H){
  const d=front.data,b=back.data;let y0=H,y1=-1;for(let i=0;i<W*H;i++)if(d[i*4+3]){const y=(i/W)|0;y0=Math.min(y0,y);y1=Math.max(y1,y)}
  const cnt=new Map(),lim=y0+(y1-y0)*.3;
  for(let y=y0;y<=lim;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(!d[i+3])continue;if(x===0||x===W-1||!d[i-4+3]||!d[i+4+3]||(y>0&&!d[i-W*4+3]))continue;const k=(d[i]>>4)<<8|(d[i+1]>>4)<<4|(d[i+2]>>4);let e=cnt.get(k);if(!e){e=[0,0,0,0];cnt.set(k,e)}e[0]++;e[1]+=d[i];e[2]+=d[i+1];e[3]+=d[i+2]}
  let best=null;for(const e of cnt.values())if(!best||e[0]>best[0])best=e;if(!best)return;
  const hc=[best[1]/best[0],best[2]/best[0],best[3]/best[0]],lim2=y0+(y1-y0)*.82;
  for(let y=y0;y<=lim2;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(!b[i+3])continue;
    const edge=x===0||x===W-1||!d[i-1]||!d[i+7]||(y>0&&!d[i-W*4+3]);if(edge&&isDark(d,i))continue;b[i]=hc[0];b[i+1]=hc[1];b[i+2]=hc[2]}
}

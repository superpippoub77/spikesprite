"use strict";
/* ============ Pupazzo 3D ricavato dall'immagine ============
   Ogni parte diventa una superficie "gonfiata": lo spessore cresce dal bordo verso il centro
   (sezione circolare), davanti c'è l'immagine, dietro il retro ricostruito.
   Così vista di lato o di spalle il personaggio ha volume e non sparisce. */
const DEPTH={spn:.62,clvL:.7,clvR:.7,fiL:.7,fiR:.7,toL:1.6,toR:1.6,abd:.62,chest:.62,head:.85,uaL:.95,faL:.95,haL:.8,uaR:.95,faR:.95,haR:.8,thL:.9,snL:.9,ftL:1.9,thR:.9,snR:.9,ftR:1.9,obj:.6};
const DEPTH_BACK={ftL:.45,ftR:.45,toL:.4,toR:.4,head:.95};  // i piedi sporgono in avanti

function makeTex(c,pixel){
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.generateMipmaps=false;
  t.magFilter=t.minFilter=pixel?THREE.NearestFilter:THREE.LinearFilter;t.needsUpdate=true;return t;
}
/* Superficie gonfiata di una parte. pivot = articolazione (coordinate immagine),
   rot = rotazione nel piano per "raddrizzare" l'osso. */
/* Toglie il contorno scuro sul bordo (sostituito dal colore interno vicino):
   serve per le viste non frontali, dove il contorno viene ridisegnato sulla sagoma. */
function stripOutline(c){
  const W=c.width,H=c.height,id=getID(c),d=id.data,N=W*H,src=new Int32Array(N).fill(-1),q=new Int32Array(N);let qh=0,qt=0;
  const edge=i=>{const x=i%W,y=(i/W)|0;return x===0||y===0||x===W-1||y===H-1||!d[(i-1)*4+3]||!d[(i+1)*4+3]||!d[(i-W)*4+3]||!d[(i+W)*4+3]};
  const bad=new Uint8Array(N);for(let i=0;i<N;i++)if(d[i*4+3]&&isDark(d,i*4)&&edge(i))bad[i]=1;
  for(let i=0;i<N;i++)if(d[i*4+3]&&!bad[i]){src[i]=i;q[qt++]=i}
  while(qh<qt){const c2=q[qh++],x=c2%W,y=(c2/W)|0;for(const n of[x>0?c2-1:-1,x<W-1?c2+1:-1,y>0?c2-W:-1,y<H-1?c2+W:-1])if(n>=0&&bad[n]&&src[n]<0){src[n]=src[c2];q[qt++]=n}}
  for(let i=0;i<N;i++)if(bad[i]&&src[i]>=0){const j=src[i]*4;d[i*4]=d[j];d[i*4+1]=d[j+1];d[i*4+2]=d[j+2]}
  const o=mk(W,H);o.getContext('2d').putImageData(id,0,0);return o;
}
/* Superficie gonfiata di una parte, costruita pixel per pixel:
   davanti l'immagine, dietro il retro ricostruito; i due gusci si chiudono sul bordo (spessore 0),
   quindi visto di lato il volume è pieno e senza fessure. Di fronte resta identico all'originale. */
function inflatedMesh(part,W,H,pivot,rot,depthF,depthB,opt){
  const m=part.mask;
  // spessore a "cilindro" attorno all'osso: per ogni pixel si misura la larghezza della parte
  // perpendicolarmente all'osso; la sezione è un cerchio di quel diametro.
  const px=Math.cos(rot),py=Math.sin(rot); // direzione perpendicolare all'osso (in coordinate immagine)
  const pz=new Float32Array(W*H);let Rm=0;
  const inside=(x,y)=>{x=Math.floor(x);y=Math.floor(y);return x>=0&&y>=0&&x<W&&y<H&&m[y*W+x]};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!m[y*W+x])continue;let d1=0,d2=0;
    while(inside(x+.5+px*(d1+1),y+.5+py*(d1+1))&&d1<W+H)d1++;while(inside(x+.5-px*(d2+1),y+.5-py*(d2+1))&&d2<W+H)d2++;
    const r=(d1+d2+1)/2,off=(d1-d2)/2;pz[y*W+x]=Math.sqrt(Math.max(0,r*r-off*off));if(r>Rm)Rm=r}
  // leggera levigatura per evitare gradini tra righe di larghezza diversa
  const sm=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!m[y*W+x])continue;let s2=0,n=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const a=x+dx,b=y+dy;if(a<0||b<0||a>=W||b>=H||!m[b*W+a])continue;s2+=pz[b*W+a];n++}sm[y*W+x]=s2/n}
  const vid=new Map(),pos=[],uv=[],zs=[];const cr=Math.cos(rot),sr=Math.sin(rot);
  const vert=(cx,cy)=>{const key=cy*(W+1)+cx;let v=vid.get(key);if(v!==undefined)return v;
    const nb=[[cx-1,cy-1],[cx,cy-1],[cx-1,cy],[cx,cy]];let all=true,s2=0;for(const[a,b]of nb){if(!inside(a,b)){all=false;break}s2+=sm[b*W+a]}
    const z=all?s2/4*opt.thick:0;
    const lx=cx-pivot.x,ly=pivot.y-cy;v=zs.length;pos.push(lx*cr-ly*sr,lx*sr+ly*cr);zs.push(z);uv.push(cx/W,1-cy/H);vid.set(key,v);return v};
  const idx=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!m[y*W+x])continue;const a=vert(x,y),b=vert(x+1,y),c=vert(x,y+1),e=vert(x+1,y+1);idx.push(a,c,b,b,c,e)}
  const mkGeo=(sign,f,flip)=>{const g=new THREE.BufferGeometry(),P=new Float32Array(zs.length*3);
    for(let k=0;k<zs.length;k++){P[k*3]=pos[k*2];P[k*3+1]=pos[k*2+1];P[k*3+2]=sign*zs[k]*f}
    g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const I=flip?idx.map((_,k)=>idx[k-k%3+(2-k%3)]):idx;g.setIndex(I);g.computeVertexNormals();return g};
  const Mat=opt.shade?THREE.MeshLambertMaterial:THREE.MeshBasicMaterial;
  const tf=makeTex(part.front,opt.pixel),tb=makeTex(part.back,opt.pixel),tfs=makeTex(stripOutline(part.front),opt.pixel),tbs=makeTex(stripOutline(part.back),opt.pixel);
  const mf=new Mat({map:tf}),mb=new Mat({map:tb});mf.userData={a:tf,b:tfs};mb.userData={a:tb,b:tbs};
  const grp=new THREE.Group(),gf=mkGeo(1,depthF,false),gb=mkGeo(-1,depthB,true);
  grp.add(new THREE.Mesh(gf,mf),new THREE.Mesh(gb,mb));
  gf.computeBoundingBox();gb.computeBoundingBox();const bb=gf.boundingBox.clone().union(gb.boundingBox);
  const corners=[];for(const X of[bb.min.x,bb.max.x])for(const Y of[bb.min.y,bb.max.y])for(const Z of[bb.min.z,bb.max.z])corners.push(new THREE.Vector3(X,Y,Z));
  grp.userData.corners=corners;grp.userData.depth=Rm*opt.thick*depthF;grp.userData.mats=[mf,mb];
  return grp;
}
/* Di fronte: texture originali (pixel identici). Nelle altre direzioni: texture senza contorno. */
function setOutlineMode(G,original){if(G.outlineOriginal===original)return;G.outlineOriginal=original;
  G.turn.traverse(o=>{if(o.userData.mats)o.userData.mats.forEach(m=>{m.map=original?m.userData.a:m.userData.b;m.needsUpdate=true})})}
const ang=(a,b)=>Math.atan2(b.x-a.x,b.y-a.y); // angolo nel piano rispetto a "giù"
/* Costruisce la gerarchia: corpo → bacino → addome → petto → (collo → testa, spalle → braccia) ; bacino → anche → gambe. */
function buildPuppet(P2,J,W,H,opt){
  const G={},turn=new THREE.Group(),body=new THREE.Group(),root=new THREE.Group();turn.add(body);body.add(root);G.turn=turn;G.body=body;
  const base={};const groups=[];
  const node=(name,parent,pos)=>{const g=new THREE.Group();g.name=name;g.position.copy(pos);parent.add(g);G[name]=g;groups.push(g);base[name]=new THREE.Euler();return g};
  // altezza del bacino da terra
  const footY=Math.max(J.ftL.y,J.ftR.y,J.anL.y,J.anR.y,H-.5);root.position.set(0,footY-J.pelvis.y,0);G.root=root;
  const V=(a,b)=>new THREE.Vector3(b.x-a.x,a.y-b.y,0);// da a a b in coordinate mondo (y in su)
  const rotV=(v,t)=>new THREE.Vector3(v.x*Math.cos(t)-v.y*Math.sin(t),v.x*Math.sin(t)+v.y*Math.cos(t),0);
  const addMesh=(g,p,pivot,rot)=>{const part=P2.parts[p];if(!part)return;const m=inflatedMesh(part,W,H,pivot,rot,DEPTH[p],DEPTH_BACK[p]??DEPTH[p],opt);m.name='m_'+p;g.add(m);G['m_'+p]=m};
  // tronco a tre segmenti (addome, vita, petto): ogni osso viene allineato all'asse Y
  const upAng=p=>Math.atan2(-(J[BONES[p][1]].x-J[BONES[p][0]].x),J[BONES[p][0]].y-J[BONES[p][1]].y);
  const rA=-upAng('abd'),gA=node('abd',root,new THREE.Vector3());addMesh(gA,'abd',J.pelvis,rA);
  const gW=node('waist',gA,rotV(V(J.pelvis,J.waist),rA)),rS=-upAng('spn');addMesh(gW,'spn',J.waist,rS);
  const gC=node('chest',gW,rotV(V(J.waist,J.chest),rS)),rC=-upAng('chest');addMesh(gC,'chest',J.chest,rC);
  const gN=node('neck',gC,rotV(V(J.chest,J.neck),rC)),rH=-upAng('head');addMesh(gN,'head',J.neck,rH);
  /* arti: ogni osso è raddrizzato verso il basso; la rotazione di partenza si calcola
     dall'angolo "voluto" nel mondo (immagine o posa neutra) meno l'angolo del genitore. */
  const keep=opt.pose==='image';
  // regole della posa neutra: 'keep' = come nell'immagine, 'rel' = stesso angolo relativo al genitore, numero = angolo assoluto (gradi)
  const NEUTRAL={clL:'keep',shL:-10,elL:0,wrL:'rel',kuL:'rel',clR:'keep',shR:10,elR:0,wrR:'rel',kuR:'rel',
    hipL:-2,knL:0,anL:'rel',baL:'rel',hipR:2,knR:0,anR:'rel',baR:'rel'};
  const limb=(parent,parentFrame,parentPivot,chain)=>{let par=parent,pp=parentPivot,prevImg=null,prevWorld=parentFrame,prevLen=0;
    chain.forEach(([p,ja,jb],k)=>{const a=J[ja],b=J[jb],a0=ang(a,b);
      const pos=k===0?rotV(V(pp,a),-parentFrame):new THREE.Vector3(0,-prevLen,0);
      const g=node(ja,par,pos);addMesh(g,p,a,-a0);
      const rule=NEUTRAL[ja];let world=a0;
      if(!keep&&rule!=='keep'){world=rule==='rel'?prevWorld+(a0-prevImg):rule*D2R}
      base[ja].z=world-prevWorld;base[ja].imageZ=a0-(k===0?parentFrame:prevImg);
      prevImg=a0;prevWorld=world;prevLen=Math.hypot(b.x-a.x,b.y-a.y);par=g;pp=a;
      if(k===chain.length-1){const tip=new THREE.Object3D();tip.position.set(0,-prevLen,0);g.add(tip);G['tip_'+jb]=tip}});
  };
  // il "telaio" del petto è l'immagine ruotata di rC: angolo assoluto del genitore = -rC
  limb(gC,-rC,J.chest,[['clvL','clL','shL'],['uaL','shL','elL'],['faL','elL','wrL'],['haL','wrL','kuL'],['fiL','kuL','haL']]);
  limb(gC,-rC,J.chest,[['clvR','clR','shR'],['uaR','shR','elR'],['faR','elR','wrR'],['haR','wrR','kuR'],['fiR','kuR','haR']]);
  // la spalla oscilla attorno all'asse del corpo, non a quello della clavicola
  base.shL.reframe=base.clL.z;base.shR.reframe=base.clR.z;
  limb(root,0,J.pelvis,[['thL','hipL','knL'],['snL','knL','anL'],['ftL','anL','baL'],['toL','baL','ftL']]);
  limb(root,0,J.pelvis,[['thR','hipR','knR'],['snR','knR','anR'],['ftR','anR','baR'],['toR','baR','ftR']]);
  if(keep){ // braccia davanti al busto (es. conserte): portale avanti in profondità
    const td=(G.m_chest?.userData.depth||0);for(const s of['L','R']){const side=s==='L'?-1:1,ch=['el','wr','ku','ha'].map(k=>J[k+s]);
      const inside=ch.some(p=>side<0?p.x>J.shL.x+2:p.x<J.shR.x-2);if(inside)G['cl'+s].position.z=td*.9}}
  G.base=base;G.groups=groups;G.H=H;G.W=W;
  G.cornerObjs=[];turn.traverse(o=>{if(o.userData.corners)G.cornerObjs.push(o)});
  return G;
}
/* Pupazzo per gli oggetti: un unico volume. */
function buildObject(base,opt){
  const W=base.width,H=base.height,img=getID(base),part={front:base,back:(()=>{const b=mk(W,H);b.getContext('2d').putImageData(modeFilter(img,W,H,Math.max(1,Math.round(H/24)),true),0,0);return b})(),mask:alphaMask(img)};
  const G={},turn=new THREE.Group(),body=new THREE.Group();turn.add(body);G.turn=turn;G.body=body;
  const m=inflatedMesh(part,W,H,{x:W/2,y:H},0,DEPTH.obj,DEPTH.obj,opt);body.add(m);
  G.base={};G.groups=[];G.H=H;G.W=W;G.obj=true;G.cornerObjs=[m];return G;
}
/* Applica una posa (gradi) e appoggia il personaggio a terra. */
const _v=new THREE.Vector3(),_q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion(),_e=new THREE.Euler(),_Z=new THREE.Vector3(0,0,1);
function applyPose(G,pose,opt={}){
  for(const g of G.groups){const b=G.base[g.name];let px=(pose[g.name+'.x']||0)*D2R,py=(pose[g.name+'.y']||0)*D2R,pz=(pose[g.name+'.z']||0)*D2R;
    // sprite disegnato di lato: le oscillazioni avanti/indietro diventano rotazioni nel piano dell'immagine
    if(G.side){pz+=-px*G.side;px=0;py=0}
    if(b.reframe!==undefined){_q1.setFromAxisAngle(_Z,-b.reframe);_q2.setFromEuler(_e.set(px,py,0,'XYZ'));_q3.setFromAxisAngle(_Z,b.reframe+b.z+pz);g.quaternion.copy(_q1).multiply(_q2).multiply(_q3)}
    else g.rotation.set(b.x+px,b.y+py,b.z+pz)}
  if(G.root)G.root.position.y=G.root.userData.y0??(G.root.userData.y0=G.root.position.y);
  if(G.side)G.body.rotation.set(0,0,(-(pose['body.x']||0)*G.side+(pose['body.z']||0))*D2R);
  else G.body.rotation.set((pose['body.x']||0)*D2R,(pose['body.y']||0)*D2R,(pose['body.z']||0)*D2R);
  const sc=pose.scale||1;G.body.scale.set(sc*(pose.sx||1),sc*(pose.sy||1),sc*(pose.sx||1));
  G.body.position.set((pose.x||0)*G.H*(G.side?G.side:1),0,0);G.turn.rotation.set(0,0,0);G.turn.updateMatrixWorld(true);
  // appoggio a terra: il punto più basso del corpo tocca y=0, poi si aggiunge il salto
  let minY=Infinity;for(const o of G.cornerObjs)for(const c of o.userData.corners){_v.copy(c).applyMatrix4(o.matrixWorld);if(_v.y<minY)minY=_v.y}
  G.body.position.y=Math.round(-minY+(pose.lift||0)*G.H);G.turn.updateMatrixWorld(true);
}

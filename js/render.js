"use strict";
/* ============ Render in 8 direzioni e conversione in pixel art ============ */
const DIRS=[{k:'S',a:0,l:'Fronte'},{k:'SE',a:45,l:'Fronte-destra'},{k:'E',a:90,l:'Destra'},{k:'NE',a:135,l:'Retro-destra'},
  {k:'N',a:180,l:'Retro'},{k:'NW',a:225,l:'Retro-sinistra'},{k:'W',a:270,l:'Sinistra'},{k:'SW',a:315,l:'Fronte-sinistra'}];
const DIRSETS={'1':['S'],'2':['E','W'],'4':['S','E','N','W'],'8':['S','SE','E','NE','N','NW','W','SW']};
const R3={renderer:null,scene:null,camera:null,amb:null,sun:null,canvas:null};
function initRenderer(){
  if(R3.renderer)return true;
  try{const r=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});r.setClearColor(0x000000,0);r.outputEncoding=THREE.sRGBEncoding;r.setPixelRatio(1);
    R3.renderer=r;R3.scene=new THREE.Scene();R3.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,20000);
    R3.amb=new THREE.AmbientLight(0xffffff,.7);R3.sun=new THREE.DirectionalLight(0xffffff,.35);R3.scene.add(R3.amb,R3.sun,R3.sun.target);return true}
  catch(e){console.error(e);return false}
}
function setCamera(elev){const e=elev*D2R,D=5000;R3.camera.position.set(0,Math.sin(e)*D,Math.cos(e)*D);R3.camera.up.set(0,1,0);R3.camera.lookAt(0,0,0);R3.camera.updateMatrixWorld(true);
  R3.sun.position.set(-.6*D,.9*D,.8*D);R3.sun.target.position.set(0,0,0)}
/* Cella unica per tutto lo sprite sheet: si calcola sui punti estremi di ogni frame e di ogni direzione. */
function computeCell(src,keys,dirs,elev){
  setCamera(elev);const inv=R3.camera.matrixWorldInverse,v=new THREE.Vector3();let mx=1,top=1,bot=0;
  for(const k of keys){const n=src.anim[k].n;for(let i=0;i<n;i++){const pts=src.setFrame(k,i);
    for(const dk of dirs){const a=DIRS.find(d=>d.k===dk).a*D2R,c=Math.cos(a),s=Math.sin(a);
      for(const p of pts){v.set(p.x*c+p.z*s,p.y,-p.x*s+p.z*c).applyMatrix4(inv);mx=Math.max(mx,Math.abs(v.x));top=Math.max(top,v.y);bot=Math.min(bot,v.y)}}}}
  const pad=2,half=Math.ceil(mx)+pad,T=Math.ceil(top)+pad,B=Math.ceil(-bot)+pad+Math.max(2,Math.ceil(src.H*.05));
  return{cw:half*2,ch:T+B,ox:half,oy:T,elev};
}
const _rc=document.createElement('canvas');
function renderFrame(src,key,i,dir,cell,opt){
  const front=dir==='S'&&!cell.elev;if(src.G&&!src.G.obj)setOutlineMode(src.G,front);else if(src.G)setOutlineMode(src.G,front);
  const pose=src.setFrame(key,i,true)||{};const yaw=DIRS.find(d=>d.k===dir).a*D2R;src.turn.rotation.y=yaw;src.turn.updateMatrixWorld(true);
  setCamera(cell.elev);
  const SS=opt.pixel?4:2,cam=R3.camera;cam.left=-cell.ox;cam.right=cell.cw-cell.ox;cam.top=cell.oy;cam.bottom=cell.oy-cell.ch;cam.updateProjectionMatrix();
  const shade=src.kind==='model'?1:(opt.shade?1:0);R3.amb.intensity=src.kind==='model'?.65:(shade?.72:1);R3.sun.intensity=src.kind==='model'?.75:(shade?.32:0);
  if(src.turn.parent!==R3.scene){R3.scene.children.filter(o=>o.userData.src).forEach(o=>R3.scene.remove(o));src.turn.userData.src=1;R3.scene.add(src.turn)}
  R3.renderer.setSize(cell.cw*SS,cell.ch*SS,false);R3.renderer.render(R3.scene,cam);
  _rc.width=cell.cw*SS;_rc.height=cell.ch*SS;const x=_rc.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,_rc.width,_rc.height);x.drawImage(R3.renderer.domElement,0,0);
  let out;
  if(opt.pixel){const big=x.getImageData(0,0,_rc.width,_rc.height),small=modeDownscale(big,cell.cw,cell.ch);
    if(src.palette)mapPalette(small,src.palette);
    if(pose.tint)tintImg(small,pose.tint);
    out=mk(cell.cw,cell.ch);out.getContext('2d').putImageData(small,0,0)}
  else{out=downscaleSmooth(_rc,cell.cw,cell.ch);if(pose.tint){const id=getID(out);tintImg(id,pose.tint);out.getContext('2d').putImageData(id,0,0)}}
  if(pose.flash>.5&&src.G?.tip_haR)drawFlash(out,src,cell);
  if(opt.outline&&!src.ownOutline)out=cropTo(addOutline(out,opt.outlineC),cell.cw,cell.ch);
  else if(src.ownOutline&&!front)out=cropTo(addOutline(out,src.outlineCol||opt.outlineC),cell.cw,cell.ch);
  if(opt.shadow){const s=mk(cell.cw,cell.ch),sx=s.getContext('2d');drawShadow(sx,cell,src,pose);sx.drawImage(out,0,0);out=s}
  return out;
}
function cropTo(c,w,h){const o=mk(w,h);o.getContext('2d').drawImage(c,-1,-1);return o}
function tintImg(img,col){const d=img.data,r=parseInt(col.slice(1,3),16),g=parseInt(col.slice(3,5),16),b=parseInt(col.slice(5,7),16);
  for(let i=0;i<d.length;i+=4)if(d[i+3]){d[i]=d[i]*.4+r*.6;d[i+1]=d[i+1]*.4+g*.6;d[i+2]=d[i+2]*.4+b*.6}}
function drawShadow(x,cell,src,pose){
  const k=Math.max(.35,1-(pose.lift||0)*1.6),rx=src.W*.36*k,ry=Math.max(1,rx*(cell.elev>0?Math.sin(Math.max(cell.elev,12)*D2R):.12));
  x.fillStyle='rgba(0,0,0,.26)';const cy=cell.oy-.5;
  for(let yy=-Math.ceil(ry);yy<=Math.ceil(ry);yy++){const q=1-(yy/ry)**2;if(q<=0)continue;const hw=Math.round(rx*Math.sqrt(q));x.fillRect(Math.round(cell.ox-hw),Math.round(cy+yy),hw*2,1)}
}
/* Lampo dello sparo, disegnato in pixel art sulla punta della mano. */
function drawFlash(c,src,cell){
  const v=new THREE.Vector3();src.G.tip_haR.getWorldPosition(v);v.applyMatrix4(R3.camera.matrixWorldInverse);
  const fx=Math.round(cell.ox+v.x+(src.G.side||1)*Math.max(2,src.H*.04)),fy=Math.round(cell.oy-v.y),r=Math.max(2,Math.round(src.H*.06)),x=c.getContext('2d');
  const ring=(rr,col)=>{x.fillStyle=col;for(let dy=-rr;dy<=rr;dy++){const w=rr-Math.abs(dy);x.fillRect(fx-w,fy+dy,w*2+1,1)}};
  ring(r,'#ff5a1f');ring(Math.max(1,Math.round(r*.65)),'#ffb21f');ring(Math.max(0,Math.round(r*.3)),'#fff6b0');
}

"use strict";
/* ============ Sorgenti ============
   Interfaccia comune: { kind, turn, H, W, anim:{key:{label,n,fps,loop,on,amp}}, setFrame(key,i,wantPose), palette, ownOutline } */

function puppetSource(G,kind,palette,ownOutline,prev){
  const defs=ANIMS[kind],anim={};
  for(const[k,d]of Object.entries(defs))anim[k]={label:d.label,n:d.n,fps:d.fps,loop:d.loop,on:true,amp:1,...(prev?.[k]?{on:prev[k].on,n:prev[k].n,fps:prev[k].fps,amp:prev[k].amp}:{})};
  const v=new THREE.Vector3();
  return{kind:'puppet',sub:kind,turn:G.turn,G,H:G.H,W:G.W,anim,palette,ownOutline,
    setFrame(key,i,wantPose){const a=anim[key],pose=poseFor(kind,key,i,a.n,a.amp);applyPose(G,pose);
      if(wantPose)return pose;const pts=[];
      for(const o of G.cornerObjs)for(const c of o.userData.corners){v.copy(c).applyMatrix4(o.matrixWorld);pts.push({x:v.x,y:v.y,z:v.z})}
      return pts}};
}

/* ---------- Modelli 3D ---------- */
const readBuf=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsArrayBuffer(f)});
async function parseModelFile(f){
  const buf=await readBuf(f),ext=f.name.split('.').pop().toLowerCase();
  if(ext==='glb'||ext==='gltf'){
    if(!THREE.GLTFLoader)throw new Error('Il lettore GLB non si è caricato.');
    const g=await new Promise((res,rej)=>new THREE.GLTFLoader().parse(buf,'',res,rej));return{obj:g.scene,clips:g.animations||[]}}
  if(ext==='fbx'){if(!THREE.FBXLoader)throw new Error('Il lettore FBX non si è caricato.');const o=new THREE.FBXLoader().parse(buf,'');return{obj:o,clips:o.animations||[]}}
  throw new Error('Formato non supportato: '+f.name+' (usa .glb o .fbx)');
}
const hasMesh=o=>{let m=false;o.traverse(c=>{if(c.isMesh&&c.geometry?.attributes?.position?.count>3)m=true});return m};
async function loadModel(files,opt){
  let model=null;const clips=[];
  for(const f of files){const{obj,clips:cs}=await parseModelFile(f);const base=f.name.replace(/\.[^.]+$/,'');
    cs.forEach((c,i)=>{c.name=(!c.name||/mixamo|take|animation|^clip/i.test(c.name))?(cs.length>1?base+'_'+(i+1):base):c.name;clips.push(c)});
    if(!model&&hasMesh(obj))model=obj}
  if(!model)throw new Error('Nessun modello con una mesh tra i file caricati.');
  if(!clips.length)throw new Error('Il modello non ha animazioni: scaricale da Mixamo e caricale insieme al modello.');
  return{model,clips};
}
function modelSource(M,opt,prev){
  const{model,clips}=M,turn=new THREE.Group(),body=new THREE.Group();turn.add(body);
  // materiali: senza luci ("piatto") per colori puliti, oppure con luci
  model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const ms=Array.isArray(o.material)?o.material:[o.material];
    const conv=ms.map(m=>{if(m.map)m.map.encoding=THREE.sRGBEncoding;if(opt.flat){const n=new THREE.MeshBasicMaterial({map:m.map||null,color:m.color?m.color.clone():0xffffff,transparent:false,alphaTest:m.alphaTest||(m.transparent?.5:0),side:THREE.DoubleSide,vertexColors:!!m.vertexColors});return n}m.side=THREE.DoubleSide;return m});
    o.material=Array.isArray(o.material)?conv:conv[0]}});
  // scala: altezza del modello = altezza scelta in pixel
  model.position.set(0,0,0);model.scale.set(1,1,1);model.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(model);const h=box.max.y-box.min.y||1,s=opt.height/h;
  model.scale.setScalar(s);model.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(model);
  const c=box.getCenter(new THREE.Vector3());model.position.set(-c.x,-box.min.y,-c.z);body.add(model);turn.updateMatrixWorld(true);
  // margine tra ossa e superficie (le ossa stanno "dentro" la mesh)
  const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o)});
  const bb=new THREE.Box3();const v=new THREE.Vector3();bones.forEach(b=>bb.expandByPoint(b.getWorldPosition(v)));
  box=new THREE.Box3().setFromObject(model);const margin=bones.length?Math.max(box.max.x-bb.max.x,bb.min.x-box.min.x,box.max.y-bb.max.y,box.max.z-bb.max.z,bb.min.z-box.min.z,opt.height*.04):0;
  // radice sul posto: si azzera lo spostamento orizzontale del bacino
  const rootBone=bones.find(b=>/hips|pelvis/i.test(b.name))||bones[0];
  const prepared=clips.map(cl=>{const c=cl.clone();if(opt.inPlace&&rootBone){const nm=rootBone.name;
    c.tracks.forEach(tr=>{if(tr.name===nm+'.position'||tr.name.endsWith('/'+nm+'.position')||tr.name===nm.replace(/[:]/g,'')+'.position'){const vv=tr.values,x0=vv[0],z0=vv[2];for(let i=0;i<vv.length;i+=3){vv[i]=x0;vv[i+2]=z0}}})}return c});
  const mixer=new THREE.AnimationMixer(model),anim={},byKey={};
  const used=new Set();prepared.forEach(c=>{let k=c.name.replace(/[^\w\-]+/g,'_').toLowerCase()||'anim';while(used.has(k))k+='_';used.add(k);byKey[k]=c;
    const n=Math.max(4,Math.min(24,Math.round(c.duration*12)));anim[k]={label:c.name,n,fps:12,loop:true,on:true,amp:1,...(prev?.[k]?{on:prev[k].on,n:prev[k].n,fps:prev[k].fps}:{})}});
  let cur=null;
  return{kind:'model',turn,H:opt.height,W:(box.max.x-box.min.x),anim,palette:null,ownOutline:false,
    setFrame(key,i,wantPose){const a=anim[key],clip=byKey[key];
      if(cur!==key){mixer.stopAllAction();mixer.uncacheRoot(model);const ac=mixer.clipAction(clip);ac.play();cur=key}
      const t=a.loop?i/a.n*clip.duration:(a.n>1?i/(a.n-1):0)*clip.duration;mixer.setTime(Math.min(t,clip.duration-1e-4));
      turn.rotation.set(0,0,0);turn.updateMatrixWorld(true);if(wantPose)return{};
      const pts=[];for(const b of bones){b.getWorldPosition(v);for(const[dx,dy,dz]of[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])pts.push({x:v.x+dx*margin,y:v.y+dy*margin,z:v.z+dz*margin})}
      if(!bones.length){const b2=new THREE.Box3().setFromObject(model);pts.push({x:b2.min.x,y:b2.min.y,z:b2.min.z},{x:b2.max.x,y:b2.max.y,z:b2.max.z},{x:b2.min.x,y:b2.max.y,z:b2.max.z},{x:b2.max.x,y:b2.min.y,z:b2.min.z})}
      return pts}};
}

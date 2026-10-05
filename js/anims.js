"use strict";
/* ============ Animazioni (angoli in gradi) ============
   Convenzioni: il personaggio guarda verso +Z.
   x negativo su anca/spalla = arto in avanti; x positivo sul ginocchio = piega all'indietro;
   x negativo sul gomito = avambraccio in avanti; x positivo su addome/petto/collo = inclinazione in avanti.
   I piedi vengono appoggiati a terra automaticamente a ogni frame (niente piedi che galleggiano). */
const lerpPose=(A,B,u)=>{const o={},ks=new Set([...Object.keys(A),...Object.keys(B)]);for(const k of ks){const a=A[k]??(k==='tint'?null:0),b=B[k]??(k==='tint'?null:0);o[k]=typeof a==='number'&&typeof b==='number'?a+(b-a)*u:(u<.5?a:b)}return o};
// interpolazione morbida tra pose chiave (curva "smoothstep" per evitare scatti)
function keyedPose(keys,t){const m=keys.length-1,f=Math.min(m,Math.max(0,t*m)),i=Math.min(m-1,Math.floor(f)),u=f-i,s=u*u*(3-2*u);return lerpPose(keys[i],keys[i+1],s)}
const scalePose=(p,a)=>{const o={};for(const k in p){const v=p[k];o[k]=typeof v==='number'&&!['sx','sy','scale'].includes(k)?v*a:(['sx','sy','scale'].includes(k)?1+(v-1)*a:v)}return o};
const footFlat=(p,s)=>{p['an'+s+'.x']=(p['an'+s+'.x']||0)-((p['hip'+s+'.x']||0)+(p['kn'+s+'.x']||0))};

const ANIMS={
 char:{
  idle:{label:'Fermo',n:8,fps:8,loop:true,f:t=>{const p=TAU*t,b=(1-Math.cos(p))/2,o={};
    o['knL.x']=o['knR.x']=3+5*b;o['hipL.x']=o['hipR.x']=-2.5*b;footFlat(o,'L');footFlat(o,'R');
    o['chest.x']=1.2*Math.sin(p);o['waist.x']=.6*Math.sin(p);o['neck.x']=-1.2*Math.sin(p+.6);o['clL.z']=1.5*b;o['clR.z']=-1.5*b;o['kuL.x']=o['kuR.x']=-8;o['shL.z']=-1.5*b;o['shR.z']=1.5*b;o['elL.x']=o['elR.x']=-4-2*b;return o}},
  walk:{label:'Camminata',n:8,fps:10,loop:true,f:t=>{const p=TAU*t,s=Math.sin(p),c=Math.cos(p),o={};
    o['hipL.x']=-24*s;o['hipR.x']=24*s;
    o['knL.x']=5+52*Math.max(0,c)**1.6;o['knR.x']=5+52*Math.max(0,-c)**1.6;
    footFlat(o,'L');footFlat(o,'R');if(c>0)o['anL.x']+=8*c;if(c<0)o['anR.x']+=-8*c;
    o['shL.x']=20*s;o['shR.x']=-20*s;o['elL.x']=-10-16*Math.max(0,-s);o['elR.x']=-10-16*Math.max(0,s);
    o['abd.x']=2;o['waist.x']=1;o['abd.y']=-3*s;o['waist.y']=-2*s;o['chest.y']=10*s;o['neck.y']=-5*s;o['neck.x']=-2;
    o['clL.z']=-2*Math.max(0,s);o['clR.z']=2*Math.max(0,-s);
    // spinta: il tallone si alza, le dita restano a terra
    o['baL.x']=-14*Math.max(0,-s)**3;o['baR.x']=-14*Math.max(0,s)**3;
    return o}},
  run:{label:'Corsa',n:8,fps:14,loop:true,f:t=>{const p=TAU*t,s=Math.sin(p),c=Math.cos(p),o={};
    o['hipL.x']=-42*s;o['hipR.x']=42*s;
    o['knL.x']=18+92*Math.max(0,c)**1.3;o['knR.x']=18+92*Math.max(0,-c)**1.3;
    footFlat(o,'L');footFlat(o,'R');o['anL.x']+=c>0?25*c:0;o['anR.x']+=c<0?-25*c:0;
    o['shL.x']=48*s;o['shR.x']=-48*s;o['elL.x']=-88+12*s;o['elR.x']=-88-12*s;o['shL.z']=-6;o['shR.z']=6;
    o['abd.x']=6;o['waist.x']=5;o['chest.x']=4;o['abd.y']=-5*s;o['waist.y']=-3*s;o['baL.x']=-25*Math.max(0,-s)**2;o['baR.x']=-25*Math.max(0,s)**2;o['kuL.x']=o['kuR.x']=-60;o['chest.y']=14*s;o['neck.x']=-9;o['neck.y']=-8*s;
    o.lift=.045*s*s;return o}},
  jump:{label:'Salto',n:10,fps:12,loop:false,f:t=>{const K=[
    {},
    {'hipL.x':-48,'hipR.x':-48,'knL.x':90,'knR.x':90,'anL.x':-42,'anR.x':-42,'abd.x':22,'chest.x':6,'neck.x':-14,'shL.x':38,'shR.x':38,'elL.x':-20,'elR.x':-20},
    {'hipL.x':-4,'hipR.x':-4,'knL.x':4,'knR.x':4,'anL.x':28,'anR.x':28,'baL.x':-30,'baR.x':-30,'clL.z':10,'clR.z':-10,'abd.x':-4,'shL.x':-155,'shR.x':-155,'elL.x':-10,'elR.x':-10,lift:.06},
    {'hipL.x':-35,'hipR.x':-28,'knL.x':55,'knR.x':45,'anL.x':12,'anR.x':10,'abd.x':4,'shL.x':-165,'shR.x':-165,'elL.x':-15,'elR.x':-15,lift:.3},
    {'hipL.x':-48,'hipR.x':-40,'knL.x':80,'knR.x':70,'anL.x':10,'anR.x':10,'abd.x':10,'shL.x':-130,'shR.x':-130,'elL.x':-35,'elR.x':-35,lift:.4},
    {'hipL.x':-25,'hipR.x':-20,'knL.x':35,'knR.x':30,'abd.x':6,'shL.x':-90,'shR.x':-90,'shL.z':-20,'shR.z':20,'elL.x':-20,'elR.x':-20,lift:.3},
    {'hipL.x':-14,'hipR.x':-12,'knL.x':14,'knR.x':12,'anL.x':12,'anR.x':12,'shL.x':-55,'shR.x':-55,'shL.z':-25,'shR.z':25,lift:.1},
    {'hipL.x':-50,'hipR.x':-50,'knL.x':85,'knR.x':85,'anL.x':-38,'anR.x':-38,'abd.x':20,'neck.x':-10,'shL.x':-25,'shR.x':-25,'shL.z':-15,'shR.z':15,'elL.x':-30,'elR.x':-30},
    {'hipL.x':-16,'hipR.x':-16,'knL.x':28,'knR.x':28,'anL.x':-12,'anR.x':-12,'abd.x':6,'shL.x':-8,'shR.x':-8},
    {}];return keyedPose(K,t)}},
  attack:{label:'Pugno',n:7,fps:14,loop:false,f:t=>{const g={'shL.x':-35,'elL.x':-95,'shR.x':-30,'elR.x':-100,'abd.x':3,'waist.x':2,'kuL.x':-80,'kuR.x':-80};const K=[
    g,
    {...g,'chest.y':-28,'abd.y':-8,'shR.x':15,'elR.x':-115,'hipR.x':-6,'knR.x':10,'anR.x':-4},
    {...g,'chest.y':32,'abd.y':10,'abd.x':10,'shR.x':-88,'elR.x':-4,'shR.z':4,'hipL.x':-22,'knL.x':20,'anL.x':2,'hipR.x':8,'knR.x':6,x:.03},
    {...g,'chest.y':28,'abd.y':8,'abd.x':9,'shR.x':-84,'elR.x':-10,'hipL.x':-20,'knL.x':18,'hipR.x':8,x:.03},
    {...g,'chest.y':10,'shR.x':-55,'elR.x':-60,'hipL.x':-8,'knL.x':8,x:.01},
    g,{}];return keyedPose(K,t)}},
  shoot:{label:'Sparo',n:8,fps:14,loop:false,f:t=>{const aim={'shR.x':-88,'elR.x':-2,'kuR.x':-70,'shL.x':-62,'elL.x':-55,'kuL.x':-60,'abd.x':2,'waist.x':1};return keyedPose([
    aim,aim,{...aim,'shR.x':-97,'elR.x':-6,'chest.x':-5,'neck.x':-3,x:-.012,flash:1},{...aim,'shR.x':-102,'elR.x':-12,'chest.x':-6,'neck.x':-4,x:-.015},
    {...aim,'shR.x':-92,'chest.x':-2},aim,{...aim,'shR.x':-97,'elR.x':-6,'chest.x':-5,'neck.x':-3,x:-.012,flash:1},aim],t)}},
  wave:{label:'Saluto',n:8,fps:10,loop:true,f:t=>{const s=Math.sin(TAU*t),o={'shR.z':150,'shR.x':-10,'elR.z':-25+28*s,'elR.x':-8,'chest.z':-3,'neck.z':4*s,'neck.x':-3,'shL.z':-4};return o}},
  hurt:{label:'Colpito',n:5,fps:12,loop:false,f:t=>keyedPose([
    {'abd.x':-16,'chest.x':-10,'neck.x':-20,'shL.z':-35,'shR.z':35,'shL.x':-20,'shR.x':-20,'elL.x':-35,'elR.x':-35,'knL.x':12,'knR.x':12,x:-.04,tint:'#ff3b30'},
    {'abd.x':-10,'chest.x':-6,'neck.x':-12,'shL.z':-22,'shR.z':22,'elL.x':-25,'elR.x':-25,'knL.x':8,'knR.x':8,x:-.03},
    {'abd.x':-6,'neck.x':-6,'shL.z':-12,'shR.z':12,'elL.x':-15,'elR.x':-15,x:-.015,tint:'#ff3b30'},
    {'abd.x':-2,'shL.z':-4,'shR.z':4},{}],t)},
  death:{label:'Sconfitta',n:10,fps:10,loop:false,f:t=>keyedPose([
    {},
    {'abd.x':-14,'neck.x':-18,'knL.x':16,'knR.x':16,'shL.z':-20,'shR.z':20,'elL.x':-20,'elR.x':-20},
    {'abd.x':-10,'neck.x':-14,'hipL.x':-25,'hipR.x':-20,'knL.x':48,'knR.x':40,'shL.z':-30,'shR.z':30},
    {'body.x':-22,'hipL.x':-30,'hipR.x':-24,'knL.x':50,'knR.x':42,'shL.z':-40,'shR.z':40,'shL.x':-30,'shR.x':-30},
    {'body.x':-48,'hipL.x':-26,'hipR.x':-20,'knL.x':38,'knR.x':30,'shL.z':-55,'shR.z':55,'shL.x':-50,'shR.x':-50},
    {'body.x':-74,'hipL.x':-16,'hipR.x':-12,'knL.x':22,'knR.x':18,'shL.z':-70,'shR.z':70,'shL.x':-60,'shR.x':-60},
    {'body.x':-92,'hipL.x':-8,'knL.x':8,'shL.z':-80,'shR.z':80,'shL.x':-40,'shR.x':-40,'neck.x':6},
    {'body.x':-86,'hipL.x':-10,'knL.x':10,'shL.z':-82,'shR.z':82,'shL.x':-30,'shR.x':-30,'neck.x':8},
    {'body.x':-90,'shL.z':-85,'shR.z':85,'shL.x':-20,'shR.x':-20,'neck.x':4},
    {'body.x':-90,'shL.z':-85,'shR.z':85,'shL.x':-15,'shR.x':-15,'neck.x':2}],t)},
 },
 obj:{
  float:{label:'Fluttua',n:8,fps:8,loop:true,f:t=>{const k=(1-Math.cos(TAU*t))/2;return{lift:.08*k}}},
  bounce:{label:'Rimbalza',n:8,fps:12,loop:true,f:t=>{const h=Math.sin(Math.PI*t);return h<.18?{sy:.86,sx:1.1}:{lift:.32*h,sy:1+.06*h,sx:1-.04*h}}},
  spin:{label:'Gira su sé stesso',n:12,fps:12,loop:true,f:t=>({'body.y':360*t})},
  pulse:{label:'Pulsa',n:6,fps:8,loop:true,f:t=>({scale:1+.08*Math.sin(TAU*t)})},
  shake:{label:'Trema',n:6,fps:15,loop:true,f:t=>({x:.03*Math.sin(TAU*t*2),'body.z':5*Math.sin(TAU*t*3)})},
 }
};
function poseFor(kind,key,i,n,amp){const d=ANIMS[kind][key],t=d.loop?i/n:(n>1?i/(n-1):0);return scalePose(d.f(t),amp)}

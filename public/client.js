import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const socket = io({ reconnection: true, reconnectionAttempts: Infinity, timeout: 8000 });
const $ = id => document.getElementById(id);
const ui = { lobby:$('lobby'), waiting:$('waiting'), hud:$('hud'), name:$('playerName'), code:$('roomCode'), notice:$('notice'), primary:$('primaryAction'), joinWrap:$('joinCodeWrap') };
let tab = 'create', roomCode = null, myId = null, myName = '', roomState = null, ready = false, raceStartAt = null, countdownTimer = null;
const keys = new Set(), cars = new Map(), clock = new THREE.Clock();
let cameraMode = 0, lastInput = 0, toastTimer;
const itemMeshes = new Map();

const levelSelect = $('levelSelect');
if (levelSelect) {
  for (let n = 1; n <= 50; n++) {
    const option = document.createElement('option');
    option.value = String(n); option.textContent = `LEVEL ${String(n).padStart(2,'0')}${n===1?' — STARTER':n>=10?' — EXTREME':n>=5?' — HARD':''}`;
    levelSelect.appendChild(option);
  }
}
function updateLevelPicker(level, isHost) {
  if (!levelSelect) return;
  levelSelect.value = String(Math.max(1, Math.min(50, Number(level)||1)));
  levelSelect.disabled = !isHost;
  $('levelMinus').disabled = !isHost || Number(levelSelect.value) <= 1;
  $('levelPlus').disabled = !isHost || Number(levelSelect.value) >= 50;
  $('levelDifficulty').textContent = Number(levelSelect.value) === 1 ? 'LEVEL 1 · WARM-UP' : Number(levelSelect.value) < 5 ? 'LEVEL ' + levelSelect.value + ' · BUILDING PRESSURE' : Number(levelSelect.value) < 10 ? 'LEVEL ' + levelSelect.value + ' · HARD' : 'LEVEL ' + levelSelect.value + ' · EXTREME';
}
if (levelSelect) {
  levelSelect.addEventListener('change', () => socket.emit('setLevel', Number(levelSelect.value)));
  $('levelMinus').addEventListener('click', () => { levelSelect.value = String(Math.max(1, Number(levelSelect.value)-1)); levelSelect.dispatchEvent(new Event('change')); });
  $('levelPlus').addEventListener('click', () => { levelSelect.value = String(Math.min(50, Number(levelSelect.value)+1)); levelSelect.dispatchEvent(new Event('change')); });
}

const themes = [ {bg:0x070817,fog:0x08091d,cyan:0x00eaff,pink:0xff2bd6,ground:0x070b18}, {bg:0x16091c,fog:0x190b21,cyan:0xff7a36,pink:0xffd166,ground:0x13091b}, {bg:0x06131b,fog:0x071b24,cyan:0x53ffd1,pink:0x4da6ff,ground:0x061018}, {bg:0x101020,fog:0x111127,cyan:0xb69cff,pink:0xff4f9a,ground:0x090918}, {bg:0x0c1018,fog:0x0c1721,cyan:0xb7f7ff,pink:0x78a9ff,ground:0x080e16} ];
let activeTheme = 0;
// Procedural Web Audio effects: no external sound files or extra downloads required.
let soundEnabled = true, audioContext = null, engineOsc = null, engineGain = null, lastSoundSpeed = 0, lastDriftSound = 0, lastEngineUpdate = 0;
function initAudio(){ if(!soundEnabled) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return; if(!audioContext){audioContext=new AC();engineOsc=audioContext.createOscillator();engineOsc.type='sawtooth';engineGain=audioContext.createGain();engineGain.gain.value=0.0001;engineOsc.connect(engineGain);engineGain.connect(audioContext.destination);engineOsc.start();} if(audioContext.state==='suspended')audioContext.resume(); }
function tone(freq=440,duration=.12,type='sine',volume=.045,slide=0){if(!soundEnabled)return;initAudio();if(!audioContext)return;const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=type;osc.frequency.setValueAtTime(Math.max(40,freq),now);if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),now+duration);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+duration+.02);}
function sfx(kind){if(!soundEnabled)return; if(kind==='coin'){tone(880,.08,'sine',.04,260);setTimeout(()=>tone(1320,.1,'sine',.035,100),55);}else if(kind==='nitro'){tone(180,.22,'sawtooth',.05,720);}else if(kind==='hit'){tone(125,.28,'square',.07,-75);tone(75,.24,'triangle',.05,-30);}else if(kind==='count'){tone(520,.09,'square',.035,-90);}else if(kind==='go'){tone(440,.12,'triangle',.05,260);setTimeout(()=>tone(760,.22,'triangle',.05,250),100);}else if(kind==='finish'){tone(523,.16,'triangle',.05,0);setTimeout(()=>tone(659,.16,'triangle',.05,0),130);setTimeout(()=>tone(784,.28,'triangle',.05,200),260);}else if(kind==='drift'){tone(95,.09,'sawtooth',.018,-20);}}
function updateEngineSound(){if(!soundEnabled||!audioContext||!engineOsc||!engineGain||audioContext.currentTime-lastEngineUpdate<.1)return;lastEngineUpdate=audioContext.currentTime;const mine=roomState?.players?.find(p=>p.id===myId);const speed=mine&&roomState.status==='racing'?Math.abs(mine.speed):0;engineOsc.frequency.setTargetAtTime(55+speed*5.2,audioContext.currentTime,.08);engineGain.gain.setTargetAtTime(speed>1?.012+Math.min(speed/48,.8)*.035:.0001,audioContext.currentTime,.12);}

function showToast(msg){ const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800); }
function notice(msg=''){ui.notice.textContent=msg;}
function showScreen(screen){ui.lobby.classList.toggle('hidden',screen!=='lobby');ui.waiting.classList.toggle('hidden',screen!=='waiting');ui.hud.classList.toggle('hidden',screen!=='hud');}
function nameValue(){return ui.name.value.trim().slice(0,16)||'NIGHTDRIVER';}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));ui.joinWrap.classList.toggle('hidden',tab!=='join');ui.primary.querySelector('span').textContent=tab==='create'?'CREATE PRIVATE ROOM':'JOIN THE GRID';notice('');}));
$('carSkin').addEventListener('change',()=>socket.emit('setCarColor',$('carSkin').value));
$('soundToggle').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('soundToggle').textContent=soundEnabled?'♫ SOUND ON':'♫ SOUND OFF';$('soundToggle').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled){initAudio();tone(660,.08,'sine',.025,100);}else if(engineGain&&audioContext)engineGain.gain.setTargetAtTime(.0001,audioContext.currentTime,.05);});
ui.primary.addEventListener('click',()=>{initAudio();myName=nameValue();notice('');if(tab==='create')socket.emit('createRoom',{name:myName,level:Number($('levelSelect').value)||1});else{const code=ui.code.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);if(code.length<4)return notice('Enter a valid room code.');socket.emit('joinRoom',{code,name:myName});}});
$('copyCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(roomCode);showToast('ROOM CODE COPIED');}catch{showToast('ROOM CODE: '+roomCode);}});
$('readyButton').addEventListener('click',()=>{initAudio();ready=!ready;socket.emit('setReady',ready);$('readyButton').querySelector('span').textContent=ready?'CANCEL READY':'READY UP';});
$('leaveButton').addEventListener('click',()=>{location.reload();});
$('backToLobby').addEventListener('click',()=>{ if(roomState?.status==='finished') socket.emit('nextLevel'); else location.reload(); });
socket.on('connect',()=>{$('connection').textContent='SYSTEM ONLINE';$('connection').style.color='#8eff80';if(roomCode){socket.emit('rejoinRoom',{code:roomCode,name:myName});}});
socket.on('disconnect',()=>{$('connection').textContent='RECONNECTING';$('connection').style.color='#ff719c';});
socket.on('connect_error',()=>{$('connection').textContent='CONNECTION LOST';});
socket.on('notice',d=>{notice(d.message);showToast(d.message);});
socket.on('joined',d=>{roomCode=d.code;myId=d.id;myName=d.name;ready=false;socket.emit('setCarColor',$('carSkin').value);if(d.reconnected)showToast('RECONNECTED TO GRID');$('roomCodeDisplay').textContent=roomCode;ui.primary.disabled=false;showScreen('waiting');notice('');});
socket.on('state',s=>{roomState=s;updateLevelPicker(s.level, s.hostId===myId);syncItems(s.items||[]);if(!ui.hud.classList.contains('hidden')||s.status==='racing'||s.status==='countdown'||s.status==='finished'){showScreen('hud');}else if(s.status==='lobby')showScreen('waiting');renderPlayers(s);renderLeaderboard(s);if(s.status==='racing')$('raceStatus').textContent='RACE IN PROGRESS';if(s.status==='finished')showFinish(s);});
socket.on('countdown',d=>{initAudio();sfx('count');raceStartAt=d.at;showScreen('hud');$('countdown').classList.remove('hidden');});
socket.on('countdownCancelled',()=>{raceStartAt=null;$('countdown').classList.add('hidden');showToast('COUNTDOWN CANCELLED — ALL RACERS MUST BE READY');});
socket.on('raceStart',()=>{sfx('go');$('countdown').classList.add('hidden');$('raceStatus').textContent='GO! GO! GO!';showScreen('hud');});
socket.on('playerFinished',d=>{if(d.id===myId)sfx('finish');if(d.id===myId)showToast('FINISH LINE CROSSED!');else showToast(`${d.name} FINISHED THE LEVEL`);});
socket.on('hazardHit',d=>{if(d.id===myId){sfx('hit');showToast(d.type==='barrier'?'SOLID BARRIER IMPACT — SPEED LOST':'MINE HIT — NITRO DRAINED');if(d.type==='barrier'){const canvas=document.querySelector('#game canvas');if(canvas){canvas.classList.remove('impact-shake');void canvas.offsetWidth;canvas.classList.add('impact-shake');setTimeout(()=>canvas.classList.remove('impact-shake'),320);}}}});
socket.on('buildingHit',d=>{if(d.id===myId){
  sfx('hit'); showToast('HARD IMPACT — BODYWORK HIT THE BUILDING');
  const canvas=document.querySelector('#game canvas');
  if(canvas){canvas.classList.remove('impact-shake');void canvas.offsetWidth;canvas.classList.add('impact-shake');setTimeout(()=>canvas.classList.remove('impact-shake'),320);}
}});
socket.on('itemCollected',d=>{sfx(d.type==='nitro'?'nitro':'coin');});
socket.on('levelStart',d=>{sfx('go');showToast(`LEVEL ${d.level} // NEW ENVIRONMENT`);});
socket.on('raceFinished',s=>showFinish(s));
function renderPlayers(s){if(s.status!=='lobby')return;const players=s.players||[];$('playerCount').textContent=`${players.length} / 8`;$('playerList').innerHTML=players.map(p=>`<div class="player-row"><span class="player-swatch" style="color:${p.color};background:${p.color}"></span><span class="player-name">${escapeHtml(p.name)}${p.id===myId?' <small>(YOU)</small>':''}</span><span class="player-status ${p.ready?'ready':''}">${p.ready?'READY':'STANDBY'}</span></div>`).join('');}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderLeaderboard(s){$('levelValue').textContent=String(s.level||1).padStart(2,'0');const ps=[...(s.players||[])].sort((a,b)=>a.finished!==b.finished?(a.finished?-1:1):(a.finished&&b.finished&&a.finishTime!=null&&b.finishTime!=null?a.finishTime-b.finishTime:b.progress-a.progress));const me=ps.findIndex(p=>p.id===myId);$('positionValue').innerHTML=`${me>=0?String(me+1).padStart(2,'0'):'—'}<em> / ${String(ps.length).padStart(2,'0')}</em>`;$('leaderboard').innerHTML=ps.map((p,i)=>`<div class="leader-row ${p.id===myId?'me':''}"><span class="rank">${String(i+1).padStart(2,'0')}</span><i class="leader-color" style="background:${p.color}"></i><span class="leader-name">${escapeHtml(p.name)}</span><span class="leader-lap">${p.finished?'FIN':`${Math.floor(p.progress||0)}%`}</span></div>`).join('');const mine=(s.players||[]).find(p=>p.id===myId);if(mine){$('lapValue').innerHTML=`${String(Math.max(0,Math.min(100,Math.floor(mine.progress||0)))).padStart(2,'0')}<span> / 100</span>`;$('lapFill').style.width=`${Math.min(100,mine.progress||0)}%`;if($('coinValue'))$('coinValue').textContent=String(mine.coins||0).padStart(3,'0');if($('challengeValue'))$('challengeValue').textContent=`${Math.min(10,mine.levelCoins||0)}/10`;if($('nitroValue'))$('nitroValue').textContent=Math.round(mine.nitro)+'%';$('nitroFill').style.width=mine.nitro+'%';$('speedValue').innerHTML=`${String(Math.round(Math.abs(mine.speed)*3.6)).padStart(3,'0')}<span> KM/H</span>`;$('speedFill').style.width=Math.min(100,Math.abs(mine.speed)/48*100)+'%';$('gearValue').textContent='GEAR '+Math.max(1,Math.min(6,Math.floor(Math.abs(mine.speed)/7)+1));}}
function showFinish(s){$('countdown').classList.add('hidden');$('finishBanner').classList.remove('hidden');const ps=[...(s.players||[])].sort((a,b)=>a.finished!==b.finished?(a.finished?-1:1):(a.finished&&b.finished&&a.finishTime!=null&&b.finishTime!=null?a.finishTime-b.finishTime:b.progress-a.progress));const rank=ps.findIndex(p=>p.id===myId)+1;const mine=ps.find(p=>p.id===myId);const winner=ps[0];$('finishTitle').textContent=winner?.id===myId?'YOU WIN!':rank?`POSITION ${rank}`:'RACE COMPLETE';const time=mine?.finishTime?` • TIME ${(mine.finishTime/1000).toFixed(2)} SEC`: ' • TIME LIMIT';const bestKey='neonRushBestLevel'+(s.level||1);const elapsed=mine?.finishTime||s.raceElapsed||0;let record='';if(mine?.finishTime){const old=Number(localStorage.getItem(bestKey)||0);if(!old||elapsed<old){localStorage.setItem(bestKey,String(elapsed));record=' • NEW PERSONAL BEST';}}$('finishText').textContent=`LEVEL ${s.level||1} COMPLETE${time} • ${mine?.levelCoins||0} COINS • ${mine?.hits||0} HITS${record}. ${winner?.name||'No racer'} leads the results.`;$('backToLobby').querySelector('span').textContent='NEXT LEVEL';$('raceStatus').textContent='LEVEL COMPLETE';}

const scene = new THREE.Scene();scene.background=new THREE.Color(0x070817);scene.fog=new THREE.FogExp2(0x08091d,.0055);
const camera = new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,1200);
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;$('game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x7a9aff,0x130c2e,2.0));const keyLight=new THREE.DirectionalLight(0x9ddcff,2.2);keyLight.position.set(-25,55,20);keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);scene.add(keyLight);
const mat=(color,roughness=.7,metalness=.1,emissive=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity:emissive?1.2:0});
const asphalt=mat(0x11152a,.92), groundMat=mat(0x070b18,1), buildingMats=[mat(0x10172f,.8,.3),mat(0x17122e,.7,.3),mat(0x111d30,.8,.2)];
// Ground is rebuilt with each generated level so the road remains visible at any distance.
function roadPlane(w,d,x,z){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),asphalt);m.rotation.x=-Math.PI/2;m.position.set(x,-.05,z);m.receiveShadow=true;scene.add(m);return m;}
// Procedurally generated winding road. The same seeded formula is mirrored by the server.
const LEVEL_LENGTH = 2600, TRACK_STEP = 20;
function centerAt(z, level=(roomState?.level||1)) {
  const seg=Math.max(0,Math.min(Math.floor(z/TRACK_STEP),LEVEL_LENGTH/TRACK_STEP)), t=z/TRACK_STEP;
  const difficulty=Math.min(Math.max(level-1,0)*.55,7);const offset=i=>Math.max(-24,Math.min(24,Math.sin((i+level*17)*1.731)*(10+difficulty)+Math.sin((i+level*7)*.713)*(6+difficulty*.55)));
  return offset(seg)+(offset(Math.min(seg+1,LEVEL_LENGTH/TRACK_STEP))-offset(seg))*(t-seg);
}
let trackLevelBuilt = 0; const trackMeshes = [];
function applyTheme(level){activeTheme=(level-1)%themes.length;const t=themes[activeTheme];scene.background=new THREE.Color(t.bg);scene.fog.color.setHex(t.fog);groundMat.color.setHex(t.ground);document.documentElement.style.setProperty('--cyan','#'+t.cyan.toString(16).padStart(6,'0'));document.documentElement.style.setProperty('--pink','#'+t.pink.toString(16).padStart(6,'0'));}
function clearItems(){for(const m of itemMeshes.values()){scene.remove(m);m.traverse?.(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(x=>x.dispose());else o.material.dispose();}});}itemMeshes.clear();}
function syncItems(items=[]){const ids=new Set(items.map(i=>i.id));for(const [id,m] of itemMeshes){if(!ids.has(id)){scene.remove(m);itemMeshes.delete(id);}}for(const item of items){let mesh=itemMeshes.get(item.id);if(!mesh){if(item.type==='coin'||item.type==='nitro'){mesh=new THREE.Mesh(item.type==='coin'?new THREE.TorusGeometry(.58,.16,8,16):new THREE.OctahedronGeometry(.62),new THREE.MeshStandardMaterial({color:item.type==='coin'?0xffd64f:0x00f5ff,emissive:item.type==='coin'?0xff9e00:0x00dfff,emissiveIntensity:1.7,metalness:.4,roughness:.25}));mesh.position.set(item.x,1.15,item.z);mesh.rotation.x=Math.PI/2;}else{mesh=new THREE.Group();const color=item.type==='barrier'?0xff2b76:0xff6b24;const core=new THREE.Mesh(new THREE.BoxGeometry(3.4,item.type==='barrier'?1.5:.8,.8),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.25,metalness:.3}));core.position.y=item.type==='barrier'?.85:.45;mesh.add(core);if(item.type==='mine'){const spike=new THREE.Mesh(new THREE.ConeGeometry(.6,1.1,6),new THREE.MeshBasicMaterial({color:0xffcf55}));spike.position.y=1.15;mesh.add(spike);}mesh.position.set(item.x,0,item.z);}mesh.userData.itemId=item.id;scene.add(mesh);itemMeshes.set(item.id,mesh);}const unavailable=item.type==='coin'||item.type==='nitro'?(item.collectedBy||[]).includes(myId):false;mesh.visible=!unavailable;}}

function clearTrack(){for(const m of trackMeshes){scene.remove(m);m.geometry?.dispose();if(m.material?.dispose)m.material.dispose();}trackMeshes.length=0;}
function buildTrack(level=1){clearTrack();clearItems();trackLevelBuilt=level;applyTheme(level);
  const add=(mesh)=>{scene.add(mesh);trackMeshes.push(mesh);return mesh;};
  const roadMat=asphalt;const roadWidth=Math.max(18,25-Math.min(Math.max(level-1,0),8)*.875);
  for(let z=0;z<LEVEL_LENGTH;z+=TRACK_STEP){const x1=centerAt(z,level),x2=centerAt(z+TRACK_STEP,level),mx=(x1+x2)/2,mz=z+TRACK_STEP/2,angle=Math.atan2(x2-x1,TRACK_STEP);
    const road= new THREE.Mesh(new THREE.PlaneGeometry(roadWidth,Math.hypot(TRACK_STEP,x2-x1)),roadMat);road.rotation.x=-Math.PI/2;road.rotation.z=angle;road.position.set(mx,-.05,mz);road.receiveShadow=true;add(road);
    for(const side of [-1,1]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.18,.08,Math.hypot(TRACK_STEP,x2-x1)),new THREE.MeshBasicMaterial({color:side<0?themes[(level-1)%themes.length].cyan:themes[(level-1)%themes.length].pink}));rail.position.set(mx+side*(roadWidth/2),.03,mz);rail.rotation.y=angle;add(rail);}
    if(z%80===0){const beacon=new THREE.Mesh(new THREE.BoxGeometry(1.2,4,.6),new THREE.MeshBasicMaterial({color:level%2?themes[(level-1)%themes.length].cyan:themes[(level-1)%themes.length].pink}));beacon.position.set(x1+17,2,z+2);add(beacon);}
  }
  // A prominent checkered winning gate at every level's endpoint.
  const endX=centerAt(LEVEL_LENGTH,level);const gateMat=new THREE.MeshBasicMaterial({color:themes[(level-1)%themes.length].cyan});
  for(let i=0;i<16;i++){const tile=new THREE.Mesh(new THREE.BoxGeometry(roadWidth/16,.12,1.5),new THREE.MeshBasicMaterial({color:i%2?0x080817:0xf5fbff}));tile.position.set(endX-roadWidth/2+(i+.5)*(roadWidth/16),.05,LEVEL_LENGTH);add(tile);}
  for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(.7,7,.7),new THREE.MeshBasicMaterial({color:themes[(level-1)%themes.length].pink}));post.position.set(endX+side*(roadWidth/2+0.8),3.5,LEVEL_LENGTH);add(post);}
  const arch=new THREE.Mesh(new THREE.BoxGeometry(roadWidth+2,.45,.6),new THREE.MeshBasicMaterial({color:themes[(level-1)%themes.length].cyan}));arch.position.set(endX,7,LEVEL_LENGTH);add(arch);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(300,LEVEL_LENGTH+100),groundMat);ground.rotation.x=-Math.PI/2;ground.position.set(0,-.22,LEVEL_LENGTH/2);add(ground);
  const grid=new THREE.GridHelper(300,60,0x13214a,0x10172e);grid.position.set(0,-.17,LEVEL_LENGTH/2);add(grid);
}
buildTrack(1);
function addBuilding(x,z,w,h,d,i){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),buildingMats[i%buildingMats.length]);mesh.position.set(x,h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);const c=i%2?0xff2bd6:0x00eaff;for(let y=2;y<h-1;y+=4){const strip=new THREE.Mesh(new THREE.BoxGeometry(w*.76,.12,.06),new THREE.MeshBasicMaterial({color:c}));strip.position.set(x,y,z-d/2-.04);scene.add(strip);}const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.3,.12,d+.3),new THREE.MeshBasicMaterial({color:c}));roof.position.set(x,h,z);scene.add(roof);}
let seed=713;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
for(let side of [-1,1])for(let z=10;z<LEVEL_LENGTH;z+=36){const w=5+rand()*8,h=10+rand()*30,d=6+rand()*8;addBuilding(side*(42+rand()*12),z+rand()*5,w,h,d,Math.floor(rand()*3));}
// glowing billboards, pylons and street lights
for(let z=-82;z<=82;z+=18){for(const side of [-1,1]){const pole=new THREE.Mesh(new THREE.BoxGeometry(.18,7,.18),mat(0x343b60));pole.position.set(side*63,3.5,z);scene.add(pole);const lamp=new THREE.Mesh(new THREE.BoxGeometry(2.6,.1,.35),new THREE.MeshBasicMaterial({color:side<0?0x00f5ff:0xff2bd6}));lamp.position.set(side*63,7,z);scene.add(lamp);}}
const grid=new THREE.GridHelper(500,100,0x13214a,0x10172e);grid.position.y=-.17;scene.add(grid);
function makeCar(color=0x00f5ff){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(1.65,.52,3.2),new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.25,emissive:color,emissiveIntensity:.12}));body.position.y=.65;body.castShadow=true;g.add(body);const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.12,.48,1.45),mat(0x111b35,.25,.7));cabin.position.set(0,1.08,-.15);g.add(cabin);const windshield=new THREE.Mesh(new THREE.BoxGeometry(1.03,.28,.08),new THREE.MeshBasicMaterial({color:0x65faff}));windshield.position.set(0,1.12,.58);g.add(windshield);const front=new THREE.Mesh(new THREE.BoxGeometry(1.35,.12,.12),new THREE.MeshBasicMaterial({color:0xf4ffff}));front.position.set(0,.62,1.59);g.add(front);const tail=new THREE.Mesh(new THREE.BoxGeometry(1.25,.12,.12),new THREE.MeshBasicMaterial({color:0xff174f}));tail.position.set(0,.62,-1.59);g.add(tail);for(const x of [-.82,.82])for(const z of [-1,1]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.18,12),mat(0x05060c,.9));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.35,z);g.add(wheel);}const glow=new THREE.PointLight(color,1.5,7);glow.position.set(0,.4,-1.6);g.add(glow);return g;}
function ensureCar(p){let entry=cars.get(p.id);if(!entry||entry.color!==p.color){if(entry)scene.remove(entry.mesh);const color=new THREE.Color(p.color).getHex();entry={mesh:makeCar(color),target:new THREE.Vector3(p.x,0,p.z),heading:p.heading,color:p.color};scene.add(entry.mesh);cars.set(p.id,entry);}entry.target.set(p.x,0,p.z);entry.heading=p.heading;entry.mesh.userData.player=p.id;return entry;}
function updateCars(){if(!roomState)return;const active=new Set();for(const p of roomState.players){active.add(p.id);const e=ensureCar(p);e.mesh.position.lerp(e.target,.28);e.mesh.rotation.y=THREE.MathUtils.lerp(e.mesh.rotation.y,e.heading,.2);}for(const [id,e] of cars)if(!active.has(id)){scene.remove(e.mesh);cars.delete(id);}}
const particleGroup=new THREE.Group();scene.add(particleGroup);
function spawnBoost(car){if(Math.random()>.28)return;const color=car.material?.color?.getHex()||0x00f5ff;const m=new THREE.Mesh(new THREE.SphereGeometry(.07,5,5),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7}));m.position.copy(car.position);m.position.y=.4;m.userData.life=.35;particleGroup.add(m);}
function updateCamera(){const mine=cars.get(myId);if(!mine)return;const m=mine.mesh;const forward=new THREE.Vector3(Math.sin(m.rotation.y),0,Math.cos(m.rotation.y));let desired,look;if(cameraMode===0){desired=m.position.clone().addScaledVector(forward,-9).add(new THREE.Vector3(0,5,0));look=m.position.clone().addScaledVector(forward,5).add(new THREE.Vector3(0,1,0));}else if(cameraMode===1){desired=m.position.clone().add(new THREE.Vector3(0,18,0)).addScaledVector(forward,-3);look=m.position.clone();}else{desired=m.position.clone().add(new THREE.Vector3(0,2.2,0)).addScaledVector(forward,2.8);look=m.position.clone().addScaledVector(forward,20);}camera.position.lerp(desired,.11);camera.lookAt(look);}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='c')cameraMode=(cameraMode+1)%3;});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
document.querySelectorAll('[data-key]').forEach(btn=>{const k=btn.dataset.key;const down=e=>{e.preventDefault();keys.add(k);btn.classList.add('pressed');};const up=e=>{e.preventDefault();keys.delete(k);btn.classList.remove('pressed');};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);});
function sendInput(){if(!roomState||roomState.status!=='racing'||!myId)return;const now=performance.now();if(soundEnabled&&(keys.has(' ')||keys.has('space'))&&now-lastDriftSound>450){const mine=roomState.players.find(p=>p.id===myId);if(mine&&Math.abs(mine.speed)>10){sfx('drift');lastDriftSound=now;}}if(now-lastInput<45)return;lastInput=now;socket.emit('input',{throttle:keys.has('w')||keys.has('arrowup'),brake:keys.has('s')||keys.has('arrowdown'),left:keys.has('a')||keys.has('arrowleft'),right:keys.has('d')||keys.has('arrowright'),drift:keys.has(' '),boost:keys.has('shift')});}
function animate(){requestAnimationFrame(animate);updateEngineSound();if(roomState?.level&&roomState.level!==trackLevelBuilt){buildTrack(roomState.level);syncItems(roomState.items||[]);}const dt=Math.min(clock.getDelta(),.05);updateCars();sendInput();updateCamera();if(raceStartAt){const left=Math.ceil((raceStartAt-Date.now())/1000);if(left>0)$('countdown').textContent=left;else{$('countdown').classList.add('hidden');raceStartAt=null;}}for(let i=particleGroup.children.length-1;i>=0;i--){const p=particleGroup.children[i];p.userData.life-=dt;p.position.y+=dt*1.3;p.material.opacity=Math.max(0,p.userData.life/.35);if(p.userData.life<=0){particleGroup.remove(p);p.geometry.dispose();p.material.dispose();}}for(const m of itemMeshes.values())if(m.visible&&(m.geometry?.type==='TorusGeometry'||m.geometry?.type==='OctahedronGeometry')){m.rotation.z+=dt*1.8;m.position.y=1.15+Math.sin(performance.now()*.003+m.position.z)*.16;}if(roomState&&roomState.status==='racing'&&keys.has('shift')){const e=cars.get(myId);if(e&&Math.random()<.8)spawnBoost(e.mesh);}renderer.render(scene,camera);}
animate();

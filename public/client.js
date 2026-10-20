import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const socket = io({ reconnection: true, reconnectionAttempts: Infinity, timeout: 8000 });
const $ = id => document.getElementById(id);
const ui = { lobby:$('lobby'), waiting:$('waiting'), hud:$('hud'), name:$('playerName'), code:$('roomCode'), notice:$('notice'), primary:$('primaryAction'), joinWrap:$('joinCodeWrap') };
let tab = 'create', roomCode = null, myId = null, myName = '', roomState = null, ready = false, raceStartAt = null, countdownTimer = null;
const keys = new Set(), cars = new Map(), clock = new THREE.Clock();
let cameraMode = 0, lastInput = 0, toastTimer;
const itemMeshes = new Map();
const GARAGE_CARS = [
 {id:'neon-gt',name:'NEON GT',type:'sports',color:'#00f5ff',speed:78,handling:82,price:0,wins:0,free:true},
 {id:'street-sport',name:'STREET SPORT',type:'sports',color:'#ff2bd6',speed:80,handling:78,price:0,wins:0,free:true},
 {id:'city-suv',name:'CITY SUV',type:'suv',color:'#f8f7ff',speed:68,handling:76,price:0,wins:0,free:true},
 {id:'muscle-r',name:'MUSCLE R',type:'muscle',color:'#ff8a00',speed:82,handling:69,price:0,wins:0,free:true},
 {id:'electric-x',name:'ELECTRIC X',type:'electric',color:'#b6ff00',speed:77,handling:85,price:0,wins:0,free:true},
 {id:'rally-rs',name:'RALLY RS',type:'rally',color:'#ff3864',speed:73,handling:88,price:0,wins:0,free:true},
 {id:'retro-coupe',name:'RETRO COUPE',type:'muscle',color:'#9b6bff',speed:76,handling:72,price:0,wins:0,free:true},
 {id:'track-day',name:'TRACK DAY',type:'hyper',color:'#32ffb4',speed:84,handling:86,price:0,wins:0,free:true},
 {id:'bmw-m4',name:'BMW M4 STYLE',type:'sports',color:'#2e8bff',speed:88,handling:86,price:700,wins:1},
 {id:'range-sport',name:'RANGE ROVER STYLE',type:'suv',color:'#d7d8dc',speed:75,handling:80,price:850,wins:1},
 {id:'porsche-911',name:'911 CARRERA STYLE',type:'sports',color:'#f4f4f4',speed:90,handling:91,price:1000,wins:2},
 {id:'supra',name:'JDM SUPRA STYLE',type:'sports',color:'#ff5b25',speed:86,handling:83,price:900,wins:2},
 {id:'gtr',name:'GT-R STYLE',type:'sports',color:'#a8b2c5',speed:89,handling:84,price:1100,wins:2},
 {id:'g-class',name:'LUX G-STYLE SUV',type:'suv',color:'#22252b',speed:74,handling:78,price:950,wins:2},
 {id:'urus',name:'URUS STYLE SUV',type:'suv',color:'#d8c500',speed:87,handling:82,price:1250,wins:3},
 {id:'mustang',name:'MUSTANG STYLE',type:'muscle',color:'#ef2727',speed:88,handling:76,price:1200,wins:3},
 {id:'challenger',name:'CHALLENGER STYLE',type:'muscle',color:'#4b6fff',speed:86,handling:73,price:1150,wins:3},
 {id:'ferrari-red',name:'ITALIAN V12 STYLE',type:'hyper',color:'#e51e2a',speed:94,handling:90,price:1800,wins:4},
 {id:'mclaren',name:'PAPAYA HYPER STYLE',type:'hyper',color:'#ff8b32',speed:96,handling:92,price:2100,wins:5},
 {id:'lamborghini',name:'V12 HYPER STYLE',type:'hyper',color:'#c7ed22',speed:97,handling:89,price:2200,wins:5},
 {id:'audi-rs',name:'RS SPORT STYLE',type:'sports',color:'#c3c8cf',speed:88,handling:87,price:1450,wins:3},
 {id:'mercedes-amg',name:'AMG GT STYLE',type:'sports',color:'#11151b',speed:91,handling:88,price:1600,wins:4},
 {id:'aston',name:'GRAND TOURER',type:'sports',color:'#17634c',speed:87,handling:85,price:1500,wins:4},
 {id:'tesla',name:'E-SPORT SEDAN',type:'electric',color:'#f5f5f5',speed:89,handling:87,price:1500,wins:3},
 {id:'offroad',name:'OFFROAD 4X4',type:'suv',color:'#a88a59',speed:70,handling:84,price:1000,wins:2},
 {id:'rally-pro',name:'RALLY PRO',type:'rally',color:'#fcdb00',speed:82,handling:93,price:1450,wins:3},
 {id:'drift-king',name:'DRIFT KING',type:'sports',color:'#ff36a8',speed:85,handling:96,price:1600,wins:4},
 {id:'time-attack',name:'TIME ATTACK',type:'hyper',color:'#12d8cf',speed:95,handling:95,price:2300,wins:6},
 {id:'concept-z',name:'CONCEPT Z',type:'electric',color:'#b6ff00',speed:92,handling:94,price:2200,wins:6},
 {id:'night-hawk',name:'NIGHT HAWK',type:'muscle',color:'#5e5e75',speed:90,handling:81,price:1800,wins:5},
 {id:'royal-suv',name:'ROYAL LUX SUV',type:'suv',color:'#0e4b3e',speed:79,handling:83,price:1700,wins:4},
 {id:'apex-one',name:'APEX ONE',type:'hyper',color:'#7c5cff',speed:99,handling:97,price:3000,wins:8}
];
const garageRead=(key,fallback)=>{try{const v=localStorage.getItem(key);return v===null?fallback:JSON.parse(v);}catch{return fallback;}};
let garageCredits=Number(localStorage.getItem('neonGarageCredits')||0), garageWins=Number(localStorage.getItem('neonGarageWins')||0);
let garageOwned=new Set(garageRead('neonGarageOwned',['neon-gt','street-sport','city-suv','muscle-r','electric-x','rally-rs','retro-coupe','track-day']));
let selectedCarId=localStorage.getItem('neonSelectedCar')||'neon-gt', garagePreviewScene=null, garagePreviewCamera=null, garagePreviewRenderer=null, garagePreviewCar=null, garageOpen=false, creditedFinishKey='';
if(!GARAGE_CARS.some(c=>c.id===selectedCarId)||!garageOwned.has(selectedCarId))selectedCarId='neon-gt';

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

const themes = [ {bg:0x9bbbd2,fog:0xa8c4d6,cyan:0x27d9ff,pink:0xff536b,ground:0x3d6240}, {bg:0xffb77a,fog:0xc58c70,cyan:0xffa34d,pink:0xffd166,ground:0x4e5940}, {bg:0x8299a4,fog:0x8299a4,cyan:0x6de6db,pink:0x78a9ff,ground:0x344e3d}, {bg:0x26364e,fog:0x394b61,cyan:0xb69cff,pink:0xff758f,ground:0x1c2b26}, {bg:0xb8c9d0,fog:0xa9bbc3,cyan:0x8be6ff,pink:0xff826e,ground:0x56604a} ];
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
$('aiRaceButton').addEventListener('click',()=>{initAudio();myName=nameValue();notice('');socket.emit('createRoom',{name:myName,level:Number($('levelSelect').value)||1,soloAI:true,carId:selectedCarId});});
$('soundToggle').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('soundToggle').textContent=soundEnabled?'♫ SOUND ON':'♫ SOUND OFF';$('soundToggle').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled){initAudio();tone(660,.08,'sine',.025,100);}else if(engineGain&&audioContext)engineGain.gain.setTargetAtTime(.0001,audioContext.currentTime,.05);});
ui.primary.addEventListener('click',()=>{initAudio();myName=nameValue();notice('');if(tab==='create')socket.emit('createRoom',{name:myName,level:Number($('levelSelect').value)||1,carId:selectedCarId});else{const code=ui.code.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);if(code.length<4)return notice('Enter a valid room code.');socket.emit('joinRoom',{code,name:myName,carId:selectedCarId});}});
$('copyCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(roomCode);showToast('ROOM CODE COPIED');}catch{showToast('ROOM CODE: '+roomCode);}});
$('readyButton').addEventListener('click',()=>{initAudio();ready=!ready;socket.emit('setReady',ready);$('readyButton').querySelector('span').textContent=ready?'CANCEL READY':'READY UP';});
$('leaveButton').addEventListener('click',()=>{location.reload();});
$('backToLobby').addEventListener('click',()=>{ if(roomState?.status==='finished') socket.emit('nextLevel'); else location.reload(); });
$('replayLevelButton').addEventListener('click',()=>{ if(roomState?.status==='finished') socket.emit('replayLevel'); else location.reload(); });
socket.on('connect',()=>{$('connection').textContent='SYSTEM ONLINE';$('connection').style.color='#8eff80';if(roomCode){socket.emit('rejoinRoom',{code:roomCode,name:myName});}});
socket.on('disconnect',()=>{$('connection').textContent='RECONNECTING';$('connection').style.color='#ff719c';});
socket.on('connect_error',()=>{$('connection').textContent='CONNECTION LOST';});
socket.on('notice',d=>{notice(d.message);showToast(d.message);});
socket.on('joined',d=>{roomCode=d.code;myId=d.id;myName=d.name;ready=false;socket.emit('setCarColor',$('carSkin').value);socket.emit('setCarModel',selectedCarId);if(d.reconnected)showToast('RECONNECTED TO GRID');$('roomCodeDisplay').textContent=roomCode;ui.primary.disabled=false;showScreen('waiting');notice('');});
socket.on('state',s=>{roomState=s;if(s.aiMode){$('roomCodeDisplay').textContent='AI RACE';}updateLevelPicker(s.level, s.hostId===myId);syncItems(s.items||[]);if(!ui.hud.classList.contains('hidden')||s.status==='racing'||s.status==='countdown'||s.status==='finished'){showScreen('hud');}else if(s.status==='lobby')showScreen('waiting');renderPlayers(s);renderLeaderboard(s);if(s.status==='racing')$('raceStatus').textContent='RACE IN PROGRESS';if(s.status==='finished')showFinish(s);});
socket.on('countdown',d=>{initAudio();sfx('count');raceStartAt=d.at;showScreen('hud');$('countdown').classList.remove('hidden');});
socket.on('countdownCancelled',()=>{raceStartAt=null;$('countdown').classList.add('hidden');showToast('COUNTDOWN CANCELLED — ALL RACERS MUST BE READY');});
socket.on('raceStart',()=>{sfx('go');$('countdown').classList.add('hidden');$('raceStatus').textContent='GO! GO! GO!';showScreen('hud');});
socket.on('checkpointReached',d=>{if(d.id===myId){sfx('coin');showToast(`CHECKPOINT ${d.checkpoint}/${d.total} CLEARED`);}});
socket.on('checkpointMissed',d=>{if(d.id===myId)showToast(`CHECKPOINT ${d.checkpoint}/${d.total} MISSED — RE-CROSS THE GATE`);});
socket.on('racePenalty',d=>{if(d)showToast(`${d.reason}: +${(d.penaltyMs/1000).toFixed(1)}s PENALTY`);});
socket.on('playerFinished',d=>{if(d.id===myId)sfx('finish');if(d.id===myId)showToast('FINISH LINE CROSSED!');else showToast(`${d.name} FINISHED THE LEVEL`);});
socket.on('hazardHit',d=>{if(d.id===myId){sfx('hit');showToast(d.type==='barrier'?'SOLID BARRIER IMPACT — SPEED LOST':'MINE HIT — NITRO DRAINED');if(d.type==='barrier'){const canvas=document.querySelector('#game canvas');if(canvas){canvas.classList.remove('impact-shake');void canvas.offsetWidth;canvas.classList.add('impact-shake');setTimeout(()=>canvas.classList.remove('impact-shake'),320);}}}});
socket.on('buildingHit',d=>{if(d.id===myId){
  sfx('hit'); showToast('HARD IMPACT — BODYWORK HIT THE BUILDING');
  const canvas=document.querySelector('#game canvas');
  if(canvas){canvas.classList.remove('impact-shake');void canvas.offsetWidth;canvas.classList.add('impact-shake');setTimeout(()=>canvas.classList.remove('impact-shake'),320);}
}});
socket.on('itemCollected',d=>{sfx(d.type==='nitro'?'nitro':'coin');});
socket.on('carCollision',d=>{if(d.a===myId||d.b===myId){sfx('hit');showToast('CAR IMPACT — SPEED LOST!');const canvas=document.querySelector('#game canvas');if(canvas){canvas.classList.remove('impact-shake');void canvas.offsetWidth;canvas.classList.add('impact-shake');setTimeout(()=>canvas.classList.remove('impact-shake'),260);}}});
socket.on('levelStart',d=>{sfx('go');showToast(`LEVEL ${d.level} // NEW ENVIRONMENT`);});
socket.on('raceFinished',s=>showFinish(s));
function renderPlayers(s){if(s.status!=='lobby')return;const players=s.players||[];$('playerCount').textContent=`${players.length} / 8`;$('playerList').innerHTML=players.map(p=>`<div class="player-row"><span class="player-swatch" style="color:${p.color};background:${p.color}"></span><span class="player-name">${escapeHtml(p.name)}${p.id===myId?' <small>(YOU)</small>':(p.isAI||p.isBot)?' <small>(AI)</small>':''}</span><span class="player-status ${p.ready?'ready':''}">${p.ready?'READY':'STANDBY'}</span></div>`).join('');}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderLeaderboard(s){$('levelValue').textContent=String(s.level||1).padStart(2,'0');const ps=[...(s.players||[])].sort((a,b)=>a.finished!==b.finished?(a.finished?-1:1):(a.finished&&b.finished&&a.finishTime!=null&&b.finishTime!=null?a.finishTime-b.finishTime:b.progress-a.progress));const me=ps.findIndex(p=>p.id===myId);$('positionValue').innerHTML=`${me>=0?String(me+1).padStart(2,'0'):'—'}<em> / ${String(ps.length).padStart(2,'0')}</em>`;$('leaderboard').innerHTML=ps.map((p,i)=>`<div class="leader-row ${p.id===myId?'me':''}"><span class="rank">${String(i+1).padStart(2,'0')}</span><i class="leader-color" style="background:${p.color}"></i><span class="leader-name">${escapeHtml(p.name)}${(p.isAI||p.isBot)?' · AI':''}</span><span class="leader-lap">${p.finished?'FIN':`${Math.floor(p.progress||0)}%`}</span></div>`).join('');const mine=(s.players||[]).find(p=>p.id===myId);if(mine){$('lapValue').innerHTML=`${String(Math.max(0,Math.min(100,Math.floor(mine.progress||0)))).padStart(2,'0')}<span> / 100</span>`;$('lapFill').style.width=`${Math.min(100,mine.progress||0)}%`;if($('coinValue'))$('coinValue').textContent=String(mine.coins||0).padStart(3,'0');if($('challengeValue'))$('challengeValue').textContent=`${Math.min(10,mine.levelCoins||0)}/10`;if($('checkpointValue'))$('checkpointValue').textContent=`${mine.checkpoint||0}/4`;if($('nitroValue'))$('nitroValue').textContent=Math.round(mine.nitro)+'%';$('nitroFill').style.width=mine.nitro+'%';$('speedValue').innerHTML=`${String(Math.round(Math.abs(mine.speed)*3.6)).padStart(3,'0')}<span> KM/H</span>`;$('speedFill').style.width=Math.min(100,Math.abs(mine.speed)/48*100)+'%';$('gearValue').textContent='GEAR '+Math.max(1,Math.min(6,Math.floor(Math.abs(mine.speed)/7)+1));}}
function raceScore(p){
  // Simple transparent score: coins and drift skill earn points; impacts cost points.
  return Math.max(0, Math.round((p?.coins||0)*100 + (p?.levelCoins||0)*50 + (p?.driftScore||0) + (p?.finishTime!=null?500:0) - (p?.hits||0)*25));
}
function showFinish(s){
  $('countdown').classList.add('hidden');
  const firstShow=$('finishBanner').classList.contains('hidden');
  $('finishBanner').classList.remove('hidden');
  const ps=[...(s.players||[])].sort((a,b)=>a.finished!==b.finished?(a.finished?-1:1):(a.finished&&b.finished&&a.finishTime!=null&&b.finishTime!=null?a.finishTime-b.finishTime:(b.progress||0)-(a.progress||0)));
  const rank=ps.findIndex(p=>p.id===myId)+1, mine=ps.find(p=>p.id===myId), winner=ps[0];
  const won=!!winner&&winner.id===myId;
  // Show the cinematic results celebration to every racer, not only first place.
  $('finishBanner').classList.add('epic-winner-screen');
  $('epicVictory').classList.remove('hidden');
  $('victoryName').textContent=String(winner?.name||'RACE WINNER').toUpperCase();
  $('victoryName').title='Race winner';
  const trophy=$('epicVictory').querySelector('.victory-trophy');
  if(trophy)trophy.textContent=won?'🏆':'🏁';
  $('epicVictory').querySelector('.victory-champ').textContent=won?'YOU ARE THE CHAMPION':(mine?`${mine.name.toUpperCase()} — RACE COMPLETE`:'RACE COMPLETE');
  $('epicVictory').querySelector('.victory-subtitle').textContent=won?'YOU OWNED THE GRID':`WINNER: ${String(winner?.name||'—').toUpperCase()}`;
  $('victoryTime').textContent=winner?.finishTime!=null?`${(winner.finishTime/1000).toFixed(2)}s`:'TIME LIMIT';
  $('victoryPosition').textContent=`${rank>0?rank:'—'} / ${ps.length}`;
  $('victoryReward').textContent=String(raceScore(mine));
  $('finishEyebrow').textContent=won?'🏁 VICTORY LAP':'FINAL CLASSIFICATION';
  $('finishTitle').textContent=won?'YOU WIN!':rank?`POSITION ${rank} / ${ps.length}`:'RACE COMPLETE';
  const time=mine?.finishTime!=null?`TIME ${(mine.finishTime/1000).toFixed(2)} SEC`:'NO FINISH TIME';
  const bestKey='neonRushBestLevel'+(s.level||1), elapsed=mine?.finishTime||s.raceElapsed||0; let record='';
  if(mine?.finishTime){const old=Number(localStorage.getItem(bestKey)||0);if(!old||elapsed<old){localStorage.setItem(bestKey,String(elapsed));record=' • NEW PERSONAL BEST!';}}
  $('finishText').textContent=`LEVEL ${s.level||1} · YOUR TIME: ${time} · SCORE: ${raceScore(mine)} · ${mine?.levelCoins||0} COINS · ${mine?.hits||0} IMPACTS${record}`;
  $('resultsRows').innerHTML=ps.map((p,i)=>{const t=p.finishTime!=null?`${(p.finishTime/1000).toFixed(2)}s`:'—';const status=p.finishTime!=null?'FINISHED':(s.status==='finished'?'DNF':'RACING');return `<tr class="${p.id===myId?'result-me':''} ${i===0?'result-winner':''}"><td>${i===0?'🏆':String(i+1).padStart(2,'0')}</td><td><span class="result-racer"><i style="background:${p.color||'#00f5ff'}"></i><span>${escapeHtml(p.name||'Racer')}<small>${(p.isAI||p.isBot)?'AI RIVAL':p.id===myId?'YOUR CAR':'RIVAL CAR'}</small></span></span></td><td>${t}</td><td>${raceScore(p).toLocaleString()}</td><td><span class="result-status ${p.finishTime!=null?'status-finished':'status-dnf'}">${status}</span></td></tr>`}).join('');
  $('winnerMedal').classList.toggle('hidden',!won);
  $('backToLobby').querySelector('span').textContent='NEXT LEVEL';
  $('replayLevelButton').querySelector('span').textContent=`RACE AGAIN · LEVEL ${s.level||1}`;
  $('raceStatus').textContent=won?'CHAMPION!':'RACE COMPLETE';
  if(firstShow){
    sfx('finish');victoryFanfare();launchCelebration();showToast(won?'🏆 CHAMPION! YOU WON THE RACE!':`🏁 RACE COMPLETE — ${winner?.name||'WINNER'} WON!`);
    const finishKey=`${s.code||roomCode||'solo'}-${s.level||1}-${mine?.finishTime||s.raceElapsed||0}`;
    if(finishKey!==creditedFinishKey){creditedFinishKey=finishKey;const earned=Math.max(25,Math.round((mine?.coins||0)*10+(mine?.levelCoins||0)*15+(won?150:50)));garageCredits+=earned;if(won)garageWins+=1;localStorage.setItem('neonGarageCredits',String(garageCredits));localStorage.setItem('neonGarageWins',String(garageWins));$('finishText').textContent+=` · GARAGE +${earned} CREDITS${won?' · WIN BONUS +150':''}`;refreshGarageUI();}
  }
}
function victoryFanfare(){
  // Short ascending victory fanfare synthesized locally; no audio asset required.
  if(!soundEnabled)return;
  [523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>setTimeout(()=>tone(f,.34,i===4?'triangle':'sine',i===4?.075:.055, f*.08),i*145));
  setTimeout(()=>{tone(1046.5,.7,'triangle',.045,0);tone(1568,.55,'sine',.025,0);},760);
}
function launchCelebration(){
  const holder=$('winConfetti'); if(!holder)return; holder.innerHTML='';
  const colors=['#00f5ff','#ff2bd6','#ffe66d','#8eff80','#ffffff','#9b6bff','#ff7a36'];
  for(let i=0;i<150;i++){const bit=document.createElement('i');bit.className='confetti-bit';bit.style.left=(Math.random()*100)+'%';bit.style.background=colors[i%colors.length];bit.style.setProperty('--fall',`${2+Math.random()*3.8}s`);bit.style.setProperty('--drift',`${Math.round((Math.random()-.5)*300)}px`);bit.style.animationDelay=(Math.random()*1.8)+'s';bit.style.width=`${4+Math.random()*8}px`;bit.style.height=`${7+Math.random()*15}px`;holder.appendChild(bit);}
  $('finishBanner').classList.add('victory-celebration');
  // Staggered bursts create a celebratory fireworks-like shimmer around the winner card.
  const screen=$('epicVictory'); if(screen){screen.classList.remove('firework-burst');void screen.offsetWidth;screen.classList.add('firework-burst');}
  setTimeout(()=>$('finishBanner').classList.remove('victory-celebration'),5200);
}

const scene = new THREE.Scene();scene.background=new THREE.Color(0x070817);scene.fog=new THREE.FogExp2(0x08091d,.0055);
const camera = new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,1200);
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;$('game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x7a9aff,0x130c2e,2.0));const keyLight=new THREE.DirectionalLight(0x9ddcff,2.2);keyLight.position.set(-25,55,20);keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);scene.add(keyLight);
const mat=(color,roughness=.7,metalness=.1,emissive=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity:emissive?1.2:0});
const asphalt=mat(0x30343a,.96,.02), groundMat=mat(0x3d6240,1,0), buildingMats=[mat(0x7c8589,.86,.04),mat(0xb5aaa0,.88,.02),mat(0x596b70,.82,.05)];
const roadLineMat=new THREE.MeshStandardMaterial({color:0xf4f0d9,roughness:.9}), shoulderMat=new THREE.MeshStandardMaterial({color:0xc0b9a8,roughness:1}), barkMat=mat(0x594331,.95), leafMats=[mat(0x315c38,.95),mat(0x416d3b,.95),mat(0x587644,.95)], windowMat=new THREE.MeshStandardMaterial({color:0x9dc4d3,metalness:.18,roughness:.22}), rubberMat=mat(0x17191b,.94), chromeMat=mat(0xb9c3c8,.28,.82);
// Ground is rebuilt with each generated level so the road remains visible at any distance.
function roadPlane(w,d,x,z){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),asphalt);m.rotation.x=-Math.PI/2;m.position.set(x,-.05,z);m.receiveShadow=true;scene.add(m);return m;}
// Procedurally generated winding road. The same seeded formula is mirrored by the server.
const LEVEL_LENGTH = 2600, TRACK_STEP = 20;
function centerAt(z, level=(roomState?.level||1)) {
  const seg=Math.max(0,Math.min(Math.floor(z/TRACK_STEP),LEVEL_LENGTH/TRACK_STEP)), t=z/TRACK_STEP;
  const difficulty=Math.min(Math.max(level-1,0)*.55,7);const offset=i=>Math.max(-24,Math.min(24,Math.sin((i+level*17)*1.731)*(10+difficulty)+Math.sin((i+level*7)*.713)*(6+difficulty*.55)));
  return offset(seg)+(offset(Math.min(seg+1,LEVEL_LENGTH/TRACK_STEP))-offset(seg))*(t-seg);
}
let seed=713;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
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
     // Real highway shoulder and broken white lane markings, following the same curve as the road.
     for(const side of [-1,1]){const shoulder=new THREE.Mesh(new THREE.PlaneGeometry(1.65,Math.hypot(TRACK_STEP,x2-x1)),shoulderMat);shoulder.rotation.x=-Math.PI/2;shoulder.rotation.z=angle;shoulder.position.set(mx+side*(roadWidth/2+.9),-.035,mz);shoulder.receiveShadow=true;add(shoulder);}
     if(Math.floor(z/ TRACK_STEP)%3===0){for(const lane of [-1,1]){const mark=new THREE.Mesh(new THREE.PlaneGeometry(.16,7),roadLineMat);mark.rotation.x=-Math.PI/2;mark.rotation.z=angle;mark.position.set(mx+lane*roadWidth*.17,.006,mz);add(mark);}}
     for(const side of [-1,1]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.18,.08,Math.hypot(TRACK_STEP,x2-x1)),new THREE.MeshBasicMaterial({color:side<0?themes[(level-1)%themes.length].cyan:themes[(level-1)%themes.length].pink}));rail.position.set(mx+side*(roadWidth/2),.03,mz);rail.rotation.y=angle;add(rail);}
    if(z%80===0){const beacon=new THREE.Mesh(new THREE.BoxGeometry(1.2,4,.6),new THREE.MeshBasicMaterial({color:level%2?themes[(level-1)%themes.length].cyan:themes[(level-1)%themes.length].pink}));beacon.position.set(x1+17,2,z+2);add(beacon);}
  }
  // A prominent checkered winning gate at every level's endpoint.
  const endX=centerAt(LEVEL_LENGTH,level);const gateMat=new THREE.MeshBasicMaterial({color:themes[(level-1)%themes.length].cyan});
  for(let i=0;i<16;i++){const tile=new THREE.Mesh(new THREE.BoxGeometry(roadWidth/16,.12,1.5),new THREE.MeshBasicMaterial({color:i%2?0x080817:0xf5fbff}));tile.position.set(endX-roadWidth/2+(i+.5)*(roadWidth/16),.05,LEVEL_LENGTH);add(tile);}
  for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(.7,7,.7),new THREE.MeshBasicMaterial({color:themes[(level-1)%themes.length].pink}));post.position.set(endX+side*(roadWidth/2+0.8),3.5,LEVEL_LENGTH);add(post);}
  const arch=new THREE.Mesh(new THREE.BoxGeometry(roadWidth+2,.45,.6),new THREE.MeshBasicMaterial({color:themes[(level-1)%themes.length].cyan}));arch.position.set(endX,7,LEVEL_LENGTH);add(arch);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(300,LEVEL_LENGTH+100),groundMat);ground.rotation.x=-Math.PI/2;ground.position.set(0,-.22,LEVEL_LENGTH/2);add(ground);
  const grid=new THREE.GridHelper(300,60,0x52614c,0x52614c);grid.material.transparent=true;grid.material.opacity=.08;grid.position.set(0,-.19,LEVEL_LENGTH/2);add(grid);
  // Rolling terrain, roadside trees, guardrails and occasional realistic highway lights.
  const vergeMat=new THREE.MeshStandardMaterial({color:0x62734a,roughness:1});
  for(let z=0;z<LEVEL_LENGTH;z+=28){
    const cx=centerAt(z,level);
    for(const side of [-1,1]){
      const baseX=cx+side*(roadWidth/2+5.5);
      const railPost=new THREE.Mesh(new THREE.BoxGeometry(.14,.9,.14),mat(0x9aa3a7,.5,.45));railPost.position.set(baseX,.43,z);add(railPost);
      if(z%56===0){const railBeam=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,27),mat(0x9da7aa,.45,.6));railBeam.position.set(baseX,.82,z+14);add(railBeam);}
      if(z%84===0){
        const tree=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,2.3,7),barkMat);trunk.position.y=1.15;trunk.castShadow=true;tree.add(trunk);
        const crown=new THREE.Mesh(new THREE.SphereGeometry(1.35,9,7),leafMats[Math.floor(rand()*leafMats.length)]);crown.position.y=2.8;crown.scale.set(1,1.25,.95);crown.castShadow=true;tree.add(crown);
        const crown2=new THREE.Mesh(new THREE.SphereGeometry(.92,8,6),leafMats[Math.floor(rand()*leafMats.length)]);crown2.position.set(.55,3.35,.1);crown2.castShadow=true;tree.add(crown2);tree.position.set(baseX+side*(5+rand()*7),0,z+rand()*10);add(tree);
      }
      if(z%168===0){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,6,8),mat(0x667177,.45,.55));pole.position.set(baseX+side*2,3,z);add(pole);const arm=new THREE.Mesh(new THREE.BoxGeometry(2.4,.08,.08),mat(0x667177,.45,.55));arm.position.set(baseX+side*.9,5.8,z);add(arm);const lamp=new THREE.Mesh(new THREE.BoxGeometry(.35,.12,.25),new THREE.MeshStandardMaterial({color:0xffefcf,emissive:0xffdca1,emissiveIntensity:.45}));lamp.position.set(baseX+side*1.8,5.72,z);add(lamp);}
    }
  }
  // Distant low hills break up the flat horizon without expensive terrain meshes.
  for(let i=0;i<34;i++){const side=i%2?1:-1;const z=(i*97)%LEVEL_LENGTH;const hill=new THREE.Mesh(new THREE.SphereGeometry(1,10,7),vergeMat);const h=8+rand()*22;hill.scale.set(12+rand()*18,h,28+rand()*35);hill.position.set(centerAt(z,level)+side*(64+rand()*38),h*.18,z);hill.receiveShadow=true;add(hill);}
}
buildTrack(1);
function addBuilding(x,z,w,h,d,i){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),buildingMats[i%buildingMats.length]);mesh.position.set(x,h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);const c=i%2?0xff2bd6:0x00eaff;for(let y=2;y<h-1;y+=4){const strip=new THREE.Mesh(new THREE.BoxGeometry(w*.76,.12,.06),new THREE.MeshBasicMaterial({color:c}));strip.position.set(x,y,z-d/2-.04);scene.add(strip);}const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.3,.12,d+.3),new THREE.MeshBasicMaterial({color:c}));roof.position.set(x,h,z);scene.add(roof);}
for(let side of [-1,1])for(let z=10;z<LEVEL_LENGTH;z+=36){const w=5+rand()*8,h=10+rand()*30,d=6+rand()*8;addBuilding(side*(42+rand()*12),z+rand()*5,w,h,d,Math.floor(rand()*3));}
// glowing billboards, pylons and street lights
for(let z=-82;z<=82;z+=18){for(const side of [-1,1]){const pole=new THREE.Mesh(new THREE.BoxGeometry(.18,7,.18),mat(0x343b60));pole.position.set(side*63,3.5,z);scene.add(pole);const lamp=new THREE.Mesh(new THREE.BoxGeometry(2.6,.1,.35),new THREE.MeshBasicMaterial({color:side<0?0x00f5ff:0xff2bd6}));lamp.position.set(side*63,7,z);scene.add(lamp);}}
const grid=new THREE.GridHelper(500,100,0x13214a,0x10172e);grid.position.y=-.17;scene.add(grid);
function makeCar(color=0x00f5ff, carId='neon-gt'){
  const g=new THREE.Group();
  const paint=new THREE.MeshStandardMaterial({color,metalness:.72,roughness:.24});
  const darkPaint=new THREE.MeshStandardMaterial({color:0x20262a,metalness:.55,roughness:.3});
  const glass=new THREE.MeshPhysicalMaterial({color:0x173344,metalness:.32,roughness:.12,transparent:true,opacity:.88,clearcoat:1,clearcoatRoughness:.08});
  const lampWhite=new THREE.MeshStandardMaterial({color:0xf7fbff,emissive:0xdceeff,emissiveIntensity:1.35,roughness:.22});
  const lampRed=new THREE.MeshStandardMaterial({color:0xff172d,emissive:0xff0018,emissiveIntensity:1.25,roughness:.25});
  const rubber=new THREE.MeshStandardMaterial({color:0x111315,roughness:.92});
  const rim=new THREE.MeshStandardMaterial({color:0xb9c4c9,metalness:.88,roughness:.23});
  function part(geo,material,x,y,z,rx=0,ry=0,rz=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
  // Lower chassis, sculpted bonnet and rear deck.
  part(new THREE.BoxGeometry(1.78,.34,3.65),darkPaint,0,.48,-.02);
  part(new THREE.BoxGeometry(1.88,.38,2.35),paint,0,.66,.48);
  part(new THREE.BoxGeometry(1.78,.3,.9),paint,0,.63,-1.36);
  part(new THREE.BoxGeometry(1.84,.16,.48),paint,0,.48,1.68);
  // Raised cabin and sloping windshield/rear glass.
  part(new THREE.BoxGeometry(1.28,.46,1.48),paint,0,.93,-.12);
  part(new THREE.BoxGeometry(1.18,.32,1.24),glass,0,1.04,-.13);
  part(new THREE.BoxGeometry(1.1,.08,.48),paint,0,1.27,.27,.23,0,0);
  part(new THREE.BoxGeometry(1.1,.08,.42),paint,0,1.23,-.65,-.28,0,0);
  // Side windows and mirrors.
  for(const side of [-1,1]){
    part(new THREE.BoxGeometry(.035,.28,.72),glass,side*.651,1.06,-.08,0,0,side*-.05);
    part(new THREE.BoxGeometry(.18,.1,.22),paint,side*.92,.91,.48,0,0,side*.08);
    part(new THREE.BoxGeometry(.08,.1,.18),darkPaint,side*.99,.9,.49);
  }
  // Front grille, splitter, rear diffuser and visible headlights/taillights.
  part(new THREE.BoxGeometry(.7,.16,.055),darkPaint,0,.48,1.86);
  for(let i=0;i<5;i++)part(new THREE.BoxGeometry(.08,.018,.02),chromeMat,-.27+i*.135,.48,1.895);
  part(new THREE.BoxGeometry(1.65,.08,.2),darkPaint,0,.34,1.77);
  part(new THREE.BoxGeometry(1.6,.08,.2),darkPaint,0,.34,-1.82);
  for(const x of [-.62,.62]){part(new THREE.BoxGeometry(.43,.12,.08),lampWhite,x,.72,1.72,-.12,0,0);part(new THREE.BoxGeometry(.48,.13,.08),lampRed,x,.69,-1.82);}
  // Wheels, alloy rims, hubs and brake discs.
  for(const x of [-.91,.91])for(const z of [-1.18,1.18]){
    part(new THREE.CylinderGeometry(.37,.37,.22,20),rubber,x,.38,z,0,0,Math.PI/2);
    part(new THREE.CylinderGeometry(.245,.245,.235,16),rim,x,.38,z,0,0,Math.PI/2);
    part(new THREE.CylinderGeometry(.105,.105,.245,12),darkPaint,x,.38,z,0,0,Math.PI/2);
    for(let spoke=0;spoke<5;spoke++){const a=spoke*Math.PI*2/5;const sp=part(new THREE.BoxGeometry(.045,.36,.045),chromeMat,x,.38,z, a,0,Math.PI/2);sp.position.y=.38+Math.sin(a)*.13;sp.position.z=z+Math.cos(a)*.13;}
  }
  // Sport rear spoiler and subtle side skirts.
  part(new THREE.BoxGeometry(1.25,.08,.22),darkPaint,0,1.08,-1.58);
  for(const x of [-.52,.52])part(new THREE.BoxGeometry(.07,.26,.07),darkPaint,x,.94,-1.55);
  for(const x of [-.89,.89])part(new THREE.BoxGeometry(.08,.13,1.8),darkPaint,x,.4,0);
  // Realistic light pools and subtle brand-colour underglow.
  const glow=new THREE.PointLight(color,.35,4);glow.position.set(0,.22,-.5);g.add(glow);
  const leftLamp=new THREE.SpotLight(0xe5f3ff,2.2,32,Math.PI/7,.55,1.4);leftLamp.position.set(-.52,.58,1.65);leftLamp.target.position.set(-.8,.08,12);g.add(leftLamp,leftLamp.target);
  const rightLamp=new THREE.SpotLight(0xe5f3ff,2.2,32,Math.PI/7,.55,1.4);rightLamp.position.set(.52,.58,1.65);rightLamp.target.position.set(.8,.08,12);g.add(rightLamp,rightLamp.target);
  const model=GARAGE_CARS.find(c=>c.id===carId)||GARAGE_CARS[0];
  if(model.type==='suv'){
    g.scale.set(1.12,1.16,1.02);
    part(new THREE.BoxGeometry(1.48,.14,1.45),paint,0,1.34,-.12);
    part(new THREE.BoxGeometry(.055,.08,1.5),chromeMat,-.58,1.43,-.12);part(new THREE.BoxGeometry(.055,.08,1.5),chromeMat,.58,1.43,-.12);
    part(new THREE.BoxGeometry(.18,.08,.2),darkPaint,-.62,.58,-.4);part(new THREE.BoxGeometry(.18,.08,.2),darkPaint,.62,.58,-.4);
  }else if(model.type==='muscle'){
    part(new THREE.BoxGeometry(.52,.14,.8),darkPaint,0,.91,.92);
    part(new THREE.BoxGeometry(1.55,.1,.12),paint,0,1.18,-1.52);
  }else if(model.type==='hyper'){
    part(new THREE.BoxGeometry(1.62,.1,.42),darkPaint,0,.78,-1.3);
    for(const side of [-1,1])part(new THREE.BoxGeometry(.13,.24,.78),paint,side*.78,.68,-.78,0,0,side*.12);
  }else if(model.type==='rally'){
    g.scale.set(1.06,1.1,1.02);part(new THREE.BoxGeometry(1.25,.1,.2),darkPaint,0,1.42,-1.2);part(new THREE.BoxGeometry(.1,.32,.1),darkPaint,-.48,1.25,-1.2);part(new THREE.BoxGeometry(.1,.32,.1),darkPaint,.48,1.25,-1.2);
  }else if(model.type==='electric'){
    part(new THREE.BoxGeometry(1.42,.16,.5),paint,0,.68,1.22);
    for(const side of [-1,1])part(new THREE.BoxGeometry(.05,.035,.12),lampWhite,side*.5,.78,1.88);
  }
  return g;
}

function refreshGarageUI(){
  const balance=$('garageBalance');if(balance)balance.textContent=`◈ ${garageCredits.toLocaleString()} CREDITS`;
  if($('garageWins'))$('garageWins').textContent=`🏆 ${garageWins} WINS`;
  if($('garageOwned'))$('garageOwned').textContent=`${garageOwned.size} / ${GARAGE_CARS.length} OWNED`;
  const grid=$('garageGrid');if(!grid)return;
  grid.innerHTML=GARAGE_CARS.map(car=>{const owned=garageOwned.has(car.id),selected=car.id===selectedCarId,locked=!owned;return `<button type="button" class="garage-car ${selected?'selected':''} ${locked?'locked':''}" data-car-id="${car.id}" aria-pressed="${selected}" title="${car.name}"><span class="car-lock">${owned?'':`🔒`}</span><div class="garage-car-swatch" style="background:${car.color};color:${car.color}"></div><strong>${car.name}</strong><small>${owned?(selected?'SELECTED':'OWNED'):`${car.price} ◈ · ${car.wins} wins`}</small></button>`;}).join('');
  grid.querySelectorAll('[data-car-id]').forEach(btn=>btn.addEventListener('click',()=>{const car=GARAGE_CARS.find(c=>c.id===btn.dataset.carId);if(!car)return;previewCarSelection(car.id);if(garageOwned.has(car.id)){selectedCarId=car.id;localStorage.setItem('neonSelectedCar',selectedCarId);$('garageUnlock').querySelector('span').textContent='SELECT CAR';}else{$('garageUnlock').querySelector('span').textContent=`UNLOCK · ${car.price} CREDITS`;}$('garageUnlock').dataset.pendingCar=car.id;refreshGarageUI();}));
}
function previewCarSelection(id){const car=GARAGE_CARS.find(c=>c.id===id)||GARAGE_CARS[0];if($('garageSelectedName'))$('garageSelectedName').textContent=car.name;$('garageSelectedStats').textContent=`${car.type.toUpperCase()} · SPEED ${car.speed} · HANDLING ${car.handling}`;if(garagePreviewCar&&garagePreviewScene){garagePreviewScene.remove(garagePreviewCar);garagePreviewCar.traverse(o=>{if(o.geometry)o.geometry.dispose();});}if(garagePreviewScene){garagePreviewCar=makeCar(new THREE.Color(car.color).getHex(),car.id);garagePreviewCar.position.y=.08;garagePreviewScene.add(garagePreviewCar);}const colorInput=$('carSkin');if(colorInput){const exists=[...colorInput.options].some(o=>o.value.toLowerCase()===car.color.toLowerCase());if(exists)colorInput.value=car.color;}}
function initGaragePreview(){const canvas=$('garagePreview');if(!canvas||garagePreviewRenderer)return;try{garagePreviewScene=new THREE.Scene();garagePreviewScene.background=new THREE.Color(0x10152b);garagePreviewCamera=new THREE.PerspectiveCamera(34,1,.1,100);garagePreviewCamera.position.set(4,3.2,6.4);garagePreviewCamera.lookAt(0,.5,0);garagePreviewRenderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});garagePreviewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));garagePreviewRenderer.setSize(canvas.clientWidth||480,canvas.clientHeight||190,false);garagePreviewRenderer.shadowMap.enabled=true;garagePreviewRenderer.toneMapping=THREE.ACESFilmicToneMapping;garagePreviewScene.add(new THREE.HemisphereLight(0xb7d7ff,0x16121e,2.3));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(4,8,5);key.castShadow=true;garagePreviewScene.add(key);const floor=new THREE.Mesh(new THREE.CircleGeometry(4,48),new THREE.MeshStandardMaterial({color:0x192238,metalness:.35,roughness:.5}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;garagePreviewScene.add(floor);previewCarSelection(selectedCarId);}catch(e){console.warn('Garage preview unavailable',e);}}
$('garageToggle')?.addEventListener('click',()=>{garageOpen=!garageOpen;$('garagePanel').classList.toggle('hidden',!garageOpen);if(garageOpen){initGaragePreview();refreshGarageUI();previewCarSelection(selectedCarId);}});
$('garageClose')?.addEventListener('click',()=>{garageOpen=false;$('garagePanel').classList.add('hidden');});
$('garageUnlock')?.addEventListener('click',()=>{const id=$('garageUnlock').dataset.pendingCar||selectedCarId;const car=GARAGE_CARS.find(c=>c.id===id);if(!car)return;if(!garageOwned.has(id)){if(garageWins<car.wins){showToast(`NEED ${car.wins} RACE WINS TO UNLOCK`);return;}if(garageCredits<car.price){showToast(`NEED ${car.price-garageCredits} MORE CREDITS`);return;}garageCredits-=car.price;garageOwned.add(id);localStorage.setItem('neonGarageCredits',String(garageCredits));localStorage.setItem('neonGarageOwned',JSON.stringify([...garageOwned]));showToast(`${car.name} UNLOCKED!`);}selectedCarId=id;localStorage.setItem('neonSelectedCar',id);$('garageUnlock').querySelector('span').textContent='SELECT CAR';$('garageUnlock').dataset.pendingCar=id;previewCarSelection(id);refreshGarageUI();});
refreshGarageUI();
function ensureCar(p){let entry=cars.get(p.id);if(!entry||entry.color!==p.color||entry.carId!==(p.carId||'neon-gt')){if(entry)scene.remove(entry.mesh);const color=new THREE.Color(p.color).getHex();entry={mesh:makeCar(color,p.carId||'neon-gt'),target:new THREE.Vector3(p.x,0,p.z),heading:p.heading,color:p.color,carId:p.carId||'neon-gt'};scene.add(entry.mesh);cars.set(p.id,entry);}entry.target.set(p.x,0,p.z);entry.heading=p.heading;entry.mesh.userData.player=p.id;return entry;}
function updateCars(){if(!roomState)return;const active=new Set();for(const p of roomState.players){active.add(p.id);const e=ensureCar(p);e.mesh.position.lerp(e.target,.28);e.mesh.rotation.y=THREE.MathUtils.lerp(e.mesh.rotation.y,e.heading,.2);}for(const [id,e] of cars)if(!active.has(id)){scene.remove(e.mesh);cars.delete(id);}}
const particleGroup=new THREE.Group();scene.add(particleGroup);
function spawnBoost(car){if(Math.random()>.28)return;const color=car.material?.color?.getHex()||0x00f5ff;const m=new THREE.Mesh(new THREE.SphereGeometry(.07,5,5),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7}));m.position.copy(car.position);m.position.y=.4;m.userData.life=.35;particleGroup.add(m);}
function updateCamera(){const mine=cars.get(myId);if(!mine)return;const m=mine.mesh;const forward=new THREE.Vector3(Math.sin(m.rotation.y),0,Math.cos(m.rotation.y));let desired,look;if(cameraMode===0){desired=m.position.clone().addScaledVector(forward,-9).add(new THREE.Vector3(0,5,0));look=m.position.clone().addScaledVector(forward,5).add(new THREE.Vector3(0,1,0));}else if(cameraMode===1){desired=m.position.clone().add(new THREE.Vector3(0,18,0)).addScaledVector(forward,-3);look=m.position.clone();}else{desired=m.position.clone().add(new THREE.Vector3(0,2.2,0)).addScaledVector(forward,2.8);look=m.position.clone().addScaledVector(forward,20);}camera.position.lerp(desired,.11);camera.lookAt(look);}
function requestLandscapeMode(){
  // Trigger both requests synchronously from the user's tap; browsers may reject either one.
  try { if (screen.orientation && typeof screen.orientation.lock === 'function') screen.orientation.lock('landscape').catch(()=>{}); } catch (_) {}
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); } catch (_) {}
  updateRotatePrompt();
}
function updateRotatePrompt(){const prompt=document.getElementById('rotatePrompt');if(!prompt)return;const mobile=window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;const racingHud=!$('hud').classList.contains('hidden');prompt.classList.toggle('hidden',!(mobile&&racingHud&&window.innerHeight>window.innerWidth));}
['primaryAction','aiRaceButton','readyButton'].forEach(id=>{const el=$(id);if(el)el.addEventListener('click',()=>{requestLandscapeMode();});});
window.addEventListener('orientationchange',updateRotatePrompt);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);updateRotatePrompt();});
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='c')cameraMode=(cameraMode+1)%3;});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
function releaseTouchKeys(){document.querySelectorAll('[data-key]').forEach(btn=>{keys.delete(btn.dataset.key);btn.classList.remove('pressed');});}
document.querySelectorAll('[data-key]').forEach(btn=>{const k=btn.dataset.key;const down=e=>{e.preventDefault();try{btn.setPointerCapture(e.pointerId);}catch(_){}keys.add(k);btn.classList.add('pressed');};const up=e=>{e.preventDefault();keys.delete(k);btn.classList.remove('pressed');try{if(btn.hasPointerCapture(e.pointerId))btn.releasePointerCapture(e.pointerId);}catch(_){}};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('lostpointercapture',up);});
window.addEventListener('blur',releaseTouchKeys);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseTouchKeys();});
function sendInput(){if(!roomState||roomState.status!=='racing'||!myId)return;const now=performance.now();if(soundEnabled&&(keys.has(' ')||keys.has('space'))&&now-lastDriftSound>450){const mine=roomState.players.find(p=>p.id===myId);if(mine&&Math.abs(mine.speed)>10){sfx('drift');lastDriftSound=now;}}if(now-lastInput<45)return;lastInput=now;socket.emit('input',{throttle:keys.has('w')||keys.has('arrowup'),brake:keys.has('s')||keys.has('arrowdown'),left:keys.has('a')||keys.has('arrowleft'),right:keys.has('d')||keys.has('arrowright'),drift:keys.has(' '),boost:keys.has('shift')});}
function animate(){requestAnimationFrame(animate);updateRotatePrompt();updateEngineSound();if(roomState?.level&&roomState.level!==trackLevelBuilt){buildTrack(roomState.level);syncItems(roomState.items||[]);}const dt=Math.min(clock.getDelta(),.05);updateCars();sendInput();updateCamera();if(raceStartAt){const left=Math.ceil((raceStartAt-Date.now())/1000);if(left>0)$('countdown').textContent=left;else{$('countdown').classList.add('hidden');raceStartAt=null;}}for(let i=particleGroup.children.length-1;i>=0;i--){const p=particleGroup.children[i];p.userData.life-=dt;p.position.y+=dt*1.3;p.material.opacity=Math.max(0,p.userData.life/.35);if(p.userData.life<=0){particleGroup.remove(p);p.geometry.dispose();p.material.dispose();}}for(const m of itemMeshes.values())if(m.visible&&(m.geometry?.type==='TorusGeometry'||m.geometry?.type==='OctahedronGeometry')){m.rotation.z+=dt*1.8;m.position.y=1.15+Math.sin(performance.now()*.003+m.position.z)*.16;}if(roomState&&roomState.status==='racing'&&keys.has('shift')){const e=cars.get(myId);if(e&&Math.random()<.8)spawnBoost(e.mesh);}renderer.render(scene,camera);if(garageOpen&&garagePreviewRenderer&&garagePreviewScene){if(garagePreviewCar)garagePreviewCar.rotation.y+=dt*.55;const canvas=$('garagePreview');const w=canvas.clientWidth||480,h=canvas.clientHeight||190;if(canvas.width!==Math.round(w*Math.min(devicePixelRatio,1.5))||canvas.height!==Math.round(h*Math.min(devicePixelRatio,1.5))){garagePreviewRenderer.setSize(w,h,false);garagePreviewCamera.aspect=w/h;garagePreviewCamera.updateProjectionMatrix();}garagePreviewRenderer.render(garagePreviewScene,garagePreviewCamera);}}
// Neon AI is a lightweight, local game assistant. It uses game rules and live
// race state, so it works without a paid API key or sending chat to a third party.
const neonAiPanel = $('neonAiPanel');
const neonAiToggle = $('neonAiToggle');
const neonAiMessages = $('neonAiMessages');
const neonAiInput = $('neonAiInput');
function setNeonAiOpen(open) {
  neonAiPanel.classList.toggle('hidden', !open);
  neonAiToggle.setAttribute('aria-expanded', String(open));
  if (open) setTimeout(() => neonAiInput.focus(), 40);
}
neonAiToggle.addEventListener('click', () => setNeonAiOpen(neonAiPanel.classList.contains('hidden')));
$('neonAiClose').addEventListener('click', () => setNeonAiOpen(false));
function addNeonAiMessage(text, who) {
  const message = document.createElement('div');
  message.className = `neon-ai-message ${who}`;
  const label = document.createElement('b');
  label.textContent = who === 'user' ? 'YOU' : 'NEON AI';
  const body = document.createElement('p');
  body.textContent = text;
  message.append(label, body);
  neonAiMessages.appendChild(message);
  neonAiMessages.scrollTop = neonAiMessages.scrollHeight;
}
function neonAiReply(raw) {
  const q = raw.toLowerCase();
  const mine = roomState?.players?.find(p => p.id === myId);
  const level = roomState?.level || Number(levelSelect?.value) || 1;
  if (/\b(hi|hello|hey|yo)\b/.test(q)) return 'Hey, driver. I’m online. Ask about controls, drift, nitro, checkpoints, hazards, your stats, or how to improve your run.';
  if (q.includes('control') || q.includes('key') || q.includes('how to drive') || q.includes('play')) return 'DRIVING CONTROLS\nW or ↑ — accelerate\nA / D or ← / → — steer\nSPACE — drift / brake\nSHIFT — nitro overdrive\nC — switch camera\nTip: steer early before a bend, and save nitro for a clear stretch.';
  if (q.includes('nitro') || q.includes('boost')) return 'Hold SHIFT to use nitro while moving fast. Nitro gradually recharges when you are not boosting, and collecting a nitro pickup restores some instantly. Save it for a straight, open section instead of spending it near barriers.';
  if (q.includes('drift') || q.includes('turn') || q.includes('steer') || q.includes('corner')) return 'For a cleaner corner, release some throttle before turning, steer smoothly, and use SPACE to drift when you need a tighter slide. Avoid holding a steering direction for too long or you may leave the track and receive a penalty.';
  if (q.includes('checkpoint') || q.includes('finish') || q.includes('gate')) return `There are 4 checkpoints to cross in order before the finish counts. Stay inside the track corridor when crossing each gate. Your current checkpoint is ${mine ? `${mine.checkpoint || 0}/4` : 'not available until you join a race'}. Missing a gate means you should turn back and cross it correctly.`;
  if (q.includes('hazard') || q.includes('mine') || q.includes('barrier') || q.includes('collision') || q.includes('hit')) return 'Watch for mines and solid barriers, especially after the early stretch. Impacts reduce speed, can drain nitro, and may add a time penalty. Look ahead, pick a clear lane, and avoid sudden steering corrections.';
  if (q.includes('coin') || q.includes('collect')) return 'Coins and nitro pickups are placed along the route. Aim for pickups only when the line is safe—one coin is not worth a major collision or leaving the track.';
  if (q.includes('level') || q.includes('difficulty') || q.includes('hard')) return `You are on level ${level}. Later levels increase the challenge and narrow the safe driving margin. Prioritize clean checkpoint crossings and avoiding penalties before trying to maximize speed.`;
  if (q.includes('stat') || q.includes('score') || q.includes('how am i') || q.includes('progress') || q.includes('position')) {
    if (!mine) return 'You are not in a race room yet. Create or join a room first, then I can read your live level, progress, speed, nitro, coins, and checkpoint stats.';
    const players = roomState?.players || [];
    const sorted = [...players].sort((a,b) => (b.progress||0)-(a.progress||0));
    return `YOUR LIVE READOUT\nLevel: ${level}\nProgress: ${Math.floor(mine.progress||0)}%\nPosition: ${Math.max(1,sorted.findIndex(p=>p.id===myId)+1)} / ${players.length}\nSpeed: ${Math.round(Math.abs(mine.speed||0)*3.6)} km/h\nNitro: ${Math.round(mine.nitro||0)}%\nCoins this level: ${mine.levelCoins||0}\nCheckpoints: ${mine.checkpoint||0}/4\nHits: ${mine.hits||0}`;
  }
  if (q.includes('record') || q.includes('personal best') || q.includes('best time')) return 'Finish a level cleanly and note your time. Avoiding collisions and crossing all checkpoints correctly is often faster than taking risky shortcuts.';
  if (q.includes('tip') || q.includes('improve') || q.includes('win') || q.includes('strategy') || q.includes('better')) return `RACE TIP FOR LEVEL ${level}\n1. Keep the car near the middle of the track.\n2. Look ahead for hazards instead of reacting at the last second.\n3. Brake or drift before sharp turns, not after hitting the wall.\n4. Use nitro on clear straights.\n5. Clean checkpoints matter: penalties can erase the advantage of extra speed.`;
  if (q.includes('friend') || q.includes('multiplayer') || q.includes('room') || q.includes('opponent') || q.includes('bot')) return 'Want to race without a friend? Go back to the main menu and choose PLAY SOLO VS AI. NEON BOT will join as a real server-simulated racer, then press READY UP to start the race. You can still create a private room to race human friends.';
  if (q.includes('who are you') || q.includes('what are you') || q.includes('ai')) return 'I’m Neon AI, the built-in Neon Rush game assistant. I can explain game mechanics and give advice using your live race stats. This free version runs locally with preset game-aware responses; it is not a generative LLM, so I cannot answer every open-ended question like a cloud chatbot.';
  if (q.includes('status') || q.includes('race')) return `Race status: ${roomState?.status || 'not in a room'}. ${mine ? `Level ${level}, ${Math.floor(mine.progress||0)}% progress, ${Math.round(mine.nitro||0)}% nitro.` : 'Create or join a room to start racing.'} Ask me for controls, nitro advice, hazards, checkpoints, or your stats.`;
  return 'I can help with Neon Rush controls, drifting, nitro, coins, hazards, checkpoints, level difficulty, personal-best ghosts, race strategy, and your live stats. Try asking “How do I control the car?” or “How am I doing?” This free built-in version answers game-related questions rather than general topics.';
}
function submitNeonAiMessage(value) {
  const message = String(value || '').trim().slice(0,240);
  if (!message) return;
  addNeonAiMessage(message, 'user');
  neonAiInput.value = '';
  // A tiny delay makes the interaction feel conversational without network calls.
  window.setTimeout(() => addNeonAiMessage(neonAiReply(message), 'bot'), 140);
}
$('neonAiForm').addEventListener('submit', event => {
  event.preventDefault();
  submitNeonAiMessage(neonAiInput.value);
});
document.querySelectorAll('[data-ai-prompt]').forEach(button => {
  button.addEventListener('click', () => submitNeonAiMessage(button.dataset.aiPrompt));
});
// Do not let typing in the chat accidentally trigger keyboard driving controls.
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))) {
    if (event.target.id === 'neonAiInput' && event.key === 'Escape') setNeonAiOpen(false);
    return;
  }
}, true);

animate();

// SketchParty multiplayer room protocol. The host owns the board, round and scores.
// PeerJS uses its public signaling service. Game messages use WebRTC data channels.
let peer, room, hosting = false, hostConnection;
let peers = new Map(), localId = "", hostCallbacks = {};
let state = null, wordBank = {}, usedWords = new Set(), roundTimer;
const MAX_STROKES = 3500;
const MAX_POINTS = 1600;
const COLORS = /^#[0-9a-f]{6}$/i;
const normName = value => String(value || "Player").trim().replace(/\s+/g, " ").slice(0, 24) || "Player";
const normWord = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const announce = () => hostCallbacks.onState?.(publicState("host"));
const emit = e => hostCallbacks.onEvent?.(e);
const report = msg => hostCallbacks.onError?.(msg);
const sendSafe = (conn, message) => { if (conn?.open) { try { conn.send(message); } catch (e) { console.warn("Peer send:",e); } } };
const allSend = message => { for (const c of peers.values()) sendSafe(c, message); };

function publicState(forId) {
  if (!state) return null;
  const guest = state.players.find(p => p.id === forId);
  const seeWord = !state.round.active || state.round.drawerId === forId || guest?.spectator;
  return {
    room: state.room, players: state.players.map(p => ({...p})),
    round: { ...state.round, word: seeWord ? state.round.word : null,
      wordLength: state.round.word.length,
      hint: state.round.word.replace(/[A-Za-z0-9]/g,"_") },
    revision: state.revision, hostId: "host"
  };
}
function refreshAll() {
  announce();
  for (const c of peers.values()) sendSafe(c, {type:"state", state:publicState(c.peer)});
}
function sanitizeStroke(input) {
  if (!input || !Array.isArray(input.points) || !input.points.length || input.points.length > MAX_POINTS) return null;
  const points = [];
  for (const p of input.points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    points.push({x:+Math.max(0,Math.min(1,p.x)).toFixed(5), y:+Math.max(0,Math.min(1,p.y)).toFixed(5)});
  }
  return {type:"stroke", points, tool:input.tool==="eraser"?"eraser":"pen",
    color:COLORS.test(input.color||"")?input.color:"#111111",
    size:Math.max(1,Math.min(26,Number(input.size)||6))};
}
function canPaint(id) { return !state?.round.active || state.round.drawerId === id; }
function recordStroke(sender, incoming) {
  if (!canPaint(sender)) return;
  const stroke = sanitizeStroke(incoming);
  if (!stroke) return;
  // Soft cap protects late joiners from excessively large PeerJS snapshots.
  // A full board retains up to MAX_STROKES strokes; clear/new round resets.
  state.history.push(stroke);
  if (state.history.length > MAX_STROKES) state.history.shift();
  state.revision++;
  emit(stroke);
  allSend({...stroke, revision:state.revision});
}
function clearBoard(sender) {
  if (sender !== "host" && !canPaint(sender)) return;
  state.history = [];
  state.revision++;
  const event = {type:"clear",revision:state.revision};
  emit(event); allSend(event);
}
function stopRound(reason="ended") {
  if (!state.round.active) return;
  state.round.active = false;
  state.round.endReason = reason;
  state.round.endsAt = 0;
  refreshAll();
}
function guess(sender, message) {
  const player = state.players.find(p => p.id===sender);
  const text = String(message||"").trim().slice(0,75);
  if (!player || !text || !state.round.active || player.spectator ||
      sender === state.round.drawerId || state.round.solvedIds.includes(sender)) return;
  if (Date.now() >= state.round.endsAt) { stopRound("time"); return; }
  const correct = normWord(text) === normWord(state.round.word);
  if (correct) {
    const seconds = Math.max(0,Math.ceil((state.round.endsAt-Date.now())/1000));
    player.score += 100 + seconds;
    const drawer = state.players.find(p => p.id===state.round.drawerId);
    if (drawer) drawer.score += 50;
    state.round.solvedIds.push(sender);
    allSend({type:"chat",name:player.name,correct:true, text:"guessed the word!",sender});
    emit({type:"chat",name:player.name,correct:true,text:"guessed the word!",sender});
    const eligible = state.players.filter(p => !p.spectator && p.id!==state.round.drawerId);
    if (eligible.length && eligible.every(p=>state.round.solvedIds.includes(p.id))) stopRound("guessed");
    else refreshAll();
  } else {
    allSend({type:"chat",name:player.name,correct:false,text,sender});
    emit({type:"chat",name:player.name,correct:false,text,sender});
  }
}
function handleGuest(conn, message) {
  if (!message || typeof message !== "object") return;
  if (message.type==="join") {
    let p=state.players.find(p=>p.id===conn.peer);
    if (!p) {
      p={id:conn.peer,name:normName(message.name),score:0,spectator:!!message.spectator};
      state.players.push(p);
    }
    conn.joined=true;
    // Always send board snapshot first, including to players joining mid-round.
    sendSafe(conn,{type:"sync",state:publicState(conn.peer),history:state.history,revision:state.revision});
    refreshAll(); return;
  }
  if (!conn.joined) return;
  if (message.type==="stroke") recordStroke(conn.peer,message);
  if (message.type==="clear") clearBoard(conn.peer);
  if (message.type==="guess") guess(conn.peer,message.text);
  if (message.type==="rename") {
    const p=state.players.find(p=>p.id===conn.peer);
    if (p) { p.name=normName(message.name); refreshAll(); }
  }
}
export function myId() { return localId; }
export function isHost() { return hosting; }
export function getState() { return state; }
export function getRoomCode() { return room; }
export async function loadWords() {
  const response=await fetch("./words.json",{cache:"no-store"});
  if (!response.ok) throw new Error("Word list could not load");
  wordBank=await response.json();
  return Object.fromEntries(Object.entries(wordBank).map(([k,v])=>[k,v.length]));
}
export function createHost({name="Host",playing=false,onReady,onState,onEvent,onError}={}) {
  disconnect();
  hosting=true; localId="host";
  hostCallbacks={onReady,onState,onEvent,onError};
  room=Array.from({length:6},()=> "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");
  state={room,revision:0,history:[],players:[{id:"host",name:normName(name),score:0,spectator:!playing}],
    round:{active:false,drawerId:null,word:"",startedAt:0,endsAt:0,duration:90,number:0,solvedIds:[],difficulty:"easy",endReason:""}};
  if(typeof Peer==="undefined"){report("PeerJS failed to load. Check your internet connection.");return;}
  peer=new Peer(room,{debug:1});
  peer.on("open",id=>{room=id;state.room=id;announce();onReady?.(id);});
  peer.on("connection",conn=>{
    peers.set(conn.peer,conn);
    conn.on("data",data=>handleGuest(conn,data));
    conn.on("close",()=>{peers.delete(conn.peer);state.players=state.players.filter(p=>p.id!==conn.peer);refreshAll();});
    conn.on("error",e=>report("Player connection error: "+e.message));
  });
  peer.on("error",e=>report("Room error: "+(e.message||e.type)));
  roundTimer=setInterval(()=>{if(state?.round.active && Date.now()>=state.round.endsAt)stopRound("time");},500);
  announce();
}
export function joinRoom({code,name="Player",spectator=false,onReady,onState,onEvent,onError}={}) {
  disconnect();
  hosting=false; room=String(code||"").toUpperCase().trim();
  hostCallbacks={onReady,onState,onEvent,onError};
  if(typeof Peer==="undefined"){report("PeerJS failed to load. Check your connection.");return;}
  peer=new Peer({debug:1});
  peer.on("open",id=>{
    localId=id;
    hostConnection=peer.connect(room,{reliable:true,serialization:"json"});
    hostConnection.on("open",()=>sendSafe(hostConnection,{type:"join",name:normName(name),spectator}));
    hostConnection.on("data",msg=>{
      if(msg.type==="sync"){state=msg.state; onEvent?.({type:"sync",history:msg.history||[]});onState?.(state);onReady?.(room);}
      else if(msg.type==="state"){state=msg.state;onState?.(state);}
      else if(msg.type==="stroke"||msg.type==="clear"||msg.type==="chat")onEvent?.(msg);
    });
    hostConnection.on("close",()=>report("Host disconnected. Room closed."));
    hostConnection.on("error",e=>report("Connection error: "+e.message));
  });
  peer.on("error",e=>report("Could not join room: "+(e.message||e.type)));
}
export function disconnect() {
  if(roundTimer) clearInterval(roundTimer);
  roundTimer=null;
  for(const c of peers.values())c.close();
  peers=new Map();
  if(hostConnection)hostConnection.close();
  hostConnection=null;
  if(peer)peer.destroy();
  peer=null;state=null;room=null;localId="";hosting=false;
}
export function sendStroke(input) {
  if(hosting){ if(state)recordStroke("host",input); }
  else sendSafe(hostConnection,{type:"stroke",...input});
}
export function sendClear() {
  if(hosting){if(state)clearBoard("host");}
  else sendSafe(hostConnection,{type:"clear"});
}
export function submitGuess(text) {
  if(hosting){if(state)guess("host",text);}
  else sendSafe(hostConnection,{type:"guess",text});
}
export function rename(name) {
  if(hosting) { if(state){state.players[0].name=normName(name);refreshAll();} }
  else sendSafe(hostConnection,{type:"rename",name});
}
export function startRound({duration=90,difficulty="any"}={}) {
  if(!hosting||!state)return;
  const candidates=state.players.filter(p=>!p.spectator);
  if(!candidates.length){report("Have at least one player (not a spectator) to start.");return;}
  const keys=difficulty==="any"?["easy","medium","hard"]:[difficulty];
  const choices=keys.flatMap(k=>wordBank[k]||[]);
  if(!choices.length){report("Word list not available; reload the page.");return;}
  let available=choices.filter(w=>!usedWords.has(w.toLowerCase()));
  if(!available.length){usedWords.clear();available=choices;}
  const word=available[Math.floor(Math.random()*available.length)];
  usedWords.add(word.toLowerCase());
  const previous=state.round.drawerId;
  let index=candidates.findIndex(p=>p.id===previous);
  const drawer=candidates[(index+1)%candidates.length];
  const now=Date.now(),seconds=Math.max(20,Math.min(300,Number(duration)||90));
  state.round={active:true,drawerId:drawer.id,word,startedAt:now,endsAt:now+seconds*1000,
    duration:seconds,number:state.round.number+1,solvedIds:[],difficulty,endReason:""};
  clearBoard("host");
  refreshAll();
}
export function endRound() {if(hosting&&state)stopRound("skipped");}
export function setScore(id,score) {
  if(!hosting||!state)return;
  const p=state.players.find(p=>p.id===id);
  if(!p)return;
  p.score=Math.max(0,Math.min(999999,Math.floor(Number(score)||0)));refreshAll();
}
export function resetScores() {
  if(!hosting||!state)return;
  state.players.forEach(p=>p.score=0);
  refreshAll();
}
export function newGame() {
  if(!hosting||!state)return;
  usedWords.clear();
  state.players.forEach(p=>p.score=0);
  state.round={active:false,drawerId:null,word:"",startedAt:0,endsAt:0,duration:90,number:0,solvedIds:[],difficulty:"easy",endReason:""};
  clearBoard("host");refreshAll();
}

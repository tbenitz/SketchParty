import {
  createHost,joinRoom,disconnect,getState,myId,isHost,getRoomCode,
  sendStroke,sendClear,submitGuess,rename,startRound,endRound,setScore,resetScores,newGame,loadWords
} from "./game.js";

const $ = id => document.getElementById(id);
const canvas=$("canvas"),ctx=canvas.getContext("2d",{alpha:false});
const W=1200,H=675;
let activeStroke=null,tool="pen",brushColor="#111111",brushSize=6,history=[];
let sessionStarted=false,localName="",inviteUrl="",toastTimeout;
const savedName=(()=>{try{return localStorage.getItem("sketchparty_name")||"";}catch{return "";}})();
$("hostName").value=savedName||"Host";
$("joinName").value=savedName||"Player";
const modal=id=>$(id).hidden=false;
const close=id=>$(id).hidden=true;
const toast=msg=>{
  $("toast").textContent=msg;$("toast").classList.add("show");
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$("toast").classList.remove("show"),3300);
};
const saveName=name=>{localName=String(name||"Player").trim().slice(0,24)||"Player";try{localStorage.setItem("sketchparty_name",localName);}catch{}};
for(const button of document.querySelectorAll("[data-close]")){
  button.onclick=()=>close(button.dataset.close);
}
for(const overlay of document.querySelectorAll(".modal")){
  overlay.onclick=e=>{if(e.target===overlay)close(overlay.id);};
}

function renderStroke(stroke) {
  if(!stroke?.points?.length)return;
  ctx.strokeStyle=stroke.tool==="eraser"?"#fff":stroke.color||"#111111";
  ctx.fillStyle=ctx.strokeStyle;
  ctx.lineWidth=(Number(stroke.size)||6)*(stroke.tool==="eraser"?3:1);
  ctx.lineCap="round";ctx.lineJoin="round";
  ctx.beginPath();
  const first=stroke.points[0];
  ctx.moveTo(first.x*W,first.y*H);
  if(stroke.points.length===1){
    ctx.arc(first.x*W,first.y*H,ctx.lineWidth/2,0,Math.PI*2);
    ctx.fill();return;
  }
  for(let i=1;i<stroke.points.length;i++){let p=stroke.points[i];ctx.lineTo(p.x*W,p.y*H);}
  ctx.stroke();
}
function repaint(){
  ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
  history.forEach(renderStroke);
}
repaint();
// Canvas has a permanent 1200×675 coordinate system. Responsive CSS letterboxes it
// without changing its backing dimensions, so desktop and mobile strokes match.
function point(e){
  const r=canvas.getBoundingClientRect();
  return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
         y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};
}
function allowDrawing(){
  const s=getState();
  return !s?.round?.active || s.round.drawerId===myId();
}
function startDrawing(e){
  if(!allowDrawing()||e.button!==0 && e.pointerType==="mouse")return;
  e.preventDefault();
  try{canvas.setPointerCapture(e.pointerId);}catch{}
  const p=point(e);
  activeStroke={points:[p],tool,color:brushColor,size:brushSize};
  // Render a dot immediately, including single-tap strokes.
  renderStroke(activeStroke);
}
function moveDrawing(e){
  if(!activeStroke)return;
  e.preventDefault();
  const p=point(e),old=activeStroke.points.at(-1);
  const distance=Math.hypot((p.x-old.x)*W,(p.y-old.y)*H);
  if(distance<1.6)return;
  if(activeStroke.points.length>=1600)return;
  activeStroke.points.push(p);
  renderStroke({...activeStroke,points:[old,p]});
}
function finishDrawing(){
  if(!activeStroke)return;
  const stroke=activeStroke;activeStroke=null;
  if(sessionStarted){
    sendStroke(stroke);
    // Guests will receive the canonical stroke back from the host.
  }else{history.push(stroke);}
}
canvas.addEventListener("pointerdown",startDrawing);
canvas.addEventListener("pointermove",moveDrawing);
canvas.addEventListener("pointerup",finishDrawing);
canvas.addEventListener("pointercancel",finishDrawing);
window.addEventListener("blur",finishDrawing);

function networkEvent(ev){
  if(ev.type==="sync"){
    history=Array.isArray(ev.history)?ev.history:[];
    repaint();$("chatLog").replaceChildren();
    return;
  }
  if(ev.type==="stroke"){
    history.push(ev);
    if(history.length>3500)history.shift();
    renderStroke(ev);
  }else if(ev.type==="clear"){
    history=[];repaint();$("chatLog").replaceChildren();
  }else if(ev.type==="chat"){
    const entry=document.createElement("div");
    entry.className="chat-entry"+(ev.correct?" correct":"");
    const speaker=document.createElement("b");speaker.textContent=ev.name+": ";
    const span=document.createElement("span");span.textContent=ev.text;
    entry.append(speaker,span);
    const log=$("chatLog");
    if(log.querySelector(".subtle"))log.replaceChildren();
    log.append(entry);while(log.children.length>30)log.firstChild.remove();
    log.scrollTop=log.scrollHeight;
    if(ev.correct)toast(ev.name+" guessed correctly!");
  }
}
function updateUI(s){
  if(!s)return;
  const round=s.round,me=s.players.find(p=>p.id===myId());
  const mine=me?.id===round.drawerId;
  const myGuessing=!!round.active && !mine && !me?.spectator && !round.solvedIds.includes(myId());
  const role=round.active?(mine?"You're drawing":me?.spectator?"Spectator / referee":myGuessing?"You're guessing":"Guessed correctly"):"Free drawing";
  $("roleLabel").textContent=" • "+role;
  $("connectionStatus").textContent=(isHost()?"Hosting ":"Room ")+s.room+" • "+s.players.length+" connected";
  $("roundLabel").textContent=round.active?"Round "+round.number:
    round.number?"Round "+round.number+" complete":"Waiting for first round";
  $("drawerLabel").textContent=round.active?
    ((s.players.find(p=>p.id===round.drawerId)?.name)||"Player")+" is drawing":"Everyone can draw";
  $("wordLabel").textContent=round.active
    ?(round.word||round.hint+" ("+round.wordLength+" characters)")
    :round.word?("Answer: "+round.word):"Start a round when ready";
  $("drawHint").textContent=allowDrawing()?"Use your mouse or finger to draw.":"Only the current artist can draw.";
  canvas.classList.toggle("locked",!allowDrawing());
  for(const id of ["pen","eraser","clear","color","size"])$(id).disabled=!allowDrawing();
  $("guessInput").disabled=!myGuessing;
  $("guessBtn").disabled=!myGuessing;
  $("guessInput").placeholder=myGuessing?"Type a guess, then Enter":
    !round.active?"Wait for the next round…":
    mine?"You're the artist!":me?.spectator?"Spectators see the word.":"You got it!";
  $("playerCount").textContent=s.players.length+" connected";
  renderScores(s);
  $("nextRound").textContent=round.active?"Skip to next round":"Start next round";
  $("endRound").disabled=!round.active;
  updateTimer();
}
function renderScores(s){
  const scores=$("scoreboard");
  scores.replaceChildren();
  const sorted=[...s.players].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  sorted.forEach((p,i)=>{
    const row=document.createElement("div");row.className="score-row";
    const rank=document.createElement("span");rank.className="score-rank";rank.textContent="#"+(i+1);
    const name=document.createElement("div");name.className="score-name";
    name.textContent=p.name+(p.id===myId()?" (you)":"");
    const badge=document.createElement("small");
    const tags=[];
    if(p.id==="host")tags.push("Host");
    if(p.spectator)tags.push("Spectator");
    if(s.round.active && s.round.drawerId===p.id)tags.push("Drawing");
    if(s.round.solvedIds.includes(p.id))tags.push("✓ solved");
    badge.textContent=tags.join(" · ");
    name.append(badge);
    const points=document.createElement("span");points.className="score-points";
    points.textContent=String(p.score);
    row.append(rank,name,points);
    if(isHost()){
      const controls=document.createElement("div");controls.className="score-buttons";
      for(const [label,delta] of [["−",-25],["+",25]]){
        const b=document.createElement("button");b.textContent=label;
        b.title=(delta<0?"Subtract":"Add")+" 25 points";
        b.onclick=()=>setScore(p.id,p.score+delta);controls.append(b);
      }
      const edit=document.createElement("button");edit.textContent="✎";edit.title="Set exact score";
      edit.onclick=()=>{
        const value=prompt("Set points for "+p.name+":",String(p.score));
        if(value!==null && value.trim()!=="" && Number.isFinite(Number(value)))setScore(p.id,Number(value));
      };
      controls.append(edit);row.append(controls);
    }
    scores.append(row);
  });
}
function updateTimer(){
  const r=getState()?.round;
  if(!r?.active){$("timerLabel").textContent="--:--";return;}
  const left=Math.max(0,Math.ceil((r.endsAt-Date.now())/1000));
  $("timerLabel").textContent=Math.floor(left/60)+":"+String(left%60).padStart(2,"0");
  $("timerLabel").style.color=left<=10?"#ff8585":"";
}
setInterval(updateTimer,250);
function connectionError(message){
  $("connectionStatus").textContent=message;
  $("joinError").textContent=message;
  toast(message);
}
const commonCallbacks={onState:updateUI,onEvent:networkEvent,onError:connectionError};
function getInvite(){
  let url;
  if(location.protocol==="https:" && location.hostname!=="localhost" && location.hostname!=="127.0.0.1"){
    url=new URL(location.href);
  }else{
    // An Android WebView is not a public URL. Point QR to the GitHub Pages client.
    url=new URL("https://tbenitz.github.io/SketchParty/");
  }
  url.searchParams.set("room",getRoomCode());return url.toString();
}
function showShare(){
  const code=getRoomCode();if(!code)return;
  $("codeDisplay").textContent=code;
  inviteUrl=getInvite();
  const qr=$("qrcode");qr.replaceChildren();
  if(typeof QRCode!=="undefined"){
    try{new QRCode(qr,{text:inviteUrl,width:200,height:200,correctLevel:QRCode.CorrectLevel.M});}
    catch(e){qr.textContent="QR unavailable — share room code";}
  }else qr.textContent="QR unavailable — share room code";
  modal("shareModal");
}
function enterSession(host){
  sessionStarted=true;
  for(const id of ["hostBtn","joinBtn"])$(id).classList.add("hidden");
  for(const id of ["shareBtn","nameBtn","leaveBtn"])$(id).classList.remove("hidden");
  $("hostControls").classList.toggle("hidden",!host);
  if(!host) $("shareBtn").classList.add("hidden");
  toast(host?"Room ready — invite your friends!":"Joined room!");
}
$("hostBtn").onclick=()=>modal("hostModal");
$("joinBtn").onclick=()=>modal("joinModal");
$("doHost").onclick=()=>{
  const name=$("hostName").value||"Host";
  saveName(name);
  close("hostModal");
  const previous=history.slice();
  createHost({
    name:localName,playing:$("hostPlaying").checked,
    ...commonCallbacks,
    onReady:()=>{
      enterSession(true);
      // Include doodles made before opening the room in the new host snapshot.
      history=[];
      previous.forEach(stroke=>sendStroke(stroke));
      showShare();
    }
  });
};
$("doJoin").onclick=()=>{
  const code=$("joinCode").value.toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(code.length!==6){$("joinError").textContent="Enter a six-character room code.";return;}
  saveName($("joinName").value||"Player");
  $("joinError").textContent="Connecting to host…";
  joinRoom({
    code,name:localName,spectator:$("joinSpectator").checked,
    ...commonCallbacks,
    onReady:()=>{close("joinModal");enterSession(false);}
  });
};
$("shareBtn").onclick=showShare;
$("copyLink").onclick=async()=>{
  try{await navigator.clipboard.writeText(inviteUrl);toast("Invite link copied!");}
  catch {prompt("Copy this invitation URL:",inviteUrl);}
};
$("nameBtn").onclick=()=>{
  const value=prompt("Change your nickname:",localName);
  if(value===null||!value.trim())return;
  saveName(value);rename(localName);
};
$("leaveBtn").onclick=()=>{
  if(!confirm("Leave this room? The game ends for everyone if the host leaves."))return;
  disconnect();location.href=location.pathname;
};
$("nextRound").onclick=()=>startRound({duration:Number($("duration").value),difficulty:$("difficulty").value});
$("endRound").onclick=()=>endRound();
$("resetScores").onclick=()=>{if(confirm("Reset everyone's points to zero?")){resetScores();toast("Scores reset.");}};
$("newGame").onclick=()=>{if(confirm("Start a new game? This clears the board, scores and round history.")){newGame();toast("New game started!");}};
$("guessForm").onsubmit=e=>{
  e.preventDefault();const text=$("guessInput").value.trim();
  if(!text)return;
  submitGuess(text);$("guessInput").value="";
};
$("pen").onclick=()=>{
  tool="pen";$("pen").classList.add("active");$("eraser").classList.remove("active");
};
$("eraser").onclick=()=>{
  tool="eraser";$("eraser").classList.add("active");$("pen").classList.remove("active");
};
$("clear").onclick=()=>{
  if(sessionStarted)sendClear();
  else{history=[];repaint();}
};
$("color").oninput=e=>{brushColor=e.target.value;};
$("size").oninput=e=>{brushSize=Number(e.target.value);$("sizeValue").textContent=String(brushSize);};

const prefill=new URLSearchParams(location.search).get("room");
if(prefill){$("joinCode").value=prefill.toUpperCase().slice(0,6);modal("joinModal");}
loadWords().catch(err=>toast("Word pack error: "+err.message));
// TV D-pad navigation: native buttons/inputs are focusable, and Back closes dialogs.
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"||e.key==="Backspace" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)){
    const open=[...document.querySelectorAll(".modal")].find(el=>!el.hidden);
    if(open){e.preventDefault();close(open.id);}
  }
});

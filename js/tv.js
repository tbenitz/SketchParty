import {createHost, joinRoom, disconnect, getRoomCode, getState, loadWords,
  startRound, endRound, setScore, resetScores, newGame} from "./game.js";

// The TV is a display ONLY. It never uses sendStroke(), submitGuess(), and never
// renders round.word. The drawer alone sees the secret on their own device.
const $ = id => document.getElementById(id);
const canvas = $("canvas"), ctx = canvas.getContext("2d", {alpha:false});
const WIDTH = 1200, HEIGHT = 675, BREAK_SECONDS = 25;
let hostMode = true, ready = false, loading = false, wordReady = false;
let current = null, history = [], intermissionEndsAt = 0, lastActive = false;
let shareUrl = "", notice = "", noticeUntil = 0;

function message(text,seconds=5) {
  notice=text; noticeUntil=Date.now()+seconds*1000;
  $("footMessage").textContent=text;
}
function clearBoard() { ctx.fillStyle="#fff"; ctx.fillRect(0,0,WIDTH,HEIGHT); }
function paint(stroke) {
  if(!stroke?.points?.length) return;
  const p=stroke.points;
  const width=Math.max(1,Number(stroke.size)||6) * (stroke.tool==="eraser"?3:1);
  const color=stroke.tool==="eraser"?"#fff":stroke.color||"#111111";
  ctx.lineCap="round";ctx.lineJoin="round";
  ctx.lineWidth=width;ctx.fillStyle=color;ctx.strokeStyle=color;
  ctx.beginPath();ctx.moveTo(p[0].x*WIDTH,p[0].y*HEIGHT);
  if(p.length===1) {ctx.arc(p[0].x*WIDTH,p[0].y*HEIGHT,width/2,0,Math.PI*2);ctx.fill();}
  else {for(let i=1;i<p.length;i++) ctx.lineTo(p[i].x*WIDTH,p[i].y*HEIGHT);ctx.stroke();}
}
function repaint() {clearBoard();for(const s of history)paint(s);}
function onEvent(ev) {
  if(ev.type==="sync") {history=Array.isArray(ev.history)?ev.history:[];repaint();}
  else if(ev.type==="stroke") {
    history.push(ev); if(history.length>3500)history.shift();paint(ev);
  }else if(ev.type==="clear"){history=[];clearBoard();}
  else if(ev.type==="chat"&&ev.correct){message(ev.name+" guessed correctly!",3);}
}
// Do not alter canvas.width/height when changing the screen layout.
function fitBoard() {
  const well=$("boardFit"),frame=$("boardFrame");
  const w=well.clientWidth,h=well.clientHeight;
  if(w<4||h<4)return;
  const width=Math.max(2,Math.min(w,h*16/9)-12);
  frame.style.width=width+"px";
  frame.style.height=(width*9/16)+"px";
}
new ResizeObserver(fitBoard).observe($("boardFit"));
window.addEventListener("resize",fitBoard);
function inviteLink(){
  const here=location.protocol==="https:" && !["localhost","127.0.0.1"].includes(location.hostname)
    ?new URL("./index.html",location.href)
    :new URL("https://tbenitz.github.io/SketchParty/");
  here.searchParams.set("room",getRoomCode());
  return here.href;
}
function qrCode(){
  const code=getRoomCode();
  if(!code||!hostMode)return;
  shareUrl=inviteLink();
  $("bigRoomCode").textContent=code;
  const target=$("qrcode");target.replaceChildren();
  if(typeof QRCode==="undefined") {
    const span=document.createElement("span");span.textContent="Use room code above";target.append(span);return;
  }
  try {
    new QRCode(target,{text:shareUrl,width:230,height:230,correctLevel:QRCode.CorrectLevel.M});
  }catch(e) {
    target.textContent="Use the room code above";
    console.error(e);
  }
}
function listPlayers(state){
  const active=state.players.filter(p=>!p.spectator);
  const wrapper=$("leaders");wrapper.replaceChildren();
  const sorted=[...active].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  if(!sorted.length) {
    const line=document.createElement("div");
    line.className="leader-row";line.textContent="Waiting for players…";
    wrapper.append(line);
  }
  sorted.forEach((p,i)=>{
    const row=document.createElement("div");row.className="leader-row";
    const rank=document.createElement("span");rank.className="leader-rank";rank.textContent=(i+1)+".";
    const name=document.createElement("span");name.className="leader-name";name.textContent=p.name;
    const score=document.createElement("span");score.className="leader-score";score.textContent=String(p.score);
    row.append(rank,name,score);wrapper.append(row);
  });
  $("lobbyCount").textContent=active.length+" player"+(active.length===1?"":"s")+" joined";
  return active.length;
}
function renderScoreEditor(){
  if(!hostMode||!current)return;
  const editor=$("scoreEditor");editor.replaceChildren();
  for(const p of current.players.filter(x=>!x.spectator)){
    const row=document.createElement("div");row.className="score-edit-row";
    const name=document.createElement("span");name.className="score-edit-name";name.textContent=p.name;
    const points=document.createElement("strong");points.textContent=String(p.score);
    const less=document.createElement("button");less.type="button";less.textContent="−25";
    less.onclick=()=>setScore(p.id,p.score-25);
    const more=document.createElement("button");more.type="button";more.textContent="+25";
    more.onclick=()=>setScore(p.id,p.score+25);
    const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";
    edit.onclick=()=>{
      const v=prompt("Enter the new score for "+p.name,String(p.score));
      if(v!==null&&v.trim()!==""&&Number.isFinite(Number(v)))setScore(p.id,Number(v));
    };
    row.append(name,points,less,more,edit);editor.append(row);
  }
  if(!editor.children.length)editor.textContent="No players to score yet.";
}
function update(state){
  if(!state)return;
  const wasActive=lastActive;
  current=state;
  const r=state.round,playing=!!r.active;
  lastActive=playing;
  if(playing||r.number===0)intermissionEndsAt=0;
  else if(hostMode&&(wasActive || !intermissionEndsAt))intermissionEndsAt=Date.now()+BREAK_SECONDS*1000;

  const phase=playing?"playing":r.number>0?"intermission":"lobby";
  $("stage").className="stage "+phase;
  $("lobbyView").hidden=phase!=="lobby";
  $("intermissionView").hidden=phase!=="intermission";
  $("roomCode").textContent=state.room;
  $("roundDisplay").textContent=r.number?"ROUND "+r.number:"";
  $("artist").textContent=playing
    ?(state.players.find(p=>p.id===r.drawerId)?.name||"Someone")+" is drawing"
    :"";
  $("phaseBadge").textContent=playing?"DRAW & GUESS":
    phase==="intermission"?"LEADERBOARD / FREE DRAW":"GET READY TO PLAY";
  $("boardCaption").textContent=playing?"Guess the picture before time runs out":
    phase==="intermission"?"Free draw · Everyone can sketch while scores are shown":
    "Free draw · Join on your phones";
  const count=listPlayers(state);
  if($("manageDialog").open)renderScoreEditor();
  $("showInvite").hidden=!hostMode||phase==="lobby"||phase==="playing";
  $("watchRoom").hidden=!hostMode;
  $("manage").hidden=!hostMode||playing;
  $("skip").hidden=!hostMode||!playing;
  $("next").hidden=!hostMode||playing||!wordReady;
  $("next").disabled=count<2;
  $("next").textContent=phase==="lobby"?"Start game":"Next round";
  const joined=count>=2;
  $("footMessage").textContent=noticeUntil>Date.now()?notice:
    phase==="lobby"?"At least two phone players are needed to start.":
    playing?"Only the artist's device displays the word. TV is spectator-only.":
    joined?"Leaderboard and free draw until the next round.":"Waiting for at least two players.";
  updateClock();
  requestAnimationFrame(fitBoard);
}
function updateClock(){
  const r=current?.round;
  if(!r){$("clock").textContent="--:--";return;}
  let seconds;
  if(r.active)seconds=Math.max(0,Math.ceil((r.endsAt-Date.now())/1000));
  else if(hostMode&&intermissionEndsAt&&r.number>0)seconds=Math.max(0,Math.ceil((intermissionEndsAt-Date.now())/1000));
  else seconds=0;
  $("clock").textContent=r.active||intermissionEndsAt?Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0"):"--:--";
  $("clock").style.color=r.active&&seconds<=10?"#ff8888":"";
  $("nextHint").textContent=hostMode
    ?seconds>0?"Next round starts in "+seconds+"s (or choose Next round)":"Next round is ready"
    :"The room host starts the next round";
}
function errorText(err){
  message(err,15);
  $("joinError").textContent=err;
  $("phaseBadge").textContent="CONNECTION ISSUE";
}
function callbacks(){
  return {onState:update,onEvent,onError:errorText};
}
function startIfReady(){
  if(!hostMode||!wordReady||current?.round.active)return;
  if(current.players.filter(p=>!p.spectator).length<2){
    message("Two players must join before the game starts.");return;
  }
  intermissionEndsAt=0;
  startRound({duration:90,difficulty:"any"});
}
function host(){
  if(loading)return;
  loading=true;ready=false;hostMode=true;
  $("phaseBadge").textContent="OPENING ROOM";
  createHost({
    name:"TV display",playing:false,hideHostWord:true,...callbacks(),
    onReady:()=>{
      ready=true;loading=false;qrCode();
      message("Room ready! Players can scan the QR code.",7);
      update(getState());
    }
  });
}
function watch(code){
  hostMode=false;loading=false;ready=false;intermissionEndsAt=0;lastActive=false;
  $("joinError").textContent="Connecting…";
  $("phaseBadge").textContent="CONNECTING";
  joinRoom({
    code,name:"TV spectator",spectator:true,tvDisplay:true,...callbacks(),
    onReady:()=>{
      ready=true;closeDialog("joinDialog");
      message("Watching room "+code+" · spectator only",6);
      update(getState());
    }
  });
}
function openDialog(id){const dlg=$(id);if(!dlg.open)dlg.showModal();}
function closeDialog(id){const dlg=$(id);if(dlg.open)dlg.close();}
$("watchRoom").onclick=()=>openDialog("joinDialog");
$("doWatch").onclick=()=>{
  const code=$("joinCode").value.toUpperCase().trim().replace(/[^A-Z0-9]/g,"");
  if(code.length!==6){$("joinError").textContent="Enter the full six-character room code.";return;}
  if(code===getRoomCode()){$("joinError").textContent="This is your current TV room.";return;}
  watch(code);
};
$("cancelWatch").onclick=()=>closeDialog("joinDialog");
$("next").onclick=startIfReady;
$("skip").onclick=()=>{if(hostMode)endRound();};
$("showInvite").onclick=()=>{if(!hostMode)return;newGameOnInvite();};
function newGameOnInvite(){
  // Show the join QR without interrupting free-draw, scores or room state.
  $("stage").classList.remove("intermission");
  $("stage").classList.add("lobby");
  $("lobbyView").hidden=false;
  $("intermissionView").hidden=true;
  $("showInvite").hidden=true;
  $("boardCaption").textContent="Free draw · Friends can join this game at any time";
  qrCode();
  requestAnimationFrame(fitBoard);
  setTimeout(()=>{if(current)update(current);},12000);
}
$("manage").onclick=()=>{if(hostMode){renderScoreEditor();openDialog("manageDialog");}};
$("exitManage").onclick=()=>closeDialog("manageDialog");
$("resetScores").onclick=()=>{
  if(hostMode&&confirm("Reset all player scores?"))resetScores();
};
$("restartGame").onclick=()=>{
  if(hostMode&&confirm("Start a brand-new game? Scores and drawing will be cleared.")){
    newGame();intermissionEndsAt=0;closeDialog("manageDialog");
  }
};
document.addEventListener("keydown",e=>{
  if((e.key==="Escape"||e.key==="Backspace")&&document.activeElement?.tagName!=="INPUT"){
    const open=[...document.querySelectorAll("dialog")].find(d=>d.open);
    if(open){e.preventDefault();open.close();}
  }
});
setInterval(()=>{
  updateClock();
  if(notice && noticeUntil<=Date.now()&&current){
    notice="";noticeUntil=0;
    const active=current.round.active;
    $("footMessage").textContent=active?"Only the artist's device displays the word. TV is spectator-only.":
      current.round.number>0?"Free drawing & scoreboard until the next round.":"Share the QR code so phones can join.";
  }
  if(hostMode&&wordReady&&intermissionEndsAt&&Date.now()>=intermissionEndsAt){
    if(current?.players.filter(p=>!p.spectator).length>=2)startIfReady();
    else intermissionEndsAt=Date.now()+10000; // do not hammer round start in an empty room
  }
},300);
clearBoard();
loadWords().then(()=>{wordReady=true;if(current)update(current);})
  .catch(e=>errorText("Word pack unavailable: "+e.message));
const requestedCode=new URLSearchParams(location.search).get("room");
if(requestedCode&&/^[A-Z0-9]{6}$/i.test(requestedCode)) watch(requestedCode.toUpperCase());
else host();

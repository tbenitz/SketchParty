// SketchParty multiplayer logic
// Requires firebase-config.js (copy from example) and Firebase CDN scripts loaded first.

let db = null;
let roomRef = null;
let roomCode = null;
let playerId = null;
let isHost = false;
let myName = "Player";

export function initFirebase(config) {
  if (!config || !config.apiKey || config.apiKey.includes("YOUR_")) {
    console.warn("Firebase config missing — running in local demo mode only.");
    return false;
  }
  const app = firebase.initializeApp(config);
  db = firebase.database();
  return true;
}

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getOrCreatePlayerId() {
  let id = localStorage.getItem("sketchparty_playerId");
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("sketchparty_playerId", id);
  }
  return id;
}

export async function createRoom(name = "Host") {
  if (!db) return null;
  roomCode = randomCode();
  playerId = getOrCreatePlayerId();
  isHost = true;
  myName = name;

  roomRef = db.ref(`rooms/${roomCode}`);
  await roomRef.set({
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    status: "lobby",
    host: playerId,
    players: {
      [playerId]: { name, role: "host", joined: firebase.database.ServerValue.TIMESTAMP }
    },
    strokes: {}
  });

  // Clean up room if host disconnects (optional)
  roomRef.onDisconnect().remove();
  return roomCode;
}

export async function joinRoom(code, name = "Player") {
  if (!db) return false;
  roomCode = code.toUpperCase().trim();
  playerId = getOrCreatePlayerId();
  myName = name;
  roomRef = db.ref(`rooms/${roomCode}`);

  const snap = await roomRef.once("value");
  if (!snap.exists()) return false;

  await roomRef.child(`players/${playerId}`).set({
    name,
    role: "player",
    joined: firebase.database.ServerValue.TIMESTAMP
  });

  roomRef.child(`players/${playerId}`).onDisconnect().remove();
  return true;
}

export function listenPlayers(callback) {
  if (!roomRef) return;
  roomRef.child("players").on("value", (snap) => {
    const players = snap.val() || {};
    callback(players);
  });
}

export function listenStrokes(callback) {
  if (!roomRef) return;
  roomRef.child("strokes").on("child_added", (snap) => {
    callback(snap.key, snap.val());
  });
  roomRef.child("strokes").on("value", (snap) => {
    if (!snap.exists()) callback(null, null); // clear
  });
}

export function pushStroke(stroke) {
  if (!roomRef) return;
  roomRef.child("strokes").push(stroke);
}

export function clearStrokes() {
  if (!roomRef) return;
  roomRef.child("strokes").remove();
}

export function getRoomCode() { return roomCode; }
export function getPlayerId() { return playerId; }
export function isConnected() { return !!db && !!roomRef; }

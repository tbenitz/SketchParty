// SketchParty — PeerJS (WebRTC) multiplayer
// Host is the relay. Players connect directly to the host peer ID (room code).
// Free PeerJS cloud is used only for signaling. Drawing data is peer-to-peer.

let peer = null;
let roomCode = null;
let isHost = false;
let connections = []; // host only
let hostConn = null;  // player only

export function getRoomCode() { return roomCode; }

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function createHost(onReady, onPlayerList, onStroke) {
  roomCode = randomCode();
  isHost = true;
  peer = new Peer(roomCode, { debug: 1 });

  peer.on("open", (id) => {
    console.log("Host open:", id);
    onReady(id);
  });

  peer.on("connection", (conn) => {
    connections.push(conn);
    conn.on("open", () => broadcastPlayers());
    conn.on("data", (data) => {
      if (data.type === "stroke") {
        connections.forEach(c => {
          if (c !== conn && c.open) c.send(data);
        });
        onStroke(data);
      } else if (data.type === "join") {
        conn.playerName = data.name || "Player";
        broadcastPlayers();
      } else if (data.type === "clear") {
        connections.forEach(c => {
          if (c !== conn && c.open) c.send(data);
        });
        onStroke({ type: "clear" });
      }
    });
    conn.on("close", () => {
      connections = connections.filter(c => c !== conn);
      broadcastPlayers();
    });
  });

  peer.on("error", (err) => console.error("Host peer error:", err));

  function broadcastPlayers() {
    const names = connections.map(c => c.playerName || "Player");
    const msg = { type: "players", names };
    connections.forEach(c => { if (c.open) c.send(msg); });
    onPlayerList(names);
  }
}

export function joinAsPlayer(code, name, onReady, onStroke, onPlayers) {
  roomCode = code.toUpperCase().trim();
  peer = new Peer({ debug: 1 });

  peer.on("open", () => {
    hostConn = peer.connect(roomCode, { reliable: true });
    hostConn.on("open", () => {
      hostConn.send({ type: "join", name });
      onReady();
    });
    hostConn.on("data", (data) => {
      if (data.type === "stroke" || data.type === "clear") onStroke(data);
      if (data.type === "players") onPlayers(data.names || []);
    });
  });

  peer.on("error", (err) => {
    console.error("Player peer error:", err);
    if (err.type === "peer-unavailable") {
      alert("Room not found. Make sure the host is still open and the code is correct.");
    }
  });
}

export function sendStroke(stroke) {
  const msg = { type: "stroke", ...stroke };
  if (isHost) {
    connections.forEach(c => { if (c.open) c.send(msg); });
  } else if (hostConn && hostConn.open) {
    hostConn.send(msg);
  }
}

export function sendClear() {
  const msg = { type: "clear" };
  if (isHost) {
    connections.forEach(c => { if (c.open) c.send(msg); });
  } else if (hostConn && hostConn.open) {
    hostConn.send(msg);
  }
}

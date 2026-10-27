# SketchParty

**Draw on your phone. Guess on the TV.**

One page does everything. Host opens it on the TV (or the APK). Players scan the QR and join on their phones. Everyone sees the live drawing board.

No accounts. No separate TV page. Pure WebRTC via PeerJS.

## How it works

1. Host (TV / APK / laptop) opens `index.html` and taps **Host a Room**.
2. A short code + QR appear.
3. Players scan the QR or type the code → they join the same page.
4. The live canvas is visible on the host and on every phone. Drawing tools appear when it’s your turn (currently everyone can draw while we add proper turn logic).
5. Strokes stream in real time via WebRTC.

The host peer relays data. Signaling uses the free PeerJS cloud; strokes travel peer-to-peer.

## Quick Start

Open `index.html` (or enable GitHub Pages).

- Host: tap **Host a Room**
- Players: scan the QR or enter the code

That’s it. No config.

### APK for the TV host

Trigger the workflow in `.github/workflows/build-apk.yml` (Actions tab → Build Host APK). It builds a debug APK that loads the same `index.html`. Sideload it to an Android TV, Fire Stick, or tablet. Players still use their phone browsers.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Single app — host lobby (QR) + live board + player drawing/viewing |
| `js/game.js` | PeerJS host relay + player connections |
| `words.json` | Sample word packs |
| `.github/workflows/build-apk.yml` | Builds the host APK |

## Status

**Working**
- Host a room + QR + short code
- Join from phone (QR or code)
- Live stroke sync on host and all phones
- Pen / eraser / color / size / clear
- Everyone sees the live board

**Next**
- Turn order so only the current drawer gets the tools (others stay in view-only)
- Secret word shown only to the drawing team
- Timer, scoring, word packs
- Teams

## Tech

Vanilla HTML/CSS/JS + PeerJS (WebRTC). Works on GitHub Pages. Optional Capacitor APK for the host.

## License

MIT

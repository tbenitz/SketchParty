# SketchParty

**Draw on your phone. Guess on the TV.**

Multiplayer Pictionary-style game for living rooms. One device is the TV board. Players scan a QR code with their phones and draw. Strokes appear in real time on the big screen.

No accounts. No downloads required for players. Pure WebRTC via PeerJS — works on GitHub Pages with zero backend.

> Independent open-source project. Not affiliated with the commercial SketchParty TV app.

## How it works

1. Host opens `tv.html` on a TV, laptop, or the optional APK.
2. Host creates a room → short code + QR code appear.
3. Players scan the QR (or type the code) → their phone opens `index.html?room=CODE`.
4. Drawing on any phone streams live to the TV and every other player via WebRTC.

The host peer acts as a simple relay. Signaling uses the free PeerJS cloud; the actual stroke data is peer-to-peer.

## Quick Start

### Local / GitHub Pages

Just open the files (or enable GitHub Pages):

- Host: `tv.html`
- Players: `index.html` (or scan the QR)

No config, no API keys, no Firebase.

Serve locally if needed:
```bash
python -m http.server 8000
```

### APK for the TV host (sideload)

A GitHub Actions workflow can build an Android APK that wraps the TV host page. Once built, sideload it to an Android TV, Fire Stick, or tablet so the host experience is a native app with the QR code.

See `.github/workflows/build-apk.yml` (when added) or use Capacitor / a simple WebView wrapper. Players still join via browser/QR — no APK needed for them.

## Current files

| File | Purpose |
|------|---------|
| `tv.html` | Host / TV board — creates PeerJS room, shows QR, receives live strokes |
| `index.html` | Player phones — join via QR or code, draw, stream strokes |
| `js/game.js` | PeerJS host relay + player connection logic |
| `words.json` | Sample word packs |

## What's working

- Room creation with short join code
- QR code that opens the player page with the room pre-filled
- Player join by code or QR
- Live stroke streaming (normalized coordinates)
- Pen, eraser, color, size, clear
- Player list on the TV

## Still to build

- Teams and drawer / guesser roles
- Secret word shown only to the drawing team
- Timer, scoring, word packs, round flow
- Host controls (skip word, end game)
- Optional GitHub Actions APK build for the host view

## Tech

- Vanilla HTML/CSS/JS (no build step)
- PeerJS + WebRTC (free PeerJS cloud for signaling only)
- qrcodejs for QR generation
- Works on GitHub Pages or any static host
- Optional APK via Capacitor / GitHub Actions for the TV host

## License

MIT

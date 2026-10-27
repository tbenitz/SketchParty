# SketchParty

**Draw on your phone. Guess on the TV.**

A multiplayer Pictionary-style game built for living rooms. One device acts as the TV Board that everyone watches. Players scan a QR code with their phones to join and draw. Strokes appear in real time on the big screen.

No accounts. Instant QR join. Real-time stroke sync.

> **Note:** This is an independent open-source project. It is not affiliated with the commercial "SketchParty TV" app by Magnate Interactive.

## How Joining Works

1. Host opens `tv.html` on the TV / laptop.
2. Host creates a room → a QR code + short code appear.
3. Players scan the QR (or enter the code) on their phones → opens `index.html?room=CODE`.
4. Players join and can draw. Strokes stream live to the TV and every other phone via Firebase Realtime Database.

## Quick Start (Multiplayer)

### 1. Firebase setup (one-time, free)

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project.
2. Build → Realtime Database → Create database (start in **test mode** for development).
3. Project settings → General → Your apps → Add web app → copy the config.
4. In this repo:
   ```bash
   cp firebase-config.example.js firebase-config.js
   ```
   Paste your config into `firebase-config.js`.
5. (Optional but recommended) In Realtime Database rules, set:
   ```json
   {
     "rules": {
       "rooms": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```
   Tighten these later for production.

### 2. Run locally

Serve the folder (Firebase modules need a real server, not `file://`):

```bash
# Python
python -m http.server 8000
# or npx
npx serve .
```

- Open `http://localhost:8000/tv.html` on the TV/laptop.
- On phones, open the same URL but for `index.html`, or just scan the QR that appears.

### 3. GitHub Pages

Enable Pages (Settings → Pages → Source: main / root).  
Then use the Pages URL for both host and players (the QR will automatically point at the right place).

## Current Files

| File | Purpose |
|------|---------|
| `tv.html` | Host / TV board — creates room, shows QR, receives live strokes |
| `index.html` | Player phones — join via QR or code, draw, stream strokes |
| `js/game.js` | Shared room + stroke sync logic |
| `firebase-config.example.js` | Template for your Firebase keys |
| `words.json` | Sample word packs (easy/medium/hard + themed) |

## What's Implemented

- Room creation + short join code
- QR code that opens the player page with the room pre-filled
- Player join by code or QR
- Live stroke streaming (normalized coordinates so different screen sizes work)
- Pen, eraser, color, size, clear
- Player list on the TV

## Still to Build

- Teams and role rotation (drawer vs guessers)
- Secret word reveal only to the drawing team
- Timer, scoring, word packs, end-of-round scoreboard
- Host controls (skip, adjust timer, end game)
- Rejoin / presence cleanup polish
- Optional APK wrapper for the host view

## Tech

- Vanilla HTML/CSS/JS (no build step)
- Firebase Realtime Database for rooms and strokes
- qrcodejs for QR generation
- Works on GitHub Pages or any static host once Firebase is configured

## License

MIT

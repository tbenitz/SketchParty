# SketchParty

**Draw on your phone. Guess on the TV.**

A multiplayer Pictionary-style game built for living rooms. One device (or a simple hosted web page) acts as the TV Board that everyone watches. Players scan a QR code with their phones to join, form teams, and take turns drawing. The drawer (and their teammates) see the secret word on their phones. Everyone else sees the live drawing appear in real time on the big screen and on their own phones.

No accounts. No downloads (beyond an optional APK for the host). Instant QR join. Real-time stroke sync.

> **Note:** This is an independent open-source project. It is not affiliated with the commercial "SketchParty TV" app by Magnate Interactive (available on the App Store for Apple TV/iOS).

## Core Problem

Classic Pictionary is fun but clunky: paper, one shared board, people crowding around, and no easy way for everyone in the room (plus remote friends) to see clearly. Digital versions usually force everyone onto one device or require complex logins. SketchParty turns any phone into a drawing tablet and any TV into the shared board, with instant QR join, team play, and real-time sync.

## Architecture Overview

- **TV / Host View**: Full-screen drawing canvas + scores + current team + timer. Can run in a browser on a smart TV, Chromecast, laptop connected to TV, or as part of an optional APK.
- **Player Phones**: Join via QR → join/create team → receive role (drawer / guesser). Drawing happens in a simple canvas suite. Word is shown only to the drawing team.
- **Real-time Sync**: Drawing strokes stream from the active drawer’s phone to the TV board and all other players (WebSockets, Firebase Realtime Database, or a lightweight signaling server).
- **Static Drawing Suite**: A clean, self-contained HTML/JS drawing page (hosted on GitHub Pages or any static host) that players open. The main game can link to it or embed it.
- **APK Option**: The host/TV experience and game logic can be wrapped as an Android APK for easier living-room use, while players still join via browser/QR.

## Key Features

### Joining & Teams
- Host starts a game → generates a QR code + short join code
- Players scan QR (or enter code) on their phones — opens the player web app instantly
- Create or join teams (2+ teams supported)
- Roles rotate automatically: one drawer per turn, rest are guessers
- Word is revealed only on the phones of the drawing team; hidden from opponents and the TV

### Drawing Suite (Simple & Fast)
- Clean mobile canvas with:
  - Pen (adjustable size and color)
  - Eraser
  - Undo
  - Clear
  - Optional basic shapes or fill
- Optimized for finger/stylus drawing
- Low-latency stroke streaming so the TV updates in near real time
- Works entirely in the browser

### Game Flow & Rules
- Standard Pictionary rounds: draw the word, team guesses, opponents can also guess (or steal)
- Configurable timer per turn (e.g. 60–90 seconds)
- Word difficulty or categories (Easy / Medium / Hard, or themed packs)
- Scoring: points for correct guess, bonus for speed, optional penalty for wrong guesses
- Turn order and team rotation handled automatically
- End-of-round and final scoreboard

### TV Board Experience
- Large, clean canvas that mirrors the drawer’s strokes live
- Current word status (“Drawing…”), timer, active team, and scores always visible
- Guesses can be typed on phones and appear on the TV (or shouted, host confirms)
- Smooth animations for round start/end, correct guess celebrations, score updates

### Quality-of-Life
- Rejoin if someone refreshes or loses connection
- Host controls: skip word, adjust timer, end game
- Multiple word packs (or custom word lists the host can paste)
- Dark mode and high-contrast drawing colors for visibility on TV
- Optional sound effects (timer warning, correct guess)

## User Flows

### Setup
1. Host opens the TV view (browser or APK) and starts a new game
2. QR code appears on screen
3. Players scan → land in lobby → pick or create teams
4. Host hits “Start” when ready

### During a Turn
1. Active drawer’s phone shows the secret word + drawing tools
2. Teammates see the word too (so they can help or just watch)
3. Opponents and TV see only the live drawing + timer
4. Drawer sketches; strokes appear instantly on the TV and other phones
5. Guessers type or shout answers; correct guess ends the turn early and awards points
6. Timer runs out → next team’s turn

### After Game
- Final scores on TV
- Option to play again with same teams or reshuffle

## Screens / Structure

- **TV / Host**: Lobby (QR + teams), Live Board (canvas + HUD), Scoreboard
- **Player Phone**: Join screen, Team select, Waiting/Guesser view, Drawer view (word + tools), Guess input
- **Drawing Suite**: Standalone or embedded canvas page (the GitHub-hosted index)

## Tech Stack (Planned / Suggested)

- **Frontend**: Vanilla HTML/CSS/JS or lightweight framework (React/Vue/Svelte) for both TV and player views
- **Real-time**: WebSockets (Socket.io, PartyKit, or Firebase Realtime Database)
- **Hosting**: GitHub Pages for static assets; optional serverless backend for rooms/signaling
- **Optional APK**: Capacitor / Cordova / Trusted Web Activity wrapping the TV host view

## Getting Started

This repo is in early scaffolding stage.

1. Clone the repo
2. Open `index.html` (drawing suite prototype) or the TV host page in a browser
3. For multiplayer, a signaling/backend layer is still needed

### GitHub Pages

Enable GitHub Pages in the repo settings (source: main branch / root) to host the static drawing suite.

## Contributing

Ideas, PRs, and word packs welcome. This is an open living-room party game concept.

## License

MIT (or choose your own).

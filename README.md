# SketchParty ✏️

Draw on your phone. Guess on the TV. SketchParty is a multiplayer Pictionary-style drawing game that runs on GitHub Pages and as a **normal launcher-visible Android TV app**.

## Features

- Host a six-character WebRTC room. Friends scan a QR code or enter the code.
- **Late joiners see the complete whiteboard**: the host sends the existing stroke history, then live updates.
- **Identical drawing proportions** on PC, phone, tablet and TV. Every device renders a fixed 1200×675 (16:9) coordinate system; no screen-size distortion or clearing on resize.
- Pen, color, brush size, eraser, and synchronized clear.
- Nicknames are remembered locally and can be changed during play.
- **485 included Pictionary words**, split into easy / medium / hard. No API required.
- Timed rounds (45–180 seconds), rotating artists, text guesses and automatic scores.
- Correct guess earns **100 + remaining seconds** for the guesser and **50** for the artist. Only the host decides scores and reveals.
- Active guessers see a masked clue. The current artist and spectators see the full word. The host can be a referee/spectator or player.
- Host can adjust each player's points by ±25 or set an exact number, reset the scoreboard, end/skip rounds or start a completely fresh game.

## Play in the browser

Open **https://tbenitz.github.io/SketchParty/** (requires GitHub Pages enabled at repository Settings → Pages, source **Deploy from a branch**, main, /(root)).

1. On the TV/PC, select **Host room**, type a nickname and choose whether the host is playing or spectating. A QR code and room code appear.
2. Each phone scans the code or selects **Join room**, enters a nickname and joins as a player (or spectator).
3. Host closes the QR panel and selects **Start next round**. The current artist sees the word and has the drawing tools. Everyone else guesses. A TV acting as spectator can see the word and timer.
4. Host may change difficulty, round length or scores and begin a new game.

A PeerJS public signaling service connects browser peers; drawings are sent over WebRTC data channels. The **host must stay online**. No login, Firebase, API key or central game database is needed.

**Limitations:** Sessions are temporary. If the host disconnects, the room closes and scores/whiteboard are lost. Joining uses the public PeerJS signaling infrastructure, so all players need internet access. There is no account-based authentication, permanent scoring or moderation audit trail.

## Build and download the Android TV APK (no Android Studio needed)

This repository generates a real native Capacitor APK using GitHub Actions; the old third-party \`web-to-apk\` step has been removed.

1. Open **[Actions → Build Android TV APK](https://github.com/tbenitz/SketchParty/actions/workflows/build-apk.yml)**.
2. Select **Run workflow → main → Run workflow**, or open the latest automatic build after a push to main.
3. When the green build check appears, open that workflow run.
4. Scroll to **Artifacts**, click **SketchParty-AndroidTV-APK**, extract the ZIP and install **SketchParty-AndroidTV-debug.apk** on the TV box.
5. Open SketchParty from your TV's regular app launcher. It advertises both \`LAUNCHER\` and \`LEANBACK_LAUNCHER\` and provides a TV banner.

For a Mi Box you can transfer the APK from a Chromebook or Android phone using a file-sharing app, then enable app installation from that source on the TV. It is an ordinary user application — no default-home/launcher replacement and no ADB needed. TV users control UI buttons with a D-pad; players generally draw from phones.

**Build note:** This is a debug-signed test APK. GitHub-hosted build machines can produce different signing certificates on later runs; if an updated APK refuses to install over an older one, uninstall the older SketchParty first (which will erase that app's local saved nickname). For seamless production updates, configure a persistent release signing key and release workflow.

**APK invitation QR:** The APK contains its own copy of the web files, but the join QR intentionally points to the public GitHub Pages website. Enable GitHub Pages for the same repository before inviting phone players. The APK still needs internet for PeerJS signaling and QR script dependencies.

## Files

| File | Purpose |
| --- | --- |
| \`index.html\`, \`style.css\` | Responsive game layout, board and controls |
| \`js/app.js\` | Fixed-size canvas rendering, pointer input and UI |
| \`js/game.js\` | Host-authoritative PeerJS state, snapshot/replay, scoring, guessing |
| \`words.json\` | 485 common drawing prompts |
| \`package.json\`, \`capacitor.config.json\` | Capacitor Android project configuration |
| \`scripts/prepare-web.mjs\` | Copies the game into the APK web bundle |
| \`scripts/patch-android.mjs\` | Enables TV launcher and generates the banner |
| \`.github/workflows/build-apk.yml\` | Automated GitHub-hosted APK build |

## License

MIT

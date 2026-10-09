# NEON RUSH — Cyber Circuit

A browser-based multiplayer neon racer built with Three.js, Node.js, Express, and Socket.IO. It includes private room codes, up to eight pilots, procedurally generated winding neon roads with unlimited level progression, a finish gate at every level, server-validated finish times, per-level environmental themes, collectible coins and nitro refills, server-checked hazards, customizable car neon skins, coin-run challenges, local personal-best records, touch controls, drift/brake, nitro, synchronized cars, standings, countdowns, and a responsive HUD.

## Requirements
- Node.js 18 or newer
- npm
- A modern desktop or mobile browser with WebGL

## Install and run

**Important:** this is a Node.js server project. Opening `public/index.html` directly will not start the backend. Run the commands below from the `neon-rush` folder in a terminal.
```bash
cd neon-rush
npm install
npm start
```
Open **http://localhost:3000** in your browser. Check that the backend is responding at **http://localhost:3000/health**; it should return JSON such as `{"ok":true,"rooms":0}`. Open the URL in another browser window/device on the same network to test multiplayer. To play from another device, use the host computer's LAN IP and allow inbound TCP port 3000 through its firewall.

For automatic server restarts while developing:
```bash
npm run dev
```

Syntax checks:
```bash
npm run check
```

## Play
1. Enter a callsign and create a private room.
2. Share the five-character room code with another player.
3. The room owner and other players press **READY UP**. The countdown begins when at least two players are ready.
4. Drive along the generated winding road to the checkered finish gate at the end of the level. The first finish-line crossing wins; the standings rank finishers by server-recorded finish time. A three-minute limit ends stalled races and ranks remaining racers by progress. The results screen shows finish time, collected coins, hazards hit, personal bests, and NEXT LEVEL. Each new level regenerates the winding road, item/hazard layout, and environment palette.

| Input | Action |
|---|---|
| W / ↑ | Accelerate |
| S / ↓ | Brake / reverse |
| A / ← and D / → | Steer |
| Space | Drift / brake |
| Shift | Nitro boost |
| Touch controls | On-screen steer, accelerate, brake, drift, and nitro buttons on mobile |

## Upgrade features
- Coins and nitro refills are collected using server-validated proximity checks; coins are tracked per racer.
- Barriers and mines slow cars and drain nitro. Hazard interactions are checked by the server.
- Five visual palettes cycle through levels, while the road and item layout are regenerated deterministically for each level.
- Select a neon car skin in the lobby. The current session tracks total coins and a 10-coin level challenge.
- Best finish time per level is stored locally in the browser. Multiplayer coin totals and race rooms are in-memory only and reset when the server restarts.
| C | Cycle chase, overhead, and cockpit-style cameras |

## Project layout
```text
neon-rush/
├── package.json
├── server.js
├── README.md
└── public/
    ├── index.html
    ├── style.css
    └── client.js
```

## Implementation notes and limitations
- The server validates input shape and rate, owns the driving simulation, bounds car positions and speed, and calculates lap/finish state. Clients only send controls; they cannot submit positions or lap counts.
- Socket.IO reconnects automatically. The server retains a disconnected player slot for 15 seconds and attempts to restore the same racer when the same callsign rejoins. This prototype matches reconnects by callsign; production should use a signed session token.
- Each level builds a deterministic winding road from a level seed, with neon edge rails and a visible finish gate. The server tracks level distance and finish state, slows cars that leave the road, and resets racers when the next level is selected. Levels can continue indefinitely. Each client camera follows that client's own car, while car positions and physics remain server-authoritative. The city and cars are generated procedurally. Three.js is loaded as an ES module from jsDelivr, and fonts are loaded from Google Fonts, so the first launch needs internet access.
- This is a playable prototype, not a production anti-cheat or tournament server. This is a lightweight arcade circuit rather than a professional racing simulator; corner geometry, collision handling, and lap gates can be tuned further. Use a trusted network for public play, and add persistence, authoritative collision rollback, account identity, abuse controls, and integration tests before deploying publicly.
- `npm run check` validates JavaScript syntax. A full server/browser gameplay run was not possible in this environment because installing npm dependencies timed out; verify room creation, multiplayer synchronization, pickups, hazards, and level transitions locally in a modern browser before public deployment.


## Extreme upgrade (Build 02.10)
- Each level is now 2,600 world units long (5× the original 520-unit track). Server-side finish validation and the client track endpoint use the same length.
- Race timeout increased to 15 minutes to suit the longer course.
- Later levels feature stronger road bends, a narrower road, reduced steering grip, denser hazards, and more punishing collisions.
- Added procedural Web Audio effects for engine revs, drifting, pickups, hazards, countdown, race start, and finish. Use the SOUND ON/OFF toggle in the header; sound starts after a user gesture. No audio asset downloads are required.


## Latest upgrade: starting level and physical building impacts

- The room host can choose a starting level from 1 to 50 in the lobby, so racers can jump straight to harder levels without completing every previous level.
- Building collisions use an oriented car footprint and rectangle overlap tests, with edge-aware axis resolution to prevent corner clipping.
- Hard impacts reduce speed, can cause a small rebound/deflection, and trigger a camera shake plus collision sound/toast.
- Only the room host can change the starting level; choosing a new level resets ready states.



### Solid barrier collisions

Road barriers now use server-authoritative car-body collision checks, like buildings. The car cannot pass through them; head-on impacts sharply reduce speed and may rebound slightly, while side impacts allow sliding away. Barrier impacts also trigger a short camera shake and collision sound. Mines remain proximity hazards.

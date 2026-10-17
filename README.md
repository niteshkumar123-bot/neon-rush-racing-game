# NEON RUSH — Cyber Circuit

A browser-based multiplayer neon racer built with Three.js, Node.js, Express, and Socket.IO. It includes private room codes, up to eight pilots, procedurally generated winding neon roads with unlimited level progression, a finish gate at every level, server-authoritative finish validation, four sequential checkpoint gates, adjusted finish times with transparent penalties, per-level environmental themes, collectible coins and nitro refills, server-checked hazards, customizable car neon skins, local personal-best records and ghost rivals, checkpoint split analysis, touch controls, drift/brake, nitro, synchronized cars, standings, countdowns, and a responsive HUD.

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
4. Drive through all four visible checkpoint gates in order, then cross the checkered finish gate. A finish is accepted only after all checkpoints are validated by the server. Off-track excursions, solid impacts, mines, and racer collisions can add transparent time penalties; final standings use adjusted finish time. The 15-minute limit ends stalled races and ranks remaining racers by progress. Results show raw and adjusted time, penalty totals, checkpoint splits, coins, hits, and personal bests. A saved personal-best ghost can replay locally on the next attempt. Each new level regenerates the winding road, item/hazard layout, and environment palette.

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
- Select a neon car skin in the lobby. Coins are tracked per racer, and the HUD shows progress through the four checkpoint gates.
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


## Competitive challenge upgrade

- Four visible gates at 20%, 40%, 60%, and 80% of the course must be crossed in sequence and within the road corridor. Skipping a gate prevents a valid finish until the racer returns and crosses it correctly.
- The server applies a 1.0-second penalty when entering off-track, 1.5 seconds for a solid impact, 2 seconds for a mine, and 1 second to each racer for a registered racer collision. Repeated contact is cooldown-limited to avoid adding a penalty every physics tick.
- Finishers are ranked by adjusted time (`raw race time + penalties`). The results screen displays raw time, adjusted time, penalty total, checkpoint splits, collected coins, and hits.
- A local ghost is recorded from server snapshots and saved when a new personal best is achieved. It is a visual time-trial reference only; it does not collide with racers or affect multiplayer scoring. Ghosts and personal-best times are stored in that browser's local storage, separately per level.

## Verification checklist

Run `npm run check` first. Then launch `npm start` and verify in a modern browser:

1. Create a room and join from a second browser/device; ready-up countdown starts only when at least two players are ready.
2. Cross each checkpoint in order and confirm the HUD advances from `0/4` to `4/4`.
3. Attempt to drive past a checkpoint outside the road corridor; confirm a missed-checkpoint message appears and the finish is not accepted until the gate is crossed correctly.
4. Drive off the road and hit a barrier/building, mine, and another racer; confirm penalties are announced and included in adjusted time.
5. Finish a race, inspect checkpoint splits and adjusted time, then achieve a personal best and confirm a translucent ghost appears on the next run.
6. Test restart/next level, host level selection, disconnect/reconnect, mobile touch controls, and several repeated races.
7. Inspect browser console and server terminal for errors. Check `/health` responds with `ok: true`.

**Verification status:** Node syntax checks pass for `server.js` and `public/client.js`. Full browser and multiplayer runtime tests were not performed in this environment because project dependencies are not installed here; complete the checklist locally before presenting this build to judges.


## Neon AI Game Assistant

The game includes a built-in chat panel named **Neon AI**. Open it from the lower-right corner to ask about controls, drift, nitro, hazards, checkpoints, level difficulty, strategy, and your live race stats.

- No API key, paid service, or external chatbot request is required.
- Replies use local game-aware rules and the current multiplayer state.
- This is a lightweight offline assistant, not an open-ended generative LLM.
- It does not add an AI-controlled car to the race; it is a chat-based game helper.


## Solo racing against NEON BOT
From the main menu, choose **PLAY SOLO VS AI**, then press **READY UP** in the lobby. NEON BOT joins as a server-simulated racer and uses road look-ahead steering, obstacle avoidance, and nitro logic. No AI API key or external AI service is required; this is an in-game driving bot, not a chat model. Normal private-room multiplayer remains available.

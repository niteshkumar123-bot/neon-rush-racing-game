# NEON RUSH — Competitive Upgrade Notes

## Changes in this build

- Added four visible checkpoint gates at 20%, 40%, 60%, and 80% of the 2,600-unit track.
- Added server-authoritative ordered checkpoint validation. The finish gate is accepted only after all four checkpoints have been crossed inside the track corridor.
- Added transparent time penalties: 1.0 s when leaving the road, 1.5 s for solid impacts, 2.0 s for mine hits, and 1.0 s per racer for a registered racer collision. Contact penalties are cooldown-limited.
- Added adjusted finish times to snapshots and changed finisher ranking to compare adjusted times.
- Updated the HUD to show checkpoint progress.
- Added checkpoint split times and raw/adjusted race times to the results summary.
- Added a local translucent ghost rival from a saved personal-best run. Ghosts are visual-only, do not collide, and are stored locally per level.
- Updated README play instructions and a manual QA checklist.

## Preserved

- Existing Three.js rendering and procedural track generation.
- Node.js / Express / Socket.IO server architecture.
- Server-authoritative driving simulation and synchronized multiplayer cars.
- Existing room codes, ready countdown, reconnect handling, collectibles, hazards, car skins, nitro, sound, and level progression.

## Verification performed

- `node --check server.js` — passed.
- `node --check public/client.js` — passed.
- Source-level assertions for checkpoint enforcement, penalty events, adjusted-time ranking, ghost logic, and HUD checkpoint element — passed.

## Not yet verified

A full browser/multiplayer run was not possible in this environment because `express` and `socket.io` dependencies are not installed here. After extracting the ZIP, run `npm install`, `npm run check`, and `npm start`, then follow the manual verification checklist in `README.md`. Do not present the build as fully runtime-tested until those steps pass.

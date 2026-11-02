# LIFT

A stealth-puzzle adventure about a gentleman thief aboard vintage passenger trains.

**Play:** https://liftgame.vercel.app

Steal. Collect. Redistribute. Repeat. Ride procedurally generated trains, observe passengers, lift their valuables through tactile sleight-of-hand minigames, pick locks, dodge conductors and detectives, then decide back at the hideout whether to keep, fence, give away or return what you took.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrows (Shift to hurry) | Drag anywhere (drag further to hurry) |
| Act (lift, pick, hide…) | E / Space | Big round button |
| Observe a passenger | Hold Q | Hold OBSERVE |
| Throw coin / staged incident / card flourish | F / G / C | Small buttons |
| Pockets | I | POCKETS |
| Pause | Esc | ❚❚ |

## Structure

No build step — plain ES modules served statically.

- `index.html`, `css/style.css` — entry page and art-deco UI
- `js/main.js` — boot, screen routing, main loop
- `js/run.js` — in-run controller: camera, rendering, input, HUD, interactions, minigame orchestration, run results
- `js/screens.js` — title, hideout (trains, workshop, wardrobe, causes, collection, ledger) and settlement
- `js/ui.js` — toasts, modals, small widgets
- `js/world/*` — train generation, simulation/AI, rendering, characters, item icons
- `js/mini/*` — pickpocketing and lockpicking minigames
- `js/economy.js`, `js/save.js`, `js/audio.js`, `js/data/content.js` — economy, persistence, procedural audio, content

Run locally with any static server, e.g. `python3 -m http.server` and open http://localhost:8000.

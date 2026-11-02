# LIFT

**Play:** https://liftgame.vercel.app

A railway mystery of quick hands. You are Mr. Ambrose Tull, thirty years a ticket inspector on the Meridian lines. You know every trick the pickpockets know. Now you use them to steal stolen things back from the thieves and return them to their owners, without anyone ever noticing.

## The loop

1. **Patrol.** Walk a moving train. Checking tickets is your job and your cover: it calms suspicion and puts you right beside anyone.
2. **Observe.** Hold Observe beside a passenger. Thieves give themselves away: lingering by a mark, odd tickets, a look exchanged with a partner. Some honest passengers just behave strangely.
3. **Identify.** Three clues, or one theft seen with your own eyes, and a thief is identified, along with the pocket the loot went into.
4. **Intercept: the Double Lift.** Lift the stolen item back off the thief. It works best while they're busy working their next mark. A wrong pocket on an honest passenger costs you.
5. **Return.** Slip it back into the owner's pocket before they notice (the Plant), or hand it over.
6. **Escalate.** Crews pass loot between accomplices, blockers distract marks, and spooked thieves ditch the goods or jump off at the next station.

**Suspicion** is the central resource. Hovering, staring, hurrying and fumbling get you talked about. Duties, kindness and returns calm things down. Push too far and Superintendent Crabbe takes you aside.

## Progression

- **The Craft:** hands and eyes (steadier lifts, faster observation, eye-lines, a bigger satchel).
- **The Cover:** uniforms (Inspector, Steward, Attendant, Chief Inspector, Off-Duty Tweeds), keys and credentials. Each uniform changes your duties and access.
- **The Network:** a friendly porter, gossiping regulars, the Rogues' Gallery, station constables, manifests.
- **Case files** on eleven recurring thieves, a ledger of every belonging returned, missions with star ratings, five routes unlocked by seniority, and memoirs.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Walk / hurry | WASD or arrows / Shift | Drag anywhere / drag further |
| Main action (ticket, lift, return…) | E / Space | Big round button |
| Alternate action | R | Small button above it |
| Observe | Hold Q | Hold OBSERVE |
| Notebook / satchel / whistle | N / B / H | Buttons |
| Pause | Esc | ❚❚ |

## Structure

Plain ES modules, no build step.

- `js/data/cast.js`: protagonist, uniforms, theft techniques, the rogues' gallery, missions, progression trees, memoirs
- `js/world/patrol.js`: the inspector's train on top of the core sim (thief AI, crews, clues, suspicion, duties, stations)
- `js/run.js`: in-run controller (camera, rendering, input, HUD, the double lift, returns, notebook, Superintendent)
- `js/missions.js`: objectives, ratings and rewards
- `js/screens.js`: title, depot hub and shift report
- `js/mini/plant.js`: the discreet-return minigame; `js/mini/pickpocket.js` and `js/mini/lockpick.js` hold the lift, pat-down and lock games
- `js/world/{gen,sim,render,chars,icons}.js`: train generation, movement and pathfinding, rendering, characters, item art
- `js/save.js`, `js/audio.js`, `js/ui.js`: persistence with mid-shift resume, procedural audio, toasts and modals

Run locally with any static server, e.g. `python3 -m http.server`.

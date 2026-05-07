# GAME DESIGN DOCUMENT
## Ezreal's Descent

**Otso Weckström — 0547090**

---

## Tools Summary

| Area | Tool |
|------|------|
| Source code | JavaScript (ES6), Phaser 3.60.0 game framework |
| Graphics | Phaser 3 Canvas API — all sprites and environments are procedurally drawn in code, no external image files |
| SFX / Music | Web Audio API — all sounds are synthesized procedurally in code using oscillators and noise buffers, no audio files |
| Other | Git / GitHub for version control |

**Link to project video:** `<link to video here>`

---

## 1. Executive Summary

Ezreal's Descent is a top-down action roguelike dungeon crawler playable in any modern web browser. The player controls a spell-casting mage character inspired by the League of Legends champion Ezreal, navigating through procedurally generated dungeon floors filled with enemies. Each floor ends with a boss encounter. Defeating the boss pauses the run and presents three random upgrade items to choose from before the player descends to the next floor, where enemies are stronger. The goal is to clear all three floors and defeat the final boss.

The game is built entirely in JavaScript using the Phaser 3 framework with no external asset files — all visuals are drawn with the Canvas API and all audio is synthesized via the Web Audio API.

---

## 2. Target Audience

- **Primary**: Casual to mid-core PC gamers aged 16–30 who enjoy short-session action games
- **Secondary**: Fans of roguelike games such as The Binding of Isaac, Enter the Gungeon, or Hades who appreciate ability-based combat and run variety through item upgrades
- **Platform**: Desktop web browser (Chrome, Firefox, Edge, Safari) — mouse and keyboard required
- **Session length**: A full three-floor run takes approximately 15–25 minutes, making it suitable for short gaming sessions

---

## 3. Main Characters

### Ezreal (Player Character)
A blue-armored mage equipped with an arcane gauntlet that fires energy projectiles. Ezreal is a quick, mobile character who rewards skillful aim and ability timing.

- **Appearance**: Blue circular body with gold armor accents, white eyes, brown hair. Rotates to face the mouse cursor at all times.
- **Role**: Player-controlled protagonist. Navigates dungeon rooms, defeats enemies, collects upgrades, and descends floor by floor.
- **Strengths**: High burst damage potential, a teleport ability for repositioning, and a screen-crossing ultimate shot
- **Weaknesses**: Low base HP; relies on player skill to avoid incoming projectiles and contact damage

---

## 4. Main Features

### 4.1 Main Mechanics

**Dungeon Progression**
The game generates a new dungeon of 12 connected rooms each run using a randomised BFS-style layout algorithm (inspired by The Binding of Isaac). Rooms are connected by doors that only open once all enemies in the room are defeated. One room is designated the Boss Room (furthest from the start by BFS distance), and dead-end rooms become Treasure Rooms containing a healing pickup.

**Floor System**
The game spans three floors. After defeating the boss on each floor, the player is presented with three random items from a pool of eight. They choose one, then descend to the next floor where enemies have scaled-up HP, speed, and damage. Clearing all three floors triggers the victory screen.

**Item Upgrades**
After each boss kill, the player picks one of three randomly offered items:

| Item | Effect |
|------|--------|
| Arcane Amplifier | All ability damage +30% |
| Phase Walk | Movement speed +25% |
| Arcane Heart | Max HP +60, restore to full |
| Rapid Fire | Auto-attack 35% faster |
| Essence Surge | W and R damage +50% |
| Blink Mastery | E cooldown −40%, blink range +120 px |
| Iron Will | Invincibility frames +60% |
| Mystic Charge | Q empowers next 3 auto-attacks instead of 1 |

**Mark System**
The W ability (Essence Flux) fires a piercing projectile that marks all enemies it passes through. Any subsequent hit on a marked enemy detonates the mark for bonus damage (+25). Marks expire after 4 seconds.

**Invincibility Frames**
After taking damage the player is invincible for 1.4 seconds (extendable with Iron Will). During this window the character flashes to signal the iFrame state.

### 4.2 Movement

The player moves with **WASD** in eight directions. Diagonal movement is normalised to prevent faster diagonal speed. The character always faces the mouse cursor, rotating smoothly in real time.

**Arcane Shift (E)** provides an instant blink teleport toward the cursor up to 370 px (extendable). On arrival a projectile automatically fires at the nearest enemy. This is the primary repositioning tool and is essential for dodging boss attacks or escaping surrounded positions.

During the **R ability charge** (1 second) movement is locked; the player must commit to the shot direction before firing.

### 4.3 Physics

- **Engine**: Phaser 3 Arcade Physics (2D top-down, no gravity)
- **Player collision**: Circular physics body (radius 16 px) collides with static wall and obstacle bodies
- **Enemy collision**: Per-enemy circular physics bodies; enemies bounce off room walls and obstacle pillars using manual velocity reflection
- **Projectiles**: Physics sprites with velocity set at spawn; destroyed on wall/obstacle hit or when max range is exceeded. W and R projectiles pierce through multiple enemies. R ignores all walls and obstacles (flies over them)
- **Obstacles**: Random stone pillars placed in each room block both movement and most projectiles, creating tactical cover

### 4.4 Multiplayer Mode

The game is single-player only. There is no multiplayer mode.

---

## 5. Genre, Setting, Concept Art

**Genre**: Top-down action roguelike / dungeon crawler

**Setting**
Ezreal descends into a series of ancient underground dungeons. Each floor is darker and more dangerous than the last. The visual style uses a muted brown-and-stone colour palette for dungeon floors and walls, with vibrant neon blue, gold, and purple ability effects to make combat feel energetic and readable against the dark backgrounds.

**Visual style**
All art is procedurally drawn using the Phaser 3 Canvas API:
- Dungeon rooms: checkerboard floor tiles in two shades of brown, dark stone walls with a lighter top edge, 3D-shaded stone pillar obstacles
- Player: blue circle with gold armour stripe and white eyes, rotates to face cursor
- Enemies: colour-coded circles with distinguishing details (grunt = red with stripe, shooter = orange with cannon, charger = purple with horns, boss = dark red with gold crown and red glowing eyes)
- Projectiles: glowing coloured ellipses with a bright white core; each ability has a unique colour (auto = light blue, Q = gold, W = blue, E = cyan, R = deep blue)
- UI: dark panel HUD with rounded ability slots, green/yellow/red HP bar, minimap in top right, floor indicator top centre

**Concept summary**
The aesthetic goal is clarity — the player must be able to read the battlefield at a glance. Enemy colours match the danger they represent (red = aggressive melee, orange = ranged, purple = high-impact charger, dark red = boss). Ability projectiles are colour-matched to their HUD icons so the player always knows which spell is in flight.

---

## 6. Enemies, NPCs, Other Objects

### Grunt (Red)
- **Behaviour**: Directly chases the player at all times
- **Attack**: Deals contact damage (15 per hit)
- **HP**: 80 (scales +22% per floor)
- **Threat**: Low individually, dangerous in groups; forces the player to keep moving

### Shooter (Orange)
- **Behaviour**: Maintains a preferred distance of 250 px from the player, retreating if too close and advancing if too far. Fires a projectile every 2.2 seconds
- **Attack**: Ranged projectile (12 damage); no contact damage
- **HP**: 55 (scales per floor)
- **Threat**: Medium; punishes players who stand still

### Charger (Purple)
- **Behaviour**: Three-state machine — wanders randomly, then telegraphs a charge with a 0.7s flashing windup, then launches in a straight line at high speed for 0.55s. Cooldown before next charge.
- **Attack**: High contact damage during charge (20). Bounces off walls during the charge.
- **HP**: 110 (scales per floor)
- **Threat**: High; requires the player to dodge the windup and use Arcane Shift reactively

### Boss (Dark Red)
- **Behaviour**: Slow persistent chase combined with a spread projectile burst (3 shots, every 1.5s) and periodic charge attacks. Below 50% HP the shoot cooldown drops to 0.9s and spreads 5 projectiles instead of 3.
- **Attack**: Contact damage (25), spread projectiles (12 each)
- **HP**: 600 (scales per floor)
- **Phases**: Single phase with escalating aggression below 50% HP
- **Threat**: Very high; requires managing both incoming spread shots and the charge pattern simultaneously

### Treasure Pickup (Gold Diamond)
- Not an enemy — a floating gold diamond in Treasure Rooms. Walking over it heals 50 HP and permanently increases max HP by 25.

### Stone Pillar Obstacles
- Randomly placed solid obstacles in each room (3–6 in normal rooms, 2–4 in Boss Room, none in Start Room). Block player and enemy movement and destroy most projectiles on contact. R (Trueshot) flies over them.

---

## 7. Story Overview

### 7.1 Story Overview
Ezreal, pursuing ancient arcane knowledge, discovers a sealed dungeon rumoured to contain a powerful artefact at its deepest level. Driven by curiosity and overconfidence, he descends alone. Each floor is guarded by increasingly powerful corrupted constructs and a floor guardian. Ezreal must use his arcane gauntlet abilities and any power-ups he finds along the way to fight through three floors and claim the artefact at the bottom.

The story is told implicitly through the game structure — there is no dialogue. The descending floor system, escalating enemy strength, and final boss create a natural narrative arc of challenge and resolution.

### 7.2 Progression — Floor 1
The first dungeon floor. Standard enemy mix of Grunts, Shooters, and Chargers at base difficulty. The player learns the room-clearing loop, experiments with abilities, and meets the floor guardian (boss) for the first time. On boss defeat, the first item choice is offered and the player descends.

### 7.3 Progression — Floor 2
Enemies have 22% more HP, move 8% faster, and deal 15% more damage than Floor 1. The player now has one upgrade from Floor 1, enabling more aggressive play. The boss fires 5-projectile spreads below half HP. Second item choice on boss defeat.

### 7.4 Progression — Floor 3 (Final)
Enemies are noticeably stronger. The player carries two upgrades and must use both effectively. The final boss is the most dangerous encounter in the game. Defeating it with two chosen items triggers the victory screen with the total kill count. Press R to restart from Floor 1.

---

## 8. Technical Definitions

### 8.1 Platforms and Versions
- **Target platform**: Desktop web browser
- **Tested on**: Chrome 120+, Firefox 120+
- **Engine**: Phaser 3.60.0 (loaded via CDN — no installation required)
- **Language**: JavaScript ES6
- **Resolution**: 1024 × 768 px, fixed canvas, centred on black background
- **No build tools required** — open `index.html` directly in a browser

### 8.2 Control Scheme

| Input | Action |
|-------|--------|
| W / A / S / D | Move up / left / down / right |
| Mouse | Aim all abilities |
| Left Mouse Button (hold) | Auto-attack — fires continuously while held |
| Right Mouse Button | Mystic Shot (Q) — fires a gold projectile; empowers the next auto-attack for 1.5× damage |
| Q key | Essence Flux (W) — fires a piercing blue projectile that marks enemies for bonus damage |
| E key | Arcane Shift (E) — instantly blinks to cursor position (max 370 px) and fires at nearest enemy |
| R key | Trueshot (R) — 1-second charge-up, then fires a powerful piercing shot that travels the full room |
| ESC | Pause game / view current stats and collected upgrades |
| R (on death / victory screen) | Restart from Floor 1 |

### 8.3 Technical Architecture

The codebase is split across six JavaScript files loaded in order:

| File | Responsibility |
|------|---------------|
| `audio.js` | `AudioManager` class — Web Audio API procedural SFX |
| `constants.js` | Global layout, damage, cooldown, colour constants; item definitions |
| `entities.js` | `Projectile`, `Enemy`, `Player` classes |
| `dungeon.js` | `DungeonGenerator` — procedural 12-room layout via random BFS walk |
| `GameScene.js` | Main Phaser scene — game loop, room management, floor transitions, item selection, pause |
| `HUDScene.js` | Overlay Phaser scene — HP bar, ability cooldowns, minimap, floor indicator, kill counter |
| `StartScene.js` | Title screen with controls reference |
| `main.js` | Phaser game configuration and scene list |

**Floor persistence**: Player stats and collected upgrades are serialised into a plain object and passed to `scene.restart()` via Phaser's scene data API when descending floors, avoiding the need for localStorage or a backend.

### 8.4 Limitations
- Requires a desktop browser with JavaScript enabled; no mobile support (mouse and keyboard required)
- No save system — progress is lost on page refresh
- No fullscreen mode — fixed 1024 × 768 canvas
- Audio requires a user interaction before the first sound plays (Web Audio API browser policy — resolved by initiating on the start screen click)

---

## 9. Business Definitions

### 9.1 In-App Purchases
None. The game is a free, self-contained browser game developed as a university course project. No monetisation is implemented or planned.

### 9.2 DLC Packs
No DLC. Potential future content areas if the project were continued:
- Additional item pool (weapon skins, passive abilities)
- Additional enemy types for floors 4+
- A fourth floor with a true final boss encounter
- Procedural background music using the existing Web Audio API infrastructure

---

## 10. Outsourced / Bought Assets

**None.** All content in Ezreal's Descent was created from scratch during development:

| Asset type | Source |
|------------|--------|
| All sprites and environments | Procedurally drawn at runtime using Phaser 3 Canvas API graphics calls (`fillCircle`, `fillRect`, `fillPoints`, etc.) |
| All sound effects | Synthesized at runtime using Web Audio API oscillator and noise nodes — no audio files |
| Game engine | Phaser 3.60.0, open-source (MIT licence), loaded via public CDN |
| Font | Arial / Arial Black — system font, no custom typeface |

The character concept is inspired by Ezreal from League of Legends (Riot Games), but all visual and mechanical implementation is original work. No Riot Games assets are used.

---

*Document version 1.0 — Otso Weckström, 0547090*

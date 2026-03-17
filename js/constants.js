// ─── LAYOUT ──────────────────────────────────────────────────────────────────
const GAME_W = 1024;
const GAME_H = 768;
const TILE  = 64;

// Room is 13 tiles wide x 9 tiles tall (walls included)
const ROOM_COLS = 13;
const ROOM_ROWS = 9;
const ROOM_W = ROOM_COLS * TILE;   // 832
const ROOM_H = ROOM_ROWS * TILE;   // 576
const OX = Math.floor((GAME_W - ROOM_W) / 2);   // 96
const OY = Math.floor((GAME_H - ROOM_H) / 2);   // 96

// Inner play-area (excludes wall tiles)
const INNER_L = OX + TILE;
const INNER_R = OX + ROOM_W - TILE;
const INNER_T = OY + TILE;
const INNER_B = OY + ROOM_H - TILE;

// Door openings are 2 tiles wide, centred on each wall
// North/South doors: cols 6-7 (x range), rows 0 / ROOM_ROWS-1
// East/West doors:   rows 4-5 (y range), cols 0 / ROOM_COLS-1
const DOOR_W_TILES = 2;
const DOOR_H_TILES = 2;
const DOOR_COL = Math.floor((ROOM_COLS - DOOR_W_TILES) / 2); // 5
const DOOR_ROW = Math.floor((ROOM_ROWS - DOOR_H_TILES) / 2); // 3

// ─── PLAYER ──────────────────────────────────────────────────────────────────
const PLAYER_SPEED = 210;
const PLAYER_MAX_HP = 100;
const IFRAME_MS = 1400;     // invincibility after getting hit

// ─── COOLDOWNS (ms) ──────────────────────────────────────────────────────────
const CD_AUTO = 380;
const CD_Q    = 1100;
const CD_W    = 3000;
const CD_E    = 3500;
const CD_R    = 9000;

// ─── DAMAGE ──────────────────────────────────────────────────────────────────
const DMG_AUTO = 22;
const DMG_Q    = 60;
const DMG_W    = 50;   // mark + detonation bonus = +25
const DMG_MARK_BONUS = 25;
const DMG_E    = 35;
const DMG_R    = 300;

// ─── PROJECTILE SPEEDS ───────────────────────────────────────────────────────
const SPD_AUTO  = 560;
const SPD_Q     = 720;
const SPD_W     = 500;
const SPD_R     = 1600;
const SPD_ENEMY = 240;

// ─── RANGE (px) ──────────────────────────────────────────────────────────────
const RANGE_AUTO = 580;
const RANGE_Q    = 700;
const RANGE_W    = 750;
const RANGE_R    = 2400;

// ─── COLORS ──────────────────────────────────────────────────────────────────
const CLR = {
    floor:          0x5c3d1e,
    floorAlt:       0x6b4a28,
    wall:           0x3b2409,
    wallFront:      0x2a1800,
    doorOpen:       0x8b5e2a,
    doorClosed:     0x1a0d00,
    obstacle:       0x4a2e10,

    player:         0x4499ff,
    playerAccent:   0xffcc33,

    enemyGrunt:     0xff3355,
    enemyShooter:   0xff8833,
    enemyCharger:   0xcc44ff,
    enemyBoss:      0x990033,

    projAuto:       0xaaddff,
    projQ:          0xffbb33,
    projW:          0x4488ff,
    projE:          0x33ffee,
    projR:          0x3366ff,
    projEnemy:      0xff5555,

    mark:           0x5577ff,
    hp:             0xff4444,
    hpBg:           0x222222,
    xpBar:          0x44aaff,
};

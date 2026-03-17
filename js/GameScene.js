class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    // ─── CREATE ──────────────────────────────────────────────────────────────
    create() {
        this._buildTextures();

        // Dungeon
        const dun = DungeonGenerator.generate(12);
        this.dungeonGrid = dun.grid;
        this.currentKey  = dun.startKey;
        this.bossKey     = dun.bossKey;

        // Group containers
        this.projGroup      = this.physics.add.group();
        this.enemProjGroup  = this.physics.add.group();
        this.enemiesGroup   = this.physics.add.group();
        this.enemies        = [];
        this.projectiles    = [];
        this.wallsGroup     = this.physics.add.staticGroup();
        this._wallColliders = [];

        // Room graphics layer
        this.roomGfx  = this.add.graphics().setDepth(0);
        this.doorGfx  = this.add.graphics().setDepth(1);

        // Player
        const cx = OX + ROOM_W / 2;
        const cy = OY + ROOM_H / 2;
        this.player = new Player(this, cx, cy);

        // Physics world bounds = full canvas (no auto boundary)
        this.physics.world.setBounds(0, 0, GAME_W, GAME_H);

        // Draw first room
        this._enterRoom(this.currentKey, null);

        // HUD scene
        this.scene.launch('HUDScene');
        this.hud = this.scene.get('HUDScene');

        // Emit initial hp
        this.time.delayedCall(100, () => {
            this.events.emit('playerHpChanged', this.player.hp, this.player.maxHp);
            this.events.emit('dungeonChanged', this.dungeonGrid, this.currentKey);
        });
    }

    // ─── UPDATE ──────────────────────────────────────────────────────────────
    update(time, delta) {
        if (!this.player.alive) return;

        this.player.update(delta);

        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.alive) { this.enemies.splice(i, 1); continue; }
            e.update(delta, this.player.sprite);
        }

        // Update player projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (!p.alive) { this.projectiles.splice(i, 1); continue; }
            p.update();
        }

        // Collisions: player projectiles vs enemies
        for (const proj of this.projectiles) {
            if (!proj.alive || proj.isEnemy) continue;
            for (const enemy of this.enemies) {
                if (!enemy.alive) continue;
                if (proj.hitEnemies.has(enemy)) continue;
                if (this.physics.overlap(proj.sprite, enemy.sprite)) {
                    proj.hitEnemies.add(enemy);
                    if (proj.marksEnemy) {
                        enemy.applyMark();
                    } else {
                        enemy.takeDamage(proj.damage);
                    }
                    if (!proj.piercing) proj.destroy();
                }
            }
        }

        // Collisions: enemy projectiles vs player
        this.physics.overlap(this.player.sprite, this.enemProjGroup, (pSprite, eProj) => {
            const ref = eProj.projRef;
            if (ref && ref.alive) {
                ref.destroy();
                this.player.takeDamage(12);
            }
        });

        // Collisions: enemy contact vs player
        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            if (this.physics.overlap(this.player.sprite, enemy.sprite)) {
                this.player.takeDamage(enemy.cfg.contactDmg);
            }
        }

        // Check room transitions
        this._checkDoorTransition();

        // Emit CD data to HUD
        this.events.emit('cdUpdate', this.player.cds);
    }

    // ─── ROOM BUILDING ───────────────────────────────────────────────────────
    _enterRoom(key, fromDir) {
        this.currentKey = key;
        const room = this.dungeonGrid.get(key);
        room.visited = true;

        // Clear old enemies / projectiles
        this._clearEnemies();
        this._clearProjectiles();

        // Draw floor + walls
        this._drawRoom(room);
        this._buildWalls(room);

        // Spawn enemies if not cleared
        if (!room.cleared) {
            this._spawnEnemies(room);
            // Some rooms (e.g. treasure) mark themselves cleared during spawn —
            // rebuild walls immediately so door bodies are removed.
            if (room.cleared) {
                this._buildWalls(room);
                this._refreshDoors();
            }
        }

        // Position player at entry door
        const cx = OX + ROOM_W / 2;
        const cy = OY + ROOM_H / 2;
        if (fromDir === 'north') {
            this.player.sprite.setPosition(cx, INNER_T + 30);
        } else if (fromDir === 'south') {
            this.player.sprite.setPosition(cx, INNER_B - 30);
        } else if (fromDir === 'east') {
            this.player.sprite.setPosition(INNER_R - 30, cy);
        } else if (fromDir === 'west') {
            this.player.sprite.setPosition(INNER_L + 30, cy);
        } else {
            this.player.sprite.setPosition(cx, cy);
        }

        this.events.emit('dungeonChanged', this.dungeonGrid, this.currentKey);

        // Fade in
        this.cameras.main.fadeIn(200, 0, 0, 0);
    }

    // Generate obstacle tile positions for a room (called once, stored in room data)
    _generateObstacles(room) {
        if (room.obstacles) return; // already generated
        if (room.type === 'start') { room.obstacles = []; return; }

        const dc = DOOR_COL, dr = DOOR_ROW;
        const midCol = Math.floor(ROOM_COLS / 2);
        const midRow = Math.floor(ROOM_ROWS / 2);
        const count  = room.type === 'boss' ? Phaser.Math.Between(2, 4) : Phaser.Math.Between(3, 6);
        const placed = [];

        const isForbidden = (col, row) => {
            // Must be inner tile (not wall row/col)
            if (col <= 1 || col >= ROOM_COLS - 2) return true;
            if (row <= 1 || row >= ROOM_ROWS - 2) return true;
            // Keep center 3x3 clear for player spawn
            if (Math.abs(col - midCol) <= 1 && Math.abs(row - midRow) <= 1) return true;
            // Keep door corridors clear (1 tile buffer around each door)
            if (Math.abs(row - 1) <= 1 && Math.abs(col - dc) <= 1) return true;           // north
            if (Math.abs(row - (ROOM_ROWS - 2)) <= 1 && Math.abs(col - dc) <= 1) return true; // south
            if (Math.abs(col - 1) <= 1 && Math.abs(row - dr) <= 1) return true;           // west
            if (Math.abs(col - (ROOM_COLS - 2)) <= 1 && Math.abs(row - dr) <= 1) return true; // east
            // No overlapping
            if (placed.some(p => p.col === col && p.row === row)) return true;
            return false;
        };

        let attempts = 0;
        while (placed.length < count && attempts < 200) {
            attempts++;
            const col = Phaser.Math.Between(2, ROOM_COLS - 3);
            const row = Phaser.Math.Between(2, ROOM_ROWS - 3);
            if (!isForbidden(col, row)) placed.push({ col, row });
        }
        room.obstacles = placed;
    }

    _drawRoom(room) {
        this.roomGfx.clear();
        this.doorGfx.clear();

        const g   = this.roomGfx;
        const t   = TILE;
        const ox  = OX, oy = OY;

        // Floor tiles (checkerboard subtle)
        for (let row = 1; row < ROOM_ROWS - 1; row++) {
            for (let col = 1; col < ROOM_COLS - 1; col++) {
                const even = (row + col) % 2 === 0;
                g.fillStyle(even ? CLR.floor : CLR.floorAlt);
                g.fillRect(ox + col * t, oy + row * t, t, t);
            }
        }

        // Wall tiles
        for (let col = 0; col < ROOM_COLS; col++) {
            for (let row = 0; row < ROOM_ROWS; row++) {
                const isWall =
                    col === 0 || col === ROOM_COLS - 1 ||
                    row === 0 || row === ROOM_ROWS - 1;
                if (!isWall) continue;

                if (this._isDoorTile(room, col, row)) continue;

                const isBottom = row === ROOM_ROWS - 1;
                g.fillStyle(isBottom ? CLR.wallFront : CLR.wall);
                g.fillRect(ox + col * t, oy + row * t, t, t);
                if (!isBottom) {
                    g.fillStyle(0x7a5030);
                    g.fillRect(ox + col * t, oy + row * t, t, 4);
                }
            }
        }

        // Obstacle pillars
        this._generateObstacles(room);
        for (const { col, row } of room.obstacles) {
            const wx = ox + col * t;
            const wy = oy + row * t;
            const inset = 6;

            // Shadow
            g.fillStyle(0x1a0d00, 0.6);
            g.fillRect(wx + inset + 4, wy + inset + 4, t - inset * 2, t - inset * 2);
            // Base block face
            g.fillStyle(0x4a2e10);
            g.fillRect(wx + inset, wy + inset, t - inset * 2, t - inset * 2);
            // Top highlight
            g.fillStyle(0x7a5535);
            g.fillRect(wx + inset, wy + inset, t - inset * 2, 6);
            // Left highlight
            g.fillStyle(0x6a4525);
            g.fillRect(wx + inset, wy + inset, 6, t - inset * 2);
            // Bottom/right shadow face
            g.fillStyle(0x2a1600);
            g.fillRect(wx + inset, wy + t - inset - 5, t - inset * 2, 5);
            g.fillRect(wx + t - inset - 5, wy + inset, 5, t - inset * 2);
            // Crack detail
            g.lineStyle(1, 0x2a1600, 0.5);
            g.lineBetween(wx + inset + 10, wy + inset + 8, wx + inset + 14, wy + inset + 18);
        }

        // Draw doors (open = coloured arch, closed = dark)
        this._drawDoors(room);

        // Room type indicator
        if (room.type === 'boss') {
            this._drawBossDecal();
        } else if (room.type === 'treasure') {
            this._drawTreasureDecal(room);
        }
    }

    _isDoorTile(room, col, row) {
        // Only treat as open (no wall body) when the room is cleared
        if (!room.cleared) return false;
        const dc = DOOR_COL, dr = DOOR_ROW;
        if (row === 0 && room.doors.north && col >= dc && col < dc + DOOR_W_TILES) return true;
        if (row === ROOM_ROWS - 1 && room.doors.south && col >= dc && col < dc + DOOR_W_TILES) return true;
        if (col === 0 && room.doors.west  && row >= dr && row < dr + DOOR_H_TILES) return true;
        if (col === ROOM_COLS - 1 && room.doors.east && row >= dr && row < dr + DOOR_H_TILES) return true;
        return false;
    }

    _drawDoors(room) {
        const g  = this.doorGfx;
        const t  = TILE;
        const dc = DOOR_COL, dr = DOOR_ROW;
        const open = room.cleared;
        const col  = open ? CLR.doorOpen : CLR.doorClosed;

        const drawDoor = (x, y, w, h) => {
            g.fillStyle(col);
            g.fillRect(x, y, w, h);
            g.lineStyle(2, open ? 0x9966cc : 0x330044);
            g.strokeRect(x, y, w, h);
        };

        if (room.doors.north) {
            drawDoor(OX + dc * t, OY, DOOR_W_TILES * t, t);
        }
        if (room.doors.south) {
            drawDoor(OX + dc * t, OY + (ROOM_ROWS - 1) * t, DOOR_W_TILES * t, t);
        }
        if (room.doors.west) {
            drawDoor(OX, OY + dr * t, t, DOOR_H_TILES * t);
        }
        if (room.doors.east) {
            drawDoor(OX + (ROOM_COLS - 1) * t, OY + dr * t, t, DOOR_H_TILES * t);
        }
    }

    _buildWalls(room) {
        // Remove old colliders and static bodies
        for (const c of this._wallColliders) this.physics.world.removeCollider(c);
        this._wallColliders = [];
        if (this._wallRects) this._wallRects.forEach(r => r.destroy());
        this._wallRects = [];

        const addStaticRect = (wx, wy, w, h) => {
            const rect = this.add.rectangle(wx, wy, w, h);
            this.physics.add.existing(rect, true);
            rect.body.setSize(w, h);
            rect.body.updateFromGameObject();
            this._wallRects.push(rect);
            this.wallsGroup.add(rect);
        };

        // Outer wall tiles
        for (let col = 0; col < ROOM_COLS; col++) {
            for (let row = 0; row < ROOM_ROWS; row++) {
                const isEdge = col === 0 || col === ROOM_COLS - 1 || row === 0 || row === ROOM_ROWS - 1;
                if (!isEdge) continue;
                if (this._isDoorTile(room, col, row)) continue;
                addStaticRect(OX + col * TILE + TILE / 2, OY + row * TILE + TILE / 2, TILE, TILE);
            }
        }

        // Obstacle pillars (slightly inset so corners feel fair)
        this._generateObstacles(room);
        const INSET = 8;
        const OBS_SIZE = TILE - INSET * 2;
        for (const { col, row } of room.obstacles) {
            addStaticRect(OX + col * TILE + TILE / 2, OY + row * TILE + TILE / 2, OBS_SIZE, OBS_SIZE);
        }

        const c1 = this.physics.add.collider(this.player.sprite, this.wallsGroup);
        this._wallColliders.push(c1);
    }

    _drawBossDecal() {
        const g = this.roomGfx;
        const cx = OX + ROOM_W / 2, cy = OY + ROOM_H / 2;
        g.lineStyle(3, 0x660022, 0.5);
        g.strokeCircle(cx, cy, 120);
        g.lineStyle(2, 0x440011, 0.3);
        g.strokeCircle(cx, cy, 80);
    }

    _drawTreasureDecal(room) {
        if (room.cleared) return;
        const g = this.roomGfx;
        const cx = OX + ROOM_W / 2, cy = OY + ROOM_H / 2;
        g.fillStyle(0xffdd44, 0.2);
        g.fillCircle(cx, cy, 40);
        g.lineStyle(2, 0xffdd44, 0.5);
        g.strokeCircle(cx, cy, 40);
    }

    // Update door graphics (called when room is cleared)
    _refreshDoors() {
        const room = this.dungeonGrid.get(this.currentKey);
        this._drawDoors(room);
    }

    // ─── ENEMY SPAWNING ──────────────────────────────────────────────────────
    _spawnEnemies(room) {
        const count = room.enemyCount || 0;
        const type  = room.type;
        const cx    = OX + ROOM_W / 2;
        const cy    = OY + ROOM_H / 2;
        const margin = 100;

        if (type === 'boss') {
            const e = new Enemy(this, cx, cy, 'boss');
            this.enemies.push(e);
            return;
        }

        // Treasure room: no enemies, just spawn pickup
        if (type === 'treasure') {
            this._spawnPickup(cx, cy);
            room.cleared = true;
            return;
        }

        const types = ['grunt', 'shooter', 'charger'];
        for (let i = 0; i < count; i++) {
            const t = types[Math.floor(Math.random() * types.length)];
            let x, y;
            let attempts = 0;
            do {
                x = Phaser.Math.Between(INNER_L + margin, INNER_R - margin);
                y = Phaser.Math.Between(INNER_T + margin, INNER_B - margin);
                attempts++;
            } while (
                Phaser.Math.Distance.Between(x, y, cx, cy) < 160 && attempts < 20
            );
            const e = new Enemy(this, x, y, t);
            this.enemies.push(e);
        }
    }

    _spawnPickup(x, y) {
        const pickup = this.add.graphics();
        pickup.fillStyle(0xffdd44);
        // Draw a diamond shape (no fillStar in Phaser)
        const pts = [
            { x: 0,  y: -22 }, { x: 14, y: 0 },
            { x: 0,  y:  22 }, { x:-14, y: 0 },
        ];
        pickup.fillPoints(pts, true);
        pickup.lineStyle(2, 0xffffff);
        pickup.strokePoints(pts, true);
        pickup.setPosition(x, y);
        pickup.setDepth(3);
        this._pickupSprite = pickup;
        this._pickupActive = true;

        this.tweens.add({
            targets: pickup,
            y: y - 8,
            duration: 800,
            yoyo: true,
            repeat: -1,
        });
    }

    _checkPickup() {
        if (!this._pickupActive) return;
        const px = this.player.sprite.x, py = this.player.sprite.y;
        const dx = px - this._pickupSprite.x, dy = py - this._pickupSprite.y;
        if (Math.sqrt(dx * dx + dy * dy) < 40) {
            this._pickupSprite.destroy();
            this._pickupActive = false;
            this.player.maxHp  = Math.min(PLAYER_MAX_HP * 1.5, this.player.maxHp + 25);
            this.player.heal(50);
            this.spawnDmgText(px, py - 30, 'HP UP!', false, 0x44ff44);
        }
    }

    // ─── PROJECTILE SPAWNING ─────────────────────────────────────────────────
    spawnProjectile(x, y, angle, cfg) {
        // Pass null group — player projectiles use manual overlap, no group needed
        const p = new Projectile(this, x, y, angle, cfg, null);
        this.projectiles.push(p);
    }

    spawnEnemyProjectile(x, y, angle) {
        // Pass enemProjGroup so we can use physics.overlap for player collision
        const p = new Projectile(this, x, y, angle, {
            type: 'enemy', damage: 12, speed: SPD_ENEMY,
            range: 650, hitR: 7, isEnemy: true,
        }, this.enemProjGroup);
        this.projectiles.push(p);
    }

    // ─── VFX ─────────────────────────────────────────────────────────────────
    spawnBlinkVFX(x, y) {
        const g = this.add.graphics();
        g.lineStyle(3, CLR.projE, 1);
        g.strokeCircle(0, 0, 20);
        g.fillStyle(CLR.projE, 0.5);
        g.fillCircle(0, 0, 10);
        g.setPosition(x, y);
        g.setDepth(8);
        this.tweens.add({
            targets: g,
            scaleX: 2.5, scaleY: 2.5,
            alpha: 0,
            duration: 300,
            onComplete: () => g.destroy(),
        });
    }

    showRCharge(x, y, angle) {
        const g = this.add.graphics();
        g.fillStyle(CLR.projR, 0.8);
        g.fillCircle(0, 0, 30);
        g.setPosition(x, y);
        g.setDepth(8);
        this.tweens.add({
            targets: g,
            scaleX: 1.5, scaleY: 1.5,
            alpha: 0,
            duration: 1000,
            onComplete: () => g.destroy(),
        });
    }

    spawnDmgText(x, y, value, isCrit = false, color = 0xffffff) {
        const col    = isCrit ? '#ffaa00' : `#${color.toString(16).padStart(6, '0')}`;
        const size   = isCrit ? 20 : 14;
        const text   = this.add.text(x, y, `${value}`, {
            fontSize: `${size}px`,
            fontFamily: 'Arial Black, sans-serif',
            color: col,
            stroke: '#000000',
            strokeThickness: 3,
        }).setDepth(10).setOrigin(0.5, 1);
        this.tweens.add({
            targets: text,
            y: y - 40,
            alpha: 0,
            duration: 700,
            onComplete: () => text.destroy(),
        });
    }

    // ─── ENEMY CALLBACKS ─────────────────────────────────────────────────────
    onEnemyDied(enemy) {
        const idx = this.enemies.indexOf(enemy);
        if (idx !== -1) this.enemies.splice(idx, 1);
        this.player.kills++;

        // Check if room cleared
        if (this.enemies.length === 0) {
            const room = this.dungeonGrid.get(this.currentKey);
            room.cleared = true;
            this._onRoomCleared(room);
        }
    }

    _onRoomCleared(room) {
        this._refreshDoors();
        this._buildWalls(room); // rebuild so door tiles lose their wall bodies

        // Boss defeated = win
        if (room.type === 'boss') {
            this.time.delayedCall(1500, () => this._showVictory());
            return;
        }

        // Heal a bit on room clear
        this.player.heal(8);
        this.spawnDmgText(this.player.sprite.x, this.player.sprite.y - 50, '+8 HP', false, 0x44ff44);
    }

    // ─── DOOR TRANSITION ─────────────────────────────────────────────────────
    _checkDoorTransition() {
        if (this.transitioning) return;
        const room = this.dungeonGrid.get(this.currentKey);
        if (!room.cleared && this.enemies.length > 0) return;

        const px = this.player.sprite.x, py = this.player.sprite.y;
        const dc = DOOR_COL, dr = DOOR_ROW;
        const t  = TILE;

        // North
        if (room.doors.north && py < OY + t && px > OX + dc * t && px < OX + (dc + DOOR_W_TILES) * t) {
            this._transition('north');
        }
        // South
        else if (room.doors.south && py > OY + (ROOM_ROWS - 1) * t && px > OX + dc * t && px < OX + (dc + DOOR_W_TILES) * t) {
            this._transition('south');
        }
        // West
        else if (room.doors.west && px < OX + t && py > OY + dr * t && py < OY + (dr + DOOR_H_TILES) * t) {
            this._transition('west');
        }
        // East
        else if (room.doors.east && px > OX + (ROOM_COLS - 1) * t && py > OY + dr * t && py < OY + (dr + DOOR_H_TILES) * t) {
            this._transition('east');
        }

        // Pickup check
        if (this._pickupActive) this._checkPickup();
    }

    _transition(dir) {
        this.transitioning = true;
        const room = this.dungeonGrid.get(this.currentKey);
        const DIRS_MAP = {
            north: { dx: 0, dy: -1, opp: 'south' },
            south: { dx: 0, dy:  1, opp: 'north' },
            east:  { dx: 1, dy:  0, opp: 'west'  },
            west:  { dx:-1, dy:  0, opp: 'east'  },
        };
        const { dx, dy, opp } = DIRS_MAP[dir];
        const nextKey = `${room.gx + dx},${room.gy + dy}`;

        if (!this.dungeonGrid.has(nextKey)) {
            this.transitioning = false;
            return;
        }

        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.time.delayedCall(180, () => {
            this._pickupActive = false;
            if (this._pickupSprite) { this._pickupSprite.destroy(); this._pickupSprite = null; }
            this._enterRoom(nextKey, opp);
            this.time.delayedCall(250, () => { this.transitioning = false; });
        });
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    findNearestEnemy(x, y) {
        let best = null, bestD = Infinity;
        for (const e of this.enemies) {
            if (!e.alive) continue;
            const d = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    }

    _clearEnemies() {
        for (const e of this.enemies) {
            if (e.alive) { e.hpBar.destroy(); e.sprite.destroy(); }
        }
        this.enemies = [];
    }

    _clearProjectiles() {
        for (const p of this.projectiles) {
            if (p.alive) p.sprite.destroy();
        }
        this.projectiles = [];
    }

    // ─── GAME OVER / VICTORY ─────────────────────────────────────────────────
    _showVictory() {
        const overlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.7).setDepth(20);
        this.add.text(GAME_W / 2, GAME_H / 2 - 60, 'VICTORY', {
            fontSize: '72px', fontFamily: 'Arial Black',
            color: '#ffcc33', stroke: '#000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(21);
        this.add.text(GAME_W / 2, GAME_H / 2 + 20, `Enemies defeated: ${this.player.kills}`, {
            fontSize: '28px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(21);
        this.add.text(GAME_W / 2, GAME_H / 2 + 80, 'Press R to restart', {
            fontSize: '22px', color: '#aaaaaa',
        }).setOrigin(0.5).setDepth(21);
        this.input.keyboard.once('keydown-R', () => this.scene.restart());
    }

    // ─── TEXTURE GENERATION ──────────────────────────────────────────────────
    _buildTextures() {
        // Player — blue body with gold accents
        this._makeTex('player', 64, 64, g => {
            // Shadow
            g.fillStyle(0x000000, 0.3);
            g.fillEllipse(32, 44, 38, 14);
            // Body
            g.fillStyle(CLR.player);
            g.fillCircle(32, 30, 18);
            // Armor highlights
            g.fillStyle(CLR.playerAccent);
            g.fillRect(26, 22, 12, 6);
            g.fillCircle(32, 22, 5);
            // Eyes
            g.fillStyle(0xffffff);
            g.fillCircle(27, 27, 4);
            g.fillCircle(37, 27, 4);
            g.fillStyle(0x001188);
            g.fillCircle(27, 27, 2);
            g.fillCircle(37, 27, 2);
            // Scarf / hair
            g.fillStyle(0x884400);
            g.fillRect(24, 14, 16, 6);
        });

        // Enemy: grunt
        this._makeEnemyTex('enemy_grunt', CLR.enemyGrunt, 64, 64, 22, g => {
            g.fillStyle(0xff8888);
            g.fillRect(22, 20, 20, 8);
        });

        // Enemy: shooter
        this._makeEnemyTex('enemy_shooter', CLR.enemyShooter, 56, 56, 18, g => {
            // Cannon
            g.fillStyle(0x884400);
            g.fillRect(36, 24, 16, 8);
        });

        // Enemy: charger
        this._makeEnemyTex('enemy_charger', CLR.enemyCharger, 72, 72, 26, g => {
            // Horns
            g.fillStyle(0xffffff);
            g.fillTriangle(18, 10, 14, 0, 24, 10);
            g.fillTriangle(54, 10, 50, 0, 58, 10);
        });

        // Enemy: boss
        this._makeTex('enemy_boss', 128, 128, g => {
            const cx = 64, cy = 60, r = 44;
            // Glow
            g.fillStyle(CLR.enemyBoss, 0.3);
            g.fillCircle(cx, cy, r + 12);
            // Body
            g.fillStyle(CLR.enemyBoss);
            g.fillCircle(cx, cy, r);
            // Crown
            g.fillStyle(0xffcc33);
            const pts = [];
            for (let i = 0; i < 7; i++) {
                const a = -Math.PI / 2 + i * (Math.PI / 3);
                pts.push({ x: cx + Math.cos(a) * (i % 2 === 0 ? r + 18 : r + 6), y: cy + Math.sin(a) * (i % 2 === 0 ? r + 18 : r + 6) });
            }
            g.fillPoints(pts, true);
            // Eyes
            g.fillStyle(0xff0000);
            g.fillCircle(cx - 14, cy - 8, 10);
            g.fillCircle(cx + 14, cy - 8, 10);
            g.fillStyle(0xffff00);
            g.fillCircle(cx - 14, cy - 8, 5);
            g.fillCircle(cx + 14, cy - 8, 5);
            // Mouth
            g.lineStyle(3, 0xff0000);
            g.strokeRect(cx - 16, cy + 12, 32, 10);
        });

        // Projectile textures
        this._makeProjTex('proj_auto',  CLR.projAuto,  16, 6,  false);
        this._makeProjTex('proj_q',     CLR.projQ,     24, 10, true);
        this._makeProjTex('proj_w',     CLR.projW,     28, 12, true);
        this._makeProjTex('proj_e',     CLR.projE,     20, 8,  true);
        this._makeProjTex('proj_r',     CLR.projR,     64, 20, true);
        this._makeProjTex('proj_enemy', CLR.projEnemy, 14, 6,  false);
    }

    _makeTex(key, w, h, fn) {
        if (this.textures.exists(key)) return;
        const g = this.make.graphics({ add: false });
        fn(g);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    _makeEnemyTex(key, color, w, h, r, extraFn) {
        this._makeTex(key, w, h, g => {
            const cx = w / 2, cy = h / 2;
            // Shadow
            g.fillStyle(0x000000, 0.3);
            g.fillEllipse(cx, cy + r * 0.8, r * 2, r * 0.7);
            // Body
            g.fillStyle(color);
            g.fillCircle(cx, cy, r);
            // Eyes
            g.fillStyle(0xffffff);
            g.fillCircle(cx - r * 0.35, cy - r * 0.1, r * 0.22);
            g.fillCircle(cx + r * 0.35, cy - r * 0.1, r * 0.22);
            g.fillStyle(0x000000);
            g.fillCircle(cx - r * 0.35, cy - r * 0.1, r * 0.1);
            g.fillCircle(cx + r * 0.35, cy - r * 0.1, r * 0.1);
            if (extraFn) extraFn(g);
        });
    }

    _makeProjTex(key, color, w, h, glow) {
        this._makeTex(key, w, h, g => {
            if (glow) {
                g.fillStyle(color, 0.4);
                g.fillEllipse(w / 2, h / 2, w, h);
            }
            g.fillStyle(color);
            g.fillEllipse(w / 2, h / 2, w * 0.8, h * 0.8);
            // Bright core
            g.fillStyle(0xffffff, 0.6);
            g.fillEllipse(w / 2, h / 2, w * 0.3, h * 0.3);
        });
    }
}

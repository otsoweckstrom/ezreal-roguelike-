// ═══════════════════════════════════════════════════════════════════
//  PROJECTILE
// ═══════════════════════════════════════════════════════════════════
class Projectile {
    // group (optional): add sprite to this group BEFORE setVelocity to avoid reset
    constructor(scene, x, y, angle, cfg, group) {
        this.scene      = scene;
        this.type       = cfg.type;
        this.damage     = cfg.damage;
        this.piercing   = cfg.piercing   || false;
        this.marksEnemy = cfg.marksEnemy || false;
        this.maxRange   = cfg.range      || 600;
        this.startX     = x;
        this.startY     = y;
        this.alive      = true;
        this.isEnemy    = cfg.isEnemy    || false;
        this.hitEnemies = new Set();

        const vx = Math.cos(angle) * cfg.speed;
        const vy = Math.sin(angle) * cfg.speed;

        // Create sprite, add to group first (prevents group.add from zeroing velocity)
        this.sprite = scene.physics.add.sprite(x, y, `proj_${cfg.type}`);
        if (group) group.add(this.sprite, true);  // true = addToScene already done

        // NOW set velocity after group membership is established
        this.sprite.body.setVelocity(vx, vy);
        this.sprite.setRotation(angle);
        this.sprite.setDepth(4);
        this.sprite.projRef = this;

        // Use a simple rect hit body sized to the texture (avoids negative offsets)
        const r = cfg.hitR || 8;
        const bw = Math.min(r * 2, this.sprite.width);
        const bh = Math.min(r * 2, this.sprite.height);
        this.sprite.body.setSize(bw, bh);
        this.sprite.body.setOffset((this.sprite.width - bw) / 2, (this.sprite.height - bh) / 2);
    }

    update() {
        if (!this.alive) return;
        const dist = Phaser.Math.Distance.Between(this.startX, this.startY,
                                                   this.sprite.x, this.sprite.y);
        if (dist > this.maxRange) { this.destroy(); return; }

        // Destroy on outer wall hit
        const bx = this.sprite.x, by = this.sprite.y;
        if (bx < INNER_L || bx > INNER_R || by < INNER_T || by > INNER_B) {
            this.destroy(); return;
        }

        // Destroy on obstacle hit
        const room = this.scene.dungeonGrid && this.scene.dungeonGrid.get(this.scene.currentKey);
        if (room && room.obstacles) {
            for (const { col, row } of room.obstacles) {
                const ox = OX + col * TILE + TILE / 2;
                const oy = OY + row * TILE + TILE / 2;
                const half = (TILE - 8) / 2;
                if (bx > ox - half && bx < ox + half && by > oy - half && by < oy + half) {
                    this.destroy(); return;
                }
            }
        }
    }

    destroy() {
        if (!this.alive) return;
        this.alive = false;
        this.sprite.destroy();
    }
}

// ═══════════════════════════════════════════════════════════════════
//  ENEMY
// ═══════════════════════════════════════════════════════════════════
const ENEMY_CFGS = {
    grunt: {
        hp: 80, speed: 95, size: 22,
        contactDmg: 15, color: CLR.enemyGrunt,
        textureKey: 'enemy_grunt',
    },
    shooter: {
        hp: 55, speed: 55, size: 18,
        contactDmg: 0, color: CLR.enemyShooter,
        textureKey: 'enemy_shooter',
        shootCD: 2200,
    },
    charger: {
        hp: 110, speed: 65, size: 26,
        contactDmg: 20, color: CLR.enemyCharger,
        textureKey: 'enemy_charger',
        chargeSpeed: 370,
    },
    boss: {
        hp: 600, speed: 80, size: 44,
        contactDmg: 25, color: CLR.enemyBoss,
        textureKey: 'enemy_boss',
        shootCD: 1500,
        chargeSpeed: 320,
    },
};

class Enemy {
    constructor(scene, x, y, type) {
        this.scene = scene;
        this.type  = type;
        this.alive = true;
        this.marked      = false;
        this.markTimer   = 0;
        this.shootTimer  = 0;
        this.stateTimer  = 0;
        this.state       = 'wander';
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.chargeVel   = null;

        const cfg = ENEMY_CFGS[type] || ENEMY_CFGS.grunt;
        this.cfg    = cfg;
        this.maxHp  = cfg.hp;
        this.hp     = cfg.hp;

        this.sprite = scene.physics.add.sprite(x, y, cfg.textureKey);
        this.sprite.setDepth(3);
        this.sprite.enemyRef = this;
        const r = cfg.size;
        const offset = this.sprite.width / 2 - r;
        this.sprite.setCircle(r, offset, offset);
        this.sprite.setCollideWorldBounds(false);

        this.hpBar = scene.add.graphics();
        this.hpBar.setDepth(6);
    }

    takeDamage(amount, detonatesMark = false) {
        let dmg = amount;
        if (this.marked) {
            dmg += DMG_MARK_BONUS;
            this.removeMark();
        }
        this.hp -= dmg;

        // Hit flash
        this.sprite.setTint(0xffffff);
        this.scene.time.delayedCall(90, () => {
            if (this.alive && !this.marked) this.sprite.clearTint();
        });

        // Damage number popup
        this.scene.spawnDmgText(this.sprite.x, this.sprite.y - this.cfg.size, dmg, this.marked);

        if (this.hp <= 0) this.die();
    }

    applyMark() {
        this.marked    = true;
        this.markTimer = 4000;
        this.sprite.setTint(CLR.mark);
    }

    removeMark() {
        this.marked = false;
        this.sprite.clearTint();
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.hpBar.destroy();

        // Burst particles
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const spd   = Phaser.Math.Between(60, 160);
            const p     = this.scene.add.graphics();
            p.fillStyle(this.cfg.color);
            p.fillCircle(0, 0, Phaser.Math.Between(3, 7));
            p.setPosition(this.sprite.x, this.sprite.y);
            p.setDepth(7);
            const vx = Math.cos(angle) * spd;
            const vy = Math.sin(angle) * spd;
            this.scene.tweens.add({
                targets: p,
                x: p.x + vx * 0.4,
                y: p.y + vy * 0.4,
                alpha: 0,
                duration: 350,
                onComplete: () => p.destroy(),
            });
        }

        this.sprite.destroy();
        this.scene.onEnemyDied(this);
    }

    update(delta, playerSprite) {
        if (!this.alive) return;

        const px   = playerSprite.x, py = playerSprite.y;
        const dx   = px - this.sprite.x, dy = py - this.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Mark timer
        if (this.marked) {
            this.markTimer -= delta;
            if (this.markTimer <= 0) this.removeMark();
        }

        // Bounce off room walls
        this._bounceWalls();

        switch (this.type) {
            case 'grunt':   this._updateGrunt(delta, dx, dy, dist);          break;
            case 'shooter': this._updateShooter(delta, dx, dy, dist);        break;
            case 'charger': this._updateCharger(delta, dx, dy, dist);        break;
            case 'boss':    this._updateBoss(delta, px, py, dx, dy, dist);   break;
        }

        this._drawHPBar();
    }

    _bounceWalls() {
        const { x, y } = this.sprite;
        const r = this.cfg.size;
        // Outer walls
        if (x - r < INNER_L) { this.sprite.x = INNER_L + r; this.sprite.setVelocityX(Math.abs(this.sprite.body.velocity.x)); }
        if (x + r > INNER_R) { this.sprite.x = INNER_R - r; this.sprite.setVelocityX(-Math.abs(this.sprite.body.velocity.x)); }
        if (y - r < INNER_T) { this.sprite.y = INNER_T + r; this.sprite.setVelocityY(Math.abs(this.sprite.body.velocity.y)); }
        if (y + r > INNER_B) { this.sprite.y = INNER_B - r; this.sprite.setVelocityY(-Math.abs(this.sprite.body.velocity.y)); }

        // Obstacle pillars
        const room = this.scene.dungeonGrid && this.scene.dungeonGrid.get(this.scene.currentKey);
        if (!room || !room.obstacles) return;
        const half = (TILE - 8) / 2 + r;
        for (const { col, row } of room.obstacles) {
            const ox = OX + col * TILE + TILE / 2;
            const oy = OY + row * TILE + TILE / 2;
            const dx = x - ox, dy = y - oy;
            if (Math.abs(dx) < half && Math.abs(dy) < half) {
                // Push out along shortest axis
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.sprite.x = ox + Math.sign(dx) * half;
                    this.sprite.setVelocityX(Math.sign(dx) * Math.abs(this.sprite.body.velocity.x));
                } else {
                    this.sprite.y = oy + Math.sign(dy) * half;
                    this.sprite.setVelocityY(Math.sign(dy) * Math.abs(this.sprite.body.velocity.y));
                }
            }
        }
    }

    _updateGrunt(delta, dx, dy, dist) {
        if (dist > 1) {
            this.sprite.setVelocity((dx / dist) * this.cfg.speed, (dy / dist) * this.cfg.speed);
            this.sprite.setRotation(Math.atan2(dy, dx));
        }
    }

    _updateShooter(delta, dx, dy, dist) {
        const preferred = 250;
        if (dist < preferred - 30) {
            this.sprite.setVelocity(-(dx / dist) * this.cfg.speed, -(dy / dist) * this.cfg.speed);
        } else if (dist > preferred + 30) {
            this.sprite.setVelocity((dx / dist) * this.cfg.speed, (dy / dist) * this.cfg.speed);
        } else {
            this.sprite.setVelocity(0, 0);
        }
        this.sprite.setRotation(Math.atan2(dy, dx));

        this.shootTimer -= delta;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.cfg.shootCD;
            const angle = Math.atan2(dy, dx);
            this.scene.spawnEnemyProjectile(this.sprite.x, this.sprite.y, angle);
        }
    }

    _updateCharger(delta, dx, dy, dist) {
        this.stateTimer -= delta;
        if (this.state === 'wander') {
            this.sprite.setVelocity(
                Math.cos(this.wanderAngle) * 45,
                Math.sin(this.wanderAngle) * 45
            );
            if (dist < 320 && this.stateTimer <= 0) {
                this.state = 'windup';
                this.stateTimer = 700;
                this.sprite.setVelocity(0, 0);
                this._windupTarget = { dx, dy, dist };
            } else if (this.stateTimer <= 0) {
                this.wanderAngle = Math.random() * Math.PI * 2;
                this.stateTimer  = 1800;
            }
        } else if (this.state === 'windup') {
            this.sprite.setVelocity(0, 0);
            const flash = Math.floor(this.stateTimer / 100) % 2 === 0;
            this.sprite.setTint(flash ? 0xffffff : this.cfg.color);
            if (this.stateTimer <= 0) {
                const { dx: cdx, dy: cdy, dist: cdist } = this._windupTarget;
                this.state      = 'charging';
                this.stateTimer = 550;
                const n         = cdist || 1;
                this.chargeVel  = { x: (cdx / n) * this.cfg.chargeSpeed, y: (cdy / n) * this.cfg.chargeSpeed };
            }
        } else if (this.state === 'charging') {
            this.sprite.setVelocity(this.chargeVel.x, this.chargeVel.y);
            if (this.stateTimer <= 0) {
                this.state      = 'wander';
                this.stateTimer = 2200;
                this.wanderAngle = Math.random() * Math.PI * 2;
                this.sprite.clearTint();
            }
        }
    }

    _updateBoss(delta, px, py, dx, dy, dist) {
        this.stateTimer -= delta;
        this.shootTimer -= delta;

        // Boss phases
        const hpPct = this.hp / this.maxHp;

        // Shoot burst
        if (this.shootTimer <= 0) {
            this.shootTimer = hpPct < 0.5 ? this.cfg.shootCD * 0.6 : this.cfg.shootCD;
            const baseAngle = Math.atan2(dy, dx);
            const spread    = hpPct < 0.5 ? 5 : 3;
            for (let i = 0; i < spread; i++) {
                const a = baseAngle + (i - Math.floor(spread / 2)) * 0.3;
                this.scene.spawnEnemyProjectile(this.sprite.x, this.sprite.y, a);
            }
        }

        // Slow chase + occasional charge
        if (this.state === 'wander') {
            if (dist > 1)
                this.sprite.setVelocity((dx / dist) * this.cfg.speed, (dy / dist) * this.cfg.speed);
            if (dist < 350 && this.stateTimer <= 0 && Math.random() < 0.4) {
                this.state = 'windup';
                this.stateTimer = 600;
                this._windupTarget = { dx, dy, dist };
                this.sprite.setVelocity(0, 0);
            } else if (this.stateTimer <= 0) {
                this.stateTimer = 2000;
            }
        } else if (this.state === 'windup') {
            const flash = Math.floor(this.stateTimer / 100) % 2 === 0;
            this.sprite.setTint(flash ? 0xffffff : this.cfg.color);
            this.sprite.setVelocity(0, 0);
            if (this.stateTimer <= 0) {
                const { dx: cdx, dy: cdy, dist: cdist } = this._windupTarget;
                this.state = 'charging';
                this.stateTimer = 500;
                const n = cdist || 1;
                this.chargeVel = { x: (cdx / n) * this.cfg.chargeSpeed, y: (cdy / n) * this.cfg.chargeSpeed };
            }
        } else if (this.state === 'charging') {
            this.sprite.setVelocity(this.chargeVel.x, this.chargeVel.y);
            if (this.stateTimer <= 0) {
                this.state = 'wander';
                this.stateTimer = 1500;
                this.sprite.clearTint();
            }
        }

        this.sprite.setRotation(Math.atan2(dy, dx));
    }

    _drawHPBar() {
        this.hpBar.clear();
        if (this.hp >= this.maxHp) return;

        const bw  = this.type === 'boss' ? 80 : 44;
        const bh  = this.type === 'boss' ? 7  : 4;
        const bx  = this.sprite.x - bw / 2;
        const by  = this.sprite.y - this.cfg.size - 12;
        const pct = this.hp / this.maxHp;

        this.hpBar.fillStyle(CLR.hpBg);
        this.hpBar.fillRect(bx, by, bw, bh);

        const col = pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff2200;
        this.hpBar.fillStyle(col);
        this.hpBar.fillRect(bx, by, bw * pct, bh);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  PLAYER
// ═══════════════════════════════════════════════════════════════════
class Player {
    constructor(scene, x, y) {
        this.scene        = scene;
        this.maxHp        = PLAYER_MAX_HP;
        this.hp           = PLAYER_MAX_HP;
        this.alive        = true;
        this.invincible   = false;
        this.invTimer     = 0;
        this.isCasting    = false;
        this.castTimer    = 0;
        this.castAngle    = 0;
        this.kills        = 0;

        this.cds = { auto: 0, q: 0, w: 0, e: 0, r: 0 };

        this.sprite = scene.physics.add.sprite(x, y, 'player');
        this.sprite.setDepth(5);
        this.sprite.setCircle(16, 16, 16);
        this.sprite.playerRef = this;

        // WASD + ability keys
        this.wasd = scene.input.keyboard.addKeys({
            up:    Phaser.Input.Keyboard.KeyCodes.W,
            down:  Phaser.Input.Keyboard.KeyCodes.S,
            left:  Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            q:     Phaser.Input.Keyboard.KeyCodes.Q,
            e:     Phaser.Input.Keyboard.KeyCodes.E,
            r:     Phaser.Input.Keyboard.KeyCodes.R,
        });

        // Mouse buttons — use leftButtonDown/rightButtonDown for reliable cross-browser detection
        scene.input.on('pointerdown', p => {
            if (!this.alive || this.isCasting) return;
            const angle = Phaser.Math.Angle.Between(
                this.sprite.x, this.sprite.y, p.worldX, p.worldY);
            if (p.leftButtonDown())  this._castAuto(angle);
            if (p.rightButtonDown()) this._castQ(angle);
        });

        // Prevent right-click context menu
        scene.game.canvas.addEventListener('contextmenu', e => e.preventDefault());

        // Hold M1 for auto-fire
        this._autoFireTimer = 0;
    }

    update(delta) {
        if (!this.alive) return;

        // Tick cooldowns
        for (const k in this.cds) this.cds[k] = Math.max(0, this.cds[k] - delta);

        // Invincibility flash
        if (this.invincible) {
            this.invTimer -= delta;
            this.sprite.setAlpha(Math.floor(this.invTimer / 90) % 2 === 0 ? 0.4 : 1);
            if (this.invTimer <= 0) { this.invincible = false; this.sprite.setAlpha(1); }
        }

        // Cast R lock
        if (this.isCasting) {
            this.sprite.setVelocity(0, 0);
            this.castTimer -= delta;
            if (this.castTimer <= 0) {
                this._fireR(this.castAngle);
                this.isCasting = false;
            }
            return;
        }

        // Movement
        let vx = 0, vy = 0;
        if (this.wasd.left.isDown)  vx -= 1;
        if (this.wasd.right.isDown) vx += 1;
        if (this.wasd.up.isDown)    vy -= 1;
        if (this.wasd.down.isDown)  vy += 1;
        if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
        this.sprite.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

        // Face cursor
        const ptr   = this.scene.input.activePointer;
        const angle = Phaser.Math.Angle.Between(
            this.sprite.x, this.sprite.y, ptr.worldX, ptr.worldY);
        this.sprite.setRotation(angle);

        // Hold M1 auto-fire
        if (this.scene.input.activePointer.leftButtonDown()) {
            this._autoFireTimer -= delta;
            if (this._autoFireTimer <= 0) {
                this._castAuto(angle);
                this._autoFireTimer = CD_AUTO;
            }
        }

        // Q key = Ezreal W
        if (Phaser.Input.Keyboard.JustDown(this.wasd.q)) this._castW();
        // E key = Ezreal E
        if (Phaser.Input.Keyboard.JustDown(this.wasd.e)) this._castE();
        // R key = Ezreal R
        if (Phaser.Input.Keyboard.JustDown(this.wasd.r)) this._beginCastR();
    }

    _castAuto(angle) {
        if (this.cds.auto > 0) return;
        this.cds.auto = CD_AUTO;
        this._autoFireTimer = CD_AUTO;
        this.scene.spawnProjectile(this.sprite.x, this.sprite.y, angle, {
            type: 'auto', damage: DMG_AUTO, speed: SPD_AUTO,
            range: RANGE_AUTO, hitR: 7, piercing: false,
        });
    }

    _castQ(angle) {
        if (this.cds.q > 0) return;
        this.cds.q = CD_Q;
        this.scene.spawnProjectile(this.sprite.x, this.sprite.y, angle, {
            type: 'q', damage: DMG_Q, speed: SPD_Q,
            range: RANGE_Q, hitR: 10, piercing: false,
        });
    }

    _castW() {
        if (this.cds.w > 0) return;
        this.cds.w = CD_W;
        const ptr   = this.scene.input.activePointer;
        const angle = Phaser.Math.Angle.Between(
            this.sprite.x, this.sprite.y, ptr.worldX, ptr.worldY);
        this.scene.spawnProjectile(this.sprite.x, this.sprite.y, angle, {
            type: 'w', damage: DMG_W, speed: SPD_W,
            range: RANGE_W, hitR: 12, piercing: true, marksEnemy: true,
        });
    }

    _castE() {
        if (this.cds.e > 0) return;
        this.cds.e = CD_E;

        const ptr = this.scene.input.activePointer;
        let tx = ptr.worldX, ty = ptr.worldY;

        // Clamp range
        const MAX_BLINK = 370;
        const dx = tx - this.sprite.x, dy = ty - this.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > MAX_BLINK) {
            tx = this.sprite.x + (dx / dist) * MAX_BLINK;
            ty = this.sprite.y + (dy / dist) * MAX_BLINK;
        }

        // Clamp to inner room
        tx = Phaser.Math.Clamp(tx, INNER_L + 16, INNER_R - 16);
        ty = Phaser.Math.Clamp(ty, INNER_T + 16, INNER_B - 16);

        // Blink VFX at old pos
        this.scene.spawnBlinkVFX(this.sprite.x, this.sprite.y);
        this.sprite.setPosition(tx, ty);
        this.scene.spawnBlinkVFX(tx, ty);

        // Fire at nearest enemy
        const nearest = this.scene.findNearestEnemy(tx, ty);
        if (nearest) {
            const a = Phaser.Math.Angle.Between(tx, ty, nearest.sprite.x, nearest.sprite.y);
            this.scene.spawnProjectile(tx, ty, a, {
                type: 'e', damage: DMG_E, speed: SPD_Q,
                range: RANGE_Q, hitR: 9, piercing: false,
            });
        }
    }

    _beginCastR() {
        if (this.cds.r > 0) return;
        this.cds.r = CD_R;

        const ptr = this.scene.input.activePointer;
        this.castAngle = Phaser.Math.Angle.Between(
            this.sprite.x, this.sprite.y, ptr.worldX, ptr.worldY);
        this.isCasting  = true;
        this.castTimer  = 1000;
        this.scene.showRCharge(this.sprite.x, this.sprite.y, this.castAngle);
    }

    _fireR(angle) {
        this.scene.spawnProjectile(this.sprite.x, this.sprite.y, angle, {
            type: 'r', damage: DMG_R, speed: SPD_R,
            range: RANGE_R, hitR: 22, piercing: true,
        });
    }

    takeDamage(amount) {
        if (this.invincible || !this.alive) return;
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
        this.invincible = true;
        this.invTimer   = IFRAME_MS;
        this.scene.cameras.main.shake(120, 0.008);
        this.scene.events.emit('playerHpChanged', this.hp, this.maxHp);
        if (this.hp <= 0) this.die();
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.scene.events.emit('playerHpChanged', this.hp, this.maxHp);
    }

    die() {
        this.alive = false;
        this.scene.events.emit('playerDied');
    }
}

class HUDScene extends Phaser.Scene {
    constructor() { super({ key: 'HUDScene', active: false }); }

    create() {
        this.game_scene = this.scene.get('GameScene');

        // ─ HP Bar ──────────────────────────────────────────────────────────
        const hpLabel = this.add.text(16, 16, 'HP', {
            fontSize: '14px', color: '#ff6666', fontFamily: 'Arial',
        });
        this.hpBg = this.add.graphics();
        this.hpBg.fillStyle(0x111111);
        this.hpBg.fillRoundedRect(40, 12, 180, 22, 4);
        this.hpFill = this.add.graphics();
        this.hpText = this.add.text(228, 16, '', { fontSize: '13px', color: '#ffffff', fontFamily: 'Arial' });

        // ─ Ability Bars ────────────────────────────────────────────────────
        const abilityDefs = [
            { key: 'auto', label: 'M1', color: CLR.projAuto, cd: CD_AUTO,  desc: 'Auto' },
            { key: 'q',    label: 'M2', color: CLR.projQ,    cd: CD_Q,     desc: 'Mystic Shot' },
            { key: 'w',    label: 'Q',  color: CLR.projW,    cd: CD_W,     desc: 'Essence Flux' },
            { key: 'e',    label: 'E',  color: CLR.projE,    cd: CD_E,     desc: 'Arcane Shift' },
            { key: 'r',    label: 'R',  color: CLR.projR,    cd: CD_R,     desc: 'Trueshot' },
        ];

        this.abilityUIs = [];
        const startY = GAME_H - 72;
        const slotW  = 56, slotH = 56, gap = 8;
        const totalW = abilityDefs.length * (slotW + gap) - gap;
        let startX   = (GAME_W - totalW) / 2;

        abilityDefs.forEach((def, i) => {
            const x = startX + i * (slotW + gap);
            const y = startY;

            // Background
            const bg = this.add.graphics();
            bg.fillStyle(0x111122);
            bg.fillRoundedRect(x, y, slotW, slotH, 6);
            bg.lineStyle(2, 0x334466);
            bg.strokeRoundedRect(x, y, slotW, slotH, 6);

            // CD overlay
            const cdOverlay = this.add.graphics();

            // Key label
            const keyLbl = this.add.text(x + slotW / 2, y + 6, def.label, {
                fontSize: '12px', color: '#aabbff',
                fontFamily: 'Arial', fontStyle: 'bold',
            }).setOrigin(0.5, 0);

            // Ability name
            const nameLbl = this.add.text(x + slotW / 2, y + slotH - 14, def.desc, {
                fontSize: '9px', color: '#778899',
                fontFamily: 'Arial',
            }).setOrigin(0.5, 0);

            // Icon circle
            const icon = this.add.graphics();
            icon.fillStyle(def.color, 0.9);
            icon.fillCircle(x + slotW / 2, y + slotH / 2 + 2, 14);

            this.abilityUIs.push({ def, bg, cdOverlay, icon, x, y, slotW, slotH });
        });

        // ─ Minimap ─────────────────────────────────────────────────────────
        this.minimapGfx = this.add.graphics();
        this.minimapX   = GAME_W - 140;
        this.minimapY   = 10;
        this.minimapCellW = 12;
        this.minimapCellH = 9;

        // ─ Kill counter ────────────────────────────────────────────────────
        this.killText = this.add.text(GAME_W - 10, GAME_H - 10, 'Kills: 0', {
            fontSize: '14px', color: '#aaaaaa',
            fontFamily: 'Arial',
        }).setOrigin(1, 1);

        // ─ Ability tooltip texts ───────────────────────────────────────────
        this.cdTexts = {};
        this.abilityUIs.forEach(ui => {
            this.cdTexts[ui.def.key] = this.add.text(
                ui.x + ui.slotW / 2, ui.y + ui.slotH / 2 + 2, '',
                { fontSize: '15px', color: '#ffffff', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 3 }
            ).setOrigin(0.5, 0.5);
        });

        // ─ Wire events ────────────────────────────────────────────────────
        this.game_scene.events.on('playerHpChanged', (hp, maxHp) => this._updateHP(hp, maxHp));
        this.game_scene.events.on('cdUpdate',        (cds)       => this._updateCDs(cds));
        this.game_scene.events.on('dungeonChanged',  (grid, key) => this._drawMinimap(grid, key));
        this.game_scene.events.on('playerDied',      ()          => this._showGameOver());
    }

    update() {
        // Kill counter
        const gs = this.game_scene;
        if (gs && gs.player) {
            this.killText.setText(`Kills: ${gs.player.kills}`);
        }
    }

    _updateHP(hp, maxHp) {
        this.hpFill.clear();
        const pct = hp / maxHp;
        const col = pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff2200;
        this.hpFill.fillStyle(col);
        this.hpFill.fillRoundedRect(40, 12, 180 * pct, 22, 4);
        this.hpText.setText(`${Math.ceil(hp)}/${maxHp}`);
    }

    _updateCDs(cds) {
        const defs = {
            auto: CD_AUTO, q: CD_Q, w: CD_W, e: CD_E, r: CD_R,
        };

        this.abilityUIs.forEach(ui => {
            const remaining = cds[ui.def.key] || 0;
            const total     = defs[ui.def.key] || 1;
            const pct       = remaining / total;

            ui.cdOverlay.clear();
            if (pct > 0) {
                // Dark overlay proportional to remaining CD
                ui.cdOverlay.fillStyle(0x000000, 0.65);
                ui.cdOverlay.fillRoundedRect(ui.x, ui.y + ui.slotH * (1 - pct), ui.slotW, ui.slotH * pct, 4);

                // CD text (seconds)
                const secs = (remaining / 1000).toFixed(remaining > 1000 ? 1 : 0);
                this.cdTexts[ui.def.key].setText(secs + 's');
                this.cdTexts[ui.def.key].setAlpha(1);
            } else {
                this.cdTexts[ui.def.key].setText('');
                this.cdTexts[ui.def.key].setAlpha(0);
            }
        });
    }

    _drawMinimap(grid, currentKey) {
        const g   = this.minimapGfx;
        g.clear();

        const cw = this.minimapCellW;
        const ch = this.minimapCellH;
        const mx = this.minimapX;
        const my = this.minimapY;

        // Find grid bounds
        let minGx = Infinity, maxGx = -Infinity, minGy = Infinity, maxGy = -Infinity;
        grid.forEach((room) => {
            minGx = Math.min(minGx, room.gx);
            maxGx = Math.max(maxGx, room.gx);
            minGy = Math.min(minGy, room.gy);
            maxGy = Math.max(maxGy, room.gy);
        });

        const offsetX = mx - (minGx + maxGx) / 2 * (cw + 2);
        const offsetY = my - (minGy + maxGy) / 2 * (ch + 2) + 30;

        grid.forEach((room, key) => {
            if (!room.visited) return;

            const rx = offsetX + room.gx * (cw + 2);
            const ry = offsetY + room.gy * (ch + 2);

            // Room color
            let col;
            if (key === currentKey)      col = 0xffffff;
            else if (room.type === 'boss')     col = 0xff2244;
            else if (room.type === 'treasure') col = 0xffdd44;
            else if (room.cleared)             col = 0x335577;
            else                               col = 0x557799;

            g.fillStyle(col);
            g.fillRect(rx, ry, cw, ch);

            // Door connectors
            g.fillStyle(col, 0.6);
            if (room.doors.east)  g.fillRect(rx + cw, ry + ch / 2 - 1, 2, 2);
            if (room.doors.south) g.fillRect(rx + cw / 2 - 1, ry + ch, 2, 2);
        });
    }

    _showGameOver() {
        const overlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.8);
        this.add.text(GAME_W / 2, GAME_H / 2 - 60, 'GAME OVER', {
            fontSize: '72px', fontFamily: 'Arial Black',
            color: '#ff3333', stroke: '#000', strokeThickness: 6,
        }).setOrigin(0.5);
        this.add.text(GAME_W / 2, GAME_H / 2 + 30, 'Press R to try again', {
            fontSize: '24px', color: '#aaaaaa',
        }).setOrigin(0.5);
        this.input.keyboard.once('keydown-R', () => {
            this.scene.stop('HUDScene');
            this.scene.get('GameScene').scene.restart();
        });
    }
}

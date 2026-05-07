class StartScene extends Phaser.Scene {
    constructor() { super('StartScene'); }

    create() {
        const W = GAME_W, H = GAME_H, cx = W / 2;

        // ── Background ────────────────────────────────────────────────
        const bg = this.add.graphics();
        bg.fillStyle(0x080810);
        bg.fillRect(0, 0, W, H);

        bg.lineStyle(1, 0x1a2244, 0.6);
        [260, 320, 380].forEach(r => bg.strokeCircle(cx, H / 2, r));

        // ── Title ─────────────────────────────────────────────────────
        this.add.text(cx, 82, 'EZREAL', {
            fontSize: '88px', fontFamily: 'Arial Black',
            color: '#4499ff', stroke: '#000b22', strokeThickness: 10,
        }).setOrigin(0.5);

        this.add.text(cx, 174, 'ROGUELIKE', {
            fontSize: '38px', fontFamily: 'Arial Black',
            color: '#ffcc33', stroke: '#000000', strokeThickness: 5,
        }).setOrigin(0.5);

        this.add.text(cx, 220, `${TOTAL_FLOORS}-floor dungeon crawler  •  defeat each boss to descend`, {
            fontSize: '14px', color: '#445566', fontFamily: 'Arial',
        }).setOrigin(0.5);

        // ── Controls box ──────────────────────────────────────────────
        const bx = 72, by = 258, bw = W - 144, bh = 316;
        const box = this.add.graphics();
        box.fillStyle(0x0c0c1e, 0.97);
        box.fillRoundedRect(bx, by, bw, bh, 10);
        box.lineStyle(1, 0x2a3a5a, 0.8);
        box.strokeRoundedRect(bx, by, bw, bh, 10);

        // Vertical divider
        box.lineStyle(1, 0x1e2a44, 0.6);
        box.lineBetween(cx, by + 14, cx, by + bh - 14);

        this.add.text(cx, by + 16, 'CONTROLS', {
            fontSize: '12px', fontFamily: 'Arial Black',
            color: '#334455',
        }).setOrigin(0.5, 0);

        // Controls data: [column 0/1, key label, description, key color]
        const rows = [
            [0, 'WASD',       'Move',                             '#aaddff'],
            [0, 'Mouse',      'Aim',                              '#aaddff'],
            [0, 'M1 (hold)',  'Auto-attack',                      '#aaddff'],
            [0, 'M2',         'Mystic Shot — empowers next auto', '#ffbb33'],
            [1, 'Q',          'Essence Flux — marks enemies',     '#4488ff'],
            [1, 'E',          'Arcane Shift — blink + fire',      '#33ffee'],
            [1, 'R',          'Trueshot — 1s charge, mega shot',  '#6688ff'],
            [1, 'ESC',        'Pause / view upgrades',            '#888888'],
        ];

        const col0X = bx + 36;
        const col1X = cx + 22;
        const startY = by + 56;
        const rowH   = 34;

        // Group rows per column
        const col0 = rows.filter(r => r[0] === 0);
        const col1 = rows.filter(r => r[0] === 1);

        const drawRows = (list, colX) => {
            list.forEach(([, key, desc, kCol], i) => {
                const y = startY + i * rowH;
                const kw = key.length <= 2 ? 42 : key.length <= 4 ? 56 : 82;

                const badge = this.add.graphics();
                badge.fillStyle(0x161628);
                badge.fillRoundedRect(colX, y, kw, 24, 5);
                badge.lineStyle(1, 0x2a3a5a);
                badge.strokeRoundedRect(colX, y, kw, 24, 5);

                this.add.text(colX + kw / 2, y + 12, key, {
                    fontSize: '11px', fontFamily: 'Arial Black', color: kCol,
                }).setOrigin(0.5, 0.5);

                this.add.text(colX + kw + 10, y + 12, desc, {
                    fontSize: '13px', color: '#7788aa', fontFamily: 'Arial',
                }).setOrigin(0, 0.5);
            });
        };

        drawRows(col0, col0X);
        drawRows(col1, col1X);

        // ── Tip line ──────────────────────────────────────────────────
        this.add.text(cx, by + bh + 18, 'Defeat the boss each floor  •  pick 1 of 3 upgrades  •  enemies grow stronger', {
            fontSize: '13px', color: '#334455', fontFamily: 'Arial',
        }).setOrigin(0.5);

        // ── Start prompt ──────────────────────────────────────────────
        const prompt = this.add.text(cx, H - 42, 'PRESS  SPACE  OR  CLICK  TO  START', {
            fontSize: '19px', fontFamily: 'Arial Black',
            color: '#ffcc33', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);

        this.tweens.add({
            targets: prompt,
            alpha: 0.25,
            duration: 650,
            yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut',
        });

        const startGame = () => { SFX.init(); this.scene.start('GameScene'); };
        this.input.keyboard.once('keydown-SPACE', startGame);
        this.input.once('pointerdown', startGame);
    }
}

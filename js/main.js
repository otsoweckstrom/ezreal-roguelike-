const config = {
    type:   Phaser.AUTO,
    width:  GAME_W,
    height: GAME_H,
    backgroundColor: '#0a0a14',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug:   false,
        },
    },
    scene: [GameScene, HUDScene],
};

new Phaser.Game(config);

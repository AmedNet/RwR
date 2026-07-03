// src/core/GameState.js
export const GameState = {
    player: null,
    enemies: [],
    bullets: [],
    obstacles: [],          // 新增
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0 },
    kills: 0,
    gameOver: false,
    spawnTimer: 0,
    camera: { x: 0, y: 0 },
    config: null,

    reset() {
        this.enemies = [];
        this.bullets = [];
        this.obstacles = [];
        this.kills = 0;
        this.gameOver = false;
        this.spawnTimer = 0;
    }
};
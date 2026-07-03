// src/core/GameState.js
export const GameState = {
    player: null,
    enemies: [],
    teammates: [],
    bullets: [],
    capturePoints: [],
    map: null,
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0 },
    kills: 0,
    score: 0,
    gameOver: false,
    spawnTimer: 0,
    camera: { x: 0, y: 0 },
    config: null,
    isEditing: false,

    reset() {
        this.enemies = [];
        this.teammates = [];
        this.bullets = [];
        this.capturePoints = [];
        this.kills = 0;
        this.score = 0;
        this.gameOver = false;
        this.spawnTimer = 0;
        // 地图和据点由 main 重新初始化
    }
};
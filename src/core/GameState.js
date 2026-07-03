// src/core/GameState.js
export const GameState = {
    player: null,
    enemies: [],
    bullets: [],
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0 },
    kills: 0,
    gameOver: false,
    spawnTimer: 0,
    // 配置引用（在main中注入）
    config: null,
    camera: { x: 0, y: 0 },   // 摄像机位置（世界坐标）

    reset() {
        this.enemies = [];
        this.bullets = [];
        this.kills = 0;
        this.gameOver = false;
        this.spawnTimer = 0;
        // Player 需要用到配置，由 main 重新创建
        // 这里的重置逻辑由 main 调用时重新设置
    }
};
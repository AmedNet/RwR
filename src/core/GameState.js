// src/core/GameState.js
export const GameState = {
    player: null,
    enemies: [],
    teammates: [],
    bullets: [],
    capturePoints: [],
    arsenal: null, // 军械库实例
    arsenalOpen: false, // 军械库界面是否打开
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
    respawnSelection: false, // 是否在选择复活据点
    selectedSpawnPoint: null, // 数字选择时临时存储
    permanentDefeat: false, // 是否永久战败（无据点可复活）
    teammateRespawnQueue: [], // 等待重生的队友 { x, y, timer }

    reset() {
        this.enemies = [];
        this.teammates = [];
        this.bullets = [];
        // 据点不重置，它们是地图的一部分，由 initCapturePoints 一次性生成
        this.kills = 0;
        this.score = 0;
        this.gameOver = false;
        this.spawnTimer = 0;
    }
};
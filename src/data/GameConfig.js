// src/data/GameConfig.js
// 游戏核心配置数据（从 main.js 分离）

const CONFIG = {
    player: {
        health: 100,
        speed: 3.5,
        radius: 18,
        shootDelay: 12,
        bulletSpeed: 7,
        damage: 34         // ×1.7
    },
    enemy: {
        health: 100,         // 与友军一致
        speedMin: 1.2,
        speedMax: 2.0,
        radius: 18,
        shootDelayMin: 40,
        shootDelayMax: 70,
        damage: 17,         // ×1.7
        spawnBaseRate: 34,
        maxEnemies: 24
    },
    teammate: {
        health: 100,
        speed: 2.5,
        radius: 18,
        shootDelay: 25,
        damage: 26,         // ×1.7
        bulletSpeed: 6,
        maxCount: 50,
        respawnDelay: 300 // 5秒后重生
    },
    bullet: {
        radius: 5,
        life: 200
    },
    rankUpKills: 5,
    level: 'random',
    colors: {
        player: "#4CAF50",
        playerStroke: "#1B5E20",
        enemyHueMin: 340,
        enemyHueMax: 360
    },
    map: {
        cols: 360,
        rows: 300,
        tileSize: 50
    },
    capturePoints: {
        playerCount: 3,
        enemyCount: 3,
        minDist: 150,
        radius: 80
    }
};

// 世界尺寸已迁移至 GameState.world（运行时由 initMap/initQuickMap 写入），CONFIG 不再持有可变状态。

const GAME_CONSTANTS = {
    INITIAL_TEAMMATES: 15,
    INITIAL_ENEMIES: 3,
    TEAMMATE_SPAWN_MIN_DIST: 250,
    RANK_UP_SPAWN_MIN_DIST: 200,
    GENERATE_POINTS_MAX_ATTEMPTS: 1000,
    SPAWN_SEARCH_ATTEMPTS: 50,
    ARSENAL_RADIUS: 60,
    ARSENAL_SEARCH_ATTEMPTS: 20,
    ARSENAL_SEARCH_RADIUS_MIN: 50,
    ARSENAL_SEARCH_RADIUS_MAX: 150,
    ARSENAL_OFFSET: 200,
    ARSENAL_MIN_X: 150,
    BOUNDARY_MARGIN: 50,
    SCORE_CAPTURE: 10,
    SCORE_LOST: -5
};

export { CONFIG, GAME_CONSTANTS };

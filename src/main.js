// src/main.js
import { GameState } from './core/GameState.js';
import { EventBus } from './core/EventBus.js';
import { Player } from './entities/Player.js';
import { Teammate } from './entities/Teammate.js';
import { Renderer } from './rendering/Renderer.js';
import { UIManager } from './rendering/UIManager.js';
import { InputManager } from './input/InputManager.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { Map, Terrain } from './core/Map.js';
import { CapturePoint } from './entities/CapturePoint.js';
import { Minimap } from './rendering/Minimap.js';
import { MapGenerator } from './utils/MapGenerator.js';

// ---------- 配置 ----------
const CONFIG = {
    player: {
        health: 100,
        speed: 3.5,
        radius: 18,
        shootDelay: 12,
        bulletSpeed: 7,
        damage: 20
    },
    enemy: {
        health: 30,
        speedMin: 1.2,
        speedMax: 2.0,
        radius: 16,
        shootDelayMin: 40,
        shootDelayMax: 70,
        damage: 10,
        spawnBaseRate: 30,
        maxEnemies: 30
    },
    teammate: {
        health: 50,
        speed: 2.2,
        radius: 15,
        shootDelay: 25,
        damage: 15,
        bulletSpeed: 6,
        maxCount: 4
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
        cols: 80,
        rows: 80,
        tileSize: 50
    },
    capturePoints: [
        { x: 800, y: 800 },
        { x: 2000, y: 1000 },
        { x: 3200, y: 800 },
        { x: 800, y: 2800 },
        { x: 3200, y: 2800 },
        { x: 2000, y: 2400 }
    ]
};

// 提前计算世界尺寸（在 initMap 之前设置）
CONFIG.world = {
    width: CONFIG.map.cols * CONFIG.map.tileSize,
    height: CONFIG.map.rows * CONFIG.map.tileSize
};

// ---------- 初始化地图 ----------
function initMap() {
    const mapConfig = CONFIG.map;
    const map = new Map(mapConfig);
    // 从 localStorage 尝试加载
    const saved = localStorage.getItem('rwr_map_data');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            map.loadData(data);
            console.log('✅ 加载本地地图数据');
        } catch (e) {
            console.warn('⚠️ 本地地图数据损坏，使用默认');
        }
    } else {
        // 使用随机地图生成器
        MapGenerator.generateRandomMap(map);
        console.log('🗺️ 使用随机生成地图');
    }
    GameState.map = map;
    // 更新世界尺寸（确保与地图一致）
    CONFIG.world.width = map.cols * map.tileSize;
    CONFIG.world.height = map.rows * map.tileSize;
}

// ---------- 初始化据点 ----------
function initCapturePoints() {
    const points = CONFIG.capturePoints.map((p, i) => {
        return new CapturePoint(p.x, p.y, 80, i);
    });
    GameState.capturePoints = points;
    console.log(`🚩 初始化 ${points.length} 个据点`);
}

// ---------- 生成队友 ----------
function spawnTeammate() {
    const player = GameState.player;
    if (!player) return null;
    const config = GameState.config.teammate;
    const world = GameState.config.world;
    const map = GameState.map;
    
    // 尝试在玩家周围找到可通行的位置
    for (let attempt = 0; attempt < 30; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 80;
        let x = player.x + Math.cos(angle) * dist;
        let y = player.y + Math.sin(angle) * dist;
        x = Math.max(config.radius, Math.min(world.width - config.radius, x));
        y = Math.max(config.radius, Math.min(world.height - config.radius, y));
        if (!map || map.isWalkable(x, y, config.radius)) {
            return new Teammate(x, y, config);
        }
    }
    // 如果找不到合适位置，强行放在玩家旁边（碰撞系统会处理）
    return new Teammate(player.x + 50, player.y + 50, config);
}

// ---------- 重置游戏 ----------
function resetGame() {
    GameState.reset();
    const config = GameState.config;
    // 重新创建玩家
    GameState.player = new Player(config.world.width / 2, config.world.height / 2, config.player);

    // 初始队友（至少1个）
    const first = spawnTeammate();
    if (first) GameState.teammates.push(first);

    // 初始敌人
    for (let i = 0; i < 3; i++) {
        GameState.enemies.push(SpawnSystem.spawnEnemy());
    }
    GameState.gameOver = false;
    UIManager.updateAll(GameState);
    console.log('🔄 游戏重置完成');
}

// ---------- 游戏循环 ----------
function gameLoop() {
    // 更新摄像机
    if (GameState.player && !GameState.gameOver) {
        const player = GameState.player;
        const world = GameState.config.world;
        const canvasWidth = Renderer.width;
        const canvasHeight = Renderer.height;
        let targetX = player.x - canvasWidth / 2;
        let targetY = player.y - canvasHeight / 2;
        targetX = Math.max(0, Math.min(world.width - canvasWidth, targetX));
        targetY = Math.max(0, Math.min(world.height - canvasHeight, targetY));
        GameState.camera.x = targetX;
        GameState.camera.y = targetY;
    }

    if (!GameState.gameOver) {
        // 更新据点
        for (const point of GameState.capturePoints) {
            point.update();
        }

        if (GameState.player) GameState.player.update();
        SpawnSystem.update();
        for (const enemy of GameState.enemies) enemy.update();
        for (const teammate of GameState.teammates) teammate.update();
        for (const bullet of GameState.bullets) bullet.update();
        CollisionSystem.checkAll();
        
        // ---- 过滤死亡实体 ----
        GameState.enemies = GameState.enemies.filter(e => e.alive);
        GameState.teammates = GameState.teammates.filter(t => t.alive);
        GameState.bullets = GameState.bullets.filter(b => b.alive);
    }

    Renderer.render();
    Minimap.render();
    requestAnimationFrame(gameLoop);
}



// ---------- 初始化 ----------
function init() {
    GameState.config = CONFIG;
    Renderer.resize();
    InputManager.setup();

    // 初始化地图和据点
    initMap();
    initCapturePoints();

    resetGame();

    // ---- 事件监听 ----
    EventBus.on('player_hurt', (data) => {
        UIManager.updateAll(GameState);
    });
    EventBus.on('player_rank_up', (data) => {
        const maxCount = CONFIG.teammate.maxCount;
        if (GameState.teammates.length < maxCount) {
            const t = spawnTeammate();
            if (t) {
                GameState.teammates.push(t);
                console.log(`🎖️ 军衔提升！新增一名队友，当前 ${GameState.teammates.length} 人`);
            }
        }
        UIManager.updateAll(GameState);
    });
    EventBus.on('player_kill', () => UIManager.updateAll(GameState));
    EventBus.on('game_over', () => UIManager.updateAll(GameState));
    EventBus.on('point_captured', (data) => {
        if (data.owner === 'player') {
            GameState.score += 10;
            console.log('🎯 占领据点! +10分');
        } else if (data.owner === 'enemy') {
            GameState.score -= 5;
            console.log('💔 据点被敌人占领 -5分');
        }
        UIManager.updateAll(GameState);
    });

    window.addEventListener('restartGame', resetGame);
    window.addEventListener('resize', () => Renderer.resize());

    // 初始化小地图
    Minimap.init();

    console.log('🎮 游戏初始化完成！');
    console.log(`📐 地图大小: ${CONFIG.world.width} x ${CONFIG.world.height}`);
    console.log(`📍 据点数量: ${GameState.capturePoints.length}`);

    gameLoop();
}

init();
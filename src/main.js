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
import { Arsenal } from './entities/Arsenal.js';

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
        maxCount: 10,
        respawnDelay: 300 // 5秒（60fps下300帧）后重生
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
    capturePoints: {
        playerCount: 3,
        enemyCount: 3,
        minDist: 150,
        radius: 80
    }
};

// 提前计算世界尺寸（在 initMap 之前设置）
CONFIG.world = {
    width: CONFIG.map.cols * CONFIG.map.tileSize,
    height: CONFIG.map.rows * CONFIG.map.tileSize
};

// ---------- 初始化地图 ----------
function initMap() {
    console.log('🗺️ 正在初始化地图...');
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
    console.log('✅ 地图初始化完成');
}

// ---------- 初始化据点 ----------
function generatePoints(xMin, xMax, yMin, yMax, count, radius, minDist) {
    const points = [];
    const map = GameState.map;
    let attempts = 0;
    while (points.length < count && attempts < 1000) {
        attempts++;
        const x = xMin + Math.random() * (xMax - xMin);
        const y = yMin + Math.random() * (yMax - yMin);
        // 检查是否可通行（不在房屋上）
        if (!map || !map.isWalkable(x, y, radius)) continue;
        // 检查与已有据点距离
        let tooClose = false;
        for (const p of points) {
            if (Math.hypot(p.x - x, p.y - y) < minDist) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;
        points.push({ x, y });
    }
    console.log(`📍 生成了 ${points.length} 个点，范围 x:[${xMin}, ${xMax}] y:[${yMin}, ${yMax}]`);
    return points;
}

function initCapturePoints() {
    const map = GameState.map;
    if (!map) return;
    const worldW = CONFIG.world.width;
    const worldH = CONFIG.world.height;
    const halfX = worldW / 2;
    const cfg = CONFIG.capturePoints;
    const radius = cfg.radius;
    const minDist = cfg.minDist;

    // 生成我方据点（左半）
    const playerPoints = generatePoints(
        0, halfX - 50,
        50, worldH - 50,
        cfg.playerCount,
        radius, minDist
    );
    // 生成敌方据点（右半）
    const enemyPoints = generatePoints(
        halfX + 50, worldW - 50,
        50, worldH - 50,
        cfg.enemyCount,
        radius, minDist
    );

    const allPoints = [];
    for (const p of playerPoints) {
        allPoints.push(new CapturePoint(p.x, p.y, radius, 'player', allPoints.length));
    }
    for (const p of enemyPoints) {
        allPoints.push(new CapturePoint(p.x, p.y, radius, 'enemy', allPoints.length));
    }
    GameState.capturePoints = allPoints;
    console.log(`🚩 生成 ${allPoints.length} 个据点（玩家${playerPoints.length} / 敌人${enemyPoints.length}）`);
    
    // 生成军械库（在友方后方，即玩家据点的左侧）
    initArsenal(playerPoints);
}

// ---------- 初始化军械库 ----------
function initArsenal(playerPoints) {
    const map = GameState.map;
    const worldW = CONFIG.world.width;
    const worldH = CONFIG.world.height;
    
    // 找到最左侧的玩家据点作为参考
    let leftMostPoint = null;
    let minX = Infinity;
    
    for (const p of playerPoints) {
        if (p.x < minX) {
            minX = p.x;
            leftMostPoint = p;
        }
    }
    
    let arsenalX, arsenalY;
    
    if (leftMostPoint) {
        // 在最左侧玩家据点的左后方生成
        arsenalX = Math.max(150, leftMostPoint.x - 200);
        arsenalY = leftMostPoint.y;
    } else {
        // 如果没有玩家据点，在地图左侧中间生成
        arsenalX = 200;
        arsenalY = worldH / 2;
    }
    
    // 确保位置可通行
    if (map && !map.isWalkable(arsenalX, arsenalY, 60)) {
        // 尝试附近位置
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 50 + Math.random() * 100;
            const testX = arsenalX + Math.cos(angle) * dist;
            const testY = arsenalY + Math.sin(angle) * dist;
            if (map.isWalkable(testX, testY, 60)) {
                arsenalX = testX;
                arsenalY = testY;
                break;
            }
        }
    }
    
    GameState.arsenal = new Arsenal(arsenalX, arsenalY);
    console.log(`🔫 军械库生成于 (${Math.round(arsenalX)}, ${Math.round(arsenalY)})`);
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
    
    // 寻找最近的己方据点，如果没有则回中心
    let spawnX = config.world.width / 2;
    let spawnY = config.world.height / 2;
    let minDist = Infinity;
    
    for (const point of GameState.capturePoints) {
        if (point.owner === 'player') {
            const d = Math.hypot(point.x - spawnX, point.y - spawnY);
            if (d < minDist) {
                minDist = d;
                spawnX = point.x;
                spawnY = point.y;
            }
        }
    }
    
    // 创建玩家
    GameState.player = new Player(spawnX, spawnY, config.player);

    // 初始队友（5人）
    for (let i = 0; i < 5; i++) {
        const t = spawnTeammate();
        if (t) GameState.teammates.push(t);
    }

    // 初始敌人
    for (let i = 0; i < 3; i++) {
        GameState.enemies.push(SpawnSystem.spawnEnemy());
    }
    GameState.gameOver = false;
    UIManager.updateAll(GameState);
    console.log('🔄 游戏重置完成，重生在据点');
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
        GameState.bullets = GameState.bullets.filter(b => b.alive);

        // ---- 队友重生逻辑 ----
        updateTeammateRespawns();
    } else {
        // 死亡状态下检查战败条件：没有己方据点 = 真正失败
        const hasFriendly = GameState.capturePoints.some(p => p.owner === 'player');
        if (!hasFriendly && GameState.gameOver && !GameState.permanentDefeat) {
            // 已经是 gameOver 状态且无己方据点 -> 永久战败，不允许复活
            GameState.permanentDefeat = true;
            console.log('💀 战败！所有据点已失守，游戏结束');
        }
    }

    Renderer.render();
    Minimap.render();
    requestAnimationFrame(gameLoop);
}



// ---------- 初始化 ----------
function init() {
    console.log('🚀 初始化游戏...');
    GameState.config = CONFIG;

    // 显式初始化渲染器
    Renderer.init();
    Renderer.resize();

    InputManager.setup();

    // 初始化地图和据点
    initMap();
    initCapturePoints();

    resetGame();
    console.log('✅ 游戏重置完成，准备开始循环');

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

    window.addEventListener('respawnPlayer', (e) => {
        const pointIndex = e.detail ? e.detail.pointIndex : undefined;
        respawnPlayer(pointIndex);
    });
    window.addEventListener('resize', () => Renderer.resize());

    // 初始化小地图
    Minimap.init();

    console.log('🎮 游戏初始化完成！');
    console.log(`📐 地图大小: ${CONFIG.world.width} x ${CONFIG.world.height}`);
    console.log(`📍 据点数量: ${GameState.capturePoints.length}`);

    gameLoop();
}

// ---------- 队友重生逻辑 ----------
function updateTeammateRespawns() {
    const config = GameState.config.teammate;
    const queue = GameState.teammateRespawnQueue;
    
    for (let i = queue.length - 1; i >= 0; i--) {
        queue[i].timer--;
        if (queue[i].timer <= 0) {
            // 在最近的己方据点重生
            const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
            let spawnX, spawnY;
            if (playerPoints.length > 0) {
                const point = playerPoints[Math.floor(Math.random() * playerPoints.length)];
                const angle = Math.random() * Math.PI * 2;
                const dist = 30 + Math.random() * 50;
                spawnX = point.x + Math.cos(angle) * dist;
                spawnY = point.y + Math.sin(angle) * dist;
            } else {
                // 无己方据点，在玩家附近重生
                const player = GameState.player;
                if (player) {
                    spawnX = player.x + (Math.random() - 0.5) * 100;
                    spawnY = player.y + (Math.random() - 0.5) * 100;
                } else {
                    spawnX = GameState.config.world.width / 2;
                    spawnY = GameState.config.world.height / 2;
                }
            }
            
            // 确保不超过最大数量
            if (GameState.teammates.length < config.maxCount) {
                const t = new Teammate(spawnX, spawnY, config);
                GameState.teammates.push(t);
                console.log('🔄 队友在据点重生');
            }
            queue.splice(i, 1);
        }
    }
}

// 启动游戏!
init();

function respawnPlayer(pointIndex) {
    const config = GameState.config;
    // 寻找己方据点
    const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
    
    let spawnX = config.world.width / 2;
    let spawnY = config.world.height / 2;
    
    if (pointIndex !== undefined && playerPoints[pointIndex]) {
        // 选择指定据点
        const point = playerPoints[pointIndex];
        spawnX = point.x;
        spawnY = point.y;
        console.log(`📍 在据点 #${pointIndex + 1} (${Math.round(spawnX)}, ${Math.round(spawnY)}) 重生`);
    } else if (playerPoints.length > 0) {
        // 默认选第一个
        const point = playerPoints[0];
        spawnX = point.x;
        spawnY = point.y;
        console.log(`📍 在己方据点 (${Math.round(spawnX)}, ${Math.round(spawnY)}) 重生`);
    } else {
        console.log('⚠️ 无己方据点，在中心重生');
    }
    
    // 重置玩家状态（位置、血量等）
    GameState.player = new Player(spawnX, spawnY, config.player);
    GameState.gameOver = false;
    GameState.respawnSelection = false;
    UIManager.updateAll(GameState);
}

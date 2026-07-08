// src/main.js
import { GameState } from './core/GameState.js';
import { Weapon } from './core/Weapon.js';
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
import { EffectsManager } from './utils/EffectsManager.js';
import { setListenerProvider } from './utils/SoundManager.js';
import { BurnEffect, STATUS_EFFECT_CONFIG } from './utils/StatusEffects.js';

// ---------- 配置 ----------
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
        radius: 16,
        shootDelayMin: 40,
        shootDelayMax: 70,
        damage: 17,         // ×1.7
        spawnBaseRate: 30,
        maxEnemies: 30
    },
    teammate: {
        health: 100,
        speed: 2.5,
        radius: 15,
        shootDelay: 25,
        damage: 26,         // ×1.7
        bulletSpeed: 6,
        maxCount: 50,
        respawnDelay: 360 // 6秒后重生
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

// 提前计算世界尺寸（在 initMap 之前设置）
CONFIG.world = {
    width: CONFIG.map.cols * CONFIG.map.tileSize,
    height: CONFIG.map.rows * CONFIG.map.tileSize
};

// ---------- 游戏常量 ----------
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

/** 获取所有己方据点 */
function getPlayerPoints() {
    return GameState.capturePoints.filter(p => p.owner === 'player');
}

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
    // 标记小地图需要重绘
    if (Minimap.initialized) Minimap.mapDirty = true;
    console.log('✅ 地图初始化完成');
}

// ---------- 初始化据点 ----------
function generatePoints(xMin, xMax, yMin, yMax, count, radius, minDist) {
    const points = [];
    const map = GameState.map;
    let attempts = 0;
    while (points.length < count && attempts < GAME_CONSTANTS.GENERATE_POINTS_MAX_ATTEMPTS) {
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
        arsenalX = Math.max(GAME_CONSTANTS.ARSENAL_MIN_X, leftMostPoint.x - GAME_CONSTANTS.ARSENAL_OFFSET);
        arsenalY = leftMostPoint.y;
    } else {
        // 如果没有玩家据点，在地图左侧中间生成
        arsenalX = GAME_CONSTANTS.ARSENAL_OFFSET;
        arsenalY = worldH / 2;
    }
    
    // 确保位置可通行
    if (map && !map.isWalkable(arsenalX, arsenalY, GAME_CONSTANTS.ARSENAL_RADIUS)) {
        // 尝试附近位置
        for (let i = 0; i < GAME_CONSTANTS.ARSENAL_SEARCH_ATTEMPTS; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = GAME_CONSTANTS.ARSENAL_SEARCH_RADIUS_MIN + Math.random() * (GAME_CONSTANTS.ARSENAL_SEARCH_RADIUS_MAX - GAME_CONSTANTS.ARSENAL_SEARCH_RADIUS_MIN);
            const testX = arsenalX + Math.cos(angle) * dist;
            const testY = arsenalY + Math.sin(angle) * dist;
            if (map.isWalkable(testX, testY, GAME_CONSTANTS.ARSENAL_RADIUS)) {
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
function spawnTeammate(spawnPoint, minDistance = 150) {
    const config = GameState.config.teammate;
    const world = GameState.config.world;
    const map = GameState.map;
    const player = GameState.player;
    
    // 如果指定了生成点，在生成点周围生成
    let centerX, centerY;
    if (spawnPoint) {
        centerX = spawnPoint.x;
        centerY = spawnPoint.y;
    } else if (player) {
        centerX = player.x;
        centerY = player.y;
    } else {
        centerX = world.width / 2;
        centerY = world.height / 2;
    }
    
    // 尝试在生成点周围找到可通行的位置，保持最小距离
    for (let attempt = 0; attempt < GAME_CONSTANTS.SPAWN_SEARCH_ATTEMPTS; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = minDistance + Math.random() * 150; // 至少 minDistance 距离
        let x = centerX + Math.cos(angle) * dist;
        let y = centerY + Math.sin(angle) * dist;
        x = Math.max(config.radius, Math.min(world.width - config.radius, x));
        y = Math.max(config.radius, Math.min(world.height - config.radius, y));
        if (!map || map.isWalkable(x, y, config.radius)) {
            return new Teammate(x, y, config);
        }
    }
    
    // Fallback：用更大的随机偏移
    const fallbackAngle = Math.random() * Math.PI * 2;
    const fallbackDist = minDistance + Math.random() * 100;
    const fx = Math.max(config.radius, Math.min(world.width - config.radius, centerX + Math.cos(fallbackAngle) * fallbackDist));
    const fy = Math.max(config.radius, Math.min(world.height - config.radius, centerY + Math.sin(fallbackAngle) * fallbackDist));
    return new Teammate(fx, fy, config);
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

    // 初始队友（15人），分散到各个己方据点（至少250像素外）
    const playerPoints = getPlayerPoints();
    for (let i = 0; i < GAME_CONSTANTS.INITIAL_TEAMMATES; i++) {
        // 轮流在各个据点生成，保持最小距离
        const spawnPoint = playerPoints.length > 0 ? playerPoints[i % playerPoints.length] : null;
        const t = spawnTeammate(spawnPoint, GAME_CONSTANTS.TEAMMATE_SPAWN_MIN_DIST);
        if (t) {
            SpawnSystem.equipTeammate(t);
            GameState.teammates.push(t);
        }
    }

    // 初始敌人
    for (let i = 0; i < GAME_CONSTANTS.INITIAL_ENEMIES; i++) {
        GameState.enemies.push(SpawnSystem.spawnEnemy());
    }
    GameState.gameOver = false;
    UIManager.updateAll(GameState);
    console.log('🔄 游戏重置完成，重生在据点');
}

// ---------- 游戏循环 ----------
function gameLoop() {
    // 更新特效（粒子、伤害数字等）
    EffectsManager.update();

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

    // 更新据点（无论是否阵亡都继续）
    for (const point of GameState.capturePoints) {
        point.update();
    }
    // 玩家仅在存活时更新
    if (GameState.player && !GameState.gameOver) GameState.player.update();
    SpawnSystem.update();
    for (const enemy of GameState.enemies) enemy.update();
    for (const teammate of GameState.teammates) teammate.update();
    for (const bullet of GameState.bullets) bullet.update();
    for (const grenade of GameState.grenades) grenade.update();
    for (const pickup of GameState.weaponPickups) pickup.update();
    CollisionSystem.checkAll();

    // ---- 过滤死亡实体 ----
    GameState.enemies = GameState.enemies.filter(e => e.alive);
    GameState.bullets = GameState.bullets.filter(b => b.alive);
    GameState.grenades = GameState.grenades.filter(g => g.alive);
    GameState.weaponPickups = GameState.weaponPickups.filter(p => p.alive);

    // ---- 队友重生逻辑 ----
    updateTeammateRespawns();

    // 死亡状态下检查战败条件
    if (GameState.gameOver) {
        const hasFriendly = GameState.capturePoints.some(p => p.owner === 'player');
        const playerDead = !GameState.player || !GameState.player.alive;
        if (!hasFriendly && playerDead && !GameState.permanentDefeat) {
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
    setListenerProvider(() => GameState.player);

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
            // 随机选择一个己方据点生成新队友
            const playerPoints = getPlayerPoints();
            const spawnPoint = playerPoints.length > 0 
                ? playerPoints[Math.floor(Math.random() * playerPoints.length)] 
                : null;
            const t = spawnTeammate(spawnPoint, GAME_CONSTANTS.RANK_UP_SPAWN_MIN_DIST);
            if (t) {
                SpawnSystem.equipTeammate(t);
                GameState.teammates.push(t);
                console.log(`🎖️ 军衔提升！新增一名队友在据点，当前 ${GameState.teammates.length} 人`);
            }
        }
        UIManager.updateAll(GameState);
    });
    EventBus.on('player_kill', () => UIManager.updateAll(GameState));
    EventBus.on('game_over', () => UIManager.updateAll(GameState));
    EventBus.on('point_captured', (data) => {
        if (data.owner === 'player') {
            GameState.score += GAME_CONSTANTS.SCORE_CAPTURE;
            console.log(`🎯 占领据点! +${GAME_CONSTANTS.SCORE_CAPTURE}分`);
        } else if (data.owner === 'enemy') {
            GameState.score += GAME_CONSTANTS.SCORE_LOST;
            console.log(`💔 据点被敌人占领 ${GAME_CONSTANTS.SCORE_LOST}分`);
        }
        UIManager.updateAll(GameState);
    });

    window.addEventListener('respawnPlayer', (e) => {
        const pointIndex = e.detail ? e.detail.pointIndex : undefined;
        respawnPlayer(pointIndex);
    });
    window.addEventListener('resize', () => Renderer.resize());

    // ---- 手雷爆炸监听 ----
    window.addEventListener('grenade_explode', (e) => {
        const { x, y, radius, damage } = e.detail;
        
        // 爆炸效果
        EffectsManager.spawnGrenadeExplosion(x, y, radius);

        // 破片伤害：对爆炸半径内所有实体造成距离衰减伤害
        const entities = [
            ...GameState.enemies.filter(e => e.alive),
            ...GameState.teammates.filter(t => t.alive)
        ];
        if (GameState.player && GameState.player.alive) {
            entities.push(GameState.player);
        }

        for (const entity of entities) {
            const d = Math.hypot(entity.x - x, entity.y - y);
            if (d < radius) {
                // 距离衰减伤害
                const dmg = Math.floor(damage * (1 - d / radius));
                if (dmg > 0) {
                    const wasAlive = entity.alive;
                    entity.takeDamage(dmg, x, y);
                    EffectsManager.addDamageNumber(entity.x, entity.y, dmg, entity === GameState.player);
                    // 爆炸伤害产生血迹
                    EffectsManager.spawnBloodSplatter(entity.x, entity.y, 0, 0, dmg);
                    if (wasAlive && !entity.alive && GameState.teammates.includes(entity)) {
                        GameState.teammateRespawnQueue.push({
                            timer: GameState.config.teammate.respawnDelay
                        });
                    }
                    // 击退效果
                    const angle = Math.atan2(entity.y - y, entity.x - x);
                    const knockback = 60 * (1 - d / radius);
                    entity.x += Math.cos(angle) * knockback;
                    entity.y += Math.sin(angle) * knockback;
                }
                // 触发燃烧效果（使用配置常量）
                if (entity.alive && Math.random() < STATUS_EFFECT_CONFIG.BURN.TRIGGER_CHANCE) {
                    const { MIN_DURATION, MAX_DURATION } = STATUS_EFFECT_CONFIG.BURN;
                    const burnDuration = MIN_DURATION + Math.floor(Math.random() * (MAX_DURATION - MIN_DURATION + 1));
                    entity.addStatusEffect(new BurnEffect(burnDuration));
                }
            }
        }

        // 清除被炸死的敌人
        GameState.enemies = GameState.enemies.filter(e => e.alive);

        // 如果玩家被炸死
        if (GameState.player && !GameState.player.alive) {
            GameState.gameOver = true;
            EventBus.emit('game_over');
        }
    });

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
            const playerPoints = getPlayerPoints();
            let spawnX, spawnY;
            if (playerPoints.length > 0) {
                const point = playerPoints[Math.floor(Math.random() * playerPoints.length)];
                const angle = Math.random() * Math.PI * 2;
                const dist = 30 + Math.random() * 50;
                spawnX = point.x + Math.cos(angle) * dist;
                spawnY = point.y + Math.sin(angle) * dist;
            } else {
                // 无己方据点，在玩家周围200-350像素外重生
                const player = GameState.player;
                if (player) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 200 + Math.random() * 150;
                    spawnX = player.x + Math.cos(angle) * dist;
                    spawnY = player.y + Math.sin(angle) * dist;
                } else {
                    spawnX = GameState.config.world.width / 2;
                    spawnY = GameState.config.world.height / 2;
                }
            }
            
            // 确保不超过最大数量
            if (GameState.teammates.length < config.maxCount) {
                const t = new Teammate(spawnX, spawnY, config);
                SpawnSystem.equipTeammate(t);
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
    const playerPoints = getPlayerPoints();
    
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
    
    // 非自杀死亡：清空背包，只保留初始手枪
    if (!GameState.suicideDeath) {
        console.log('💔 阵亡损失：背包物品已清空');
        GameState.inventory = [new Weapon('beretta92'), null, null, null, null, null, null];
        GameState.activeWeaponSlot = 0;
    } else {
        console.log('✅ 自杀：保留背包物品');
    }
    
    // 重置自杀标记
    GameState.suicideDeath = false;
    
    // 重置玩家状态（位置、血量等）
    GameState.player = new Player(spawnX, spawnY, config.player);
    GameState.gameOver = false;
    GameState.respawnSelection = false;
    UIManager.updateAll(GameState);
}

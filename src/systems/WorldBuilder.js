// src/systems/WorldBuilder.js
// 世界构建：地图、据点、军械库、载具、队友的生成与重生。
// 从 main.js 抽出，供战地模式（startMatch/resetGame）、快速模式、菜单背景战斗共用。
import { GameState } from '../core/GameState.js';
import { Map } from '../core/Map.js';
import { CapturePoint } from '../entities/CapturePoint.js';
import { Arsenal } from '../entities/Arsenal.js';
import { Vehicle } from '../entities/Vehicle.js';
import { Teammate } from '../entities/Teammate.js';
import { VehicleRegistry } from '../core/VehicleRegistry.js';
import { MapGenerator } from '../utils/MapGenerator.js';
import { SpawnSystem } from './SpawnSystem.js';
import { CONFIG, GAME_CONSTANTS } from '../data/GameConfig.js';
import { Minimap } from '../rendering/Minimap.js';

// ---------- 工具 ----------
/** 获取所有己方据点 */
export function getPlayerPoints() {
    return GameState.capturePoints.filter(p => p.owner === 'player');
}

// ---------- 初始化地图 ----------
export function initMap() {
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
    GameState.world.width = map.cols * map.tileSize;
    GameState.world.height = map.rows * map.tileSize;
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
        const minDistSq = minDist * minDist;
        for (const p of points) {
            const dx = p.x - x;
            const dy = p.y - y;
            if (dx * dx + dy * dy < minDistSq) {
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

export function initCapturePoints() {
    const map = GameState.map;
    if (!map) return;
    const worldW = GameState.world.width;
    const worldH = GameState.world.height;
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
    const worldW = GameState.world.width;
    const worldH = GameState.world.height;

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

// ---------- 载具生成 ----------
// 在指定坐标周围随机可行走处生成一辆吉普，成功返回 true
function spawnVehicleNear(x, y, spawnRadius = 200) {
    const map = GameState.map;
    if (!map) return false;
    for (let attempts = 0; attempts < 200; attempts++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * (spawnRadius - 80);
        const wx = x + Math.cos(angle) * dist;
        const wy = y + Math.sin(angle) * dist;
        if (!map.isWalkable(wx, wy, VehicleRegistry.jeep.radius)) continue;
        GameState.vehicles.push(new Vehicle(wx, wy, VehicleRegistry.jeep));
        return true;
    }
    return false;
}

export function initVehicles() {
    const points = GameState.capturePoints;
    if (!points || points.length === 0) return;
    const max = GameState.maxVehicles;
    console.log("🚙 在据点附近生成吉普车（上限 " + max + " 辆）...");

    // 打乱据点顺序，从每个据点旁尝试生成，直到达到上限
    const shuffled = [...points].sort(() => Math.random() - 0.5);
    for (const p of shuffled) {
        if (GameState.vehicles.length >= max) break;
        spawnVehicleNear(p.x, p.y);
    }
    console.log("✅ 载具生成完成: " + GameState.vehicles.length + " 辆");
}

// 持续刷新：场上吉普不足上限时，每隔一段时间在随机据点旁补刷
const VEHICLE_RESPAWN_INTERVAL = 360; // 约 6 秒（60fps）检查一次
export function updateVehicleSpawns() {
    if (GameState.vehicleSpawnTimer > 0) {
        GameState.vehicleSpawnTimer--;
        return;
    }
    if (GameState.vehicles.length >= GameState.maxVehicles) {
        GameState.vehicleSpawnTimer = VEHICLE_RESPAWN_INTERVAL;
        return;
    }
    const points = GameState.capturePoints;
    if (!points || points.length === 0) {
        GameState.vehicleSpawnTimer = VEHICLE_RESPAWN_INTERVAL;
        return;
    }

    // 过滤掉距离玩家太近的据点（避免在视野内刷车）
    const player = GameState.player;
    const minSpawnDistance = 600; // 至少 600 像素外
    const minSpawnDistSq = minSpawnDistance * minSpawnDistance;
    const safePoints = player && player.alive
        ? points.filter(p => {
            const dx = p.x - player.x;
            const dy = p.y - player.y;
            return dx * dx + dy * dy > minSpawnDistSq;
          })
        : points;

    if (safePoints.length === 0) {
        // 所有据点都太近，跳过这次刷新
        GameState.vehicleSpawnTimer = VEHICLE_RESPAWN_INTERVAL;
        return;
    }

    const p = safePoints[Math.floor(Math.random() * safePoints.length)];
    spawnVehicleNear(p.x, p.y);
    GameState.vehicleSpawnTimer = VEHICLE_RESPAWN_INTERVAL;
}

// ---------- 生成队友 ----------
export function spawnTeammate(spawnPoint, minDistance = 150) {
    const config = GameState.config.teammate;
    const world = GameState.world;
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

// ---------- 队友重生逻辑 ----------
export function updateTeammateRespawns() {
    // 快速模式（死斗）：队友阵亡不重生（此函数与菜单背景战斗共用，故在函数内按 mode 守卫）
    if (GameState.mode === 'quick') return;
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
                    spawnX = GameState.world.width / 2;
                    spawnY = GameState.world.height / 2;
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

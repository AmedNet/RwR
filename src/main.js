// src/main.js
import { GameState } from './core/GameState.js';
import { Weapon } from './core/Weapon.js';
import { EventBus } from './core/EventBus.js';
import { Player } from './entities/Player.js';
import { Teammate } from './entities/Teammate.js';
import { Enemy } from './entities/Enemy.js';
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
import { setListenerProvider, playRadioOpen, playRadioClose } from './utils/SoundManager.js';
import { BurnEffect, STATUS_EFFECT_CONFIG } from './utils/StatusEffects.js';
import { WeatherSystem } from './core/WeatherSystem.js';
import { DayNightSystem } from './core/DayNightSystem.js';
import { AmbientSoundManager } from './utils/AmbientSoundManager.js';
import { SupportSystem } from './core/SupportSystem.js';
import { Vehicle } from "./entities/Vehicle.js";
import { VehicleRegistry } from "./core/VehicleRegistry.js";
import { DialogueSystem } from './utils/DialogueSystem.js';
import { generateBriefing } from './data/BriefingDialogues.js';
// ─── 主菜单 / 加载流程 ───
import { preloadAssets, getMenuMusicArrayBuffer } from './core/AssetLoader.js';
import { startMenuMusic, stopMenuMusic, stopVehicleEngine, muteBattleSfx, setFocusMuted } from './utils/SoundManager.js';
import { setMenuActions } from './input/handlers/MainMenuHandler.js';
import { setQuickResultActions } from './input/handlers/QuickResultHandler.js';
import { setQuitToMenu } from './input/handlers/PauseHandler.js';
import { setFirstGestureHandler } from './input/InputManager.js';

// ---------- 配置 ----------
import { CONFIG, GAME_CONSTANTS } from './data/GameConfig.js';
import { WeaponRegistry, WeaponType } from './core/WeaponRegistry.js';
import { Settings, applyGraphics, applyAudio } from './data/Settings.js';
// ---------- 剧情系统 (TODO: 后续阶段集成) ----------
// import { CampaignManager } from './campaign/CampaignManager.js';

// ---------- 快速模式（死斗）调参 ----------
const QUICK_MAP_COLS = 120;      // 快速模式小地图列数（战地 360 的 1/3）
const QUICK_MAP_ROWS = 100;      // 快速模式小地图行数（战地 300 的 1/3）
const QUICK_ENEMY_MIN = 25;      // 敌方数量下限（约 30±5）
const QUICK_ENEMY_MAX = 35;      // 敌方数量上限
const QUICK_TEAMMATE_MIN = 5;    // 友军数量下限（约 10±5）
const QUICK_TEAMMATE_MAX = 15;   // 友军数量上限

// ---------- 工具函数 ----------
/** 获取所有己方据点 */
function getPlayerPoints() {
    return GameState.capturePoints.filter(p => p.owner === 'player');
}

// ---------- 快速模式：小地图（无据点/军械库，不读 localStorage） ----------
function initQuickMap() {
    const map = new Map({ cols: QUICK_MAP_COLS, rows: QUICK_MAP_ROWS, tileSize: CONFIG.map.tileSize });
    MapGenerator.generateRandomMap(map);
    GameState.map = map;
    CONFIG.world.width = map.cols * map.tileSize;
    CONFIG.world.height = map.rows * map.tileSize;
    if (Minimap.initialized) Minimap.mapDirty = true;
    console.log(`🗺️ 快速模式小地图生成 (${QUICK_MAP_COLS}×${QUICK_MAP_ROWS})`);
}

// ---------- 快速模式：随机主武器 id（仅枪械类） ----------
function randomGunId() {
    const gunTypes = [WeaponType.RIFLE, WeaponType.SMG, WeaponType.SHOTGUN, WeaponType.SNIPER];
    const guns = Object.keys(WeaponRegistry).filter(id => gunTypes.includes(WeaponRegistry[id].type));
    return guns[Math.floor(Math.random() * guns.length)];
}

// ---------- 快速模式：序列化/还原 AI 单位（供「重试=同配置」精确复现位置+装备） ----------
function describeUnit(u) {
    return {
        x: u.x, y: u.y,
        rank: u.rank,
        unitClass: u.unitClass,
        weapons: u.weapons.map(w => (w ? { id: w.id, inf: w.isInfiniteAmmo } : null)),
    };
}

function buildUnitFromDesc(d, Ctor, config) {
    const u = new Ctor(d.x, d.y, config);
    u.setRank(d.rank);
    u.setClass(d.unitClass);
    u.setHelmet(d.rank);
    u.setWeapons(d.weapons.map(wd => {
        if (!wd) return null;
        const w = new Weapon(wd.id);
        w.isInfiniteAmmo = wd.inf;
        return w;
    }));
    return u;
}

// ---------- 快速模式：生成本局兵力快照（位置/军衔/兵种/装备），写入 quickConfig ----------
// 只在「新一把」调用一次；「重试」直接复用 quickConfig 里的快照，不再随机。
function generateQuickBattleDescs() {
    const cfg = GameState.quickConfig;
    const world = GameState.config.world;
    const worldH = world.height;
    const halfX = world.width / 2;

    // 友军分散在左半：网格切片 + 格内抖动，避免挤一坨
    const teammates = [];
    const tCols = Math.ceil(Math.sqrt(cfg.teammateCount));
    const tRows = Math.ceil(cfg.teammateCount / tCols);
    const tCellW = (halfX - 200) / tCols;
    const tCellH = (worldH - 200) / tRows;
    for (let i = 0; i < cfg.teammateCount; i++) {
        const cx = 100 + (i % tCols + 0.5) * tCellW + (Math.random() - 0.5) * tCellW * 0.6;
        const cy = 100 + (Math.floor(i / tCols) + 0.5) * tCellH + (Math.random() - 0.5) * tCellH * 0.6;
        const t = new Teammate(cx, cy, GameState.config.teammate);
        SpawnSystem.equipTeammate(t);
        teammates.push(describeUnit(t));
    }

    // 敌人分散在右半：同样的网格分散
    const enemies = [];
    const eCols = Math.ceil(Math.sqrt(cfg.enemyCount));
    const eRows = Math.ceil(cfg.enemyCount / eCols);
    const eCellW = (halfX - 200) / eCols;
    const eCellH = (worldH - 200) / eRows;
    for (let i = 0; i < cfg.enemyCount; i++) {
        const cx = halfX + 100 + (i % eCols + 0.5) * eCellW + (Math.random() - 0.5) * eCellW * 0.6;
        const cy = 100 + (Math.floor(i / eCols) + 0.5) * eCellH + (Math.random() - 0.5) * eCellH * 0.6;
        const enemy = new Enemy(cx, cy, GameState.config.enemy);
        enemy.setWeapons(SpawnSystem.generateRandomWeapons(enemy.rank, enemy.unitClass));
        enemies.push(describeUnit(enemy));
    }

    // 玩家随友军在左侧出生 + 随机主武器
    cfg.teammates = teammates;
    cfg.enemies = enemies;
    cfg.player = {
        x: 100 + Math.random() * (halfX - 300),
        y: 100 + Math.random() * (worldH - 200),
        weaponId: randomGunId(),
    };
}

// ---------- 快速模式：按 quickConfig 快照铺开双方兵力 + 进 playing ----------
// 「新一把」与「重试」共用：都从 quickConfig 的兵力快照实例化（重试不重新随机位置/装备）。
function setupQuickBattle() {
    GameState.mode = 'quick';
    stopMenuMusic();
    applyAudio();

    GameState.reset();
    GameState.capturePoints = [];  // 死斗无据点
    GameState.arsenal = null;      // 死斗无军械库

    const cfg = GameState.quickConfig;

    for (const d of cfg.teammates) {
        GameState.teammates.push(buildUnitFromDesc(d, Teammate, GameState.config.teammate));
    }
    for (const d of cfg.enemies) {
        GameState.enemies.push(buildUnitFromDesc(d, Enemy, GameState.config.enemy));
    }

    // 玩家：还原出生点 + 主武器
    const pd = cfg.player;
    GameState.player = new Player(pd.x, pd.y, GameState.config.player);
    GameState.inventory[0] = new Weapon(pd.weaponId);
    GameState.activeWeaponSlot = 0;

    GameState.camera.zoom = 1;
    GameState.camera.targetZoom = 1;
    GameState.phase = 'playing';
    UIManager.updateAll(GameState);
    console.log(`⚔️ 快速模式开始：敌 ${cfg.enemies.length} / 友 ${cfg.teammates.length}`);
}

// ---------- 快速模式：新一把（重新随机数量 + 新小地图 + 新兵力快照） ----------
function startQuickMatch() {
    GameState.mode = 'quick';
    const enemyCount = QUICK_ENEMY_MIN + Math.floor(Math.random() * (QUICK_ENEMY_MAX - QUICK_ENEMY_MIN + 1));
    const teammateCount = QUICK_TEAMMATE_MIN + Math.floor(Math.random() * (QUICK_TEAMMATE_MAX - QUICK_TEAMMATE_MIN + 1));
    initQuickMap();
    // 快照本局配置（含地图数据），供「重试=同配置」复用
    GameState.quickConfig = { enemyCount, teammateCount, mapData: GameState.map.data };
    generateQuickBattleDescs();  // 随机生成兵力快照（位置/装备），存入 quickConfig
    setupQuickBattle();
}

// ---------- 快速模式：重试（同配置 —— 同地图/同兵力/同位置/同装备重开） ----------
function retryQuickMatch() {
    const cfg = GameState.quickConfig;
    const map = new Map({ cols: QUICK_MAP_COLS, rows: QUICK_MAP_ROWS, tileSize: CONFIG.map.tileSize });
    map.loadData(cfg.mapData);
    GameState.map = map;
    CONFIG.world.width = map.cols * map.tileSize;
    CONFIG.world.height = map.rows * map.tileSize;
    if (Minimap.initialized) Minimap.mapDirty = true;
    setupQuickBattle();  // 复用 quickConfig 里的兵力快照，不重新随机
}

// ---------- 快速模式：结算（冻结世界，弹结算界面） ----------
function triggerQuickResult(result) {
    GameState.quickResult = result;
    GameState.quickResultDelay = 0;
    GameState.quickResultAppearAnim = 0;
    GameState._quickResultAppearLastTime = null;
    console.log(result === 'victory' ? '🏆 快速模式胜利' : '💀 快速模式失败');
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

function initVehicles() {
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
function updateVehicleSpawns() {
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
    const safePoints = player && player.alive
        ? points.filter(p => Math.hypot(p.x - player.x, p.y - player.y) > minSpawnDistance)
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
    // 清死亡弹出动画状态（与 respawnPlayer 同步，防止重置后死亡跳过动画）
    GameState.gameOverDelay = 0;
    GameState.gameOverAppearAnim = 0;
    GameState._gameOverAppearLastTime = null;
    UIManager.updateAll(GameState);
    console.log('🔄 游戏重置完成，重生在据点');
}

// ---------- 游戏循环 ----------
function gameLoop() {
    // FPS计算
    const now = performance.now();
    GameState._fpsFrames++;
    if (now - GameState._fpsLastTime >= 1000) {
        GameState.fps = GameState._fpsFrames;
        GameState._fpsFrames = 0;
        GameState._fpsLastTime = now;
    }

    // ─── 阶段门控（loading / presskey / menu / playing） ───
    // loading / presskey：只渲染对应界面，绝不跑任何世界 update
    // （天气/昼夜/支援等系统虽已 boot init，但此阶段无地图/实体，渲染纯 2D 界面即可）
    if (GameState.phase === 'loading') {
        Renderer.render();
        requestAnimationFrame(gameLoop);
        return;
    }
    if (GameState.phase === 'presskey') {
        Renderer.render();
        requestAnimationFrame(gameLoop);
        return;
    }
    // warming：背景战斗分片预热（每帧跑一批 stepMenuSimulation，跑完进 menu）
    // 界面沿用 presskey 屏（底部显示「正在生成战场…」），把原同步 900 帧循环拆到多帧，消除进菜单卡顿
    if (GameState.phase === 'warming') {
        for (let i = 0; i < MENU_WARMUP_BATCH && menuWarmupRemaining > 0; i++) {
            stepMenuSimulation();
            menuWarmupRemaining--;
        }
        if (menuWarmupRemaining <= 0) {
            // 预热完成 → 进菜单（出现动画从头淡入；摄像机首帧由 updateMenuCamera 定位）
            GameState.mainMenuAnimProgress = 0;
            GameState._mainMenuAnimLastTime = null;
            GameState.phase = 'menu';
        }
        Renderer.render();
        requestAnimationFrame(gameLoop);
        return;
    }
    // menu：背景 AI 战斗独立更新块（不含玩家逻辑）+ 渲染
    // （小地图仅游玩阶段显示，Minimap.render 内部 guard phase!=='playing'，此分支无需调用）
    if (GameState.phase === 'menu') {
        updateMenuBattle();
        Renderer.render();
        requestAnimationFrame(gameLoop);
        return;
    }

    // ─── playing 阶段 ───
    // 暂停/对话冻结：跳过所有世界 update（特效/天气/昼夜/环境音/支援/摄像机/实体/碰撞），
    // 但仍 render —— 暂停菜单/设置面板/对话框动画是渲染函数内自驱 deltaTime，照常推进
    if (GameState.paused || GameState.dialogueOpen) {
        Renderer.render();
        Minimap.render();
        requestAnimationFrame(gameLoop);
        return;
    }

    // 更新特效（粒子、伤害数字等）
    EffectsManager.update();
    // 更新天气系统
    WeatherSystem.update();

    // 更新昼夜循环系统
    DayNightSystem.update();
    // 更新环境音效
    AmbientSoundManager.update();

    // 更新支援系统
    SupportSystem.update();

    // G键长按检测（打开/关闭电台）—— 仅 playing 阶段（menu 阶段输入已被 InputManager 门控，此处显式守卫双保险）
    if (GameState.phase === 'playing' && GameState.radioGKeyPressed && !GameState.radioGKeyConsumed && !GameState.gameOver) {
        GameState.radioGKeyTimer++;
        if (GameState.radioGKeyTimer >= 18) {
            if (GameState.radioOpen) {
                GameState.toggleRadio();
                playRadioClose();
            } else {
                const player = GameState.player;
                if (player && (player.rank + 1) >= 2) {
                    GameState.toggleRadio();
                    playRadioOpen();
                    GameState.radioSelectedIndex = 0;
                    GameState.radioScrollOffset = 0;
                    const cam = GameState.camera;
                    const zoom = cam.zoom || 1;
                    const offsetX = cam.offsetX || 0;
                    const offsetY = cam.offsetY || 0;
                    const canvas = document.getElementById('gameCanvas');
                    const canvasW = canvas ? canvas.clientWidth : 800;
                    const canvasH = canvas ? canvas.clientHeight : 600;
                    const cx = canvasW / 2;
                    const cy = canvasH / 2;
                    GameState.radioTargetWorld = {
                        x: (GameState.mouse.x - cx * (1 - zoom) + offsetX) / zoom + cam.x,
                        y: (GameState.mouse.y - cy * (1 - zoom) + offsetY) / zoom + cam.y
                    };
                } else {
                    // 权限不足：左下角弹出 call_nohave.png 提示
                    // 已在显示则从头弹一遍（progress 归零），避免半路重弹造成的跳变
                    GameState.radioNoPermitActive = true;
                    GameState.radioNoPermitAnimDirection = 'opening';
                    GameState.radioNoPermitAnimProgress = 0;
                    GameState.radioNoPermitShowTimer = 0;
                    GameState._radioNoPermitAnimLastTime = null;
                }
            }
            GameState.radioGKeyConsumed = true;
            GameState.radioGKeyTimer = 0;
        }
    }


    // 敌方AI支援决策（快速模式禁用：死斗不可召唤援军，否则"杀光=赢"无法达成）
    if (!GameState.gameOver && GameState.mode !== 'quick') {
        const aiDecision = SupportSystem.aiShouldCallSupport();
        if (aiDecision) {
            SupportSystem.enemyCallSupport(aiDecision.type, aiDecision.x, aiDecision.y);
        }
    }

    // 更新摄像机（跟随玩家，仅 playing 阶段；menu 阶段的漂移摄像机在 updateMenuBattle 内独立驱动）
    if (GameState.phase === 'playing' && GameState.player && !GameState.gameOver) {
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

        // 平滑归零 camera offset
        GameState.camera.offsetX *= 0.9;
        GameState.camera.offsetY *= 0.9;
    }

    // 更新据点（无论是否阵亡都继续）
    for (const point of GameState.capturePoints) {
        point.update();
    }
    // 据点刷新吉普（上限内、炸毁后自动补刷）
    updateVehicleSpawns();
    // 玩家在存活或死亡动画期间更新
    if (GameState.player && (!GameState.gameOver || GameState.player.dying)) GameState.player.update();
    if (GameState.mode !== 'quick') SpawnSystem.update(); // 快速模式不持续刷敌（死斗：敌人固定，杀光即胜）
    for (const enemy of GameState.enemies) enemy.update();
    for (const teammate of GameState.teammates) teammate.update();
    for (const bullet of GameState.bullets) bullet.update();
    for (const grenade of GameState.grenades) grenade.update();
    for (const pickup of GameState.weaponPickups) pickup.update();
    for (const loot of GameState.lootPickups) loot.update();
    CollisionSystem.checkAll();

    // ---- 过滤死亡实体 ----
    GameState.enemies = GameState.enemies.filter(e => e.alive);
    GameState.bullets = GameState.bullets.filter(b => b.alive);
    GameState.grenades = GameState.grenades.filter(g => g.alive);
    GameState.weaponPickups = GameState.weaponPickups.filter(p => p.alive);
    GameState.lootPickups = GameState.lootPickups.filter(p => p.alive);
    // 过滤死亡的队友（手雷炸死等场景），确保重生时 length 检查正确
    GameState.teammates = GameState.teammates.filter(t => t.alive);

    // ---- 队友重生逻辑 ----
    updateTeammateRespawns();

    // ---- 快速模式胜负判定（死斗：杀光敌人=胜利；玩家死亡=失败；队友全灭不影响） ----
    if (GameState.mode === 'quick' && !GameState.quickResult) {
        if (GameState.player && !GameState.player.alive) {
            triggerQuickResult('defeat');
        } else if (GameState.enemies.length === 0) {
            triggerQuickResult('victory');
        }
    }

    Renderer.render();
    Minimap.render();
    requestAnimationFrame(gameLoop);
}

// ─── 主菜单背景战斗调参 ───
const MENU_CAMERA_ZOOM = 0.7;    // 菜单摄像机缩放（<1 放宽视野，看到更大战场）
const MENU_WARMUP_FRAMES = 480;  // 进菜单预热模拟总帧数（~8s；两军贴脸接火，预热积累血迹/伤亡/战线，呈现「打了一阵」）
const MENU_WARMUP_BATCH = 30;    // warming 阶段每帧跑的预热步数（分片到多帧，480/30≈16 帧≈0.27s，不冻主线程）
const MENU_ENEMY_COUNT = 15;     // 背景战斗红队初始数量（匹配蓝队，打出像样的拉锯）
// 旁观漫游镜头：纯 Lissajous 正弦漫游，中心锚定在战场（setupBackgroundBattle 记录的交火点）。
// 位置是「时间」的纯函数 → 数学上连续可导：绝对平滑（不抖动/不乱动）、速度均匀、永不停留；
// X/Y 频率不可公度 → 轨迹永不重复，看起来像随机漫游。不读任何逐帧游戏状态，杜绝抖动源。
const MENU_CAM_FREQ_X = 0.050;   // X 正弦频率（弧度/秒，周期~126s）——缓慢横扫
const MENU_CAM_FREQ_Y = 0.037;   // Y 正弦频率（弧度/秒，周期~170s，与 X 不可公度→不重复）
const MENU_CAM_PHASE_Y = 1.7;    // Y 初相位（与 X 错开，轨迹不塌成直线）
const MENU_CAM_DRIFT = 0.35;     // 漫游振幅（单位：可视宽度倍数）——极值时交火点恰在屏缘，战场始终大部分在画面内
let menuBattleCenter = null;     // 背景战斗交火中心（setupBackgroundBattle 写入；摄像机漫游锚点）
let menuWarmupRemaining = 0;     // warming 阶段剩余预热帧数（beginMenuWarmup 设置，gameLoop 分帧消费）

// ---------- 菜单背景战斗：世界模拟一步（不含摄像机；预热与每帧共用） ----------
// 关键差异（见计划 P0-2/P0-3）：
//  - 不调 player.update()（dummy 玩家 alive=false，且 Player.update 死亡路径不 guard alive）
//  - 必含 capturePoints[i].update()（驱动 AI 攻防角色，player-null-safe）
//    与 updateTeammateRespawns()（蓝队阵亡后重生，否则战斗会熄火成纯红队）
function stepMenuSimulation() {
    // 环境系统（boot 阶段已 init，此处运行安全）
    EffectsManager.update();
    WeatherSystem.update();
    DayNightSystem.update();
    AmbientSoundManager.update();
    SupportSystem.update();

    // 据点推进（驱动 AI 攻防角色切换）
    for (const point of GameState.capturePoints) {
        point.update();
    }

    // 敌方补员：红队被全歼且已无红方据点（spawnEnemy 会返回 null）时，
    // 在蓝队重心附近补一波，避免背景战斗彻底熄火（用户未要求循环，此为低强度维持）
    if (GameState.enemies.length === 0) {
        const hasEnemyPoint = GameState.capturePoints.some(p => p.owner === 'enemy');
        if (!hasEnemyPoint && GameState.teammates.length > 0) {
            let cx = 0, cy = 0;
            for (const t of GameState.teammates) { cx += t.x; cy += t.y; }
            cx /= GameState.teammates.length;
            cy /= GameState.teammates.length;
            SpawnSystem.spawnCustomWave({ count: 6, x: cx, y: cy, radius: 320 });
        }
    }

    // 实体更新（不含玩家）
    SpawnSystem.update();
    for (const enemy of GameState.enemies) enemy.update();
    for (const teammate of GameState.teammates) teammate.update();
    for (const bullet of GameState.bullets) bullet.update();
    for (const grenade of GameState.grenades) grenade.update();
    for (const pickup of GameState.weaponPickups) pickup.update();
    for (const loot of GameState.lootPickups) loot.update();
    CollisionSystem.checkAll();

    // 过滤死亡实体
    GameState.enemies = GameState.enemies.filter(e => e.alive);
    GameState.bullets = GameState.bullets.filter(b => b.alive);
    GameState.grenades = GameState.grenades.filter(g => g.alive);
    GameState.weaponPickups = GameState.weaponPickups.filter(p => p.alive);
    GameState.lootPickups = GameState.lootPickups.filter(p => p.alive);
    GameState.teammates = GameState.teammates.filter(t => t.alive);

    // 蓝队重生（防熄火）
    updateTeammateRespawns();
}

// ---------- 菜单摄像机：纯 Lissajous 平滑漫游（锚定战场，连续不停、绝不抖动） ----------
// 位置 = 战场中心 + 两组不同频率正弦偏移，是时间的纯函数：平滑、匀速、不停、轨迹永不重复。
// 不追逐任何逐帧变化的目标（旧版追「重心」会因单位阵亡/重生而跳 → 抖动），从根上消除乱动。
// 几何：camera.x/y 是镜头左上角世界坐标 = 镜头中心 - 可视半宽；夹取边距按 zoom<1 推导。
function updateMenuCamera() {
    const world = GameState.config.world;
    const vw = Renderer.width;
    const vh = Renderer.height;
    const zoom = MENU_CAMERA_ZOOM;
    GameState.camera.zoom = zoom;
    GameState.camera.targetZoom = zoom;

    // zoom<1 的安全夹取边距（缩放绕屏幕中心）：保证缩小后边缘不露地图外空白
    const marginLeft = vw * (1 - zoom) / (2 * zoom);
    const marginRight = vw * (1 + zoom) / (2 * zoom);
    const marginTop = vh * (1 - zoom) / (2 * zoom);
    const marginBottom = vh * (1 + zoom) / (2 * zoom);
    const minX = marginLeft, maxX = Math.max(marginLeft, world.width - marginRight);
    const minY = marginTop, maxY = Math.max(marginTop, world.height - marginBottom);

    // 漫游锚点：背景战斗的交火中心（无则回落地图中心）
    const anchorX = menuBattleCenter ? menuBattleCenter.x : world.width / 2;
    const anchorY = menuBattleCenter ? menuBattleCenter.y : world.height / 2;

    // 振幅按可视尺寸自适应（zoom 越小可视越宽，漫游范围随之放大）
    const ampX = (vw / zoom) * MENU_CAM_DRIFT;
    const ampY = (vh / zoom) * MENU_CAM_DRIFT;

    // 纯时间驱动正弦漫游：平滑、匀速、不停、永不重复
    const t = performance.now() / 1000;
    const centerX = anchorX + ampX * Math.sin(t * MENU_CAM_FREQ_X);
    const centerY = anchorY + ampY * Math.sin(t * MENU_CAM_FREQ_Y + MENU_CAM_PHASE_Y);

    // 镜头左上角 = 中心 - 可视半宽，夹取到地图内（安全兜底）
    GameState.camera.x = Math.max(minX, Math.min(maxX, centerX - vw / 2));
    GameState.camera.y = Math.max(minY, Math.min(maxY, centerY - vh / 2));
    GameState.camera.offsetX = 0;
    GameState.camera.offsetY = 0;
}

// ---------- 菜单阶段每帧：模拟一步 + 摄像机漂移 ----------
function updateMenuBattle() {
    stepMenuSimulation();
    updateMenuCamera();
}



// ---------- 启动：系统引导（只跑一次；gameLoop 启动前完成所有系统 init —— P0-1） ----------
function bootSystems() {
    console.log('🚀 引导系统...');
    GameState.config = CONFIG;
    setListenerProvider(() => GameState.player);

    // 显式初始化渲染器
    Renderer.init();
    Renderer.resize();

    InputManager.setup();

    // 注入主菜单/暂停菜单/首次手势的动作回调（避免 main↔handler 循环依赖）
    setMenuActions({ startMatch, startQuickMatch, quitGame });
    setQuickResultActions({ retry: retryQuickMatch, next: startQuickMatch, menu: quitToMenu });
    setQuitToMenu(quitToMenu);
    setFirstGestureHandler(onFirstGesture);

    // ---- 事件监听 ----
    EventBus.on('player_hurt', (data) => {
        UIManager.updateAll(GameState);
    });
    EventBus.on('player_rank_up', (data) => {
        const maxCount = CONFIG.teammate.maxCount;
        // 快速模式（死斗）不补员：兵力开局固定
        if (GameState.mode !== 'quick' && GameState.teammates.length < maxCount) {
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
    window.addEventListener('resize', () => {
        Renderer.resize();
        // PostProcess.resize 已在 Renderer.resize() 内部调用
    });

    // ---- 手雷爆炸监听 ----
    window.addEventListener('grenade_explode', (e) => {
        const { x, y, radius, damage, directHitTarget = null } = e.detail;

        // 爆炸效果
        EffectsManager.spawnGrenadeExplosion(x, y, radius);

        // 破片伤害：对爆炸半径内所有实体造成距离衰减伤害
        const entities = [
            ...GameState.enemies.filter(e => e.alive),
            ...GameState.teammates.filter(t => t.alive),
            ...GameState.vehicles.filter(v => v.alive)
        ];
        if (GameState.player && GameState.player.alive) {
            entities.push(GameState.player);
        }

        for (const entity of entities) {
            if (entity.mountedVehicle) continue;
            // 火箭弹直接命中的载具按爆心完整伤害结算，不受车体半径导致的距离衰减影响。
            const d = entity === directHitTarget ? 0 : Math.hypot(entity.x - x, entity.y - y);
            if (d < radius) {
                // 距离衰减伤害
                const dmg = Math.floor(damage * (1 - d / radius));
                if (dmg > 0) {
                    const isVehicle = GameState.vehicles.includes(entity);
                    const actualDamage = isVehicle
                        ? Math.min(entity.health, dmg)
                        : dmg;
                    const wasAlive = entity.alive;
                    entity.takeDamage(dmg, x, y);
                    EffectsManager.addDamageNumber(
                        entity.x,
                        isVehicle ? entity.y - entity.radius : entity.y,
                        actualDamage,
                        entity === GameState.player
                    );
                    if (isVehicle) {
                        EffectsManager.spawnRicochetEffect(x, y, null, true);
                        EffectsManager.triggerShake(4, 6);
                        continue;
                    }
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

        // 如果玩家被炸死（仅游玩阶段；菜单的假玩家 alive=false，否则第一次爆炸就误判阵亡弹出死亡界面）
        if (GameState.phase === 'playing' && GameState.player && !GameState.player.alive && !GameState.gameOver) {
            GameState.triggerDeath();
            EventBus.emit('game_over');
        }
    });

    // 初始化所有世界系统（必须在 gameLoop 启动前完成：天气/昼夜/支援的 update 在各自 init 前会崩 —— P0-1）
    WeatherSystem.init();
    DayNightSystem.init();
    AmbientSoundManager.init();
    Minimap.init();
    Minimap.canvas.style.display = 'none'; // 初始隐藏，仅游玩阶段由 Minimap.render 显示
    SupportSystem.init();

    // 应用设置（把默认图形/音频参数写入运行系统；音频总线在 SoundManager.initAudio 后已就绪）
    applyGraphics();
    applyAudio();

    // 失焦静音：切后台/最小化时静音全部音频（含菜单音乐），回前台恢复。由 Settings.audio.muteOnBlur 门控（默认开）。
    // 回前台无条件 setFocusMuted(false)：即使设置已关，总闸本就为 1，淡入到 1 是无害空操作。
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (Settings.audio.muteOnBlur) setFocusMuted(true);
        } else {
            setFocusMuted(false);
        }
    });

    // 进入 loading 阶段，启动主循环（此后由 gameLoop 按 phase 门控）
    GameState.phase = 'loading';
    console.log('🎮 系统引导完成，进入加载阶段');
    gameLoop();
}

// ---------- 加载阶段：预加载资源 → 生成背景地图 → presskey ----------
async function runLoading() {
    try {
        // 预加载资源（驱动进度条 + 预热浏览器缓存；单个失败不阻塞整体）
        await preloadAssets(p => { GameState.loadProgress = p; });

        // 生成背景战斗的地图 + 据点（同步耗时，进度条填满后执行）
        initMap();
        initCapturePoints();

        // 加载完毕 → 等待任意键
        GameState.phase = 'presskey';
        console.log('✅ 资源加载完成，等待按键开始');
    } catch (err) {
        // 加载失败：写入 loadError，drawLoadingScreen 显示错误并停止转圈（避免永久卡在加载界面）
        GameState.loadError = err && err.message ? err.message : String(err);
        console.error('❌ 资源加载失败:', err);
    }
}

// ---------- 主菜单音频：静音战斗/环境音，仅保留主总线上的菜单音乐 ----------
// sfx 子总线（枪械/爆炸/载具）置 0、环境音主音量置 0；进入游玩时由 applyAudio() 依据 Settings 恢复。
// 须在 warming 阶段的预热模拟之前调用，否则预热产生的枪声会漏出来。
function enterMenuAudio() {
    muteBattleSfx();
    AmbientSoundManager.setMasterVolume(0);
}

// ---------- 首次手势：presskey → menu（按键顺带解锁浏览器音频锁） ----------
function onFirstGesture() {
    if (GameState.phase !== 'presskey') return;
    enterMenuAudio();                          // 先静音战斗/环境音（预热模拟也在静音下进行）
    setupBackgroundBattle();                   // 搭建两军（不含预热循环）
    startMenuMusic(getMenuMusicArrayBuffer()); // 菜单背景音乐起
    beginMenuWarmup();                         // 分片预热 → warming 阶段（跑完自动进 menu）
    console.log('🎮 进入主菜单');
}

// ---------- 搭建背景 AI 战斗（首次进菜单 与 游戏内退出到主菜单 共用） ----------
function setupBackgroundBattle() {
    GameState.reset(); // 清实体/UI 状态（不重置 map/capturePoints/weather/camera/phase）

    const config = GameState.config;
    const world = config.world;

    // 假玩家：alive=false → CollisionSystem.checkAll 不 bail（非空），但全代码库对其惰性，
    // 敌人索敌/敌方子弹/载具撞击/医疗光环全跳过它，因此菜单里 gameOver 不可达（P1-5）。
    const dummy = new Player(world.width / 2, world.height / 2, config.player);
    dummy.alive = false;
    GameState.player = dummy;

    // 两军贴着「离地图中心最近的据点」分列两侧出生 → 开局即接火。
    // 真实对局蓝队左半/红队右半相隔上万像素，预热帧数不够它们相遇，全程在赶路 → 看着像刚开局。
    // 菜单只需「打了一阵」的观感：选一个居中据点当争夺焦点，两军贴脸出生，预热即打出交火/血迹/伤亡。
    let anchor = null, bestD = Infinity;
    for (const p of GameState.capturePoints) {
        const d = Math.hypot(p.x - world.width / 2, p.y - world.height / 2);
        if (d < bestD) { bestD = d; anchor = p; }
    }
    const ax = anchor ? anchor.x : world.width / 2;
    const ay = anchor ? anchor.y : world.height / 2;
    menuBattleCenter = { x: ax, y: ay }; // 记录交火中心，供菜单摄像机锚定漫游

    // 蓝队（己方）：据点左侧出生，minDist 收小让队形贴紧、确保进感知范围即交火
    const bluePoint = { x: ax - 220, y: ay };
    for (let i = 0; i < GAME_CONSTANTS.INITIAL_TEAMMATES; i++) {
        const t = spawnTeammate(bluePoint, 60);
        if (t) {
            SpawnSystem.equipTeammate(t);
            GameState.teammates.push(t);
        }
    }

    // 红队（敌方）：据点右侧出生。spawnCustomWave 不依赖敌方据点、自带 push，数量匹配蓝队
    SpawnSystem.spawnCustomWave({ count: MENU_ENEMY_COUNT, x: ax + 220, y: ay, radius: 260 });

    // 小地图 canvas 直接挂在 document.body 上（不在 #hud 内），Renderer 隐藏 #hud 不会连带隐藏它；
    // playing→menu 经此函数，须显式隐藏，否则退出到主菜单后小地图残留（Minimap.render 仅 playing 调用）
    Minimap.canvas.style.display = 'none';

    // 预热模拟改由 warming 阶段分片执行（beginMenuWarmup + gameLoop），不在此同步跑，避免冻主线程
}

// ---------- 进入预热阶段：把背景战斗预热分片到多帧（消除进菜单卡顿） ----------
// 仅设置余量 + 切 phase；实际模拟步由 gameLoop 的 warming 分支每帧跑 MENU_WARMUP_BATCH 步，跑完进 menu。
function beginMenuWarmup() {
    menuWarmupRemaining = MENU_WARMUP_FRAMES;
    GameState.phase = 'warming';
}

// ---------- 战地模式：开一把干净的真游戏 ----------
function startMatch() {
    stopMenuMusic(); // 停菜单背景音乐
    applyAudio();    // 恢复战斗/环境音量（菜单里被静音的 sfx/ambient，依据 Settings）

    // 干净新图 + 据点（resetGame 不重置据点，需先重建）
    initMap();
    initCapturePoints();

    resetGame();   // 真玩家 + 双方初始兵力
    initVehicles();

    // 复位摄像机缩放（菜单用 zoom<1 放宽视野，开局恢复默认 1，避免首帧缩放残留）
    GameState.camera.zoom = 1;
    GameState.camera.targetZoom = 1;

    GameState.phase = 'playing';

    // 开局任务简报（世界冻结，逐句推进）—— 与原始 init 行为一致
    DialogueSystem.start(generateBriefing());
    console.log('🎮 战地模式开始');
}

// ---------- 退出游戏（主菜单按钮） ----------
function quitGame() {
    // 浏览器通常拦截非脚本打开的标签页关闭；兜底提示手动关闭
    window.close();
    setTimeout(() => { alert('请手动关闭此标签页'); }, 100);
}

// ---------- 游戏内暂停菜单「退出到主菜单」 ----------
function quitToMenu() {
    // 停掉所有载具引擎音（engine voice 以 vehicle 引用为 key，reset() 只清数组不停音，
    // 否则 mounted 状态下退出会让引擎声在菜单里无限循环）—— 须在 reset 清空 vehicles 前执行
    for (const v of GameState.vehicles) stopVehicleEngine(v);

    // 来自快速模式：当前是小地图且无据点，菜单背景战斗需要标准大地图+据点，退出时重建
    if (GameState.mode === 'quick') {
        initMap();
        initCapturePoints();
    }
    GameState.mode = 'battle';

    // setupBackgroundBattle 内的 reset() 已清 paused/settingsOpen/dialogueOpen，
    // 避免冻结门把菜单背景战斗冻住（P1-7）
    enterMenuAudio();                          // 静音战斗/环境音（预热模拟也在静音下进行）
    setupBackgroundBattle();
    startMenuMusic(getMenuMusicArrayBuffer());
    beginMenuWarmup();                         // 分片预热 → warming 阶段（跑完自动进 menu）
    console.log('🚪 退出到主菜单');
}

// ---------- 队友重生逻辑 ----------
function updateTeammateRespawns() {
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

// ---------- 重生逻辑 ----------
// 启动游戏：引导系统 → 进入加载流程（唯一启动入口）
bootSystems();
runLoading();

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

    // 保留当前军衔（阵亡不降级）
    const savedRank = GameState.player ? GameState.player.rank : 0;

    // 自杀死亡：保留防弹衣状态（与武器不掉落规则一致）
    const savedArmor = (GameState.suicideDeath && GameState.player) ? {
        armorDurability: GameState.player.armorDurability,
        armorMaxDurability: GameState.player.armorMaxDurability,
        armorHelmetImg: GameState.player.armorHelmetImg,
        armorHelmetImgLoaded: GameState.player.armorHelmetImgLoaded,
        armorHelmetRotation: GameState.player.armorHelmetRotation,
    } : null;

    // 重置自杀标记（必须在读取 suicideDeath 之后）
    GameState.suicideDeath = false;

    // 重置玩家状态（位置、血量等）
    GameState.player = new Player(spawnX, spawnY, config.player);
    GameState.player.rank = savedRank;
    // 恢复防弹衣状态（自杀死亡时）
    if (savedArmor) {
        Object.assign(GameState.player, savedArmor);
        console.log(`🛡️ 自杀保留防弹衣：耐久 ${savedArmor.armorDurability}/${savedArmor.armorMaxDurability}`);
    }
    GameState.gameOver = false;
    GameState.respawnSelection = false;
    // 清死亡弹出动画状态（否则下次死亡瞬间跳过动画直接弹出）
    GameState.gameOverDelay = 0;
    GameState.gameOverAppearAnim = 0;
    GameState._gameOverAppearLastTime = null;
    // 清据点焦点滑动（否则下次死亡焦点从上一次落点起跳，第一帧跳变）
    GameState.gameOverSelectedPoint = -1;
    GameState.respawnHitAreas = [];
    GameState.gameOverFocusX = null; GameState.gameOverFocusY = null;
    GameState.gameOverFocusFromX = null; GameState.gameOverFocusFromY = null;
    GameState.gameOverFocusIndex = -1; GameState.gameOverFocusAnim = 0;
    GameState._gameOverFocusLastTime = null;
    UIManager.updateAll(GameState);
}

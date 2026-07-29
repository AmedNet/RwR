// src/modes/QuickMode.js
// 快速模式（死斗）：小地图、随机主武器、固定兵力快照、杀光敌人即胜 / 玩家阵亡即负。
// 从 main.js 抽出。「新一把」随机生成兵力快照存入 quickConfig；「重试」复用快照不重新随机。
import { GameState } from '../core/GameState.js';
import { Map } from '../core/Map.js';
import { Player } from '../entities/Player.js';
import { Teammate } from '../entities/Teammate.js';
import { Enemy } from '../entities/Enemy.js';
import { Weapon } from '../core/Weapon.js';
import { WeaponRegistry, WeaponType } from '../core/WeaponRegistry.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { MapGenerator } from '../utils/MapGenerator.js';
import { UIManager } from '../rendering/UIManager.js';
import { CONFIG } from '../data/GameConfig.js';
import { Minimap } from '../rendering/Minimap.js';
import { stopMenuMusic } from '../utils/SoundManager.js';
import { applyAudio } from '../data/Settings.js';

// ---------- 快速模式（死斗）调参 ----------
const QUICK_MAP_COLS = 120;      // 快速模式小地图列数（战地 360 的 1/3）
const QUICK_MAP_ROWS = 100;      // 快速模式小地图行数（战地 300 的 1/3）
const QUICK_ENEMY_MIN = 25;      // 敌方数量下限（约 30±5）
const QUICK_ENEMY_MAX = 35;      // 敌方数量上限
const QUICK_TEAMMATE_MIN = 5;    // 友军数量下限（约 10±5）
const QUICK_TEAMMATE_MAX = 15;   // 友军数量上限

// ---------- 小地图（无据点/军械库，不读 localStorage） ----------
function initQuickMap() {
    const map = new Map({ cols: QUICK_MAP_COLS, rows: QUICK_MAP_ROWS, tileSize: CONFIG.map.tileSize });
    MapGenerator.generateRandomMap(map);
    GameState.map = map;
    GameState.world.width = map.cols * map.tileSize;
    GameState.world.height = map.rows * map.tileSize;
    if (Minimap.initialized) Minimap.mapDirty = true;
    console.log(`🗺️ 快速模式小地图生成 (${QUICK_MAP_COLS}×${QUICK_MAP_ROWS})`);
}

// ---------- 随机主武器 id（仅枪械类） ----------
function randomGunId() {
    const gunTypes = [WeaponType.RIFLE, WeaponType.SMG, WeaponType.SHOTGUN, WeaponType.SNIPER];
    const guns = Object.keys(WeaponRegistry).filter(id => gunTypes.includes(WeaponRegistry[id].type));
    return guns[Math.floor(Math.random() * guns.length)];
}

// ---------- 序列化/还原 AI 单位（供「重试=同配置」精确复现位置+装备） ----------
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

// ---------- 生成本局兵力快照（位置/军衔/兵种/装备），写入 quickConfig ----------
// 只在「新一把」调用一次；「重试」直接复用 quickConfig 里的快照，不再随机。
function generateQuickBattleDescs() {
    const cfg = GameState.quickConfig;
    const world = GameState.world;
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

// ---------- 按 quickConfig 快照铺开双方兵力 + 进 playing ----------
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

// ---------- 新一把（重新随机数量 + 新小地图 + 新兵力快照） ----------
export function startQuickMatch() {
    GameState.mode = 'quick';
    const enemyCount = QUICK_ENEMY_MIN + Math.floor(Math.random() * (QUICK_ENEMY_MAX - QUICK_ENEMY_MIN + 1));
    const teammateCount = QUICK_TEAMMATE_MIN + Math.floor(Math.random() * (QUICK_TEAMMATE_MAX - QUICK_TEAMMATE_MIN + 1));
    initQuickMap();
    // 快照本局配置（含地图数据），供「重试=同配置」复用
    GameState.quickConfig = { enemyCount, teammateCount, mapData: GameState.map.data };
    generateQuickBattleDescs();  // 随机生成兵力快照（位置/装备），存入 quickConfig
    setupQuickBattle();
}

// ---------- 重试（同配置 —— 同地图/同兵力/同位置/同装备重开） ----------
export function retryQuickMatch() {
    const cfg = GameState.quickConfig;
    const map = new Map({ cols: QUICK_MAP_COLS, rows: QUICK_MAP_ROWS, tileSize: CONFIG.map.tileSize });
    map.loadData(cfg.mapData);
    GameState.map = map;
    GameState.world.width = map.cols * map.tileSize;
    GameState.world.height = map.rows * map.tileSize;
    if (Minimap.initialized) Minimap.mapDirty = true;
    setupQuickBattle();  // 复用 quickConfig 里的兵力快照，不重新随机
}

// ---------- 结算（冻结世界，弹结算界面） ----------
export function triggerQuickResult(result) {
    GameState.quickResult = result;
    GameState.appear.quickResult.delay = 0;
    GameState.appear.quickResult.progress = 0;
    GameState.appear.quickResult._lastTime = null;
    console.log(result === 'victory' ? '🏆 快速模式胜利' : '💀 快速模式失败');
}

// ---------- 胜负判定（死斗：杀光敌人=胜利；玩家死亡=失败；队友全灭不影响） ----------
// 由 gameLoop 每帧调用；非快速模式或已结算则直接返回。
export function checkQuickWinLoss() {
    if (GameState.mode !== 'quick' || GameState.quickResult) return;
    if (GameState.player && !GameState.player.alive) {
        triggerQuickResult('defeat');
    } else if (GameState.enemies.length === 0) {
        triggerQuickResult('victory');
    }
}

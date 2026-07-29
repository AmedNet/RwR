// src/core/GameState.js
import { Weapon } from './Weapon.js';
import { makePanelAnim, makeFocusAnim, makeAppearAnim, togglePanel } from './AnimState.js';
import { CONFIG } from '../data/GameConfig.js';

// ─── 动画状态定义（init 与 reset 共用同一组 factory，消灭逐字段清零） ───
// 新增面板：在 PANEL_DEFS 加一行 → init/reset 自动覆盖，无需改 reset()
const PANEL_DEFS = {
    inventory:     () => makePanelAnim(),
    arsenal:       () => makePanelAnim(),
    radio:         () => makePanelAnim(),
    pause:         () => makePanelAnim(),
    settings:      () => makePanelAnim(),
    dialogue:      () => makePanelAnim(),
    radioNoPermit: () => makePanelAnim({ showTimer: 0 }),
    menuPreview:   () => makePanelAnim({ id: null }),
};
const FOCUS_KEYS  = ['inventory', 'arsenalItem', 'arsenalCat', 'arsenalSlot', 'radioItem', 'settingsTab', 'gameOver'];
const APPEAR_KEYS = ['gameOver', 'quickResult', 'battleReport', 'mainMenu'];

const freshPanels = () => Object.fromEntries(Object.entries(PANEL_DEFS).map(([k, f]) => [k, f()]));
const freshFocus  = () => Object.fromEntries(FOCUS_KEYS.map(k => [k, makeFocusAnim()]));
const freshAppear = () => Object.fromEntries(APPEAR_KEYS.map(k => [k, makeAppearAnim()]));

export const GameState = {
    // ─── 世界实体 ───
    player: null,
    enemies: [],
    teammates: [],
    bullets: [],
    grenades: [],
    capturePoints: [],
    weaponPickups: [],
    lootPickups: [],
    vehicles: [],
    maxVehicles: 4,
    vehicleSpawnTimer: 0,
    arsenal: null,

    // ─── 背包 / 经济 ───
    inventory: [null, null, null, null, null, null, null],
    rp: 0,

    // ─── 世界 / 地图 ───
    map: null,
    // 世界尺寸（像素）—— 单一数据源：initMap/initQuickMap 写入，全代码库读 GameState.world。
    // 初始值按 CONFIG.map 推导（地图生成前的默认尺寸），地图初始化后更新为实际尺寸。
    world: { width: CONFIG.map.cols * CONFIG.map.tileSize, height: CONFIG.map.rows * CONFIG.map.tileSize },
    weather: 'sunny',

    // ─── 输入 ───
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0, down: false, rightDown: false },

    // ─── 计分 / 流程 ───
    kills: 0,
    score: 0,
    gameOver: false,
    spawnTimer: 0,
    suicideDeath: false,

    // ─── 摄像机 / 视口 ───
    camera: { x: 0, y: 0, zoom: 1, targetZoom: 1, offsetX: 0, offsetY: 0, targetOffsetX: 0, targetOffsetY: 0 },
    viewport: { width: 0, height: 0 },
    scopeState: { isScoped: false, idleTimer: 0, lastMovingFrame: 0 },

    config: null,

    // ─── 阶段状态机：loading → presskey → warming → menu → playing ───
    phase: 'loading',
    loadProgress: 0,
    loadError: null,

    // ─── 重生 ───
    isEditing: false,
    respawnSelection: false,
    selectedSpawnPoint: null,
    teammateRespawnQueue: [],

    // ─── 武器选择 ───
    activeWeaponSlot: 0,

    // ─── UI 交互状态（非动画：选中索引 / 热区 / 滚动 / 拖拽） ───
    inventorySelectedSlot: -1,
    inventoryHitAreas: [],
    inventoryExpandAnimStart: null,   // 扩容弹入动画时刻（特殊一次性动画，不走 factory）
    inventoryExpandFromIndex: -1,
    arsenalSelectedSlot: 0,
    arsenalSelectedIndex: 0,
    arsenalCategory: 0,
    arsenalScrollOffset: 0,
    radioSelectedIndex: 0,
    radioScrollOffset: 0,
    radioTargetWorld: null,
    radioGKeyTimer: 0,
    radioGKeyPressed: false,
    radioGKeyConsumed: false,
    settingsTab: 0,
    pauseHitAreas: [],
    settingsHitAreas: [],
    settingsSliderDragging: null,
    settingsSliderDragArea: null,
    keybindCapturing: null,
    dialogueHitAreas: [],
    mainMenuHitAreas: [],
    gameOverSelectedPoint: -1,
    respawnHitAreas: [],
    quickResultHitAreas: [],

    // ─── Debug ───
    debugOpen: false,
    debugTab: 0,
    debugKey9Pressed: false,
    debugShowTornado: false,
    debugShowFPS: false,
    fps: 0,
    _fpsFrames: 0,
    _fpsLastTime: 0,

    // ─── 模式 / 结算 ───
    mode: 'battle',
    quickResult: null,
    quickConfig: null,
    battleReport: null,
    battleReportShown: false,
    matchFrames: 0,

    // ─── 动画状态（factory 产出，reset 时整体重建） ───
    // panels: 面板开/关（倒带式）  → GameState.panels.radio.open / .progress / .direction / ._lastTime
    // focus:  选中项焦点滑动       → GameState.focus.inventory.x / .y / .fromX / .fromY / .index / .anim
    // appear: 延迟+弹出动画        → GameState.appear.gameOver.delay / .progress / ._lastTime
    panels: freshPanels(),
    focus: freshFocus(),
    appear: freshAppear(),

    // ─── 方法 ───

    getActiveWeapon() {
        return this.inventory[this.activeWeaponSlot];
    },

    switchWeapon(slot) {
        if (slot < 0 || slot >= this.inventory.length) return false;
        if (this.activeWeaponSlot === slot) return false;
        this.activeWeaponSlot = slot;
        return true;
    },

    // 面板切换：统一委托 togglePanel（支持中途反向打断）
    toggleInventory() { togglePanel(this.panels.inventory); },
    toggleArsenal()   { togglePanel(this.panels.arsenal); },
    toggleRadio()     { togglePanel(this.panels.radio); },
    togglePause()     { togglePanel(this.panels.pause); },
    toggleSettings()  { togglePanel(this.panels.settings); },

    // 触发死亡：重建相关动画状态，防止跨死亡周期残留
    triggerDeath() {
        this.gameOver = true;
        this.appear.gameOver = makeAppearAnim();
        this.gameOverSelectedPoint = -1;
        this.respawnHitAreas = [];
        this.focus.gameOver = makeFocusAnim();
        // 无权限提示一并清零，防止死亡→复活后凭空冒出 call_nohave.png
        this.panels.radioNoPermit = PANEL_DEFS.radioNoPermit();
    },

    reset() {
        // 实体
        this.enemies = [];
        this.teammates = [];
        this.bullets = [];
        this.grenades = [];
        this.weaponPickups = [];
        this.lootPickups = [];
        this.vehicles = [];
        this.vehicleSpawnTimer = 0;
        // 据点不重置：由 initCapturePoints 一次性生成
        // 计分
        this.kills = 0;
        this.score = 0;
        this.gameOver = false;
        this.spawnTimer = 0;
        // 背包
        this.inventory = [new Weapon('beretta92'), null, null, null, null, null, null];
        this.activeWeaponSlot = 0;
        this.rp = 0;
        // UI 交互状态
        this.inventorySelectedSlot = -1;
        this.inventoryHitAreas = [];
        this.inventoryExpandAnimStart = null;
        this.inventoryExpandFromIndex = -1;
        this.arsenalSelectedSlot = 0;
        this.arsenalSelectedIndex = 0;
        // arsenalCategory / arsenalScrollOffset 不重置（保留上次选择）
        this.radioSelectedIndex = 0;
        this.radioScrollOffset = 0;
        this.radioTargetWorld = null;
        this.radioGKeyTimer = 0;
        this.radioGKeyPressed = false;
        this.radioGKeyConsumed = false;
        this.settingsTab = 0;
        this.pauseHitAreas = [];
        this.settingsHitAreas = [];
        this.settingsSliderDragging = null;
        this.settingsSliderDragArea = null;
        this.keybindCapturing = null;
        this.dialogueHitAreas = [];
        this.gameOverSelectedPoint = -1;
        this.respawnHitAreas = [];
        this.quickResultHitAreas = [];
        // 模式 / 结算（mode/quickConfig 不在此重置：mode 由启动函数控制，quickConfig 供重试复用）
        this.quickResult = null;
        this.battleReport = null;
        this.battleReportShown = false;
        this.matchFrames = 0;
        // Debug
        this.debugTab = 0;
        // 动画状态：整体重建
        this.panels = freshPanels();
        this.focus = freshFocus();
        this.appear = freshAppear();
        // 主菜单：命中区清空；appear.mainMenu（菜单淡入动画）已由上方 freshAppear() 一并重建。
        // phase / loadProgress 不在此重置（由启动/加载流程控制）。
        this.mainMenuHitAreas = [];
    }
};

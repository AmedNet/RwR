// src/core/GameState.js
import { Weapon } from './Weapon.js';

export const GameState = {
    player: null,
    enemies: [],
    teammates: [],
    bullets: [],
    grenades: [],
    capturePoints: [],
    weaponPickups: [], // 地面掉落的武器
    lootPickups: [],   // 地面掉落的战利品
    arsenal: null, // 军械库实例
    arsenalOpen: false, // 军械库界面是否打开
    inventory: [null, null, null, null, null, null, null], // 背包，7个位置，存储 Weapon 实例或 null
    inventoryOpen: false, // 背包是否打开
    rp: 0, // RP值（金钱）
    map: null,
    weather: 'sunny', // 当前天气类型
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0, down: false },
    kills: 0,
    score: 0,
    gameOver: false,
    spawnTimer: 0,
    camera: { x: 0, y: 0, zoom: 1, targetZoom: 1, offsetX: 0, offsetY: 0, targetOffsetX: 0, targetOffsetY: 0 },
    // 视口尺寸（由 Renderer.resize 同步）
    viewport: { width: 0, height: 0 },
    // 倍镜状态
    scopeState: {
        isScoped: false,      // 是否正在开镜
        idleTimer: 0,         // 静止计时器
        lastMovingFrame: 0    // 上一帧是否在移动
    },
    config: null,
    isEditing: false,
    respawnSelection: false, // 是否在选择复活据点
    selectedSpawnPoint: null, // 数字选择时临时存储
    permanentDefeat: false, // 是否永久战败（无据点可复活）
    teammateRespawnQueue: [], // 等待重生的队友 { x, y, timer }
    // 武器系统
    activeWeaponSlot: 0, // 当前装备的背包位置 (0-6)
    inventorySelectedSlot: -1, // 背包界面中选中的格子索引（-1=未选中）
    inventoryHitAreas: [], // 背包格子点击热区 [{x,y,w,h,index}]
    arsenalSelectedSlot: 0, // 军械库中选中的背包位置
    arsenalSelectedIndex: 0, // 军械库中选中的商品索引
    arsenalCategory: 0,      // 军械库当前分类索引 (0=重武器, 1=轻武器, 2=其他, 3=副武器)

    // 军械库滚动
    arsenalScrollOffset: 0, // 军械库列表滚动偏移量

    // 死亡标记
    suicideDeath: false, // 标记本次死亡是否为自杀（自杀保留物品）

    // Debug系统
    debugOpen: false, // Debug面板是否打开
    debugTab: 0, // Debug面板当前标签页 (0=玩家, 1=天气, 2=昼夜, 3=战利品, 4=音效)
    debugKey9Pressed: false, // 追踪9键状态（用于组合键）
    debugShowTornado: false, // 小地图上显示龙卷风位置
    debugShowFPS: false, // 显示实时帧率
    fps: 0, // 当前帧率
    _fpsFrames: 0, // FPS计算用帧计数器
    _fpsLastTime: 0, // FPS计算用上次时间戳
    // 电台系统
    radioOpen: false, // 电台界面是否打开
    radioSelectedIndex: 0, // 电台选中的支援类型索引
    radioScrollOffset: 0, // 电台列表滚动偏移
    radioTargetWorld: null, // 电台标记的世界坐标 {x, y}
    radioGKeyTimer: 0, // G键按下计时器（用于长按检测）
    radioGKeyPressed: false, // G键是否按下
    radioGKeyConsumed: false, // 本次物理按住是否已触发过（防autorepeat闪烁）
    radioAnimProgress: 0, // 电台动画进度 0~1
    radioAnimating: false, // 是否正在播放动画
    radioClosing: false, // 是否正在关闭动画
    gameOverSelectedPoint: -1, // 死亡界面当前悬浮的据点索引
    respawnHitAreas: [], // 死亡界面据点点击热区 [{x, y, r, index}]

    // 获取当前装备的武器
    getActiveWeapon() {
        return this.inventory[this.activeWeaponSlot];
    },

    // 切换武器
    switchWeapon(slot) {
        if (slot < 0 || slot > 6) return false;
        if (this.activeWeaponSlot === slot) return false;
        this.activeWeaponSlot = slot;
        return true;
    },

    reset() {
        this.enemies = [];
        this.teammates = [];
        this.bullets = [];
        this.weaponPickups = [];
        this.lootPickups = [];
        // 据点不重置，它们是地图的一部分，由 initCapturePoints 一次性生成
        this.kills = 0;
        this.score = 0;
        this.gameOver = false;
        this.spawnTimer = 0;
        // 初始化：背包第1格放 Beretta 92
        this.inventory = [new Weapon('beretta92'), null, null, null, null, null, null];
        this.activeWeaponSlot = 0;
this.inventorySelectedSlot = -1;
this.inventoryHitAreas = [];
        this.arsenalSelectedSlot = 0;
        this.arsenalSelectedIndex = 0;
        this.inventoryOpen = false;
        this.arsenalOpen = false;
        this.rp = 0;
        this.gameOverSelectedPoint = -1;
        this.respawnHitAreas = [];
        this.radioOpen = false;
        this.radioSelectedIndex = 0;
        this.radioScrollOffset = 0;
        this.radioTargetWorld = null;
        this.radioGKeyTimer = 0;
        this.radioGKeyPressed = false;
        this.radioGKeyConsumed = false;
        this.radioAnimProgress = 0;
        this.radioAnimating = false;
        this.radioClosing = false;
        this.debugTab = 0;
    }
};

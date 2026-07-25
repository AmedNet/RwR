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
    vehicles: [],     // 载具
    maxVehicles: 4,   // 战场上同时存在的吉普上限
    vehicleSpawnTimer: 0, // 吉普据点刷新计时器（帧）
    arsenal: null, // 军械库实例
    arsenalOpen: false, // 军械库界面是否打开
    arsenalAnimProgress: 0, // 军械库动画进度 0-1（打开/关闭共用）
    arsenalAnimDirection: null, // 'opening' | 'closing' | null
    _arsenalAnimLastTime: null, // 动画计时基准（performance.now）
    inventory: [null, null, null, null, null, null, null], // 背包，7个位置，存储 Weapon 实例或 null
    inventoryOpen: false, // 背包是否打开
    inventoryAnimProgress: 0, // 背包动画进度 0-1
    inventoryAnimDirection: null, // 'opening' | 'closing' | null
    // 物品栏扩容弹入动画（购买防弹衣扩容时触发，军械库底部新格子逐格弹出）
    inventoryExpandAnimStart: null, // 扩容时刻 performance.now()，null=无动画
    inventoryExpandFromIndex: -1,   // 新格子起始索引（扩容前的 length），-1=无
    rp: 0, // RP值（金钱）
    map: null,
    weather: 'sunny', // 当前天气类型
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0, down: false, rightDown: false },
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
    teammateRespawnQueue: [], // 等待重生的队友 { x, y, timer }
    // 武器系统
    activeWeaponSlot: 0, // 当前装备的背包位置 (0-6)
    inventorySelectedSlot: -1, // 背包界面中选中的格子索引（-1=未选中）
    inventoryHitAreas: [], // 背包格子点击热区 [{x,y,w,h,index}]
    // 选中槽位焦点滑动动画（渲染端自治：检测 inventorySelectedSlot 变化驱动）
    inventoryFocusX: null, // 焦点框当前显示位置（格子中心 x），null=未初始化
    inventoryFocusY: null,
    inventoryFocusSlot: -1, // 焦点当前归属的选中索引（用于检测变化）
    inventoryFocusFromX: null, // 本次滑动起点 x（切换瞬间记录）
    inventoryFocusFromY: null,
    inventoryFocusAnim: 0, // 本次滑动进度 0→1（easeOutCubic 前）
    arsenalSelectedSlot: 0, // 军械库中选中的背包位置
    arsenalSelectedIndex: 0, // 军械库中选中的商品索引
    arsenalCategory: 0,      // 军械库当前分类索引 (0=重武器, 1=轻武器, 2=其他, 3=副武器)

    // 军械库滚动
    arsenalScrollOffset: 0, // 军械库列表滚动偏移量

    // 军械库商品列表选中项焦点滑动（W/S 切选商品时高亮从旧项滑到新项）
    arsenalItemFocusY: null,       // 当前选中高亮显示 y（含滚动偏移后的列表内 y）
    arsenalItemFocusFromY: null,  // 本次滑动起点 y
    arsenalItemFocusIndex: -1,    // 焦点当前归属的商品索引（检测变化用）
    arsenalItemFocusAnim: 0,      // 滑动进度 0→1

    // 军械库分类高亮条焦点滑动（侧边栏分类项之间竖向滑动，镜像背包焦点）
    arsenalCatFocusY: null,      // 当前高亮条显示 y
    arsenalCatFocusFromY: null,  // 本次滑动起点 y
    arsenalCatFocusIndex: -1,    // 焦点当前归属的分类索引（检测变化用）
    arsenalCatFocusAnim: 0,      // 滑动进度 0→1
    // 军械库背包槽焦点滑动框（1-7 选中槽之间横向滑动）
    arsenalSlotFocusX: null,
    arsenalSlotFocusY: null,
    arsenalSlotFocusFromX: null,
    arsenalSlotFocusFromY: null,
    arsenalSlotFocusIndex: -1,
    arsenalSlotFocusAnim: 0,

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
    radioAnimProgress: 0, // 电台动画进度 0~1（开/关共用，倒带式）
    radioAnimDirection: null, // 'opening' | 'closing' | null（支持中途反向打断）
    _radioAnimLastTime: null, // 动画计时基准（performance.now）

    // 无权限打开电台提示（RP/军衔不足时试图开电台，左下角弹 call_nohave.png，几秒后自动收回）
    radioNoPermitActive: false, // 是否正在显示提示
    radioNoPermitAnimProgress: 0, // 0~1 进度（弹入/弹出共用）
    radioNoPermitAnimDirection: null, // 'opening' | 'closing' | null
    radioNoPermitShowTimer: 0, // 完全弹出后已显示的帧数
    _radioNoPermitAnimLastTime: null, // 动画计时基准（performance.now）

    // 电台选中项焦点滑动（↑/↓ 切选时蓝高亮从旧项滑到新项，easeOutBack 末端轻过冲）
    radioItemFocusY: null,       // 当前选中高亮显示 y
    radioItemFocusFromY: null,   // 本次滑动起点 y
    radioItemFocusIndex: -1,     // 焦点当前归属的支援项索引（检测变化用）
    radioItemFocusAnim: 0,       // 滑动进度 0→1
    _radioFocusLastTime: null,   // 焦点滑动 deltaTime 计时基准（performance.now）
    gameOverSelectedPoint: -1, // 死亡界面当前悬浮的据点索引
    respawnHitAreas: [], // 死亡界面据点点击热区 [{x, y, r, index}]
    // 死亡界面据点焦点滑动（鼠标悬浮/数字键切选时高亮从旧据点滑到新据点，easeOutBack 末端轻过冲）
    gameOverFocusX: null,
    gameOverFocusY: null,
    gameOverFocusFromX: null,
    gameOverFocusFromY: null,
    gameOverFocusIndex: -1,
    gameOverFocusAnim: 0,
    _gameOverFocusLastTime: null, // 焦点滑动 deltaTime 计时基准（performance.now）
    // 死亡界面弹出动画（死亡后延迟 1s 只渲染战场，再 easeOutCubic 弹出毛玻璃背板+卡片）
    gameOverDelay: 0,                 // 死亡后已延迟秒数（0→1 期间只渲染战场、渐黑）
    gameOverAppearAnim: 0,            // 弹出动画进度 0→1
    _gameOverAppearLastTime: null,    // 弹出动画 deltaTime 计时基准（performance.now）

    // 获取当前装备的武器
    getActiveWeapon() {
        return this.inventory[this.activeWeaponSlot];
    },

    // 切换武器
    switchWeapon(slot) {
        if (slot < 0 || slot >= this.inventory.length) return false;
        if (this.activeWeaponSlot === slot) return false;
        this.activeWeaponSlot = slot;
        return true;
    },

    // 切换背包开/关（支持中途可反向打断：progress 不归零，从半路反向继续播）
    toggleInventory() {
        const dir = this.inventoryAnimDirection;
        if (dir === 'closing') {
            this.inventoryAnimDirection = 'opening';
        } else if (dir === 'opening') {
            this.inventoryAnimDirection = 'closing';
        } else if (this.inventoryOpen) {
            this.inventoryAnimDirection = 'closing';
        } else {
            this.inventoryOpen = true;
            this.inventoryAnimProgress = 0;
            this.inventoryAnimDirection = 'opening';
        }
        this._inventoryAnimLastTime = null;
    },

    // 切换军械库开/关（支持中途可反向打断：progress 不归零）
    toggleArsenal() {
        const dir = this.arsenalAnimDirection;
        if (dir === 'closing') {
            this.arsenalAnimDirection = 'opening';
        } else if (dir === 'opening') {
            this.arsenalAnimDirection = 'closing';
        } else if (this.arsenalOpen) {
            this.arsenalAnimDirection = 'closing';
        } else {
            this.arsenalOpen = true;
            this.arsenalAnimProgress = 0;
            this.arsenalAnimDirection = 'opening';
        }
        this._arsenalAnimLastTime = null;
    },

    // 切换电台开/关（支持中途可反向打断：progress 不归零从半路反向）
    toggleRadio() {
        const dir = this.radioAnimDirection;
        if (dir === 'closing') {
            this.radioAnimDirection = 'opening';
        } else if (dir === 'opening') {
            this.radioAnimDirection = 'closing';
        } else if (this.radioOpen) {
            this.radioAnimDirection = 'closing';
        } else {
            this.radioOpen = true;
            this.radioAnimProgress = 0;
            this.radioAnimDirection = 'opening';
        }
        this._radioAnimLastTime = null;
    },

    // 触发死亡：统一清零弹出动画与焦点滑动状态，防止跨死亡周期残留
    triggerDeath() {
        this.gameOver = true;
        this.gameOverDelay = 0;
        this.gameOverAppearAnim = 0;
        this._gameOverAppearLastTime = null;
        this.gameOverSelectedPoint = -1;
        this.respawnHitAreas = [];
        this.gameOverFocusX = null; this.gameOverFocusY = null;
        this.gameOverFocusFromX = null; this.gameOverFocusFromY = null;
        this.gameOverFocusIndex = -1; this.gameOverFocusAnim = 0;
        this._gameOverFocusLastTime = null;
        // 无权限提示也一并清零，防止死亡→复活后凭空冒出 call_nohave.png
        this.radioNoPermitActive = false;
        this.radioNoPermitAnimProgress = 0;
        this.radioNoPermitAnimDirection = null;
        this.radioNoPermitShowTimer = 0;
        this._radioNoPermitAnimLastTime = null;
    },

    reset() {
        this.enemies = [];
        this.teammates = [];
        this.bullets = [];
        this.weaponPickups = [];
        this.lootPickups = [];
        this.vehicles = [];
        this.vehicleSpawnTimer = 0;
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
        this.inventoryFocusX = null;
        this.inventoryFocusY = null;
        this.inventoryFocusSlot = -1;
        this.inventoryFocusFromX = null;
        this.inventoryFocusFromY = null;
        this.inventoryFocusAnim = 0;
        this.arsenalSelectedSlot = 0;
        this.arsenalSelectedIndex = 0;
        this.inventoryOpen = false;
        this.inventoryAnimProgress = 0;
        this.inventoryAnimDirection = null;
        this._inventoryAnimLastTime = null;
        this.inventoryExpandAnimStart = null;
        this.inventoryExpandFromIndex = -1;
        this.arsenalOpen = false;
        this.arsenalAnimProgress = 0;
        this.arsenalAnimDirection = null;
        this._arsenalAnimLastTime = null;
        this.arsenalItemFocusY = null;
        this.arsenalItemFocusFromY = null;
        this.arsenalItemFocusIndex = -1;
        this.arsenalItemFocusAnim = 0;
        this.arsenalCatFocusY = null;
        this.arsenalCatFocusFromY = null;
        this.arsenalCatFocusIndex = -1;
        this.arsenalCatFocusAnim = 0;
        this.arsenalSlotFocusX = null;
        this.arsenalSlotFocusY = null;
        this.arsenalSlotFocusFromX = null;
        this.arsenalSlotFocusFromY = null;
        this.arsenalSlotFocusIndex = -1;
        this.arsenalSlotFocusAnim = 0;
        this.rp = 0;
        this.gameOverSelectedPoint = -1;
        this.respawnHitAreas = [];
        this.gameOverFocusX = null;
        this.gameOverFocusY = null;
        this.gameOverFocusFromX = null;
        this.gameOverFocusFromY = null;
        this.gameOverFocusIndex = -1;
        this.gameOverFocusAnim = 0;
        this._gameOverFocusLastTime = null;
        this.gameOverDelay = 0;
        this.gameOverAppearAnim = 0;
        this._gameOverAppearLastTime = null;
        this.radioOpen = false;
        this.radioSelectedIndex = 0;
        this.radioScrollOffset = 0;
        this.radioTargetWorld = null;
        this.radioGKeyTimer = 0;
        this.radioGKeyPressed = false;
        this.radioGKeyConsumed = false;
        this.radioAnimProgress = 0;
        this.radioAnimDirection = null;
        this._radioAnimLastTime = null;
        this.radioItemFocusY = null;
        this.radioItemFocusFromY = null;
        this.radioItemFocusIndex = -1;
        this.radioItemFocusAnim = 0;
        this._radioFocusLastTime = null;
        this.radioNoPermitActive = false;
        this.radioNoPermitAnimProgress = 0;
        this.radioNoPermitAnimDirection = null;
        this.radioNoPermitShowTimer = 0;
        this._radioNoPermitAnimLastTime = null;
        this.debugTab = 0;
    }
};

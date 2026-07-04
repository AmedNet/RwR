// src/core/GameState.js
import { Weapon } from './Weapon.js';

export const GameState = {
    player: null,
    enemies: [],
    teammates: [],
    bullets: [],
    grenades: [],
    capturePoints: [],
    arsenal: null, // 军械库实例
    arsenalOpen: false, // 军械库界面是否打开
    inventory: [null, null, null, null], // 背包，4个位置，存储 Weapon 实例或 null
    inventoryOpen: false, // 背包是否打开
    rp: 0, // RP值（金钱）
    map: null,
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0, down: false },
    kills: 0,
    score: 0,
    gameOver: false,
    spawnTimer: 0,
    camera: { x: 0, y: 0 },
    config: null,
    isEditing: false,
    respawnSelection: false, // 是否在选择复活据点
    selectedSpawnPoint: null, // 数字选择时临时存储
    permanentDefeat: false, // 是否永久战败（无据点可复活）
    teammateRespawnQueue: [], // 等待重生的队友 { x, y, timer }
    // 武器系统
    activeWeaponSlot: 0, // 当前装备的背包位置 (0-3)
    arsenalSelectedSlot: 0, // 军械库中选中的背包位置
    arsenalSelectedIndex: 0, // 军械库中选中的商品索引

    // 军械库滚动
    arsenalScrollOffset: 0, // 军械库列表滚动偏移量

    // Debug系统
    debugOpen: false, // Debug面板是否打开
    debugKey9Pressed: false, // 追踪9键状态（用于组合键）

    // 获取当前装备的武器
    getActiveWeapon() {
        return this.inventory[this.activeWeaponSlot];
    },

    // 切换武器
    switchWeapon(slot) {
        if (slot < 0 || slot > 3) return false;
        if (this.activeWeaponSlot === slot) return false;
        this.activeWeaponSlot = slot;
        return true;
    },

    reset() {
        this.enemies = [];
        this.teammates = [];
        this.bullets = [];
        // 据点不重置，它们是地图的一部分，由 initCapturePoints 一次性生成
        this.kills = 0;
        this.score = 0;
        this.gameOver = false;
        this.spawnTimer = 0;
        // 初始化：背包第1格放 Beretta 92
        this.inventory = [new Weapon('beretta92'), null, null, null];
        this.activeWeaponSlot = 0;
        this.arsenalSelectedSlot = 0;
        this.arsenalSelectedIndex = 0;
        this.inventoryOpen = false;
        this.arsenalOpen = false;
        this.rp = 0;
    }
};

// src/core/WeaponRegistry.js
// 武器注册表 - 添加新武器只需在这里加一条配置

export const WeaponType = {
    MELEE: 'melee',      // 近战
    PISTOL: 'pistol',    // 手枪
    RIFLE: 'rifle',      // 步枪（预留）
    SHOTGUN: 'shotgun',  // 霰弹枪（预留）
    SNIPER: 'sniper',    // 狙击枪（预留）
    GRENADE: 'grenade'   // 手雷
};

// 射击模式
export const FireMode = {
    SEMI: 'semi',    // 半自动（单发，需松开再按）
    AUTO: 'auto',    // 全自动（长按连发）
    BURST: 'burst'   // 三连射（按一次打3发）
};

export const WeaponRegistry = {
    // 匕首 919 - 不占背包，自动装备
    knife: {
        id: 'knife',
        name: '匕首 919',
        type: WeaponType.MELEE,
        damage: 5,
        shootDelay: 25,
        bulletSpeed: 0,
        magSize: null,      // 近战无弹药
        reloadTime: 0,
        buyPrice: 0,
        sellPrice: 0,
        icon: '🗡️',
        imagePath: 'src/pkg/weapon/919/919.png',
        range: 80,          // 近战攻击距离
        fireMode: FireMode.SEMI
    },

    // Beretta 92 - 初始武器
    beretta92: {
        id: 'beretta92',
        name: 'Beretta 92',
        type: WeaponType.PISTOL,
        damage: 20,
        shootDelay: 12,
        bulletSpeed: 9,
        magSize: 17,
        reloadTime: { min: 180, max: 300 }, // 3-5秒随机
        buyPrice: 100,
        sellPrice: 50,
        icon: 'src/pkg/weapon/Beretta92/Beretta92.png',
        imagePath: 'src/pkg/weapon/Beretta92/Beretta92.png',
        range: Infinity,
        fireMode: FireMode.SEMI  // 半自动
    },

    // AK-47 突击步枪 - 连射武器
    ak47: {
        id: 'ak47',
        name: 'AK-47',
        type: WeaponType.RIFLE,
        damage: 30,
        shootDelay: 11,         // 连射速度适中（手枪是12）
        bulletSpeed: 12,       // 子弹速度快（手枪是9）
        magSize: 30,           // 30发弹容量
        reloadTime: { min: 180, max: 300 }, // 与手枪一致 3-5秒
        buyPrice: 300,
        sellPrice: 150,
        icon: 'src/pkg/weapon/ak47/ak47.png',
        imagePath: 'src/pkg/weapon/ak47/ak47.png',
        reloadImagePath: 'src/pkg/weapon/ak47/ak47_Reload.png', // 换弹贴图
        range: Infinity,
        fireMode: FireMode.AUTO  // 全自动
    },

    // M67 手雷 - 投掷爆炸物
    m67: {
        id: 'm67',
        name: 'M67 手雷',
        type: WeaponType.GRENADE,
        damage: 60,
        shootDelay: 0,        // 无射速延迟
        bulletSpeed: 0,
        magSize: 4,           // 堆叠4枚
        reloadTime: 0,
        buyPrice: 70,
        sellPrice: 35,
        icon: 'src/pkg/weapon/M67/M67.png',
        imagePath: 'src/pkg/weapon/M67/M67.png',
        range: 400,           // 最大投掷距离
        fuseTime: 120,        // 引信2秒
        explosionRadius: 120, // 爆炸半径
        fireMode: FireMode.SEMI
    }
};
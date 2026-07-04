// src/core/WeaponRegistry.js
// 武器注册表 - 添加新武器只需在这里加一条配置

export const WeaponType = {
    MELEE: 'melee',      // 近战
    PISTOL: 'pistol',    // 手枪
    RIFLE: 'rifle',      // 步枪（预留）
    SHOTGUN: 'shotgun',  // 霰弹枪（预留）
    SNIPER: 'sniper',    // 狙击枪（预留）
    GRENADE: 'grenade',  // 手雷
    MEDICAL: 'medical'   // 医疗用品
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
        damage: 67,
        shootDelay: 25,
        bulletSpeed: 0,
        magSize: null,
        reloadTime: 0,
        buyPrice: 0,
        sellPrice: 0,
        icon: '🗡️',
        imagePath: 'src/pkg/weapon/919/919.png',
        range: 80,
        fireMode: FireMode.SEMI
    },

    // Beretta 92 - 初始武器
    beretta92: {
        id: 'beretta92',
        name: 'Beretta 92',
        type: WeaponType.PISTOL,
        damage: 34,
        shootDelay: 12,
        bulletSpeed: 9,
        magSize: 17,
        reloadTime: { min: 180, max: 300 },
        buyPrice: 100,
        sellPrice: 50,
        icon: 'src/pkg/weapon/Beretta92/Beretta92.png',
        imagePath: 'src/pkg/weapon/Beretta92/Beretta92.png',
        range: Infinity,
        fireMode: FireMode.SEMI,
        canChamberedReload: true,
        // 后坐力配置（手枪后坐力小）
        recoil: {
            maxAngle: 0.15,         // 最大后坐力角度偏移（弧度）
            recoverySpeed: 0.008    // 每帧恢复速度
        },
        // 子弹散布配置（手枪精度较好）
        spread: {
            base: 0.04,         // 基础散布角度（弧度） 
            max: 0.15,          // 最大散布角度（连续射击时）
            increase: 0.012,     // 每次开火增加的散布量
            recovery: 0.008      // 每秒恢复的散布量
        },
        // 连续开火散布递增
        sustainedFire: {
            threshold: 3,
            bonusPerShot: 0.008
        }
    },

    // AK-47 突击步枪 - 连射武器
    ak47: {
        id: 'ak47',
        name: 'AK-47',
        type: WeaponType.RIFLE,
        damage: 51,
        shootDelay: 11,
        bulletSpeed: 12,
        magSize: 30,
        reloadTime: { min: 180, max: 300 },
        buyPrice: 300,
        sellPrice: 150,
        icon: 'src/pkg/weapon/ak47/ak47.png',
        imagePath: 'src/pkg/weapon/ak47/ak47.png',
        reloadImagePath: 'src/pkg/weapon/ak47/ak47_Reload.png',
        range: Infinity,
        fireMode: FireMode.AUTO,
        canChamberedReload: true,
        // 后坐力配置（步枪后坐力大）
        recoil: {
            maxAngle: 0.30,
            recoverySpeed: 0.005
        },
        // 子弹散布配置（步枪散布较大）
        spread: {
            base: 0.06,
            max: 0.25,
            increase: 0.018,
            recovery: 0.005
        },
        // 连续开火散布递增
        sustainedFire: {
            threshold: 3,
            bonusPerShot: 0.012
        }
    },

    // M4A1 卡宾枪 - 三连发武器
    m4a1: {
        id: 'm4a1',
        name: 'M4A1',
        type: WeaponType.RIFLE,
        damage: 46,
        shootDelay: 7,
        bulletSpeed: 14,
        magSize: 25,
        reloadTime: { min: 180, max: 300 },
        buyPrice: 300,
        sellPrice: 150,
        icon: 'src/pkg/weapon/m4a1/m4a1.png',
        imagePath: 'src/pkg/weapon/m4a1/m4a1.png',
        reloadImagePath: 'src/pkg/weapon/m4a1/m4a1_Reload.png',
        range: Infinity,
        fireMode: FireMode.BURST,
        canChamberedReload: true,
        // 后坐力配置（卡宾枪后坐力适中）
        recoil: {
            maxAngle: 0.18,
            recoverySpeed: 0.008
        },
        // 子弹散布配置（卡宾枪精度较好）
        spread: {
            base: 0.05,
            max: 0.18,
            increase: 0.015,
            recovery: 0.008
        },
        // 连续开火散布递增
        sustainedFire: {
            threshold: 3,
            bonusPerShot: 0.010
        }
    },

    // M67 手雷 - 投掷爆炸物
    m67: {
        id: 'm67',
        name: 'M67 手雷',
        type: WeaponType.GRENADE,
        damage: 102,
        shootDelay: 0,
        bulletSpeed: 0,
        magSize: 4,
        reloadTime: 0,
        buyPrice: 70,
        sellPrice: 35,
        icon: 'src/pkg/weapon/M67/M67.png',
        imagePath: 'src/pkg/weapon/M67/M67.png',
        range: 400,
        fuseTime: 120,
        explosionRadius: 120,
        fireMode: FireMode.SEMI
    },

    // 医疗包 - 恢复血量
    cat: {
        id: 'cat',
        name: '医疗包',
        type: WeaponType.MEDICAL,
        healAmount: 30,
        magSize: 3,
        buyPrice: 30,
        sellPrice: 15,
        icon: 'src/pkg/weapon/CAT/CAT.png',
        imagePath: 'src/pkg/weapon/CAT/CAT.png',
        fireMode: FireMode.SEMI
    }
};

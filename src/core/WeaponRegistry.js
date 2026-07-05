// src/core/WeaponRegistry.js
// 武器注册表 - 添加新武器只在这里添加配置

export const WeaponType = {
    MELEE: 'melee',      // 近战
    PISTOL: 'pistol',    // 手枪
    RIFLE: 'rifle',      // 步枪
    SHOTGUN: 'shotgun',  // 霰弹枪
    SNIPER: 'sniper',    // 狙击枪
    GRENADE: 'grenade',  // 手雷
    MEDICAL: 'medical',  // 医疗包
    LAUNCHER: 'launcher' // 重武器/发射器
};

// 射击模式
export const FireMode = {
    SEMI: 'semi',    // 半自动（单发，需释放再按下）
    AUTO: 'auto',    // 全自动（长按连发）
    BURST: 'burst'   // 三连发（按一次打3发）
};

export const WeaponRegistry = {
    // 匕首 919 - 近战武器
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
        fireMode: FireMode.SEMI,
        knockback: 12
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
        // 后坐力配置：手枪后坐力较小
        recoil: {
            maxAngle: 0.15,         // 最大后坐力角度偏移（弧度）
            recoverySpeed: 0.008    // 每帧恢复速度
        },
        // 子弹散布配置：手枪精度较好
        spread: {
            base: 0.04,         // 基础散布角度（弧度）
            max: 0.15,          // 最大散布角度，连续射击时
            increase: 0.012,     // 每次开火增加的散布量
            recovery: 0.008      // 每秒恢复的散布量
        },
        // 连续射击散布增加
        sustainedFire: {
            threshold: 3,
            bonusPerShot: 0.008
        },
        knockback: 2
    },

    // AK-47 突击步枪 - 进阶武器
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
        // 后坐力配置：步枪后坐力较大
        recoil: {
            maxAngle: 0.30,
            recoverySpeed: 0.005
        },
        // 子弹散布配置：步枪散布较大
        spread: {
            base: 0.06,
            max: 0.25,
            increase: 0.018,
            recovery: 0.005
        },
        // 连续射击散布增加
        sustainedFire: {
            threshold: 3,
            bonusPerShot: 0.012
        },
        knockback: 4
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
        // 后坐力配置：卡宾枪后坐力适中
        recoil: {
            maxAngle: 0.30,
            recoverySpeed: 0.005
        },
        // 子弹散布配置：卡宾枪精度较好
        spread: {
            base: 0.05,
            max: 0.18,
            increase: 0.015,
            recovery: 0.008
        },
        // 连续射击散布增加
        sustainedFire: {
            threshold: 3,
            bonusPerShot: 0.010
        },
        knockback: 3
    },

    // SA28 霰弹枪 - 半自动，多弹丸
    sa28: {
        id: 'sa28',
        name: 'SA28',
        type: WeaponType.SHOTGUN,
        damage: 33,           // 每颗弹丸伤害
        pellets: 8,           // 每次射击弹丸数
        spreadAngle: 0.35,    // 20度锥角（总角度，弧度）
        shootDelay: 32,       // 半自动射速较慢
        bulletSpeed: 10,
        canChamberedReload: true, // 支持空仓挂机
        magSize: 8,
        reloadTime: { min: 180, max: 240 },
        buyPrice: 400,
        sellPrice: 150,
        icon: 'src/pkg/weapon/SA28/SA28.png',
        imagePath: 'src/pkg/weapon/SA28/SA28.png',
        range: 550,           // 最大射程（像素）
        fireMode: FireMode.SEMI,
        knockback: 8,         // 击退力度大
        recoil: {
            maxAngle: 0.25,
            recoverySpeed: 0.008
        }
    },

    // AWP 狙击枪 - 栓动，高伤害，穿透，倍镜
    awp: {
        id: 'awp',
        name: 'AWP',
        type: WeaponType.SNIPER,
        damage: 150,
        shootDelay: 60,           // 栓动，约1秒
        bulletSpeed: 50,          // 子弹速度极快
        magSize: 5,
        reloadTime: { min: 240, max: 360 },
        buyPrice: 500,
        sellPrice: 400,
        icon: 'src/pkg/weapon/AWP/AWP.png',
        imagePath: 'src/pkg/weapon/AWP/AWP.png',
        reloadImagePath: 'src/pkg/weapon/AWP/AWP_Reload.png',
        range: Infinity,
        fireMode: FireMode.SEMI,
        canChamberedReload: true, // 支持空仓挂机
        knockback: 15,
        
        // 穿透配置
        penetration: {
            maxTargets: 4,        // 最多穿透3个敌人
            damageDecay: 0.7      // 每次穿透伤害×0.5
        },
        
        // 倍镜配置（动态视野 - 仅使用offset偏移）
        scope: {
            activateDelay: 30,    // 停止移动后30帧进入瞄准状态
            maxOffset: 600,       // 最大偏移距离（像素）
            offsetSensitivity: 300 // 鼠标距离中心多远时达到最大偏移
        },
        
        // 后坐力（大）
        recoil: {
            maxAngle: 0.35,
            recoverySpeed: 0.004
        },
        
        // 精度（极高）
        spread: {
            base: 0.01,
            max: 0.08,
            increase: 0.02,
            recovery: 0.01
        }
    },

    // M82 反器材狙击枪 - 爆炸弹
    m82: {
        id: 'm82',
        name: 'M82',
        type: WeaponType.SNIPER,
        damage: 200,              // 爆炸中心伤害（距离衰减）
        shootDelay: 12,           // 同手枪射速
        bulletSpeed: 50,          // 同AWP
        magSize: 10,
        reloadTime: { min: 240, max: 360 },
        buyPrice: 800,
        sellPrice: 400,
        icon: 'src/pkg/weapon/M82/M82.png',
        imagePath: 'src/pkg/weapon/M82/M82.png',
        reloadImagePath: 'src/pkg/weapon/M82/M82_Reload.png',
        range: Infinity,
        fireMode: FireMode.SEMI,
        canChamberedReload: true, // 支持空仓挂机
        knockback: 60,            // 同手雷击退
        
        // 爆炸弹配置
        explosionRadius: 70,      // 爆炸半径（像素）
        explosionDamage: 160,     // 爆炸中心伤害
        
        // 倍镜配置
        scope: {
            activateDelay: 30,
            maxOffset: 400,
            offsetSensitivity: 300
        },
        
        // 后坐力（同AWP）
        recoil: {
            maxAngle: 0.35,
            recoverySpeed: 0.004
        },
        
        // 精度（第一发比AWP稍差，连射精度损失极大）
        spread: {
            base: 0.015,
            max: 0.35,
            increase: 0.04,
            recovery: 0.008
        }
    },

    // M67 手雷 - 投掷物
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

    // AT4 火箭筒 - 一次性重武器，堆叠机制
    at4: {
        id: 'at4',
        name: 'AT4',
        type: WeaponType.LAUNCHER,
        damage: 300,              // 直接命中伤害
        shootDelay: 90,           // 1.5秒射击间隔
        bulletSpeed: 8,           // 慢速可见弹道
        magSize: 1,               // 每次装填1发
        maxStack: 2,              // 最多持有2发
        reloadTime: { min: 300, max: 420 }, // 换弹时间
        buyPrice: 300,
        sellPrice: 150,
        icon: 'src/pkg/weapon/at4/at4.png',
        imagePath: 'src/pkg/weapon/at4/at4.png',
        range: Infinity,
        fireMode: FireMode.SEMI,
        knockback: 100,           // 大范围击退

        // 爆炸配置
        explosionRadius: 150,     // 爆炸半径（像素）
        explosionDamage: 2000,    // 爆炸中心伤害

        // 后坐力（极大）
        recoil: {
            maxAngle: 0.5,
            recoverySpeed: 0.003
        },

        // 拖尾特效
        hasTrail: true
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
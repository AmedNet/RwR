// src/core/WeaponRegistry.js
// 武器注册表 - 添加新武器只需在这里加一条配置

export const WeaponType = {
    MELEE: 'melee',      // 近战
    PISTOL: 'pistol',    // 手枪
    RIFLE: 'rifle',      // 步枪（预留）
    SHOTGUN: 'shotgun',  // 霰弹枪（预留）
    SNIPER: 'sniper'     // 狙击枪（预留）
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
        range: 80           // 近战攻击距离
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
        range: Infinity
    }
};
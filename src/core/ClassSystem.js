// src/core/ClassSystem.js
// AI 兵种系统配置

export const UnitClass = {
    NORMAL: 'normal',      // 普通兵
    MEDIC: 'medic',        // 医疗兵
    SNIPER: 'sniper',      // 狙击手
    ASSAULT: 'assault',    // 突击兵
    AMMO: 'ammo'           // 弹药兵
};

export const ClassConfig = {
    [UnitClass.NORMAL]: {
        name: '普通兵',
        icon: '●',
        spawnWeight: 50,
        healthMultiplier: 1.0,
        damageMultiplier: 1.0,
        speedMultiplier: 1.0,
        awarenessBonus: 0,
        accuracyBonus: 0,
        reloadSpeedMult: 1.0,
        fireRateMult: 1.0
    },
    [UnitClass.MEDIC]: {
        name: '医疗兵',
        icon: '+',
        spawnWeight: 15,
        healthMultiplier: 0.9,
        damageMultiplier: 0.8,
        speedMultiplier: 1.0,
        awarenessBonus: 0,
        accuracyBonus: 0,
        reloadSpeedMult: 1.0,
        fireRateMult: 1.0,
        healRange: 300,
        healAmount: 30,
        healCooldown: 60,
        healAuraRange: 200,
        healAuraPerSecond: 10
    },
    [UnitClass.SNIPER]: {
        name: '狙击手',
        icon: '◎',
        spawnWeight: 10,
        healthMultiplier: 0.85,
        damageMultiplier: 1.2,
        speedMultiplier: 0.9,
        awarenessBonus: 300,
        accuracyBonus: 0.2,
        reloadSpeedMult: 1.0,
        fireRateMult: 1.0
    },
    [UnitClass.ASSAULT]: {
        name: '突击兵',
        icon: '▶',
        spawnWeight: 15,
        healthMultiplier: 1.1,
        damageMultiplier: 1.15,
        speedMultiplier: 1.3,
        awarenessBonus: 0,
        accuracyBonus: 0,
        reloadSpeedMult: 1.0,
        fireRateMult: 1.0
    },
    [UnitClass.AMMO]: {
        name: '弹药兵',
        icon: '⊕',
        spawnWeight: 10,
        healthMultiplier: 1.0,
        damageMultiplier: 0.9,
        speedMultiplier: 1.0,
        awarenessBonus: 0,
        accuracyBonus: 0,
        reloadSpeedMult: 1.0,
        fireRateMult: 1.0,
        auraRange: 200,
        auraReloadSpeed: 1.3,
        auraFireRate: 1.2
    }
};

/**
 * 根据权重随机选择兵种
 * @param {number} rankBonus - 军衔加成（0-0.2），增加特殊兵种概率
 * @returns {string} UnitClass 枚举值
 */
export function rollRandomClass(rankBonus = 0) {
    const adjustedWeights = {};
    let normalWeight = ClassConfig[UnitClass.NORMAL].spawnWeight;
    
    // 军衔加成：减少普通兵权重，增加特殊兵种权重
    if (rankBonus > 0) {
        normalWeight = Math.max(20, normalWeight - rankBonus * 30);
    }
    
    adjustedWeights[UnitClass.NORMAL] = normalWeight;
    adjustedWeights[UnitClass.MEDIC] = ClassConfig[UnitClass.MEDIC].spawnWeight + rankBonus * 5;
    adjustedWeights[UnitClass.SNIPER] = ClassConfig[UnitClass.SNIPER].spawnWeight + rankBonus * 5;
    adjustedWeights[UnitClass.ASSAULT] = ClassConfig[UnitClass.ASSAULT].spawnWeight + rankBonus * 5;
    adjustedWeights[UnitClass.AMMO] = ClassConfig[UnitClass.AMMO].spawnWeight + rankBonus * 5;
    
    const totalWeight = Object.values(adjustedWeights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (const [unitClass, weight] of Object.entries(adjustedWeights)) {
        random -= weight;
        if (random <= 0) {
            return unitClass;
        }
    }
    
    return UnitClass.NORMAL;
}

/**
 * 获取兵种配置
 * @param {string} unitClass - UnitClass 枚举值
 * @returns {Object} 兵种配置对象
 */
export function getClassConfig(unitClass) {
    return ClassConfig[unitClass] || ClassConfig[UnitClass.NORMAL];
}

/**
 * 获取兵种名称
 * @param {string} unitClass - UnitClass 枚举值
 * @returns {string} 兵种名称
 */
export function getClassName(unitClass) {
    return getClassConfig(unitClass).name;
}

/**
 * 获取兵种图标
 * @param {string} unitClass - UnitClass 枚举值
 * @returns {string} 兵种图标
 */
export function getClassIcon(unitClass) {
    return getClassConfig(unitClass).icon;
}

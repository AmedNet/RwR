// src/core/RankSystem.js
// AI 军衔系统配置

export const AIRank = {
    PRIVATE: 0,      // 列兵
    SERGEANT: 1,     // 军士
    OFFICER: 2,      // 军官
    COMMANDER: 3     // 指挥官
};

export const RankConfig = {
    [AIRank.PRIVATE]: {
        name: '列兵',
        stars: 1,
        spawnWeight: 88,           // 出现概率权重
        maxSubordinates: 0,        // 小弟上限
        healthMultiplier: 1.0,     // 血量倍率
        damageMultiplier: 1.0,     // 伤害倍率
        killReward: 10,            // 击杀RP奖励
        starColor: '#FFD740',      // 星标颜色
        weaponTier: 0              // 武器等级
    },
    [AIRank.SERGEANT]: {
        name: '军士',
        stars: 2,
        spawnWeight: 10,
        maxSubordinates: 3,
        healthMultiplier: 1.2,
        damageMultiplier: 1.15,
        killReward: 20,
        starColor: '#FFD740',
        weaponTier: 1
    },
    [AIRank.OFFICER]: {
        name: '军官',
        stars: 3,
        spawnWeight: 1.75,
        maxSubordinates: 6,
        healthMultiplier: 1.5,
        damageMultiplier: 1.35,
        killReward: 40,
        starColor: '#FF6D00',
        weaponTier: 2
    },
    [AIRank.COMMANDER]: {
        name: '指挥官',
        stars: 4,
        spawnWeight: 0.25,
        maxSubordinates: 10,
        healthMultiplier: 2.0,
        damageMultiplier: 1.6,
        killReward: 80,
        starColor: '#F44336',
        weaponTier: 3
    }
};

/**
 * 根据权重随机选择军衔
 * @returns {number} AIRank 枚举值
 */
export function rollRandomRank() {
    const totalWeight = Object.values(RankConfig).reduce((sum, cfg) => sum + cfg.spawnWeight, 0);
    let random = Math.random() * totalWeight;
    
    for (const [rank, config] of Object.entries(RankConfig)) {
        random -= config.spawnWeight;
        if (random <= 0) {
            return parseInt(rank);
        }
    }
    
    return AIRank.PRIVATE; // fallback
}

/**
 * 获取军衔配置
 * @param {number} rank - AIRank 枚举值
 * @returns {Object} 军衔配置对象
 */
export function getRankConfig(rank) {
    return RankConfig[rank] || RankConfig[AIRank.PRIVATE];
}

/**
 * 获取军衔名称
 * @param {number} rank - AIRank 枚举值
 * @returns {string} 军衔名称
 */
export function getRankName(rank) {
    return getRankConfig(rank).name;
}

/**
 * 获取军衔星标数量
 * @param {number} rank - AIRank 枚举值
 * @returns {number} 星标数量
 */
export function getRankStars(rank) {
    return getRankConfig(rank).stars;
}

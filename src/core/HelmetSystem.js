// src/core/HelmetSystem.js
// AI 头盔系统 - 提供减伤和概率跳弹机制

// 头盔等级枚举
export const HelmetTier = {
    NONE: 0,        // 无头盔
    STEEL: 1,       // 钢盔
    TITANIUM: 2     // 钛合金盔
};

// 头盔配置表
export const HelmetConfig = {
    [HelmetTier.NONE]: {
        name: "无头盔",
        damageReduction: 0,
        ricochetChance: 0,
        imagePath: null,
        spawnWeight: 0
    },
    [HelmetTier.STEEL]: {
        name: "钢盔",
        damageReduction: 0.15,      // 15% 减伤
        ricochetChance: 0.08,       // 8% 跳弹概率
        spawnWeight: 70,            // 基础生成权重
        variants: [
            { imagePath: "src/pkg/gear/m35_green.png", name: "橄榄绿钢盔" },
            { imagePath: "src/pkg/gear/m35_grey.png",  name: "灰色钢盔" }
        ]
    },
    [HelmetTier.TITANIUM]: {
        name: "钛合金盔",
        damageReduction: 0.30,      // 30% 减伤
        ricochetChance: 0.18,       // 18% 跳弹概率
        spawnWeight: 30,            // 基础生成权重
        variants: [
            { imagePath: "src/pkg/gear/m35_blue.png",  name: "银蓝钛合金盔" },
            { imagePath: "src/pkg/gear/m35b_brown.png", name: "棕色钛合金盔" }
        ]
    }
};

// 免疫跳弹的武器类型
export const RICOCHET_IMMUNE_TYPES = new Set(["sniper", "rifle", "launcher", "grenade"]);

/**
 * 根据军衔随机分配头盔等级
 * @param {number} rank - AIRank 枚举值
 * @returns {number} HelmetTier 枚举值
 */
export function rollHelmet(rank = 0) {
    const rankBonus = rank * 0.1;
    let noneWeight = Math.max(0, 40 - rankBonus * 40);
    let steelWeight = HelmetConfig[HelmetTier.STEEL].spawnWeight;
    let titaniumWeight = HelmetConfig[HelmetTier.TITANIUM].spawnWeight + rankBonus * 50;

    const totalWeight = noneWeight + steelWeight + titaniumWeight;
    let random = Math.random() * totalWeight;

    if (random < noneWeight) return HelmetTier.NONE;
    random -= noneWeight;

    if (random < steelWeight) return HelmetTier.STEEL;
    return HelmetTier.TITANIUM;
}

/**
 * 获取头盔配置
 * @param {number} tier - HelmetTier 枚举值
 * @returns {Object} 头盔配置对象
 */
export function getHelmetConfig(tier) {
    return HelmetConfig[tier] || HelmetConfig[HelmetTier.NONE];
}

/**
 * 获取头盔变体数量
 * @param {number} tier - HelmetTier 枚举值
 * @returns {number} 变体数量
 */
export function getHelmetVariantCount(tier) {
    const config = getHelmetConfig(tier);
    return (config.variants || []).length;
}

/**
 * 获取指定头盔等级的随机变体索引
 * @param {number} tier - HelmetTier 枚举值
 * @returns {number} 变体索引
 */
export function rollHelmetVariant(tier) {
    const count = getHelmetVariantCount(tier);
    if (count === 0) return 0;
    return Math.floor(Math.random() * count);
}

/**
 * 获取指定头盔等级和变体索引的贴图路径
 * @param {number} tier - HelmetTier 枚举值
 * @param {number} variantIndex - 变体索引
 * @returns {string} 贴图路径
 */
export function getHelmetVariantImagePath(tier, variantIndex = 0) {
    const config = getHelmetConfig(tier);
    const variants = config.variants || [];
    if (variants.length === 0) return null;
    const idx = Math.max(0, Math.min(variantIndex, variants.length - 1));
    return variants[idx].imagePath;
}

/**
 * 判断是否触发跳弹
 * @param {number} helmetTier - 头盔等级
 * @param {string} weaponType - 武器类型
 * @returns {boolean} 是否跳弹
 */
export function tryRicochet(helmetTier, weaponType) {
    if (helmetTier === HelmetTier.NONE) return false;
    if (RICOCHET_IMMUNE_TYPES.has(weaponType)) return false;
    const config = getHelmetConfig(helmetTier);
    return Math.random() < config.ricochetChance;
}

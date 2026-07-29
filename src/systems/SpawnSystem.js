// src/systems/SpawnSystem.js
import { GameState } from '../core/GameState.js';
import { Enemy } from '../entities/Enemy.js';
import { Weapon } from '../core/Weapon.js';
import { WeaponRegistry, WeaponType } from '../core/WeaponRegistry.js';
import { AIRank, getRankConfig } from '../core/RankSystem.js';
import { UnitClass, getClassConfig } from '../core/ClassSystem.js';

// 所有可用武器（完整池）
const ALL_WEAPONS = Object.keys(WeaponRegistry).filter(id => 
    WeaponRegistry[id].aiWeight > 0
);

// 武器类型分级（用于权重调整）
const WEAPON_TIER = {
    [WeaponType.PISTOL]: 0,
    [WeaponType.SMG]: 0,
    [WeaponType.RIFLE]: 1,
    [WeaponType.SHOTGUN]: 1,
    [WeaponType.SNIPER]: 2,
    [WeaponType.LAUNCHER]: 2
};

// 军衔对应的武器类型权重加成（军衔 -> 武器等级 -> 权重倍率）
const RANK_WEAPON_WEIGHT_MULT = {
    0: { 0: 3.0, 1: 1.5, 2: 0.5 },  // 列兵：偏好低级武器
    1: { 0: 2.0, 1: 2.0, 2: 1.0 },  // 军士：均衡偏好中级
    2: { 0: 1.0, 1: 2.5, 2: 1.5 },  // 军官：偏好中高级
    3: { 0: 0.5, 1: 1.5, 2: 3.0 }   // 指挥官：偏好高级武器
};

// 兵种对应的武器类型权重加成
const CLASS_WEAPON_WEIGHT_MULT = {
    [UnitClass.NORMAL]: {},   // 普通兵：无额外偏好
    [UnitClass.MEDIC]: {      // 医疗兵：偏好医疗包
        medical: 3.0
    },
    [UnitClass.SNIPER]: {     // 狙击手：偏好狙击枪
        sniper: 3.0
    },
    [UnitClass.ASSAULT]: {    // 突击兵：偏好霰弹枪/冲锋枪
        shotgun: 2.0,
        smg: 2.0
    },
    [UnitClass.AMMO]: {       // 弹药兵：偏好轻武器
        pistol: 2.0,
        smg: 2.0,
        launcher: 0.5
    }
};

// 配件池
const AI_WEAPON_POOL = {
    accessories: Object.keys(WeaponRegistry).filter(id => [
        WeaponType.LAUNCHER,
        WeaponType.GRENADE,
        WeaponType.MEDICAL
    ].includes(WeaponRegistry[id].type) && WeaponRegistry[id].aiWeight > 0)
};

// 加权随机选择函数
function weightedRandom(items) {
    // 计算总权重
    let totalWeight = 0;
    const weights = [];
    for (const id of items) {
        const config = WeaponRegistry[id];
        const weight = config?.aiWeight || 10; // 默认权重10
        weights.push(weight);
        totalWeight += weight;
    }

    // 随机选择
    let random = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return items[i];
        }
    }
    return items[items.length - 1]; // fallback
}

export const SpawnSystem = {
    // 剧情模式接口：在指定位置按配置生成一波敌人
    // config: { count, x, y, radius, rank?, unitClass?, weaponIds? }
    // rank/unitClass 未指定时随机；weaponIds 未指定时根据 rank/unitClass 随机生成
    spawnCustomWave(config) {
        const world = GameState.world;
        const enemies = [];
        for (let i = 0; i < (config.count || 1); i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (config.radius || 60);
            let x = (config.x || world.width / 2) + Math.cos(angle) * dist;
            let y = (config.y || world.height / 2) + Math.sin(angle) * dist;
            x = Math.max(10, Math.min(world.width - 10, x));
            y = Math.max(10, Math.min(world.height - 10, y));

            const enemyConfig = { ...GameState.config.enemy };
            if (config.rank != null) enemyConfig.rank = config.rank;
            if (config.unitClass != null) enemyConfig.unitClass = config.unitClass;
            const enemy = new Enemy(x, y, enemyConfig);

            const weapons = config.weaponIds
                ? config.weaponIds.map(id => { const w = new Weapon(id); w.isInfiniteAmmo = true; return w; })
                : this.generateRandomWeapons(enemy.rank, enemy.unitClass);
            enemy.setWeapons(weapons);
            enemies.push(enemy);
        }
        GameState.enemies.push(...enemies);
        return enemies;
    },

    spawnEnemy() {
        const config = GameState.config.enemy;
        const world = GameState.world;

        // 只在敌方据点生成敌人
        const enemyPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');

        if (enemyPoints.length === 0) {
            // 没有敌方据点，不生成敌人
            return null;
        }

        const point = enemyPoints[Math.floor(Math.random() * enemyPoints.length)];
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 100;
        let x = point.x + Math.cos(angle) * dist;
        let y = point.y + Math.sin(angle) * dist;

        // 确保不超出边界
        x = Math.max(config.radius, Math.min(world.width - config.radius, x));
        y = Math.max(config.radius, Math.min(world.height - config.radius, y));

        console.log(`👾 敌人生成于据点附近 (${Math.round(x)}, ${Math.round(y)})`);

        // 创建敌人实例
        const enemy = new Enemy(x, y, config);

        // 随机分配武器
        const weapons = this.generateRandomWeapons(enemy.rank, enemy.unitClass);
        enemy.setWeapons(weapons);

        return enemy;
    },

    // 为 AI 生成随机武器配置（根据军衔和兵种）
    generateRandomWeapons(rank = AIRank.PRIVATE, unitClass = UnitClass.NORMAL) {
        const weapons = [];
        const accChance1 = 0.3 + rank * 0.2;
        const accChance2 = 0.1 + rank * 0.2;

        weapons.push(new Weapon('knife'));

        const randomGun = this.weightedRandomByClass(ALL_WEAPONS, rank, unitClass);
        const gun = new Weapon(randomGun);
        gun.isInfiniteAmmo = true;
        weapons.push(gun);

        // 医疗兵保证携带医疗包
        if (unitClass === UnitClass.MEDIC) {
            const medicalIds = AI_WEAPON_POOL.accessories.filter(id => WeaponRegistry[id].type === WeaponType.MEDICAL);
            if (medicalIds.length > 0) {
                weapons.push(new Weapon(medicalIds[Math.floor(Math.random() * medicalIds.length)]));
            } else {
                weapons.push(Math.random() < accChance1 ? new Weapon(weightedRandom(AI_WEAPON_POOL.accessories)) : null);
            }
        } else if (Math.random() < accChance1) {
            weapons.push(new Weapon(weightedRandom(AI_WEAPON_POOL.accessories)));
        } else {
            weapons.push(null);
        }

        if (Math.random() < accChance2) {
            weapons.push(new Weapon(weightedRandom(AI_WEAPON_POOL.accessories)));
        } else {
            weapons.push(null);
        }

        return weapons;
    },

    // 根据军衔调整武器权重的随机选择
    weightedRandomByRank(weaponIds, rank) {
        const weightMult = RANK_WEAPON_WEIGHT_MULT[rank] || RANK_WEAPON_WEIGHT_MULT[0];
        let totalWeight = 0;
        const weights = [];
        
        for (const id of weaponIds) {
            const config = WeaponRegistry[id];
            const baseWeight = config?.aiWeight || 10;
            const tier = WEAPON_TIER[config.type] ?? 0;
            const mult = weightMult[tier] ?? 1.0;
            const finalWeight = baseWeight * mult;
            weights.push(finalWeight);
            totalWeight += finalWeight;
        }
        
        let random = Math.random() * totalWeight;
        for (let i = 0; i < weaponIds.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return weaponIds[i];
            }
        }
        return weaponIds[weaponIds.length - 1];
    },

    // 根据军衔+兵种调整武器权重的随机选择
    weightedRandomByClass(weaponIds, rank, unitClass) {
        const rankMult = RANK_WEAPON_WEIGHT_MULT[rank] || RANK_WEAPON_WEIGHT_MULT[0];
        const classMult = CLASS_WEAPON_WEIGHT_MULT[unitClass] || {};
        let totalWeight = 0;
        const weights = [];

        for (const id of weaponIds) {
            const config = WeaponRegistry[id];
            const baseWeight = config?.aiWeight || 10;
            const tier = WEAPON_TIER[config.type] ?? 0;
            const rMult = rankMult[tier] ?? 1.0;
            const cMult = classMult[config.type] ?? 1.0;
            const finalWeight = baseWeight * rMult * cMult;
            weights.push(finalWeight);
            totalWeight += finalWeight;
        }

        let random = Math.random() * totalWeight;
        for (let i = 0; i < weaponIds.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return weaponIds[i];
            }
        }
        return weaponIds[weaponIds.length - 1];
    },

    // 为队友生成随机武器配置（根据军衔和兵种）
    generateTeammateWeapons(rank = AIRank.PRIVATE, unitClass = UnitClass.NORMAL) {
        return this.generateRandomWeapons(rank, unitClass);
    },

    // 为队友装备武器
    equipTeammate(teammate) {
        const weapons = this.generateTeammateWeapons(teammate.rank, teammate.unitClass);
        teammate.setWeapons(weapons);
    },

    update() {
        const config = GameState.config.enemy;
        if (GameState.enemies.length >= config.maxEnemies) return;

        GameState.spawnTimer++;
        // 在战争激烈时，敌人刷新增加更快
        // 战地平衡：刷兵加速更平缓、下限更高，避免「越杀越多」压垮蓝方
        const rate = Math.max(22, config.spawnBaseRate - Math.floor(GameState.kills / 12));
        if (GameState.spawnTimer >= rate) {
            const enemy = this.spawnEnemy();
            if (enemy) {
                GameState.enemies.push(enemy);
            }
            GameState.spawnTimer = 0;
        }
    }
};

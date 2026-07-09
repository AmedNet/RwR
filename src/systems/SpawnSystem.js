// src/systems/SpawnSystem.js
import { GameState } from '../core/GameState.js';
import { Enemy } from '../entities/Enemy.js';
import { Weapon } from '../core/Weapon.js';
import { WeaponRegistry, WeaponType } from '../core/WeaponRegistry.js';
import { AIRank, getRankConfig } from '../core/RankSystem.js';

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
    spawnEnemy() {
        const config = GameState.config.enemy;
        const world = GameState.config.world;

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
        const weapons = this.generateRandomWeapons(enemy.rank);
        enemy.setWeapons(weapons);

        return enemy;
    },

    // 为 AI 生成随机武器配置（根据军衔）
    generateRandomWeapons(rank = AIRank.PRIVATE) {
        const weapons = [];
        const accChance1 = 0.3 + rank * 0.2;
        const accChance2 = 0.1 + rank * 0.2;

        weapons.push(new Weapon('knife'));

        const randomGun = this.weightedRandomByRank(ALL_WEAPONS, rank);
        const gun = new Weapon(randomGun);
        gun.isInfiniteAmmo = true;
        weapons.push(gun);

        if (Math.random() < accChance1) {
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

    // 为队友生成随机武器配置（根据军衔）
    generateTeammateWeapons(rank = AIRank.PRIVATE) {
        return this.generateRandomWeapons(rank);
    },

    // 为队友装备武器
    equipTeammate(teammate) {
        const weapons = this.generateTeammateWeapons(teammate.rank);
        teammate.setWeapons(weapons);
    },

    update() {
        const config = GameState.config.enemy;
        if (GameState.enemies.length >= config.maxEnemies) return;

        GameState.spawnTimer++;
        // 在战争激烈时，敌人刷新增加更快
        const rate = Math.max(10, config.spawnBaseRate - Math.floor(GameState.kills / 5));
        if (GameState.spawnTimer >= rate) {
            const enemy = this.spawnEnemy();
            if (enemy) {
                GameState.enemies.push(enemy);
            }
            GameState.spawnTimer = 0;
        }
    }
};

// src/systems/SpawnSystem.js
import { GameState } from '../core/GameState.js';
import { Enemy } from '../entities/Enemy.js';
import { Weapon } from '../core/Weapon.js';
import { WeaponRegistry, WeaponType } from '../core/WeaponRegistry.js';

// AI 武器池
const AI_WEAPON_POOL = {
    guns: Object.keys(WeaponRegistry).filter(id => [
        WeaponType.PISTOL,
        WeaponType.RIFLE,
        WeaponType.SMG,
        WeaponType.SHOTGUN,
        WeaponType.SNIPER
    ].includes(WeaponRegistry[id].type) && WeaponRegistry[id].aiWeight > 0),
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
        const weapons = this.generateRandomWeapons();
        enemy.setWeapons(weapons);

        return enemy;
    },

    // 为 AI 生成随机武器配置
    generateRandomWeapons() {
        const weapons = [];

        // 槽位0: 固定军刀
        weapons.push(new Weapon('knife'));

        // 槽位1: 加权随机选择枪械
        const randomGun = weightedRandom(AI_WEAPON_POOL.guns);
        const gun = new Weapon(randomGun);
        gun.isInfiniteAmmo = true; // AI 枪械无限备弹
        weapons.push(gun);

        // 槽位2: 加权随机配件（可能为空）
        if (Math.random() < 0.5) { // 50% 概率有配件
            const randomAcc = weightedRandom(AI_WEAPON_POOL.accessories);
            weapons.push(new Weapon(randomAcc));
        } else {
            weapons.push(null);
        }

        // 槽位3: 加权随机配件（可能为空）
        if (Math.random() < 0.3) { // 30% 概率有第二个配件
            const randomAcc = weightedRandom(AI_WEAPON_POOL.accessories);
            weapons.push(new Weapon(randomAcc));
        } else {
            weapons.push(null);
        }

        return weapons;
    },

    // 为队友生成随机武器配置
    generateTeammateWeapons() {
        const weapons = [];

        // 槽位0: 初始近战武器
        weapons.push(new Weapon('knife'));

        // 槽位1: 加权随机选择枪械
        const randomGun = weightedRandom(AI_WEAPON_POOL.guns);
        const gun = new Weapon(randomGun);
        gun.isInfiniteAmmo = true;
        weapons.push(gun);

        // 槽位2: 加权随机配件（50%概率）
        if (Math.random() < 0.5) {
            const randomAcc = weightedRandom(AI_WEAPON_POOL.accessories);
            weapons.push(new Weapon(randomAcc));
        } else {
            weapons.push(null);
        }

        // 槽位3: 加权随机配件（30%概率）
        if (Math.random() < 0.3) {
            const randomAcc = weightedRandom(AI_WEAPON_POOL.accessories);
            weapons.push(new Weapon(randomAcc));
        } else {
            weapons.push(null);
        }

        return weapons;
    },

    // 为队友装备武器
    equipTeammate(teammate) {
        const weapons = this.generateTeammateWeapons();
        teammate.setWeapons(weapons);
    },

    update() {
        if (GameState.gameOver) return;
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

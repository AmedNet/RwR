// src/core/Weapon.js
import { WeaponRegistry } from './WeaponRegistry.js';

export class Weapon {
    constructor(weaponId) {
        const config = WeaponRegistry[weaponId];
        if (!config) {
            console.error(`❌ 未知武器: ${weaponId}`);
            return;
        }
        this.id = weaponId;
        this.config = config;
        this.ammo = config.magSize; // 当前弹药，近战为 null
        this.isReloading = false;
        this.reloadTimer = 0;
    }

    // 能否射击
    canShoot() {
        if (this.isReloading) return false;
        if (this.config.type === 'melee') return true; // 近战无弹药限制
        return this.ammo > 0;
    }

    // 消耗弹药
    consumeAmmo() {
        if (this.config.type === 'melee') return;
        if (this.ammo > 0) this.ammo--;
    }

    // 开始换弹
    startReload() {
        if (this.config.type === 'melee') return;
        if (this.isReloading) return;
        if (this.ammo >= this.config.magSize) return;
        this.isReloading = true;
        // 支持随机换弹时间 { min, max } 或固定数值
        const rt = this.config.reloadTime;
        if (typeof rt === 'object' && rt.min !== undefined) {
            this.reloadTimer = rt.min + Math.random() * (rt.max - rt.min);
            this.reloadTimeTotal = this.reloadTimer; // 保存总时长用于计算进度
        } else {
            this.reloadTimer = rt;
            this.reloadTimeTotal = rt;
        }
    }

    // 每帧更新换弹
    updateReload() {
        if (!this.isReloading) return;
        this.reloadTimer--;
        if (this.reloadTimer <= 0) {
            this.ammo = this.config.magSize;
            this.isReloading = false;
            this.reloadTimer = 0;
        }
    }

    // 获取换弹进度 (0-1)
    getReloadProgress() {
        if (!this.isReloading) return 1;
        const total = this.reloadTimeTotal || this.config.reloadTime.max || this.config.reloadTime;
        return 1 - (this.reloadTimer / total);
    }

    // 克隆武器（用于重置/复制）
    clone() {
        return new Weapon(this.id);
    }
}
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
        this.isChamberedReload = false; // 空仓挂机快速换弹标记
        this.justEmptied = false; // 打空后未切枪标记
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
        // 弹药打空时设置标记（空仓挂机机制）
        if (this.ammo === 0) this.justEmptied = true;
    }
    
    // 清除打空标记（切换武器时调用）
    clearJustEmptied() {
        this.justEmptied = false;
    }

    // 开始换弹
    startReload() {
        if (this.config.type === 'melee') return;
        if (this.isReloading) return;
        if (this.ammo >= this.config.magSize) return;
        this.isReloading = true;
        // 空仓挂机：弹药>=1 且武器支持时，换弹时间减少45%
        this.isChamberedReload = (this.ammo >= 1 && this.config.canChamberedReload === true);
        // 支持随机换弹时间 { min, max } 或固定数值
        const rt = this.config.reloadTime;
        if (typeof rt === 'object' && rt.min !== undefined) {
            this.reloadTimer = rt.min + Math.random() * (rt.max - rt.min);
            this.reloadTimeTotal = this.reloadTimer; // 保存总时长用于计算进度
        } else {
            this.reloadTimer = rt;
            this.reloadTimeTotal = rt;
        }
        // 空仓挂机加速
        if (this.isChamberedReload) {
            this.reloadTimer = Math.floor(this.reloadTimer * 0.55);
            this.reloadTimeTotal = this.reloadTimer;
        }
        // 打空后即时换弹加速（弹药=0且不切枪）：换弹时间减少30%
        if (this.justEmptied && this.config.canChamberedReload === true) {
            this.reloadTimer = Math.floor(this.reloadTimer * 0.7);
            this.reloadTimeTotal = this.reloadTimer;
        }
        // 清除打空标记
        this.justEmptied = false;
    }

    // 每帧更新换弹
    updateReload() {
        if (!this.isReloading) return;
        this.reloadTimer--;
        if (this.reloadTimer <= 0) {
            // 空仓挂机：换弹完成后弹药量 = magSize + 1
            if (this.isChamberedReload) {
                this.ammo = this.config.magSize + 1;
            } else {
                this.ammo = this.config.magSize;
            }
            this.isReloading = false;
            this.reloadTimer = 0;
            this.isChamberedReload = false;
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
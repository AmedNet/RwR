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
        this.ammo = config.magSize;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.isChamberedReload = false;
        this.justEmptied = false;
        // 后坐力 & 散布状态
        this.currentRecoil = 0;
        this.currentSpread = config.spread ? config.spread.base : 0;
        // 连续射击计数
        this.consecutiveShots = 0;
    }

    canShoot() {
        if (this.isReloading) return false;
        if (this.config.type === 'melee') return true;
        return this.ammo > 0;
    }

    consumeAmmo() {
        if (this.config.type === 'melee') return;
        if (this.ammo > 0) this.ammo--;
        if (this.ammo === 0) this.justEmptied = true;
    }

    clearJustEmptied() {
        this.justEmptied = false;
    }

    startReload() {
        // 近战、医疗用品、手雷不能换弹
        if (this.config.type === 'melee') return;
        if (this.config.type === 'medical') return;
        if (this.config.type === 'grenade') return;
        if (this.isReloading) return;
        if (this.ammo >= this.config.magSize) return;
        this.isReloading = true;
        this.isChamberedReload = (this.ammo >= 1 && this.config.canChamberedReload === true);
        const rt = this.config.reloadTime;
        if (typeof rt === 'object' && rt.min !== undefined) {
            this.reloadTimer = rt.min + Math.random() * (rt.max - rt.min);
            this.reloadTimeTotal = this.reloadTimer;
        } else {
            this.reloadTimer = rt;
            this.reloadTimeTotal = rt;
        }
        if (this.isChamberedReload) {
            this.reloadTimer = Math.floor(this.reloadTimer * 0.55);
            this.reloadTimeTotal = this.reloadTimer;
        }
        if (this.justEmptied && this.config.canChamberedReload === true) {
            this.reloadTimer = Math.floor(this.reloadTimer * 0.7);
            this.reloadTimeTotal = this.reloadTimer;
        }
        this.justEmptied = false;
    }

    updateReload() {
        if (!this.isReloading) return;
        this.reloadTimer--;
        if (this.reloadTimer <= 0) {
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

    getReloadProgress() {
        if (!this.isReloading) return 1;
        const rt = this.config.reloadTime;
        const total = this.reloadTimeTotal || (rt && rt.max) || rt || 1;
        return 1 - (this.reloadTimer / total);
    }

    // 射击时增加后坐力和散布
    applyRecoilAndSpread() {
        const recoil = this.config.recoil;
        const spread = this.config.spread;
        // 三连发模式：完全不增加后坐力和散布（三发子弹完全重合）
        const isBurstMode = this.config.fireMode === 'burst';
        if (!isBurstMode) {
            if (recoil) {
                this.currentRecoil = Math.min(this.currentRecoil + recoil.maxAngle * 0.5, recoil.maxAngle);
            }
            if (spread) {
                this.currentSpread = Math.min(this.currentSpread + spread.increase, spread.max);
                // 连续开火散布递增（三连发不算）
                this.consecutiveShots++;
                const sustained = this.config.sustainedFire;
                if (sustained && this.consecutiveShots > sustained.threshold) {
                    const bonus = (this.consecutiveShots - sustained.threshold) * sustained.bonusPerShot;
                    this.currentSpread = Math.min(this.currentSpread + bonus, spread.max);
                }
            }
        }
    }

    // 每帧恢复后坐力和散布
    updateRecoilAndSpread() {
        const recoil = this.config.recoil;
        const spread = this.config.spread;
        if (recoil && this.currentRecoil > 0) {
            this.currentRecoil = Math.max(0, this.currentRecoil - recoil.recoverySpeed);
        }
        if (spread && this.currentSpread > spread.base) {
            this.currentSpread = Math.max(spread.base, this.currentSpread - spread.recovery);
            // 停止射击时递减连续计数
            if (this.consecutiveShots > 0) {
                this.consecutiveShots--;
            }
        }
    }

    // 获取射击角度偏移（后坐力 + 随机散布）
    getShotAngleOffset() {
        // 三连射模式：使用较小的固定散布，三发子弹紧密但非完全一个点
        const isBurstMode = this.config.fireMode === 'burst';
        if (isBurstMode) {
            const spread = this.config.spread;
            const burstSpread = spread ? spread.base * 0.5 : 0.01;
            return (Math.random() - 0.5) * 2 * burstSpread;
        }
        const spread = this.config.spread;
        const spreadOffset = (Math.random() - 0.5) * 2 * this.currentSpread;
        const recoilOffset = -this.currentRecoil * (0.5 + Math.random() * 0.5);
        return spreadOffset + recoilOffset;
    }

    clone() {
        return new Weapon(this.id);
    }
}
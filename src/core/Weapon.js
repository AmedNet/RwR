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
        // 堆叠计数（火箭筒等一次性武器）
        this.stackCount = config.maxStack ? 1 : 0;
        // AI无限备弹标记（枪械类AI武器换弹自动补满，不需要捡弹药包）
        this.isInfiniteAmmo = false;
    }

    canShoot() {
        // 换弹期间：支持空仓挂机的武器且有弹药时可以开火一次
        if (this.isReloading) {
            if (this.isChamberedReload && this.ammo > 0 && !this.firedDuringReload) {
                return true;
            }
            return false;
        }
        if (this.config.type === 'melee') return true;
        // 火箭筒检查堆叠数
        // 火箭筒检查堆叠数（XM320等无堆叠的launcher除外）
        if (this.config.type === 'launcher' && this.config.maxStack) {
            return this.stackCount > 0 && this.ammo > 0;
        }
        return this.ammo > 0;
    }

    consumeAmmo() {
        if (this.config.type === 'melee') return;
        if (this.ammo > 0) this.ammo--;
        if (this.ammo === 0) this.justEmptied = true;
        // 换弹期间开火：标记并取消空仓挂机的额外弹药
        if (this.isReloading && this.isChamberedReload) {
            this.firedDuringReload = true;
            this.isChamberedReload = false;
        }
    }

    // 堆叠武器：增加持有数量
    addStack(count = 1) {
        if (!this.config.maxStack) return;
        this.stackCount = Math.min(this.stackCount + count, this.config.maxStack);
    }

    // 堆叠武器：消耗一个（射击后调用）
    consumeStack() {
        if (this.stackCount > 0) this.stackCount--;
    }

    clearJustEmptied() {
        this.justEmptied = false;
        return true;
    }

    startReload() {
        // 近战、医疗用品、手雷不能换弹
        if (this.config.type === 'melee') return false;
        if (this.config.type === 'medical') return false;
        if (this.config.type === 'grenade') return false;
        if (this.isReloading) return false;
        this.firedDuringReload = false;
        // 火箭筒（有堆叠机制的）：有备弹才能换弹
        if (this.config.type === 'launcher' && this.config.maxStack) {
            if (this.ammo > 0) return false; // 弹膛还有弹，不需要换
            if (this.stackCount <= 0) return false; // 没有备弹
            this.isReloading = true;
            const rt = this.config.reloadTime;
            if (typeof rt === 'object' && rt.min !== undefined) {
                this.reloadTimer = rt.min + Math.random() * (rt.max - rt.min);
            } else {
                this.reloadTimer = rt || 60;
            }
            this.reloadTimeTotal = this.reloadTimer;
            return true;
        }
        if (this.ammo >= this.config.magSize) return false;
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
        return true;
    }

    updateReload() {
        if (!this.isReloading) return;
        this.reloadTimer--;
        if (this.reloadTimer <= 0) {
            if (this.config.type === 'launcher' && this.config.maxStack) {
                // 火箭筒：从堆叠取1发装填
                if (this.stackCount > 0) {
                    this.ammo = 1;
                }
            } else if (this.isChamberedReload) {
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
        // 三连发模式：仍然有视觉后坐力，但不累积散布（三发子弹紧密）
        const isBurstMode = this.config.fireMode === 'burst';
        // 后坐力：所有模式都应用
        if (recoil) {
            this.currentRecoil = Math.min(this.currentRecoil + recoil.maxAngle * 0.5, recoil.maxAngle);
        }
        // 散布：三连发模式不累积
        if (!isBurstMode && spread) {
            this.currentSpread = Math.min(this.currentSpread + spread.increase, spread.max);
            // 连续开火散布递增
            this.consecutiveShots++;
            const sustained = this.config.sustainedFire;
            if (sustained && this.consecutiveShots > sustained.threshold) {
                const bonus = (this.consecutiveShots - sustained.threshold) * sustained.bonusPerShot;
                this.currentSpread = Math.min(this.currentSpread + bonus, spread.max);
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
        // 三连射模式：每发有不同的偏移，弹着点分散但仍在可控范围
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
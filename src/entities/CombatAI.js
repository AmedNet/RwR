// src/entities/CombatAI.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { Terrain } from '../core/Map.js';
import { Bullet } from './Bullet.js';
import { MovementSystem } from '../utils/MovementSystem.js';
import { WeaponPickup } from './WeaponPickup.js';
import { Grenade } from './Grenade.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import * as SoundManager from '../utils/SoundManager.js';
import { WEAPON_VALUE, evaluateWeaponChoice } from '../utils/WeaponAI.js';

export class CombatAI extends Entity {
    constructor(x, y, entityConfig, aiConfig) {
        super(x, y, entityConfig);
        this.faction = aiConfig.faction;
        this.bulletIsEnemy = aiConfig.bulletIsEnemy;
        this.color = aiConfig.color;
        this.damage = aiConfig.damage || entityConfig.damage || 15;
        this.shootCooldown = 0;
        this.shootDelay = aiConfig.shootDelay || entityConfig.shootDelay || 25;
        this.bulletSpeed = aiConfig.bulletSpeed || entityConfig.bulletSpeed || 6;
        this.role = Math.random() < 0.25 ? 0 : (Math.random() < 0.7 ? 1 : 2);
        this.guardPoint = this.assignGuardPoint();
        this.patrolAngle = Math.random() * Math.PI * 2;
        this.patrolTimer = Math.random() * 1000;
        this.patrolRadius = 120 + Math.random() * 80;
        this.wanderTarget = null;
        this.wanderTimer = 0;
        this.stuckState = { timer: 0, lastX: x, lastY: y, fallbackPoints: null };
        this.weapons = [null, null, null, null];
        this.activeWeaponSlot = 1;
        this.weaponImages = {};
        this.weaponImagesLoaded = {};
        this.reloadImages = {};
        this.reloadImagesLoaded = {};
    }

    setWeapons(weapons) {
        this.weapons = weapons;
        this.activeWeaponSlot = 1;
        for (const w of this.weapons) {
            if (w && w.config && w.config.imagePath) {
                this.loadWeaponImage(w.id, w.config.imagePath, w.config.reloadImagePath);
            }
        }
    }

    loadWeaponImage(weaponId, imagePath, reloadImagePath) {
        if (this.weaponImagesLoaded[weaponId] !== undefined) return;
        const img = new Image();
        img.src = imagePath;
        this.weaponImages[weaponId] = img;
        this.weaponImagesLoaded[weaponId] = false;
        img.onload = () => { this.weaponImagesLoaded[weaponId] = true; };
        if (reloadImagePath) {
            const reloadImg = new Image();
            reloadImg.src = reloadImagePath;
            this.reloadImages[weaponId] = reloadImg;
            this.reloadImagesLoaded[weaponId] = false;
            reloadImg.onload = () => { this.reloadImagesLoaded[weaponId] = true; };
        }
    }

    getWeaponImage(weaponId, isReloading = false) {
        if (isReloading && this.reloadImagesLoaded[weaponId]) return this.reloadImages[weaponId];
        if (this.weaponImagesLoaded[weaponId]) return this.weaponImages[weaponId];
        return null;
    }

    getActiveWeapon() {
        return this.weapons[this.activeWeaponSlot];
    }

    findAccessorySlot(type) {
        for (let i = 2; i <= 3; i++) {
            if (this.weapons[i] && this.weapons[i].config.type === type) return i;
        }
        return -1;
    }

    getAllies() {
        return this.faction === 'enemy' ? GameState.enemies : GameState.teammates;
    }

    getTargets() {
        if (this.faction === 'enemy') {
            const targets = [];
            if (GameState.player && GameState.player.alive) targets.push(GameState.player);
            for (const teammate of GameState.teammates) {
                if (teammate.alive) targets.push(teammate);
            }
            return targets;
        }
        return GameState.enemies.filter(enemy => enemy.alive);
    }

    getOwnPoints() {
        return GameState.capturePoints.filter(point => point.owner === this.faction);
    }

    getTargetPoints() {
        return GameState.capturePoints.filter(point => point.owner !== this.faction);
    }

    assignGuardPoint() {
        const points = this.getOwnPoints();
        if (points.length === 0) return null;
        return points[Math.floor(Math.random() * points.length)];
    }

    isPointSafe() {
        if (!this.guardPoint) return false;
        for (const target of this.getTargets()) {
            if (!target.alive) continue;
            if (Math.hypot(target.x - this.guardPoint.x, target.y - this.guardPoint.y) < 350) {
                return false;
            }
        }
        return true;
    }

    countGuardDefenders() {
        if (!this.guardPoint) return 0;
        let count = 0;
        for (const ally of this.getAllies()) {
            if (ally.alive && ally.role === 0 && ally.guardPoint === this.guardPoint) count++;
        }
        return count;
    }

    updateRole() {
        const ownPoints = this.getOwnPoints();
        const targetPoints = this.getTargetPoints();
        if (this.role !== 0) return;

        if (!this.guardPoint || targetPoints.length === 0 || ownPoints.length <= 1) {
            this.role = Math.random() < 0.8 ? 1 : 2;
            this.guardPoint = null;
            return;
        }

        if (this.isPointSafe() && this.countGuardDefenders() > 2) {
            this.role = Math.random() < 0.8 ? 1 : 2;
            this.guardPoint = null;
            return;
        }

        if (ownPoints.length > targetPoints.length + 1 && Math.random() < 0.005) {
            this.role = 1;
            this.guardPoint = null;
        }
    }

    getClosestTarget() {
        let target = null;
        let distance = Infinity;
        const awarenessRange = this.getAwarenessRange();
        for (const candidate of this.getTargets()) {
            if (!candidate.alive) continue;
            const d = Math.hypot(candidate.x - this.x, candidate.y - this.y);
            if (d > awarenessRange) continue;
            if (d < distance) {
                target = candidate;
                distance = d;
            }
        }
        return { target, distance };
    }

    getAwarenessRange() {
        const weapon = this.getActiveWeapon();
        if (!weapon) return 550;
        if (weapon.config.type === 'sniper') return 850;
        if (weapon.config.type === 'rifle' || weapon.config.type === 'launcher') return 700;
        if (weapon.config.type === 'smg') return 550;
        return 500;
    }

    hasLineOfSight(target) {
        return this.hasLineBetween(this, target);
    }

    hasLineBetween(from, to) {
        const map = GameState.map;
        if (!map || !from || !to) return true;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.max(10, map.tileSize * 0.35);
        const steps = Math.max(1, Math.ceil(dist / step));
        for (let i = 1; i < steps; i++) {
            const x = from.x + dx * (i / steps);
            const y = from.y + dy * (i / steps);
            const { col, row } = map.worldToTile(x, y);
            const tile = map.getTile(col, row);
            if (tile === Terrain.HOUSE || tile === Terrain.MOUNTAIN || tile === -1) return false;
        }
        return true;
    }

    getClosestEnemy() {
        return this.getClosestTarget();
    }

    getClosestTargetPoint() {
        let target = null;
        let distance = Infinity;
        for (const point of this.getTargetPoints()) {
            let nearbyAllies = 0;
            for (const ally of this.getAllies()) {
                if (ally !== this && ally.alive && Math.hypot(ally.x - point.x, ally.y - point.y) < 200) {
                    nearbyAllies++;
                }
            }
            const effectiveDist = Math.hypot(point.x - this.x, point.y - this.y) + nearbyAllies * 150;
            if (effectiveDist < distance) {
                target = point;
                distance = effectiveDist;
            }
        }
        return { target, distance };
    }

    getClosestEnemyPoint() {
        return this.getClosestTargetPoint();
    }

    countNearbyEnemies(target, radius) {
        if (!target) return 0;
        let count = 0;
        for (const candidate of this.getTargets()) {
            if (candidate.alive && Math.hypot(candidate.x - target.x, candidate.y - target.y) < radius) {
                count++;
            }
        }
        return count;
    }

    pickWanderTarget() {
        const world = GameState.config.world;
        const map = GameState.map;
        for (let i = 0; i < 20; i++) {
            const x = 200 + Math.random() * (world.width - 400);
            const y = 200 + Math.random() * (world.height - 400);
            if (!map || map.isWalkable(x, y, this.radius)) return { x, y };
        }
        return { x: world.width / 2, y: world.height / 2 };
    }

    switchWeaponBasedOnCombat(closestTarget, closestDist) {
        if (this.health < this.maxHealth * 0.7) {
            const medicalSlot = this.findAccessorySlot('medical');
            if (medicalSlot >= 0 && this.weapons[medicalSlot] && this.weapons[medicalSlot].canShoot()) {
                if (!closestTarget || closestDist > 300) {
                    this.activeWeaponSlot = medicalSlot;
                    return;
                }
            }
        }
        evaluateWeaponChoice(this, closestDist, closestTarget);
    }

    update() {
        if (GameState.gameOver || !this.alive) return;
        this.savePrevPosition();
        this.updateRole();

        const { target: closestTarget, distance: closestDist } = this.getClosestTarget();
        const { target: captureTarget } = this.getClosestTargetPoint();
        const targetMove = this.chooseMoveTarget(closestTarget, closestDist, captureTarget);

        if (targetMove) {
            const moveTarget = this.getMoveTargetAroundObstacles(targetMove);
            MovementSystem.moveToward(this, moveTarget.x, moveTarget.y, this.stuckState);
        }

        if (closestTarget) this.switchWeaponBasedOnCombat(closestTarget, closestDist);

        const weapon = this.getActiveWeapon();
        if (weapon) {
            weapon.updateReload();
            weapon.updateRecoilAndSpread();
        }

        if (weapon && weapon.ammo === 0 && !weapon.isReloading && weapon.config.type !== 'melee') {
            if (weapon.isInfiniteAmmo || weapon.config.type !== 'launcher') {
                weapon.startReload();
                if (weapon.isInfiniteAmmo) SoundManager.playReload(weapon.config.type, this);
            }
        }

        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        } else if (weapon) {
            if (weapon.config.type === 'medical' && this.health < this.maxHealth) {
                this.fireWeapon(weapon, null, 0);
            } else if (closestTarget && closestDist < this.getEngageRange(weapon) && this.canFireAt(weapon, closestTarget)) {
                this.fireWeapon(weapon, closestTarget, closestDist);
            }
        }

        this.tryPickupWeapon();
    }

    chooseMoveTarget(closestTarget, closestDist, captureTarget) {
        if (this.role === 0) {
            if (!this.guardPoint) {
                this.role = 1;
            } else {
                this.stuckState.fallbackPoints = [this.guardPoint];
                const distToPoint = Math.hypot(this.guardPoint.x - this.x, this.guardPoint.y - this.y);
                const guardRadius = 180;
                const pointSafe = this.isPointSafe();

                if (closestTarget && closestDist < guardRadius + 100) {
                    return { x: this.guardPoint.x, y: this.guardPoint.y };
                }
                if (pointSafe && closestTarget && closestDist < 550) {
                    if (!this.hasLineOfSight(closestTarget)) return this.getFlankPosition(closestTarget);
                    return this.getCombatPosition(closestTarget, 180);
                }
                if (distToPoint > guardRadius) {
                    return { x: this.guardPoint.x, y: this.guardPoint.y };
                }

                this.patrolTimer++;
                const forwardAngle = captureTarget
                    ? Math.atan2(captureTarget.y - this.guardPoint.y, captureTarget.x - this.guardPoint.x)
                    : this.patrolAngle;
                const patrolAngle = forwardAngle + Math.sin(this.patrolTimer * 0.015 + this.x * 0.01) * Math.PI / 2;
                return {
                    x: this.guardPoint.x + Math.cos(patrolAngle) * 140,
                    y: this.guardPoint.y + Math.sin(patrolAngle) * 140
                };
            }
        }

        if (this.role === 1) {
            if (closestTarget && closestDist < 650) {
                if (!this.hasLineOfSight(closestTarget)) return this.getFlankPosition(closestTarget);
                return this.getCombatPosition(closestTarget, 180);
            }
            if (captureTarget) {
                this.stuckState.fallbackPoints = this.getTargetPoints();
                return { x: captureTarget.x, y: captureTarget.y };
            }
            if (closestTarget) return { x: closestTarget.x, y: closestTarget.y };
        }

        this.stuckState.fallbackPoints = this.getTargetPoints();
        if (closestTarget && closestDist < 500) {
            if (!this.hasLineOfSight(closestTarget)) return this.getFlankPosition(closestTarget);
            return this.getCombatPosition(closestTarget, 260, true);
        }

        this.wanderTimer++;
        if (this.wanderTimer > 180 || !this.wanderTarget) {
            if (captureTarget && Math.random() < 0.65) {
                this.wanderTarget = { x: captureTarget.x, y: captureTarget.y };
            } else {
                this.wanderTarget = this.pickWanderTarget();
            }
            this.wanderTimer = 0;
        }
        return this.wanderTarget;
    }

    getCombatPosition(target, distance, wide = false) {
        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        const side = wide ? Math.sin(Date.now() * 0.003 + this.y * 0.01) * Math.PI * 0.7
            : (Math.sin(this.shootCooldown * 0.1 + this.x * 0.01) > 0 ? Math.PI / 4 : -Math.PI / 4);
        const moveAngle = angle + side;
        return {
            x: target.x + Math.cos(moveAngle) * distance,
            y: target.y + Math.sin(moveAngle) * distance
        };
    }

    getFlankPosition(target) {
        const map = GameState.map;
        if (!map || !target) return this.getCombatPosition(target, 220, true);
        const baseAngle = Math.atan2(this.y - target.y, this.x - target.x);
        const candidates = [];
        for (const radius of [180, 240, 320]) {
            for (const offset of [Math.PI / 2, -Math.PI / 2, Math.PI / 3, -Math.PI / 3, Math.PI]) {
                const angle = baseAngle + offset;
                candidates.push({
                    x: target.x + Math.cos(angle) * radius,
                    y: target.y + Math.sin(angle) * radius
                });
            }
        }
        let best = null;
        let bestScore = Infinity;
        for (const point of candidates) {
            if (!map.isWalkable(point.x, point.y, this.radius)) continue;
            if (!this.hasLineBetween(point, target)) continue;
            const score = Math.hypot(point.x - this.x, point.y - this.y);
            if (score < bestScore) {
                best = point;
                bestScore = score;
            }
        }
        return best || this.getCombatPosition(target, 260, true);
    }

    getMoveTargetAroundObstacles(target) {
        const map = GameState.map;
        if (!map || this.hasLineBetween(this, target)) return target;

        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        const dist = Math.min(240, Math.max(100, Math.hypot(target.x - this.x, target.y - this.y) * 0.35));
        const candidates = [];
        for (const side of [1, -1]) {
            for (const offset of [Math.PI / 2, Math.PI / 3, Math.PI * 0.72]) {
                const a = angle + offset * side;
                candidates.push({ x: this.x + Math.cos(a) * dist, y: this.y + Math.sin(a) * dist });
            }
        }

        let best = null;
        let bestScore = Infinity;
        for (const point of candidates) {
            if (!map.isWalkable(point.x, point.y, this.radius)) continue;
            if (!this.hasLineBetween(this, point)) continue;
            const score = Math.hypot(point.x - target.x, point.y - target.y);
            if (score < bestScore) {
                best = point;
                bestScore = score;
            }
        }
        return best || target;
    }

    getEngageRange(weapon) {
        if (!weapon) return 0;
        if (weapon.config.type === 'melee') return weapon.config.range || 80;
        if (weapon.config.type === 'grenade') return weapon.config.range || 400;
        if (weapon.config.type === 'sniper') return 750;
        if (weapon.config.type === 'rifle') return 600;
        if (weapon.config.type === 'launcher') return 550;
        if (weapon.config.type === 'smg') return 450;
        if (weapon.config.type === 'shotgun') return Math.min(weapon.config.range || 250, 320);
        return 420;
    }

    canFireAt(weapon, target) {
        if (!target) return false;
        if (weapon.config.type === 'medical') return true;
        if (weapon.config.type === 'melee') return true;
        return this.hasLineOfSight(target);
    }

    predictTargetPosition(target, bulletSpeed) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        const travelTime = dist / bulletSpeed;
        let tvx = 0, tvy = 0;
        if (target.prevX !== undefined && target.prevY !== undefined) {
            tvx = target.x - target.prevX;
            tvy = target.y - target.prevY;
        }

        const predictionAccuracy = 0.35 + Math.random() * 0.4;
        let predictX = target.x + tvx * travelTime * predictionAccuracy;
        let predictY = target.y + tvy * travelTime * predictionAccuracy;
        const maxOffset = dist * 0.25;
        const offsetDist = Math.hypot(predictX - target.x, predictY - target.y);
        if (offsetDist > maxOffset) {
            const scale = maxOffset / offsetDist;
            predictX = target.x + (predictX - target.x) * scale;
            predictY = target.y + (predictY - target.y) * scale;
        }

        const errorRange = Math.min(14 + dist * 0.11, 70);
        predictX += (Math.random() - 0.5) * errorRange;
        predictY += (Math.random() - 0.5) * errorRange;
        return { x: predictX, y: predictY };
    }

    fireWeapon(weapon, target, dist) {
        const weaponType = weapon.config.type;

        if (weaponType === 'melee') {
            if (target && dist < (weapon.config.range || 80)) {
                target.takeDamage(weapon.config.damage, this.x, this.y);
                const angle = Math.atan2(target.y - this.y, target.x - this.x);
                target.x += Math.cos(angle) * (weapon.config.knockback || 10);
                target.y += Math.sin(angle) * (weapon.config.knockback || 10);
                SoundManager.playMelee(this);
                this.shootCooldown = weapon.config.shootDelay;
            }
            return;
        }

        if (weaponType === 'medical') {
            if (this.health < this.maxHealth) {
                const healAmount = weapon.config.healAmount || 30;
                this.health = Math.min(this.health + healAmount, this.maxHealth);
                weapon.consumeAmmo();
                if (weapon.ammo <= 0) this.weapons[this.activeWeaponSlot] = null;
                this.shootCooldown = 20;
            }
            return;
        }

        if (!target) return;

        if (weaponType === 'grenade') {
            if (dist < (weapon.config.range || 400)) {
                GameState.grenades.push(new Grenade(this.x, this.y, target.x, target.y, weapon.config));
                weapon.consumeAmmo();
                if (weapon.ammo <= 0) this.weapons[this.activeWeaponSlot] = null;
                this.shootCooldown = 30;
            }
            return;
        }

        if (!weapon.canShoot()) return;
        const speed = weapon.config.bulletSpeed || this.bulletSpeed;
        const predicted = this.predictTargetPosition(target, speed);
        const angle = Math.atan2(predicted.y - this.y, predicted.x - this.x);
        const baseAngle = angle + weapon.getShotAngleOffset();

        if (weaponType === 'shotgun') {
            const pellets = weapon.config.pellets || 8;
            const spreadAngle = weapon.config.spreadAngle || 0.35;
            for (let i = 0; i < pellets; i++) {
                const pelletAngle = baseAngle + (Math.random() - 0.5) * spreadAngle;
                this.spawnBullet(pelletAngle, speed, weapon, weapon.config.range || 250);
            }
        } else {
            this.spawnBullet(baseAngle, speed, weapon, null);
        }

        if (['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'launcher'].includes(weaponType)) {
            SoundManager.playShoot(weaponType, this);
        }

        weapon.consumeAmmo();
        weapon.applyRecoilAndSpread();
        this.shootCooldown = weapon.config.shootDelay;

        const noShellTypes = ['melee', 'grenade', 'medical', 'launcher'];
        if (!noShellTypes.includes(weaponType)) {
            const shellType = weapon.config.shellType || weaponType;
            EffectsManager.spawnShellCasing(this.x, this.y, shellType);
            SoundManager.playShellEject(shellType, this);
        }

        if (weaponType === 'launcher') {
            weapon.consumeStack();
            if (weapon.stackCount <= 0) this.weapons[this.activeWeaponSlot] = null;
        }
    }

    spawnBullet(angle, speed, weapon, maxRange) {
        const explosion = (weapon.config.explosionRadius && weapon.config.explosionDamage)
            ? { radius: weapon.config.explosionRadius, damage: weapon.config.explosionDamage }
            : null;
        const bulletRadiusMult = weapon.config.bulletRadiusMultiplier !== undefined
            ? weapon.config.bulletRadiusMultiplier : 0.6;
        GameState.bullets.push(new Bullet(
            this.x + Math.cos(angle) * this.radius,
            this.y + Math.sin(angle) * this.radius,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            this.bulletIsEnemy,
            weapon.config.damage,
            true,
            weapon.config.knockback || 0,
            GameState.config.bullet.radius * bulletRadiusMult,
            maxRange,
            weapon.config.penetration || null,
            explosion,
            weapon.config.hasTrail === true,
            weapon.config.bulletColor,
            weapon.config.bulletGlow,
            this
        ));
    }

    tryPickupWeapon() {
        for (let i = GameState.weaponPickups.length - 1; i >= 0; i--) {
            const pickup = GameState.weaponPickups[i];
            if (!pickup.alive || !pickup.canPickup(this)) continue;
            const pickupWeapon = pickup.weapon;
            const pickupType = pickupWeapon.config.type;
            const pickupValue = WEAPON_VALUE[pickupWeapon.id] || 0;
            let targetSlot = -1;
            if (pickupType === 'melee') {
                targetSlot = 0;
            } else if (['pistol', 'rifle', 'smg', 'shotgun', 'sniper'].includes(pickupType)) {
                targetSlot = 1;
            } else if (!this.weapons[2]) {
                targetSlot = 2;
            } else if (!this.weapons[3]) {
                targetSlot = 3;
            } else {
                const v2 = WEAPON_VALUE[this.weapons[2].id] || 0;
                const v3 = WEAPON_VALUE[this.weapons[3].id] || 0;
                if (pickupValue > v2 && pickupValue > v3) targetSlot = (v2 <= v3) ? 2 : 3;
                else if (pickupValue > v2) targetSlot = 2;
                else if (pickupValue > v3) targetSlot = 3;
            }

            if (targetSlot < 0) continue;
            const currentValue = WEAPON_VALUE[this.weapons[targetSlot] ? this.weapons[targetSlot].id : 'knife'] || 0;
            if (pickupValue <= currentValue && this.weapons[targetSlot] !== null) continue;

            const oldWeapon = this.weapons[targetSlot];
            this.weapons[targetSlot] = pickupWeapon;
            pickup.alive = false;
            if (oldWeapon && oldWeapon.id !== 'knife') {
                GameState.weaponPickups.push(new WeaponPickup(this.x, this.y, oldWeapon));
            }
            break;
        }
    }

    draw(ctx) {
        this.drawBody(ctx);
        this.drawWeapon(ctx);
    }

    drawBody(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = this.getRoleStroke();
        ctx.lineWidth = 3;
        ctx.stroke();
        this.drawHealthBar(ctx, -20, -25, 40, 5);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icons = ['◆', '▲', '●'];
        ctx.fillText(icons[this.role] || '✧', 0, 0);
        ctx.restore();
    }

    getRoleStroke() {
        if (this.role === 0) return '#FFD740';
        if (this.role === 1) return '#ff5252';
        return '#E040FB';
    }

    drawHealthBar(ctx, x, y, w, h) {
        const hpPercent = this.health / this.maxHealth;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : (hpPercent > 0.3 ? '#FFC107' : '#f44336');
        ctx.fillRect(x, y, w * hpPercent, h);
    }

    drawWeapon(ctx) {
        const weapon = this.getActiveWeapon();
        if (!weapon) return;
        const { target } = this.getClosestTarget();
        const weaponAngle = target ? Math.atan2(target.y - this.y, target.x - this.x) : Math.PI / 4;
        const weaponImage = this.getWeaponImage(weapon.id, weapon.isReloading);

        ctx.save();
        if (weaponImage) {
            const facingLeft = Math.cos(weaponAngle) < 0;
            const targetHeight = 40;
            const scale = targetHeight / weaponImage.naturalHeight;
            const drawW = weaponImage.naturalWidth * scale;
            const drawH = targetHeight;
            if (facingLeft) {
                ctx.scale(1, -1);
                ctx.rotate(-weaponAngle);
            } else {
                ctx.rotate(weaponAngle);
            }
            ctx.drawImage(weaponImage, -drawW * 0.15, -drawH / 2, drawW, drawH);
        } else {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(weaponAngle) * 25, Math.sin(weaponAngle) * 25);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        ctx.restore();
    }

    takeDamage(amount) {
        this.health -= amount;
        const distance = GameState.player ? Math.hypot(this.x - GameState.player.x, this.y - GameState.player.y) : 0;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            SoundManager.playDie(distance);
            this.dropWeaponOnDeath();
        } else {
            SoundManager.playHurt(distance);
        }
    }

    dropWeaponOnDeath() {
        if (Math.random() > 0.05) return;
        const dropSlots = [];
        for (let i = 1; i <= 3; i++) {
            if (this.weapons[i]) dropSlots.push(i);
        }
        if (dropSlots.length === 0) return;
        const slot = dropSlots[Math.floor(Math.random() * dropSlots.length)];
        const weapon = this.weapons[slot];
        if (weapon) {
            GameState.weaponPickups.push(new WeaponPickup(this.x, this.y, weapon));
            this.weapons[slot] = null;
        }
    }
}

// src/entities/CombatAI.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { Terrain } from '../core/Map.js';
import { Bullet } from './Bullet.js';
import { GrenadeBullet } from './GrenadeBullet.js';
import { MovementSystem } from '../utils/MovementSystem.js';
import { WeaponPickup } from './WeaponPickup.js';
import { Grenade } from './Grenade.js';
import { EffectsManager, ParticleType } from '../utils/EffectsManager.js';
import * as SoundManager from '../utils/SoundManager.js';
import { WEAPON_VALUE, evaluateWeaponChoice } from '../utils/WeaponAI.js';
import { SlowEffect, AmmoBuffEffect, HealAuraEffect, STATUS_EFFECT_CONFIG } from '../utils/StatusEffects.js';
import { AIRank, getRankConfig } from '../core/RankSystem.js';
import { UnitClass, getClassConfig } from '../core/ClassSystem.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { rollLoot } from '../core/LootRegistry.js';
import { LootPickup } from './LootPickup.js';
import { rollHelmet, rollHelmetVariant, getHelmetConfig, getHelmetVariantImagePath, HelmetTier } from '../core/HelmetSystem.js';

export class CombatAI extends Entity {
    // AI 角色常量
    static ROLE_GUARD = 0;
    static ROLE_ATTACK = 1;
    static ROLE_WANDER = 2;
    static GUARD_CHANCE = 0.25;
    static ATTACK_CHANCE = 0.7;
    static GUARD_SAFE_RADIUS = 350;
    static GUARD_DEFENDER_THRESHOLD = 2;
    static GUARD_RADIUS = 180;
    static GUARD_ENGAGE_RANGE = 550;
    static PATROL_OFFSET = 140;
    static PATROL_FREQ = 0.015;
    static ATTACK_ENGAGE_RANGE = 650;
    static WANDER_ENGAGE_RANGE = 500;
    static WANDER_INTERVAL = 180;
    static WANDER_CAPTURE_CHANCE = 0.65;
    static ROLE_SHIFT_CHANCE = 0.005;
    static ROLE_SHIFT_ATTACK_CHANCE = 0.8;
    // 感知/射程常量
    static DEFAULT_AWARENESS = 550;
    static MEDICAL_HEAL_THRESHOLD = 0.7;
    static MEDICAL_HEAL_RANGE = 300;
    // 移动/寻路常量
    static WANDER_MARGIN = 200;
    static WANDER_SEARCH_ATTEMPTS = 20;
    static FLANK_RADII = [180, 240, 320];
    static FLANK_OFFSETS = [Math.PI / 2, -Math.PI / 2, Math.PI / 3, -Math.PI / 3, Math.PI];
    static MOVE_TARGET_CACHE_FRAMES = 10;
    static MOVE_TARGET_REPLAN_DISTANCE = 70;
    static MOVE_TARGET_REACHED_DISTANCE = 24;
    static OBSTACLE_DIST_MIN = 100;
    static OBSTACLE_DIST_MAX = 240;
    static OBSTACLE_DIST_FACTOR = 0.35;
    static OBSTACLE_CACHE_FRAMES = 24;
    static OBSTACLE_CACHE_REPLAN_DISTANCE = 90;
    // 武器/射击常量
    static WEAPON_DRAW_HEIGHT = 40;
    static MELEE_LINE_LENGTH = 25;
    static MELEE_LINE_WIDTH = 4;
    static DROP_CHANCE = 0.05;
    // 军衔系统常量
    static RECRUIT_RANGE = 300;
    static RECRUIT_CHECK_INTERVAL = 60;
    static FOLLOW_DISTANCE = 80;
    // 瞄准延迟常量（帧数）
    static AIM_DELAY = {
        sniper: 75,      // 狙击枪：1.25秒
        rifle: 25,       // 步枪：0.4秒
        shotgun: 15,     // 霰弹枪：0.25秒
        smg: 12,         // 冲锋枪：0.2秒
        pistol: 15,      // 手枪：0.25秒
        launcher: 40,    // 火箭筒：0.67秒
        default: 20      // 默认：0.33秒
    };
    // 载具射击范围
    static VEHICLE_ENGAGE_RANGE = 500;

    constructor(x, y, entityConfig, aiConfig) {
        super(x, y, entityConfig);
        this.faction = aiConfig.faction;
        this.bulletIsEnemy = aiConfig.bulletIsEnemy;
        this.color = aiConfig.color;
        this.damage = aiConfig.damage || entityConfig.damage || 15;
        this.shootCooldown = 0;
        this.shootDelay = aiConfig.shootDelay || entityConfig.shootDelay || 25;
        this.bulletSpeed = aiConfig.bulletSpeed || entityConfig.bulletSpeed || 6;
        this.role = Math.random() < CombatAI.GUARD_CHANCE ? CombatAI.ROLE_GUARD
            : (Math.random() < CombatAI.ATTACK_CHANCE ? CombatAI.ROLE_ATTACK : CombatAI.ROLE_WANDER);
        this.guardPoint = this.assignGuardPoint();
        this.patrolAngle = Math.random() * Math.PI * 2;
        this.patrolTimer = Math.random() * 1000;
        this.patrolRadius = 120 + Math.random() * 80;
        this.wanderTarget = null;
        this.wanderTimer = 0;
        this.stuckState = { timer: 0, lastX: x, lastY: y, fallbackPoints: null };
        this.moveTargetCache = { point: null, timer: 0 };
        this.obstacleTargetCache = { point: null, original: null, timer: 0 };
        this.cycleTimer = Math.random() * 1000;
        this.weapons = [null, null, null, null];
        this.activeWeaponSlot = 1;
        this.weaponImages = {};
        // 头盔贴图
        this.loadHelmetImage();
        this.weaponImagesLoaded = {};
        this.reloadImages = {};
        this.reloadImagesLoaded = {};
        this.dying = false;
        this.deathTimer = 0;
        this.healSwitchTimer = 0;
        // 军衔系统
        this.rank = AIRank.PRIVATE;
        this.subordinates = [];
        this.leader = null;
        this.recruitTimer = 0;
        // 兵种系统
        this.unitClass = UnitClass.NORMAL;
        this.healTimer = 0;
        // 瞄准系统
        this.aimTimer = 0;
        this.currentAimTarget = null;
        // 龙卷风伤害累积
        this.tornadoDamageAccumulator = 0;
        this.tornadoDamageTimer = 0;
        // 移动方向记录（用于头盔镜像）
        this._prevX = x;       // 上一帧X坐标（用于头盔镜像）
        this._lastMoveDir = 1;  // 1=右, -1=左
        // 头盔系统
        this.helmet = HelmetTier.NONE;
        this.helmetVariant = 0;
        // 载具射击冷却
        this._vehicleAimTimer = 0;
        this._vehicleTarget = null;
    }

    // ─── 军衔系统方法 ───

    setRank(rank) {
        this.rank = rank;
        const config = getRankConfig(rank);
        this.maxHealth = Math.floor(this.maxHealth * config.healthMultiplier);
        this.health = this.maxHealth;
        this.damage = Math.floor(this.damage * config.damageMultiplier);
    }

    setClass(unitClass) {
        this.unitClass = unitClass;
        const config = getClassConfig(unitClass);
        this.maxHealth = Math.floor(this.maxHealth * config.healthMultiplier);
        this.health = this.maxHealth;
        this.damage = Math.floor(this.damage * config.damageMultiplier);
        this.speed = this.speed * config.speedMultiplier;
    }

    // 头盔系统
    setHelmet(rank) {
        this.helmet = rollHelmet(rank);
        this.helmetVariant = rollHelmetVariant(this.helmet);
    }

    hasHelmet() {
        return this.helmet !== HelmetTier.NONE;
    }

    // 弹药兵：给附近队友施加弹药补给增益
    applyAmmoBuffToAllies() {
        if (this.unitClass !== UnitClass.AMMO) return;
        const config = getClassConfig(UnitClass.AMMO);
        const auraRange = config.auraRange || 200;
        const allies = this.getAllies();
        for (const ally of allies) {
            if (ally === this || !ally.alive) continue;
            const dist = Math.hypot(ally.x - this.x, ally.y - this.y);
            if (dist <= auraRange) {
                ally.addStatusEffect(new AmmoBuffEffect(30));
            }
        }
        // 友军弹药兵也给玩家施加增益
        if (this.faction === 'player' && GameState.player && GameState.player.alive) {
            const dist = Math.hypot(GameState.player.x - this.x, GameState.player.y - this.y);
            if (dist <= auraRange) {
                GameState.player.addStatusEffect(new AmmoBuffEffect(30));
            }
        }
    }

    // 检查是否有弹药补给增益
    hasAmmoBuff() {
        return this.hasStatusEffect('ammoBuff');
    }

    // 医疗兵：给附近队友施加医疗光环
    applyHealAuraToAllies() {
        if (this.unitClass !== UnitClass.MEDIC) return;
        const config = getClassConfig(UnitClass.MEDIC);
        const auraRange = config.healAuraRange || 200;
        const allies = this.getAllies();
        for (const ally of allies) {
            if (ally === this || !ally.alive) continue;
            const dist = Math.hypot(ally.x - this.x, ally.y - this.y);
            if (dist <= auraRange) {
                ally.addStatusEffect(new HealAuraEffect(30));
            }
        }
        // 友军医疗兵也给玩家施加光环
        if (this.faction === 'player' && GameState.player && GameState.player.alive) {
            const dist = Math.hypot(GameState.player.x - this.x, GameState.player.y - this.y);
            if (dist <= auraRange) {
                GameState.player.addStatusEffect(new HealAuraEffect(30));
            }
        }
    }

    tryHealAllies() {
        if (this.unitClass !== UnitClass.MEDIC) return;
        const config = getClassConfig(UnitClass.MEDIC);
        if (this.healTimer > 0) {
            this.healTimer--;
            return;
        }
        const allies = this.getAllies();
        let closestAlly = null;
        let closestDist = Infinity;
        for (const ally of allies) {
            if (ally === this || !ally.alive) continue;
            if (ally.health >= ally.maxHealth) continue;
            const dist = Math.hypot(ally.x - this.x, ally.y - this.y);
            if (dist > config.healRange) continue;
            if (dist < closestDist) {
                closestAlly = ally;
                closestDist = dist;
            }
        }
        // 友军医疗兵也检查玩家
        if (this.faction === 'player' && GameState.player && GameState.player.alive) {
            if (GameState.player.health < GameState.player.maxHealth) {
                const dist = Math.hypot(GameState.player.x - this.x, GameState.player.y - this.y);
                if (dist <= config.healRange && dist < closestDist) {
                    closestAlly = GameState.player;
                    closestDist = dist;
                }
            }
        }
        if (closestAlly) {
            closestAlly.health = Math.min(closestAlly.health + config.healAmount, closestAlly.maxHealth);
            this.healTimer = config.healCooldown;
            EffectsManager.spawnParticles(closestAlly.x, closestAlly.y, ParticleType.HEAL, 5);
        }
    }

    hasLeader() {
        return this.leader !== null && this.leader.alive;
    }

    setLeader(leader) {
        this.leader = leader;
    }

    tryRecruitSubordinates() {
        const config = getRankConfig(this.rank);
        if (config.maxSubordinates === 0) return;
        this.subordinates = this.subordinates.filter(s => s.alive);
        if (this.subordinates.length >= config.maxSubordinates) return;
        this.recruitTimer++;
        if (this.recruitTimer < CombatAI.RECRUIT_CHECK_INTERVAL) return;
        this.recruitTimer = 0;
        const allies = this.getAllies();
        for (const ally of allies) {
            if (this.subordinates.length >= config.maxSubordinates) break;
            if (ally === this || !ally.alive || ally.hasLeader()) continue;
            if (ally.rank >= this.rank) continue;
            const dist = Math.hypot(ally.x - this.x, ally.y - this.y);
            if (dist > CombatAI.RECRUIT_RANGE) continue;
            ally.setLeader(this);
            this.subordinates.push(ally);
        }
    }

    releaseSubordinates() {
        for (const sub of this.subordinates) {
            if (sub.alive) sub.leader = null;
        }
        this.subordinates = [];
    }

    getLeaderTarget() {
        if (!this.hasLeader()) return null;
        return { x: this.leader.x, y: this.leader.y };
    }

    // 获取武器瞄准延迟
    getAimDelay(weapon) {
        if (!weapon || !weapon.config) return CombatAI.AIM_DELAY.default;
        const type = weapon.config.type;
        return CombatAI.AIM_DELAY[type] || CombatAI.AIM_DELAY.default;
    }

    // 更新瞄准状态，返回是否可以射击
    updateAim(target) {
        // 目标改变或新目标，重置瞄准计时
        if (this.currentAimTarget !== target) {
            this.currentAimTarget = target;
            const weapon = this.getActiveWeapon();
            this.aimTimer = this.getAimDelay(weapon);
        }
        // 倒计时
        if (this.aimTimer > 0) {
            this.aimTimer--;
            return false;
        }
        return true;
    }

    updateVehicleAim(target) {
        // 载具中的瞄准逻辑，使用独立的计时器
        if (this._vehicleTarget !== target) {
            this._vehicleTarget = target;
            const weapon = this.getActiveWeapon();
            // 载具中瞄准更快（移动目标变化快）
            const delay = Math.floor(this.getAimDelay(weapon) * 0.5);
            this._vehicleAimTimer = delay;
        }
        if (this._vehicleAimTimer > 0) {
            this._vehicleAimTimer--;
            return false;
        }
        return true;
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

    // 加载所有头盔变体贴图
    loadHelmetImage() {
        this.helmetImages = {};
        this.helmetImagesLoaded = {};
        for (const tier of [HelmetTier.STEEL, HelmetTier.TITANIUM]) {
            const config = getHelmetConfig(tier);
            const variants = config.variants || [];
            this.helmetImages[tier] = [];
            this.helmetImagesLoaded[tier] = [];
            for (let i = 0; i < variants.length; i++) {
                const img = new Image();
                img.src = variants[i].imagePath;
                this.helmetImages[tier].push(img);
                this.helmetImagesLoaded[tier].push(false);
                img.onload = () => { this.helmetImagesLoaded[tier][i] = true; };
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
            if (Math.hypot(target.x - this.guardPoint.x, target.y - this.guardPoint.y) < CombatAI.GUARD_SAFE_RADIUS) {
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
        // 有长官的小弟不参与角色切换
        if (this.hasLeader()) return;
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
        let base = 550;
        if (weapon) {
            if (weapon.config.type === 'sniper') base = 850;
            else if (weapon.config.type === 'rifle' || weapon.config.type === 'launcher') base = 700;
            else if (weapon.config.type === 'smg') base = 550;
            else base = 500;
        }
        // 狙击手兵种加成
        if (this.unitClass === UnitClass.SNIPER) {
            base += getClassConfig(UnitClass.SNIPER).awarenessBonus || 300;
        }
        // 天气感知倍率
        const weatherAwareness = WeatherSystem.getAwarenessMultiplier();
        return base * weatherAwareness;
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
        for (let i = 0; i < CombatAI.WANDER_SEARCH_ATTEMPTS; i++) {
            const x = CombatAI.WANDER_MARGIN + Math.random() * (world.width - CombatAI.WANDER_MARGIN * 2);
            const y = CombatAI.WANDER_MARGIN + Math.random() * (world.height - CombatAI.WANDER_MARGIN * 2);
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

    // ─── 载具战斗方法 ───

    /**
     * 在载具中更新AI战斗逻辑（由Vehicle.updatePassengers调用）
     * @param {import('./Vehicle.js').Vehicle} vehicle
     */
    updateVehicleCombat(vehicle) {
        if (!vehicle || !vehicle.alive || !this.alive) return;

        // 更新座位置（使用座位世界坐标）
        const seatPos = vehicle.getSeatWorldPosition(this.vehicleSeat);
        this.x = seatPos.x;
        this.y = seatPos.y;

        // 更新武器相关
        this.updateStatusEffects();
        const weapon = this.getActiveWeapon();
        if (weapon) {
            weapon.updateReload();
            weapon.updateRecoilAndSpread();
        }

        // 自动换弹
        if (weapon && weapon.ammo === 0 && !weapon.isReloading && weapon.config.type !== 'melee') {
            if (weapon.isInfiniteAmmo || weapon.config.type !== 'launcher') {
                weapon.startReload();
                if (weapon.isInfiniteAmmo) SoundManager.playReload(weapon.config.type, this);
            }
        }

        // 寻找最近的敌人
        let closestTarget = null;
        let closestDist = Infinity;
        const engageRange = CombatAI.VEHICLE_ENGAGE_RANGE;
        for (const target of this.getTargets()) {
            if (!target.alive) continue;
            const d = Math.hypot(target.x - this.x, target.y - this.y);
            if (d < engageRange && d < closestDist) {
                if (this.hasLineBetween({ x: this.x, y: this.y }, target)) {
                    closestTarget = target;
                    closestDist = d;
                }
            }
        }

        if (!weapon || !closestTarget) return;

        // 武器选择（在载具中只使用主武器槽1）
        if (this.activeWeaponSlot !== 1 && this.weapons[1]) {
            this.activeWeaponSlot = 1;
        }

        // 射击冷却和瞄准
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        } else if (this.updateVehicleAim(closestTarget)) {
            // 载具中的射击方向——从座位指向目标
            const angle = Math.atan2(closestTarget.y - this.y, closestTarget.x - this.x);
            const speed = weapon.config.bulletSpeed || this.bulletSpeed;
            const predicted = this.predictTargetPosition(closestTarget, speed);
            const fireAngle = Math.atan2(predicted.y - this.y, predicted.x - this.x);
            const angleOffset = weapon.getShotAngleOffset();

            if (weapon.config.type === 'shotgun') {
                const pellets = weapon.config.pellets || 8;
                const spreadAngle = weapon.config.spreadAngle || 0.35;
                for (let i = 0; i < pellets; i++) {
                    const pelletAngle = fireAngle + (Math.random() - 0.5) * spreadAngle + angleOffset;
                    this.spawnBullet(pelletAngle, speed, weapon, weapon.config.range || 250);
                }
            } else if (weapon.config.arcRange) {
                GameState.bullets.push(new GrenadeBullet(
                    this.x, this.y,
                    predicted.x, predicted.y,
                    weapon.config,
                    this
                ));
            } else {
                this.spawnBullet(fireAngle + angleOffset, speed, weapon, null);
            }

            // 播放枪声和枪口火焰
            const weaponType = weapon.config.type;
            if (['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'launcher'].includes(weaponType)) {
                SoundManager.playShoot(weaponType, this);
                EffectsManager.spawnMuzzleFlash(this.x, this.y, fireAngle, weaponType);
            }

            weapon.consumeAmmo();
            weapon.applyRecoilAndSpread();
            this.shootCooldown = weapon.config.shootDelay;

            // 抛壳
            const noShellTypes = ['melee', 'grenade', 'medical', 'launcher'];
            if (!noShellTypes.includes(weaponType)) {
                EffectsManager.spawnShellCasing(this.x, this.y, weaponType);
                SoundManager.playShellEject(weaponType, this);
            }
        }
    }

    update() {
        if (this.dying) {
            this.deathTimer--;
            if (this.deathTimer <= 0) this.alive = false;
            return;
        }
        if (!this.alive) return;
        if (this.mountedVehicle) {
            this.x = this.mountedVehicle.x;
            this.y = this.mountedVehicle.y;
            return;
        }
        this.updateStatusEffects();
        this.savePrevPosition();

        // 龙卷风伤害（getTornadoDamage 返回每秒伤害，除以 60 转为每帧）
        const tornadoDmg = WeatherSystem.getTornadoDamage(this.x, this.y);
        if (tornadoDmg > 0) {
            this.tornadoDamageAccumulator += tornadoDmg / 60;
            this.tornadoDamageTimer++;
            if (this.tornadoDamageTimer >= 30) {
                this.takeDamage(this.tornadoDamageAccumulator);
                this.tornadoDamageAccumulator = 0;
                this.tornadoDamageTimer = 0;
            }
        } else {
            this.tornadoDamageAccumulator = 0;
            this.tornadoDamageTimer = 0;
        }
        // 军衔召集逻辑
        if (this.rank > AIRank.PRIVATE) {
            this.tryRecruitSubordinates();
        }
        // 医疗兵治疗友军
        this.tryHealAllies();
        // 医疗兵光环效果
        this.applyHealAuraToAllies();
        // 弹药兵给附近队友施加增益
        this.applyAmmoBuffToAllies();
        this.updateRole();

        if (this.healSwitchTimer > 0) {
            this.healSwitchTimer--;
            if (this.healSwitchTimer === 0 && this.weapons[1]) {
                this.activeWeaponSlot = 1;
            }
        }
        const { target: closestTarget, distance: closestDist } = this.getClosestTarget();
        const { target: captureTarget } = this.getClosestTargetPoint();
        const targetMove = this.chooseMoveTarget(closestTarget, closestDist, captureTarget);

        if (targetMove) {
            const stableTarget = this.stabilizeMoveTarget(targetMove);
            const moveTarget = this.getMoveTargetAroundObstacles(stableTarget);
            const originalSpeed = this.speed;
            this.speed *= this.getSpeedMultiplier();
            MovementSystem.moveToward(this, moveTarget.x, moveTarget.y, this.stuckState);
            this.speed = originalSpeed;
        } else {
            this.moveTargetCache.point = null;
            this.obstacleTargetCache.point = null;
        }

        if (closestTarget) this.switchWeaponBasedOnCombat(closestTarget, closestDist);

        const weapon = this.getActiveWeapon();
        // 弹药补给增益状态
        const ammoBuff = this.getStatusEffect('ammoBuff');
        if (weapon) {
            // 弹药补给增益：换弹速度加成
            const reloadMult = ammoBuff ? ammoBuff.getReloadSpeedMult() : 1.0;
            if (weapon.isReloading && reloadMult > 1.0) {
                weapon.reloadTimer -= (reloadMult - 1.0);
            }
            weapon.updateReload();
            weapon.updateRecoilAndSpread();
        }

        if (weapon && weapon.ammo === 0 && !weapon.isReloading && weapon.config.type !== 'melee') {
            if (weapon.isInfiniteAmmo || weapon.config.type !== 'launcher') {
                weapon.startReload();
                if (weapon.isInfiniteAmmo) SoundManager.playReload(weapon.config.type, this);
            }
        }

        // 弹药补给增益：射速加成
        const fireRateMult = ammoBuff ? ammoBuff.getFireRateMult() : 1.0;
        // 更新瞄准状态
        const canAimFire = closestTarget ? this.updateAim(closestTarget) : true;
        if (this.shootCooldown > 0) {
            this.shootCooldown -= fireRateMult;
        } else if (weapon && canAimFire) {
            if (weapon.config.type === 'medical' && this.health < this.maxHealth) {
                this.fireWeapon(weapon, null, 0);
            } else if (closestTarget && closestDist < this.getEngageRange(weapon) && this.canFireAt(weapon, closestTarget)) {
                this.fireWeapon(weapon, closestTarget, closestDist);
            }
        }

        this.cycleTimer++;
        this.tryPickupWeapon();
    }

    stabilizeMoveTarget(target) {
        const cache = this.moveTargetCache;
        const cached = cache.point;
        const shouldRefresh = !cached ||
            cache.timer <= 0 ||
            Math.hypot(target.x - cached.x, target.y - cached.y) > CombatAI.MOVE_TARGET_REPLAN_DISTANCE ||
            Math.hypot(this.x - cached.x, this.y - cached.y) < CombatAI.MOVE_TARGET_REACHED_DISTANCE;

        if (shouldRefresh) {
            cache.point = { x: target.x, y: target.y };
            cache.timer = CombatAI.MOVE_TARGET_CACHE_FRAMES;
        } else {
            cache.timer--;
        }

        return cache.point;
    }

    chooseMoveTarget(closestTarget, closestDist, captureTarget) {
        // 有长官的小弟：优先跟随长官
        if (this.hasLeader()) {
            return this.chooseFollowLeaderTarget(closestTarget, closestDist);
        }
        if (this.role === CombatAI.ROLE_GUARD) return this.chooseGuardMoveTarget(closestTarget, closestDist, captureTarget);
        if (this.role === CombatAI.ROLE_ATTACK) return this.chooseAttackMoveTarget(closestTarget, closestDist, captureTarget);
        return this.chooseWanderMoveTarget(closestTarget, closestDist, captureTarget);
    }

    chooseFollowLeaderTarget(closestTarget, closestDist) {
        const leaderPos = this.getLeaderTarget();
        if (!leaderPos) return null;
        const distToLeader = Math.hypot(leaderPos.x - this.x, leaderPos.y - this.y);
        // 有近距离威胁，优先攻击
        if (closestTarget && closestDist < 200) {
            if (!this.hasLineOfSight(closestTarget)) return this.getFlankPosition(closestTarget);
            return this.getCombatPosition(closestTarget, CombatAI.FOLLOW_DISTANCE);
        }
        // 离长官太远，快速跟上
        if (distToLeader > CombatAI.FOLLOW_DISTANCE * 2) {
            return leaderPos;
        }
        // 在长官周围小范围巡逻
        if (distToLeader > CombatAI.FOLLOW_DISTANCE) {
            return leaderPos;
        }
        const angle = Math.atan2(this.y - leaderPos.y, this.x - leaderPos.x);
        const patrolAngle = angle + Math.sin(this.cycleTimer * 0.02) * 0.5;
        return {
            x: leaderPos.x + Math.cos(patrolAngle) * CombatAI.FOLLOW_DISTANCE,
            y: leaderPos.y + Math.sin(patrolAngle) * CombatAI.FOLLOW_DISTANCE
        };
    }

    chooseGuardMoveTarget(closestTarget, closestDist, captureTarget) {
        if (!this.guardPoint) {
            this.role = CombatAI.ROLE_ATTACK;
            return null;
        }
        this.stuckState.fallbackPoints = [this.guardPoint];
        const distToPoint = Math.hypot(this.guardPoint.x - this.x, this.guardPoint.y - this.y);
        const pointSafe = this.isPointSafe();

        // 近距离威胁：回撤到守卫点
        if (closestTarget && closestDist < CombatAI.GUARD_RADIUS + CombatAI.OBSTACLE_DIST_MIN) {
            return { x: this.guardPoint.x, y: this.guardPoint.y };
        }
        // 中距离交战
        if (pointSafe && closestTarget && closestDist < CombatAI.GUARD_ENGAGE_RANGE) {
            if (!this.hasLineOfSight(closestTarget)) return this.getFlankPosition(closestTarget);
            return this.getCombatPosition(closestTarget, CombatAI.GUARD_RADIUS);
        }
        // 超出巡逻半径则返回
        if (distToPoint > CombatAI.GUARD_RADIUS) {
            return { x: this.guardPoint.x, y: this.guardPoint.y };
        }
        // 巡逻行为
        return this.getPatrolPosition(captureTarget);
    }

    getPatrolPosition(captureTarget) {
        this.patrolTimer++;
        const forwardAngle = captureTarget
            ? Math.atan2(captureTarget.y - this.guardPoint.y, captureTarget.x - this.guardPoint.x)
            : this.patrolAngle;
        // 移除位置依赖项，避免反馈震荡
        const patrolAngle = forwardAngle + Math.sin(this.patrolTimer * CombatAI.PATROL_FREQ) * Math.PI / 2;
        return {
            x: this.guardPoint.x + Math.cos(patrolAngle) * CombatAI.PATROL_OFFSET,
            y: this.guardPoint.y + Math.sin(patrolAngle) * CombatAI.PATROL_OFFSET
        };
    }

    chooseAttackMoveTarget(closestTarget, closestDist, captureTarget) {
        if (closestTarget && closestDist < CombatAI.ATTACK_ENGAGE_RANGE) {
            if (!this.hasLineOfSight(closestTarget)) return this.getFlankPosition(closestTarget);
            return this.getCombatPosition(closestTarget, CombatAI.GUARD_RADIUS);
        }
        if (captureTarget) {
            this.stuckState.fallbackPoints = this.getTargetPoints();
            return { x: captureTarget.x, y: captureTarget.y };
        }
        if (closestTarget) return { x: closestTarget.x, y: closestTarget.y };
        return null;
    }

    chooseWanderMoveTarget(closestTarget, closestDist, captureTarget) {
        this.stuckState.fallbackPoints = this.getTargetPoints();
        if (closestTarget && closestDist < CombatAI.WANDER_ENGAGE_RANGE) {
            if (!this.hasLineOfSight(closestTarget)) return this.getFlankPosition(closestTarget);
            return this.getCombatPosition(closestTarget, CombatAI.FLANK_RADII[2], true);
        }
        this.wanderTimer++;
        if (this.wanderTimer > CombatAI.WANDER_INTERVAL || !this.wanderTarget) {
            if (captureTarget && Math.random() < CombatAI.WANDER_CAPTURE_CHANCE) {
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
        // 垂直方向像素偏移代替角度偏移，避免位置反馈导致抖动
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);
        const offset = wide
            ? Math.sin(this.cycleTimer * 0.015) * 50
            : Math.sin(this.cycleTimer * 0.025) * 25;
        const baseX = target.x + Math.cos(angle) * distance;
        const baseY = target.y + Math.sin(angle) * distance;
        return {
            x: baseX + perpX * offset,
            y: baseY + perpY * offset
        };
    }

    getFlankPosition(target) {
        const map = GameState.map;
        if (!map || !target) return this.getCombatPosition(target, 220, true);
        const baseAngle = Math.atan2(this.y - target.y, this.x - target.x);
        const candidates = [];
        for (const radius of CombatAI.FLANK_RADII) {
            for (const offset of CombatAI.FLANK_OFFSETS) {
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
        if (!map || this.hasLineBetween(this, target)) {
            this.obstacleTargetCache.point = null;
            return target;
        }

        const cache = this.obstacleTargetCache;
        if (cache.point && cache.original && cache.timer > 0) {
            const targetShift = Math.hypot(target.x - cache.original.x, target.y - cache.original.y);
            const cacheDist = Math.hypot(this.x - cache.point.x, this.y - cache.point.y);
            if (targetShift < CombatAI.OBSTACLE_CACHE_REPLAN_DISTANCE &&
                cacheDist > CombatAI.MOVE_TARGET_REACHED_DISTANCE &&
                map.isWalkable(cache.point.x, cache.point.y, this.radius) &&
                this.hasLineBetween(this, cache.point)) {
                cache.timer--;
                return cache.point;
            }
        }

        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        const dist = Math.min(CombatAI.OBSTACLE_DIST_MAX, Math.max(CombatAI.OBSTACLE_DIST_MIN, Math.hypot(target.x - this.x, target.y - this.y) * CombatAI.OBSTACLE_DIST_FACTOR));
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
        if (!best) {
            cache.point = null;
            return target;
        }

        cache.point = { x: best.x, y: best.y };
        cache.original = { x: target.x, y: target.y };
        cache.timer = CombatAI.OBSTACLE_CACHE_FRAMES;
        return cache.point;
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

        let predictionAccuracy = 0.35 + Math.random() * 0.4;
        // 狙击手精度加成
        if (this.unitClass === UnitClass.SNIPER) {
            predictionAccuracy += getClassConfig(UnitClass.SNIPER).accuracyBonus || 0.2;
        }
        let predictX = target.x + tvx * travelTime * predictionAccuracy;
        let predictY = target.y + tvy * travelTime * predictionAccuracy;
        const maxOffset = dist * 0.25;
        const offsetDist = Math.hypot(predictX - target.x, predictY - target.y);
        if (offsetDist > maxOffset) {
            const scale = maxOffset / offsetDist;
            predictX = target.x + (predictX - target.x) * scale;
            predictY = target.y + (predictY - target.y) * scale;
        }

        const errorRange = Math.min(6 + dist * 0.05, 35);
        const weatherAccuracy = WeatherSystem.getAccuracyMultiplier();
        predictX += (Math.random() - 0.5) * errorRange * weatherAccuracy;
        predictY += (Math.random() - 0.5) * errorRange * weatherAccuracy;
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
                // 近战攻击产生血迹
                EffectsManager.spawnBloodSplatter(target.x, target.y, Math.cos(angle) * 3, Math.sin(angle) * 3, weapon.config.damage);
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
                this.healSwitchTimer = 60;
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
        // AI 压枪补偿：根据当前后坐力反向修正弹道
        const recoilCompensation = weapon.currentRecoil * 0.65;
        const weatherAccuracy = WeatherSystem.getAccuracyMultiplier();
        const baseAngle = angle + weapon.getShotAngleOffset() * weatherAccuracy + recoilCompensation;

        if (weaponType === 'shotgun') {
            const pellets = weapon.config.pellets || 8;
            const spreadAngle = weapon.config.spreadAngle || 0.35;
            for (let i = 0; i < pellets; i++) {
                const pelletAngle = baseAngle + (Math.random() - 0.5) * spreadAngle;
                this.spawnBullet(pelletAngle, speed, weapon, weapon.config.range || 250);
            }
        } else if (weapon.config.arcRange) {
            // 抛物线武器（XM320榴弹发射器）— 预判目标位置
            const arcSpeed = weapon.config.bulletSpeed || 6;
            const predicted = this.predictTargetPosition(target, arcSpeed);
            GameState.bullets.push(new GrenadeBullet(
                this.x, this.y,
                predicted.x, predicted.y,
                weapon.config,
                this
            ));
        } else {
            this.spawnBullet(baseAngle, speed, weapon, null);
        }

        if (['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'launcher'].includes(weaponType)) {
            SoundManager.playShoot(weaponType, this);
            EffectsManager.spawnMuzzleFlash(this.x, this.y, baseAngle, weaponType);
            // 火箭筒：额外生成后焰喷射效果
            if (weaponType === 'launcher' && weapon.config.hasBackblast !== false) {
                EffectsManager.spawnBackblast(this.x, this.y, baseAngle);
            }
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

        if (weaponType === 'launcher' && weapon.config.maxStack) {
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
            this,
            weapon.config.type
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
            // 加载武器贴图
            if (pickupWeapon.config && pickupWeapon.config.imagePath) {
                this.loadWeaponImage(pickupWeapon.id, pickupWeapon.config.imagePath, pickupWeapon.config.reloadImagePath);
            }
            pickup.alive = false;
            if (oldWeapon && oldWeapon.id !== 'knife') {
                GameState.weaponPickups.push(new WeaponPickup(this.x, this.y, oldWeapon));
            }
            break;
        }
    }

    draw(ctx) {
        const weaponAngle = this.getWeaponDrawAngle();

        // 更新移动方向（用于头盔镜像）
        if (this.x !== this._prevX) {
            this._lastMoveDir = this.x > this._prevX ? 1 : -1;
        }
        this._prevX = this.x;
        
        if (this.dying) {
            const progress = 1 - this.deathTimer / 15;
            ctx.save();
            ctx.globalAlpha = 1 - progress * 0.85;
            const s = 1 - progress * 0.4;
            ctx.scale(s, s);
            this.drawBody(ctx, weaponAngle);
            ctx.restore();
            return;
        }
        this.drawBody(ctx, weaponAngle);
        this.drawWeapon(ctx, weaponAngle);
        this.drawStatusEffects(ctx);
    }

    drawBody(ctx, weaponAngle, showRankStars = true) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = this.getRoleStroke();
        ctx.lineWidth = 3;
        ctx.stroke();
        if (showRankStars && this.rank > AIRank.PRIVATE) {
            this.drawRankStars(ctx);
        }

        // 中心图标表示兵种，使用描边颜色
        const classConfig = getClassConfig(this.unitClass);
        ctx.fillStyle = this.getRoleStroke();
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(classConfig.icon, 0, 0);
        
        // 绘制头盔（贴图版本，覆盖在图标上方，根据朝向镜像）
        if (this.hasHelmet() && this.helmetImagesLoaded[this.helmet] && this.helmetImagesLoaded[this.helmet][this.helmetVariant]) {
            const r = this.radius;
            // 头盔贴图参数（易于调整）
            const helmetScale = 2.7;
            const helmetOffsetX = 0;
            const helmetOffsetY = -r * 0.4;
            const drawSize = r * helmetScale;
            
            // 根据武器指向方向决定是否镜像
            const facingLeft = Math.cos(weaponAngle) < 0;
            
            const centerX = helmetOffsetX;
            const centerY = -drawSize / 2 + helmetOffsetY + drawSize / 2;
            ctx.save();
            ctx.translate(centerX, centerY);
            if (facingLeft) {
                ctx.scale(-1, 1);
            }
            ctx.drawImage(
                this.helmetImages[this.helmet][this.helmetVariant],
                -drawSize / 2,
                -drawSize / 2,
                drawSize,
                drawSize
            );
            ctx.restore();
        }
        
        ctx.restore();
    }

    drawRankStars(ctx) {
        const config = getRankConfig(this.rank);
        const stars = config.stars;
        ctx.fillStyle = config.starColor;
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★'.repeat(stars), 0, -28);
    }

    getRoleStroke() {
        if (this.faction === 'player') {
            // 友军冷色调
            if (this.role === 0) return '#80DEEA';  // 守卫：冰蓝
            if (this.role === 1) return '#64B5F6';  // 攻击：钢蓝
            return '#9FA8DA';  // 游走：淡紫蓝
        }
        // 敌军暖色调
        if (this.role === 0) return '#FFD740';
        if (this.role === 1) return '#ff5252';
        return '#E040FB';
    }


    getWeaponDrawAngle() {
        const { target } = this.getClosestTarget();
        return target
            ? Math.atan2(target.y - this.y, target.x - this.x)
            : (this._lastMoveDir < 0 ? Math.PI * 3 / 4 : Math.PI / 4);
    }

    drawWeapon(ctx, weaponAngle) {
        const weapon = this.getActiveWeapon();
        if (!weapon) return;
        const weaponImage = this.getWeaponImage(weapon.id, weapon.isReloading);

        ctx.save();
        if (weaponImage) {
            const facingLeft = Math.cos(weaponAngle) < 0;
            const targetHeight = CombatAI.WEAPON_DRAW_HEIGHT;
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
        }
        ctx.restore();
    }

    takeDamage(amount) {
        if (this.dying) return this.alive;
        this.health -= amount;
        // 受到伤害时添加缓慢效果（使用配置常量）
        const slowDuration = STATUS_EFFECT_CONFIG.SLOW.DEFAULT_DURATION;
        this.addStatusEffect(new SlowEffect(slowDuration));
        const distance = GameState.player ? Math.hypot(this.x - GameState.player.x, this.y - GameState.player.y) : 0;
        if (this.hasHelmet()) {
            SoundManager.playHelmetHit(distance);
        }
        if (this.health <= 0) {
            this.health = 0;
            if (this.mountedVehicle) {
                this.mountedVehicle.unmount(this);
            }
            if (!this.dying) {
                if (this.faction === 'enemy') {
                    // 敌人：死亡动画（淡出缩小 + 粒子）
                    this.dying = true;
                    this.deathTimer = 15;
                    EffectsManager.spawnParticles(this.x, this.y, ParticleType.EXPLOSION, 15);
                    // 掉落战利品
                    this.dropLootOnDeath();
                } else {
                    // 队友：立即死亡，让 CollisionSystem 正常触发重生队列
                    this.alive = false;
                }
                SoundManager.playDie(distance);
                if (this.rank > AIRank.PRIVATE) {
                    this.releaseSubordinates();
                }
                this.dropWeaponOnDeath();
            }
        } else {
            SoundManager.playHurt(distance);
        }
    }

    dropWeaponOnDeath() {
        if (Math.random() > CombatAI.DROP_CHANCE) return;
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

    // 死亡时掉落战利品
    dropLootOnDeath() {
        // 只有敌人才掉落战利品
        if (this.faction !== 'enemy') return;
        
        const lootIds = rollLoot(this.rank);
        if (lootIds.length === 0) return;
        
        for (const lootId of lootIds) {
            // 在死亡位置附近随机偏移
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetY = (Math.random() - 0.5) * 40;
            GameState.lootPickups.push(new LootPickup(this.x + offsetX, this.y + offsetY, lootId));
        }
        
        // 生成掉落特效
        EffectsManager.spawnParticles(this.x, this.y, ParticleType.EXPLOSION, 8);
    }
}

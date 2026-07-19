// src/entities/Vehicle.js
import { Entity } from "./Entity.js";
import { GameState } from "../core/GameState.js";
import { drawJeep } from "../rendering/JeepRenderer.js";
import { drawBTR80 } from "../rendering/BTR80Renderer.js";
import { Bullet } from "./Bullet.js";
import { GrenadeBullet } from "./GrenadeBullet.js";
import { EffectsManager, ParticleType } from "../utils/EffectsManager.js";
import * as SoundManager from "../utils/SoundManager.js";
import { DayNightSystem } from "../core/DayNightSystem.js";
import { VehicleAI } from "./VehicleAI.js";
import { VehicleChatSystem } from "../utils/VehicleChatSystem.js";

export class Vehicle extends Entity {
    // 座位局部坐标（与 JeepRenderer.js 中的座位位置一致）
    static SEAT_LOCAL_POSITIONS = [
        { x: -50, y: 55 },   // 驾驶位（索引0）
        { x: 50, y: 55 },    // 副驾驶（索引1）
        { x: 0, y: 138 }     // 后排（索引2）
    ];

    constructor(x, y, config) {
        super(x, y, {
            health: config.health,
            speed: config.speed,
            radius: config.radius
        });
        this.id = config.id;
        this.config = config;
        this.name = config.name;
        this.type = config.type;
        this.armor = config.armor || 0;
        this.windshieldMaxHealth = config.windshieldHealth || 80;
        this.hasWindshield = config.hasWindshield ?? true;
        this.windshieldHealth = this.windshieldMaxHealth;
        this.windshieldDamageReduction = config.windshieldDamageReduction ?? 0.08;
        this.windshieldCracks = [];
        this.windshieldBroken = false;
        this.passengerCapacity = config.passengers || 1;
        this.passengerCanFire = config.passengerCanFire ?? true;
        this.seatLocalPositions = config.seatPositions || Vehicle.SEAT_LOCAL_POSITIONS;
        this.mountRange = config.mountRange || 50;
        this.passengerRange = config.passengerRange || 80;
        this.acceleration = config.acceleration || 0.16;
        this.brakeDeceleration = config.brakeDeceleration || 0.28;
        this.friction = config.friction || 0.91;
        this.reverseSpeedRatio = config.reverseSpeedRatio || 0.55;
        this.turnRate = config.turnRate || 0.045;
        this.impactDamage = config.impactDamage || 45;
        this.impactCooldown = config.impactCooldown || 30;
        this.width = config.width || 60;
        this.height = config.height || 36;
        this.color = config.color || "#5C4033";
        this.strokeColor = config.strokeColor || "#3E2723";
        this.occupants = [];
        this.occupied = false;
        this.angle = 0;
        this.steeringAngle = 0;
        this.wheelRotation = 0;
        this.visualLean = 0;
        this.visualBob = 0;
        this.impactKick = 0;
        this.exhaustTimer = 0;
        this.brakeLights = false;
        this.reverseLights = false;
        this.velocityX = 0;
        this.velocityY = 0;
        this.currentSpeed = 0;
        this.drawScale = config.drawScale || 0.48;
        this.impactCooldowns = new Map();
        this.maxHealth = this.health;
        this.weaponConfig = config.weapons || null;
        this.turretAngle = this.angle;
        this.turretTargetAngle = this.angle;
        // 炮塔每 tick 最大旋转弧度（默认 0.025 = 约 86°/秒 @60fps）
        this.turretTurnRate = config.turretTurnRate ?? 0.025;
        this.cannonCooldown = 0;
        this.coaxCooldown = 0;
        this.cannonRecoil = 0;
        this.coaxRecoil = 0;
        this.activeVehicleWeapon = 'cannon';
        this.coaxShotCounter = 0;
        this.cannonHeat = 0;
        this.coaxHeat = 0;
        this.cannonAmmo = 120;
        this.coaxAmmo = 300;
        this.cannonReloadTimer = 0;
        this.coaxReloadTimer = 0;
        this.aiWeaponTarget = null;
        this.aiBurstWeapon = null;
        this.aiBurstShotsRemaining = 0;
        this.aiBurstPause = 0;
        this.barrelSmokeTimer = 0;
        this.dustTimer = 0;
        this.trackTimer = 0;
        this.lastTrackPositions = null;
        this.damageSmokeTimer = 0;
        this.lastDoorSoundAt = -Infinity;
    }

    _worldToLocal(worldX, worldY) {
        const theta = this.angle + Math.PI / 2;
        const dx = worldX - this.x;
        const dy = worldY - this.y;
        return {
            x: (dx * Math.cos(theta) + dy * Math.sin(theta)) / this.drawScale,
            y: (-dx * Math.sin(theta) + dy * Math.cos(theta)) / this.drawScale
        };
    }

    _localToWorld(localX, localY) {
        const theta = this.angle + Math.PI / 2;
        const scaledX = localX * this.drawScale;
        const scaledY = localY * this.drawScale;
        return {
            x: this.x + scaledX * Math.cos(theta) - scaledY * Math.sin(theta),
            y: this.y + scaledX * Math.sin(theta) + scaledY * Math.cos(theta)
        };
    }

    /**
     * 获取指定座位在世界坐标中的位置
     * @param {number} seatIndex - 座位索引
     * @returns {{x: number, y: number}}
     */
    getSeatWorldPosition(seatIndex) {
        if (seatIndex < 0 || seatIndex >= this.seatLocalPositions.length) {
            return { x: this.x, y: this.y };
        }
        const localPos = this.seatLocalPositions[seatIndex];
        return this._localToWorld(localPos.x, localPos.y);
    }

    hitWindshield(bullet) {
        if (!this.hasWindshield) return null;
        if (this.windshieldBroken) return null;
        const speed = Math.hypot(bullet.vx, bullet.vy);
        if (speed <= 0) return null;
        const start = this._worldToLocal(bullet.prevX ?? bullet.x, bullet.prevY ?? bullet.y);
        const extension = this.radius * 3;
        const end = this._worldToLocal(
            bullet.x + bullet.vx / speed * extension,
            bullet.y + bullet.vy / speed * extension
        );
        const dy = end.y - start.y;
        if (dy <= 0 || start.y > -55 || end.y < -88) return null;
        const t = (-72 - start.y) / dy;
        if (t < 0 || t > 1) return null;
        const localX = start.x + (end.x - start.x) * t;
        const hitsPane = (localX >= -103 && localX <= -4) || (localX >= 4 && localX <= 103);
        if (!hitsPane) return null;

        const hitPoint = this._localToWorld(localX, -72);
        this.windshieldHealth = Math.max(0, this.windshieldHealth - bullet.damage);
        this.windshieldCracks.push({
            x: localX,
            y: -72,
            seed: this.windshieldCracks.length * 1.73 + localX * 0.031,
            size: 11 + Math.min(9, bullet.damage * 0.18)
        });
        if (this.windshieldCracks.length > 10) this.windshieldCracks.shift();
        this.windshieldBroken = this.windshieldHealth <= 0;
        return {
            x: hitPoint.x,
            y: hitPoint.y,
            shattered: this.windshieldBroken,
            damage: bullet.damage * (1 - this.windshieldDamageReduction)
        };
    }

    takeDamage(amount) {
        if (!this.alive) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            EffectsManager.spawnGrenadeExplosion(this.x, this.y, this.radius * 1.6);
            EffectsManager.spawnParticles(this.x, this.y, ParticleType.EXPLOSION, 30);
            SoundManager.playExplosion(this);
            this._ejectPassengers();
        }
        return this.alive;
    }

    _ejectPassengers() {
        SoundManager.stopVehicleEngine(this);
        for (let i = this.occupants.length - 1; i >= 0; i--) {
            const occupant = this.occupants[i];
            if (!occupant) continue;
            this._releaseOccupant(occupant, i);
            if (occupant === GameState.player) {
                occupant.takeDamage(20);
            }
        }
        this.occupants = [];
        this.occupied = false;
        this.velocityX = 0;
        this.velocityY = 0;
        this.currentSpeed = 0;
        VehicleChatSystem.clear(this);
    }

    isFull() {
        return this.occupants.filter(Boolean).length >= this.passengerCapacity;
    }

    boardNearbyTeammates() {
        // 只要驾驶座有人（玩家或AI）就尝试搭载附近同阵营单位
        if (!this.occupants[0] || this.isFull()) return 0;

        const driver = this.occupants[0];
        const driverFaction = driver.faction || 'player';

        // 按驾驶员阵营选择搭载候选列表
        const candidates = driverFaction === 'enemy'
            ? GameState.enemies
            : GameState.teammates;

        const nearbyAllies = candidates
            .filter(u => u.alive && !u.mountedVehicle && u !== driver)
            .sort((a, b) =>
                Math.hypot(a.x - this.x, a.y - this.y) -
                Math.hypot(b.x - this.x, b.y - this.y)
            );
        let boarded = 0;
        for (const ally of nearbyAllies) {
            if (Math.hypot(ally.x - this.x, ally.y - this.y) > this.passengerRange) break;
            if (this.isFull()) break;
            if (this.mount(ally)) boarded++;
        }
        return boarded;
    }

    /**
     * AI驾驶员让出驾驶座给玩家
     * @param {Entity} player - 玩家实体
     * @returns {boolean} 是否成功让座
     */
    yieldDriverSeat(player) {
        if (!player || !this.alive) return false;
        const currentDriver = this.occupants[0];
        if (!currentDriver || currentDriver === player) return false;

        // 找到第一个空闲乘客座
        let targetSeat = -1;
        for (let i = 1; i < this.passengerCapacity; i++) {
            if (!this.occupants[i]) {
                targetSeat = i;
                break;
            }
        }
        if (targetSeat < 0) return false; // 无空位

        // 将AI驾驶员移到乘客座
        this.occupants[targetSeat] = currentDriver;
        currentDriver.vehicleSeat = targetSeat;

        // 玩家坐上驾驶座
        this.occupants[0] = player;
        player.mountedVehicle = this;
        player.vehicleSeat = 0;
        player.x = this.x;
        player.y = this.y;

        this.occupied = this.isFull();
        this._playDoorSound();
        return true;
    }

    mount(entity, seatIndex = -1) {
        if (!entity || entity.mountedVehicle || !this.alive || this.isFull()) return false;
        if (seatIndex < 0 || seatIndex >= this.passengerCapacity || this.occupants[seatIndex]) {
            seatIndex = this.occupants.findIndex(occupant => !occupant);
            if (seatIndex < 0) seatIndex = this.occupants.length;
        }
        // 保存挂载前的半径，供卸载时恢复
        if (entity._preMountRadius === undefined) {
            entity._preMountRadius = entity.radius;
        }
        this.occupants[seatIndex] = entity;
        entity.mountedVehicle = this;
        entity.vehicleSeat = seatIndex;
        entity.x = this.x;
        entity.y = this.y;
        this.occupied = this.isFull();
        this._playDoorSound();
        SoundManager.startVehicleEngine(this);
        return true;
    }

    unmount(entity) {
        if (entity.mountedVehicle !== this) return false;
        const seatIndex = entity.vehicleSeat ?? this.occupants.indexOf(entity);
        const releaseAll = entity === GameState.player;
        if (releaseAll) {
            for (let i = this.occupants.length - 1; i >= 0; i--) {
                if (this.occupants[i]) this._releaseOccupant(this.occupants[i], i);
            }
            this.occupants = [];
            this.velocityX = 0;
            this.velocityY = 0;
            this.currentSpeed = 0;
            this.steeringAngle = 0;
            this.brakeLights = false;
            this.reverseLights = false;
            this.visualBob = 0;
        } else {
            this._releaseOccupant(entity, seatIndex);
            this.occupants[seatIndex] = null;
        }
        this.occupied = this.isFull();
        if (releaseAll || this.occupants.filter(Boolean).length === 0) {
            this._playDoorSound();
            SoundManager.stopVehicleEngine(this);
        }
        return true;
    }

    changeSeat(entity, targetSeat) {
        if (entity.mountedVehicle !== this || targetSeat < 0 || targetSeat >= this.passengerCapacity) return false;
        const currentSeat = entity.vehicleSeat;
        if (currentSeat === targetSeat) return true;
        if (currentSeat === 0 && targetSeat !== 0) {
            this.currentSpeed = 0;
            this.velocityX = 0;
            this.velocityY = 0;
            this.brakeLights = false;
            this.reverseLights = false;
            this.visualBob = 0;
            SoundManager.updateVehicleEngine(this, 0);
        }
        const otherOccupant = this.occupants[targetSeat] || null;
        this.occupants[targetSeat] = entity;
        this.occupants[currentSeat] = otherOccupant;
        entity.vehicleSeat = targetSeat;
        if (otherOccupant) otherOccupant.vehicleSeat = currentSeat;
        return true;
    }

    switchVehicleWeapon(weapon) {
        if (!this.weaponConfig) return;
        if (weapon !== 'cannon' && weapon !== 'coax') return;
        if (this.activeVehicleWeapon === weapon) return;
        
        const leaving = this.activeVehicleWeapon;
        if (leaving === 'cannon' && this.cannonAmmo <= 0 && this.cannonReloadTimer <= 0) {
            this.cannonReloadTimer = 1200;
            SoundManager.playReload();
        }
        if (leaving === 'coax' && this.coaxAmmo <= 0 && this.coaxReloadTimer <= 0) {
            this.coaxReloadTimer = 600;
            SoundManager.playReload();
        }
        
        this.activeVehicleWeapon = weapon;
        
        if (weapon === 'cannon' && this.cannonAmmo <= 0 && this.cannonReloadTimer > 0) {
            SoundManager.playReload();
        }
        if (weapon === 'coax' && this.coaxAmmo <= 0 && this.coaxReloadTimer > 0) {
            SoundManager.playReload();
        }
    }

    _playDoorSound() {
        const now = performance.now();
        if (this.id === 'btr80' && now - this.lastDoorSoundAt < 180) return;
        this.lastDoorSoundAt = now;
        SoundManager.playVehicleDoor(this);
    }

    _releaseOccupant(entity, seatIndex) {
        const offsets = [
            { x: this.radius + entity.radius + 8, y: 0 },
            { x: -(this.radius + entity.radius + 8), y: 0 },
            { x: 0, y: this.radius + entity.radius + 8 }
        ];
        const exitAngle = (seatIndex / Math.max(1, this.passengerCapacity)) * Math.PI * 2;
        const exitDistance = this.radius + entity.radius + 8;
        const offset = offsets[seatIndex] || {
            x: Math.cos(exitAngle) * exitDistance,
            y: Math.sin(exitAngle) * exitDistance
        };
        entity.mountedVehicle = null;
        entity.vehicleSeat = -1;
        // 恢复挂载前的半径（如果有保存的话）
        if (entity._preMountRadius !== undefined) {
            entity.radius = entity._preMountRadius;
            delete entity._preMountRadius;
        }
        entity.x = this.x + offset.x;
        entity.y = this.y + offset.y;
    }

    /**
     * 更新所有非驾驶座乘客的AI射击行为
     */
    updatePassengers() {
        // 驾驶位空缺时，AI乘客自动换到驾驶位
        if (!this.occupants[0] && this.alive) {
            for (let i = 1; i < this.occupants.length; i++) {
                const candidate = this.occupants[i];
                if (candidate && candidate.alive && candidate !== GameState.player) {
                    this.changeSeat(candidate, 0);
                    console.log(`🚗 AI乘客自动换到驾驶位`);
                    break;
                }
            }
        }

        if (!this.passengerCanFire) return;
        for (let i = 0; i < this.occupants.length; i++) {
            const occupant = this.occupants[i];
            if (!occupant || occupant === GameState.player) continue;
            if (occupant.vehicleSeat === 0) continue; // 驾驶座不射击
            // 让AI队友在载具中自动寻找敌人射击
            VehicleAI.updateVehicleCombat(occupant, this);
        }
    }

    updateWeapons(controller = GameState.player, aiTarget = null) {
        // 只有当前驾驶座成员能控制载具武器；AI 使用自己的目标，不读取玩家鼠标。
        if (!this.weaponConfig || this.occupants[0] !== controller) return;
        const isPlayerController = controller === GameState.player;

        this.cannonCooldown = Math.max(0, this.cannonCooldown - 1);
        this.coaxCooldown = Math.max(0, this.coaxCooldown - 1);
        this.cannonRecoil *= 0.68;
        this.coaxRecoil *= 0.58;
        this.cannonHeat = Math.max(0, this.cannonHeat - 0.34);
        this.coaxHeat = Math.max(0, this.coaxHeat - 0.26);
        if (!isPlayerController && this.aiBurstPause > 0) this.aiBurstPause--;
        if (this.cannonRecoil < 0.1) this.cannonRecoil = 0;
        if (this.coaxRecoil < 0.1) this.coaxRecoil = 0;

        if (this.cannonReloadTimer > 0) {
            this.cannonReloadTimer--;
            if (this.cannonReloadTimer <= 0) {
                this.cannonAmmo = 120;
                SoundManager.playReload();
            }
        }
        if (this.coaxReloadTimer > 0) {
            this.coaxReloadTimer--;
            if (this.coaxReloadTimer <= 0) {
                this.coaxAmmo = 300;
                SoundManager.playReload();
            }
        }
        if (this.cannonAmmo <= 0 && this.cannonReloadTimer <= 0) {
            this.cannonReloadTimer = 1200;
            SoundManager.playReload();
        }
        if (this.coaxAmmo <= 0 && this.coaxReloadTimer <= 0) {
            this.coaxReloadTimer = 600;
            SoundManager.playReload();
        }

        const target = isPlayerController ? this._getMouseWorldPosition() : aiTarget;
        if (!target || target.alive === false) {
            if (!isPlayerController) {
                this.aiWeaponTarget = null;
                this.aiBurstWeapon = null;
                this.aiBurstShotsRemaining = 0;
            }
            return;
        }
        const turretBase = this._localToWorld(0, -68);
        this.turretTargetAngle = Math.atan2(target.y - turretBase.y, target.x - turretBase.x);
        this.turretAngle = this._rotateToward(this.turretAngle, this.turretTargetAngle, this.turretTurnRate);

        this.barrelSmokeTimer++;
        if (this.cannonHeat > 42 && this.barrelSmokeTimer % 4 === 0) {
            const muzzleDistance = 224 * this.drawScale;
            EffectsManager.spawnBarrelSmoke(
                turretBase.x + Math.cos(this.turretAngle) * muzzleDistance,
                turretBase.y + Math.sin(this.turretAngle) * muzzleDistance,
                this.turretAngle,
                this.cannonHeat / 100
            );
        }
        if (this.coaxHeat > 48 && this.barrelSmokeTimer % 6 === 0) {
            const muzzleDistance = 100 * this.drawScale;
            EffectsManager.spawnBarrelSmoke(
                turretBase.x + Math.cos(this.turretAngle) * muzzleDistance,
                turretBase.y + Math.sin(this.turretAngle) * muzzleDistance,
                this.turretAngle,
                this.coaxHeat / 100
            );
        }

        if (!isPlayerController) {
            if (this.aiWeaponTarget !== target) {
                this.aiWeaponTarget = target;
                this.aiBurstWeapon = null;
                this.aiBurstShotsRemaining = 0;
                this.aiBurstPause = 18 + Math.floor(Math.random() * 13);
            }

            const nearbyEnemies = typeof controller.countNearbyEnemies === 'function'
                ? controller.countNearbyEnemies(target, 120)
                : 1;
            const targetIsArmored = target.type === 'armored';
            let selectedWeapon = targetIsArmored || nearbyEnemies >= 2 ? 'cannon' : 'coax';
            if (selectedWeapon === 'cannon' && this.cannonAmmo <= 0) selectedWeapon = 'coax';
            if (selectedWeapon === 'coax' && this.coaxAmmo <= 0) selectedWeapon = 'cannon';
            if ((selectedWeapon === 'cannon' && this.cannonAmmo <= 0) ||
                (selectedWeapon === 'coax' && this.coaxAmmo <= 0)) return;

            if (this.aiBurstWeapon !== selectedWeapon) {
                this.aiBurstWeapon = selectedWeapon;
                this.aiBurstShotsRemaining = 0;
            }
            this.activeVehicleWeapon = selectedWeapon;
            if (this.aiBurstPause > 0) return;
            if (this.aiBurstShotsRemaining <= 0) {
                this.aiBurstShotsRemaining = selectedWeapon === 'cannon'
                    ? 4 + Math.floor(Math.random() * 3)
                    : 8 + Math.floor(Math.random() * 5);
            }

            const weaponConfig = this.weaponConfig[selectedWeapon];
            const weaponRange = weaponConfig.arcRange || weaponConfig.maxRange || Infinity;
            const targetDistance = Math.hypot(target.x - turretBase.x, target.y - turretBase.y);
            const aimError = Math.atan2(
                Math.sin(this.turretTargetAngle - this.turretAngle),
                Math.cos(this.turretTargetAngle - this.turretAngle)
            );
            const weaponReady = selectedWeapon === 'cannon'
                ? this.cannonCooldown === 0
                : this.coaxCooldown === 0;
            if (targetDistance <= weaponRange && Math.abs(aimError) <= 0.08 && weaponReady) {
                if (selectedWeapon === 'cannon') this._fireCannon(target, turretBase, controller);
                else this._fireCoax(turretBase, controller);
                this.aiBurstShotsRemaining--;
                if (this.aiBurstShotsRemaining <= 0) {
                    this.aiBurstPause = selectedWeapon === 'cannon'
                        ? 45 + Math.floor(Math.random() * 31)
                        : 25 + Math.floor(Math.random() * 21);
                }
            }
            return;
        }

        if (GameState.arsenalOpen || GameState.inventoryOpen || GameState.debugOpen || GameState.radioOpen) return;
        if (GameState.mouse.down && this.cannonCooldown === 0 && this.activeVehicleWeapon === 'cannon') this._fireCannon(target, turretBase);
        if (GameState.mouse.down && this.coaxCooldown === 0 && this.activeVehicleWeapon === 'coax') this._fireCoax(turretBase);
        if (GameState.mouse.rightDown && this.coaxCooldown === 0) this._fireCoax(turretBase);
    }

    /**
     * 以最短角度差把 currentAngle 向 targetAngle 逼近，单步最多 maxDelta 弧度。
     * 用于炮塔旋转的角速度限制，避免瞬移到目标角度。
     */
    _rotateToward(currentAngle, targetAngle, maxDelta) {
        let diff = targetAngle - currentAngle;
        // 归一到 [-PI, PI]
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(diff) <= maxDelta) return targetAngle;
        return currentAngle + Math.sign(diff) * maxDelta;
    }

    _getMouseWorldPosition() {
        const cam = GameState.camera;
        const cx = GameState.viewport.width / 2;
        const cy = GameState.viewport.height / 2;
        return {
            x: (GameState.mouse.x - cx * (1 - cam.zoom) + (cam.offsetX || 0)) / cam.zoom + cam.x,
            y: (GameState.mouse.y - cy * (1 - cam.zoom) + (cam.offsetY || 0)) / cam.zoom + cam.y
        };
    }

    _fireCannon(target, turretBase, shooter = GameState.player) {
        if (this.cannonAmmo <= 0) {
            if (this.cannonReloadTimer <= 0) {
                this.cannonReloadTimer = 1200;
                SoundManager.playReload();
            }
            return;
        }
        const config = this.weaponConfig.cannon;
        const muzzleDistance = 224 * this.drawScale;
        const muzzleX = turretBase.x + Math.cos(this.turretAngle) * muzzleDistance;
        const muzzleY = turretBase.y + Math.sin(this.turretAngle) * muzzleDistance;
        // 炮弹必须沿当前炮管方向飞行；鼠标/AI目标只决定预计飞行距离。
        const shotDistance = Math.min(
            config.arcRange || Infinity,
            Math.hypot(target.x - muzzleX, target.y - muzzleY)
        );
        const shotTargetX = muzzleX + Math.cos(this.turretAngle) * shotDistance;
        const shotTargetY = muzzleY + Math.sin(this.turretAngle) * shotDistance;
        GameState.bullets.push(new GrenadeBullet(
            muzzleX, muzzleY, shotTargetX, shotTargetY, config, shooter
        ));
        this.cannonCooldown = config.shootDelay;
        this.cannonRecoil = config.recoil;
        this.cannonHeat = Math.min(100, this.cannonHeat + 18);
        this.activeVehicleWeapon = 'cannon';
        this.cannonAmmo--;
        const ejectionX = turretBase.x - Math.sin(this.turretAngle) * 10;
        const ejectionY = turretBase.y + Math.cos(this.turretAngle) * 10;
        EffectsManager.spawnMuzzleFlash(muzzleX, muzzleY, this.turretAngle, 'autocannon', 0);
        EffectsManager.spawnShellCasing(ejectionX, ejectionY, 'autocannon', this.turretAngle + Math.PI / 2, 1.35);
        EffectsManager.triggerShake(5, 6);
        SoundManager.playShoot('autocannon', this);
    }

    _fireCoax(turretBase, shooter = GameState.player) {
        if (this.coaxAmmo <= 0) {
            if (this.coaxReloadTimer <= 0) {
                this.coaxReloadTimer = 600;
                SoundManager.playReload();
            }
            return;
        }
        const config = this.weaponConfig.coax;
        const muzzleDistance = 100 * this.drawScale;
        const muzzleX = turretBase.x + Math.cos(this.turretAngle) * muzzleDistance;
        const muzzleY = turretBase.y + Math.sin(this.turretAngle) * muzzleDistance;
        GameState.bullets.push(new Bullet(
            muzzleX, muzzleY,
            Math.cos(this.turretAngle) * config.bulletSpeed,
            Math.sin(this.turretAngle) * config.bulletSpeed,
            shooter?.faction === 'enemy', config.damage, shooter === GameState.player, 0, 2, config.maxRange,
            null, null, false, config.bulletColor, config.bulletGlow,
            shooter, 'rifle'
        ));
        this.coaxCooldown = config.shootDelay;
        this.coaxRecoil = config.recoil;
        this.coaxHeat = Math.min(100, this.coaxHeat + 7);
        this.activeVehicleWeapon = 'coax';
        this.coaxAmmo--;
        EffectsManager.spawnMuzzleFlash(muzzleX, muzzleY, this.turretAngle, 'coax', 0);
        this.coaxShotCounter++;
        if (this.coaxShotCounter % 2 === 0) {
            const ejectionX = turretBase.x - Math.sin(this.turretAngle) * 8;
            const ejectionY = turretBase.y + Math.cos(this.turretAngle) * 8;
            EffectsManager.spawnShellCasing(ejectionX, ejectionY, 'coax', this.turretAngle + Math.PI / 2, 0.9);
        }
        SoundManager.playShoot('coax', this);
    }

    updatePhysics(throttle, steering, terrainSpeed = 1) {
        this.savePrevPosition();
        // 节流：每 30 帧检查一次搭载队友
        if (!this._boardTimer) this._boardTimer = 0;
        if (++this._boardTimer >= 30) {
            this._boardTimer = 0;
            this.boardNearbyTeammates();
        }
        // 更新乘客AI射击
        this.updatePassengers();
        for (const [entity, cooldown] of this.impactCooldowns) {
            if (cooldown <= 1) this.impactCooldowns.delete(entity);
            else this.impactCooldowns.set(entity, cooldown - 1);
        }
        const maxForwardSpeed = this.speed * terrainSpeed;
        const maxReverseSpeed = maxForwardSpeed * this.reverseSpeedRatio;
        const previousSpeed = this.currentSpeed;
        const desiredSteering = steering * 0.65;
        this.steeringAngle += (desiredSteering - this.steeringAngle) * 0.24;

        if (throttle !== 0) {
            const targetSpeed = throttle > 0 ? maxForwardSpeed : -maxReverseSpeed;
            const reversingDirection = this.currentSpeed !== 0 && Math.sign(this.currentSpeed) !== Math.sign(targetSpeed);
            const rate = reversingDirection ? this.brakeDeceleration : this.acceleration;
            if (this.currentSpeed < targetSpeed) this.currentSpeed = Math.min(targetSpeed, this.currentSpeed + rate);
            else if (this.currentSpeed > targetSpeed) this.currentSpeed = Math.max(targetSpeed, this.currentSpeed - rate);
        } else {
            this.currentSpeed *= this.friction;
            if (Math.abs(this.currentSpeed) < 0.03) this.currentSpeed = 0;
        }

        if (Math.abs(this.currentSpeed) > 0.05) {
            const speedRatio = Math.min(1, Math.abs(this.currentSpeed) / Math.max(maxForwardSpeed, 0.01));
            const direction = Math.sign(this.currentSpeed);
            this.angle += this.steeringAngle * this.turnRate * direction * (0.25 + speedRatio * 0.75);
            this.wheelRotation = (this.wheelRotation + this.currentSpeed / 18) % (Math.PI * 2);
        }

        const speedRatio = Math.min(1, Math.abs(this.currentSpeed) / Math.max(maxForwardSpeed, 0.01));
        const brakingInput = throttle !== 0 && Math.abs(previousSpeed) > 0.15 &&
            Math.sign(throttle) !== Math.sign(previousSpeed);
        this.brakeLights = brakingInput;
        this.reverseLights = this.currentSpeed < -0.15;
        const accelerationLean = (this.currentSpeed - previousSpeed) * 0.035;
        const steeringLean = -this.steeringAngle * speedRatio * 0.045;
        const targetLean = accelerationLean + steeringLean + this.impactKick;
        this.visualLean += (targetLean - this.visualLean) * 0.18;
        this.visualBob = speedRatio > 0.08
            ? Math.sin(this.wheelRotation * 2.2) * 1.4 * speedRatio
            : this.visualBob * 0.78;
        this.impactKick *= 0.72;

        this.velocityX = Math.cos(this.angle) * this.currentSpeed;
        this.velocityY = Math.sin(this.angle) * this.currentSpeed;
        this.exhaustTimer++;
        const exhaustInterval = Math.max(5, 12 - Math.floor(speedRatio * 6));
        if (this.exhaustTimer >= exhaustInterval) {
            this.exhaustTimer = 0;
            const exhaustLocal = this.config.exhaustPosition || { x: 82, y: 245 };
            const exhaust = this._localToWorld(exhaustLocal.x, exhaustLocal.y);
            const exhaustIntensity = this.id === 'btr80'
                ? Math.min(1, 0.3 + speedRatio * 0.9)
                : speedRatio;
            EffectsManager.spawnVehicleExhaust(
                exhaust.x,
                exhaust.y,
                -this.velocityX * 0.08,
                -this.velocityY * 0.08,
                exhaustIntensity
            );
            if (this.id === 'btr80' && speedRatio > 0.35) {
                EffectsManager.spawnVehicleExhaust(
                    exhaust.x + (Math.random() - 0.5) * 3,
                    exhaust.y + (Math.random() - 0.5) * 3,
                    -this.velocityX * 0.1,
                    -this.velocityY * 0.1,
                    exhaustIntensity
                );
            }
        }

        // 后轮尘土飞扬（车速越快，尘土越多）
        // 尘土从车辆最底部生成（备胎位置）
        if (speedRatio > 0.15) {
            const dustDriftX = -this.velocityX * 0.12;
            const dustDriftY = -this.velocityY * 0.12;
            this.dustTimer++;
            const dustInterval = this.id === 'btr80' ? 2 : 1;
            if (this.dustTimer >= dustInterval) {
                this.dustTimer = 0;
                const dustPositions = this.id === 'btr80'
                    ? [[-140, 260], [140, 260], [-140, 102], [140, 102]]
                    : [[-132, 275], [132, 275]];
                for (const [localX, localY] of dustPositions) {
                    const wheel = this._localToWorld(localX, localY);
                    EffectsManager.spawnVehicleDust(wheel.x, wheel.y, dustDriftX, dustDriftY, speedRatio);
                }
            }

            if (this.id === 'btr80' && speedRatio > 0.22) {
                const trackPositions = [-140, 140].map(localX => this._localToWorld(localX, 260));
                if (this.lastTrackPositions) {
                    for (let i = 0; i < trackPositions.length; i++) {
                        const previous = this.lastTrackPositions[i];
                        const current = trackPositions[i];
                        const dx = current.x - previous.x;
                        const dy = current.y - previous.y;
                        const distance = Math.hypot(dx, dy);
                        if (distance >= 9) {
                            EffectsManager.spawnVehicleTrack(
                                (previous.x + current.x) * 0.5,
                                (previous.y + current.y) * 0.5,
                                Math.atan2(dy, dx),
                                true,
                                distance + 2
                            );
                            this.lastTrackPositions[i] = current;
                        }
                    }
                } else {
                    this.lastTrackPositions = trackPositions;
                }
            }
        } else {
            this.dustTimer = 0;
            this.trackTimer = 0;
            this.lastTrackPositions = null;
        }

        if (this.id === 'btr80' && this.health / this.maxHealth < 0.5) {
            this.damageSmokeTimer++;
            const smokeInterval = this.health / this.maxHealth < 0.25 ? 5 : 11;
            if (this.damageSmokeTimer >= smokeInterval) {
                this.damageSmokeTimer = 0;
                const damagePoint = this._localToWorld(0, 230);
                EffectsManager.spawnVehicleDamageSmoke(
                    damagePoint.x,
                    damagePoint.y,
                    -this.velocityX * 0.04,
                    -this.velocityY * 0.04
                );
            }
        } else {
            this.damageSmokeTimer = 0;
        }
        SoundManager.updateVehicleEngine(this, Math.abs(this.currentSpeed) / Math.max(maxForwardSpeed, 0.01));
        // 更新 AI 闲聊系统
        VehicleChatSystem.update(this);
        return throttle !== 0 || steering !== 0 || Math.abs(this.currentSpeed) > 0.05;
    }

    overlapsEntity(entity) {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        const forward = dx * Math.cos(this.angle) + dy * Math.sin(this.angle);
        const lateral = -dx * Math.sin(this.angle) + dy * Math.cos(this.angle);
        return Math.abs(forward) < this.height / 2 + entity.radius &&
            Math.abs(lateral) < this.width / 2 + entity.radius;
    }

    tryImpact(entity) {
        if (!entity || !entity.alive || entity.mountedVehicle === this || Math.abs(this.currentSpeed) < 1.5) return false;
        if (this.impactCooldowns.has(entity)) return false;
        this.impactCooldowns.set(entity, this.impactCooldown);
        const speedRatio = Math.min(1, Math.abs(this.currentSpeed) / Math.max(this.speed, 0.01));
        const lateral = -(entity.x - this.x) * Math.sin(this.angle) + (entity.y - this.y) * Math.cos(this.angle);
        this.impactKick = (lateral < 0 ? -1 : 1) * (0.025 + speedRatio * 0.04);
        SoundManager.playVehicleImpact(this, speedRatio);
        EffectsManager.triggerShake(2 + speedRatio * 4, 6);
        entity.takeDamage(this.impactDamage);
        const angle = Math.atan2(entity.y - this.y, entity.x - this.x);
        entity.x += Math.cos(angle) * 24;
        entity.y += Math.sin(angle) * 24;
        return true;
    }

    hitObstacle(hitPoint = null) {
        const speedRatio = Math.min(1, Math.abs(this.currentSpeed) / Math.max(this.speed, 0.01));
        if (speedRatio > 0.12) {
            // 使用实际碰撞点，如果没有则回退到车头位置
            const impactPos = hitPoint || this._localToWorld(0, -245);
            this.impactKick = (Math.random() < 0.5 ? -1 : 1) * (0.02 + speedRatio * 0.035);
            SoundManager.playVehicleImpact(this, speedRatio);
            EffectsManager.spawnParticles(impactPos.x, impactPos.y, ParticleType.SPARK, 4);
            EffectsManager.triggerShake(2 + speedRatio * 3, 5);
        }
        this.currentSpeed *= -0.15;
        this.velocityX = Math.cos(this.angle) * this.currentSpeed;
        this.velocityY = Math.sin(this.angle) * this.currentSpeed;
    }

    draw(ctx) {
        if (!this.alive) return;
        
        // 夜间车灯效果
        const darkness = DayNightSystem.getAmbientDarkness();
        if (darkness > 0.15) {
            this._drawHeadlights(ctx, darkness);
        }
        
        if (this.id === 'btr80') {
            drawBTR80(ctx, this.angle, this.drawScale, this.turretAngle, this.cannonRecoil, this.coaxRecoil, {
                lean: this.visualLean,
                bob: this.visualBob,
                braking: this.brakeLights,
                reversing: this.reverseLights,
                steeringAngle: this.steeringAngle,
                wheelRotation: this.wheelRotation,
                headlightsOn: darkness > 0.15
            });
            return;
        }

        drawJeep(ctx, this.angle, this.drawScale, this.occupants, this.steeringAngle, this.wheelRotation, {
            cracks: this.windshieldCracks,
            broken: this.windshieldBroken
        }, {
            lean: this.visualLean,
            bob: this.visualBob,
            braking: this.brakeLights,
            reversing: this.reverseLights
        });
    }
    
    _drawHeadlights(ctx, darkness) {
        // 车头灯位置（局部坐标，与 JeepRenderer 中绘制的灯一致）
        const lightPositions = this.config.headlightPositions || [
            { x: -83, y: -264 },
            { x: 83, y: -264 }
        ];
        const [leftLight, rightLight] = lightPositions.map(pos => this._localToWorld(pos.x, pos.y));

        const forwardX = Math.cos(this.angle);
        const forwardY = Math.sin(this.angle);

        // 光束随环境变暗而变长、变亮
        const beamLength = (this.config.headlightBeamLength || 500) * (0.52 + 0.48 * darkness);
        const beamHalfAngle = 0.16; // 约 18° 半张角
        const spread = this.config.headlightSpread || 95;

        // 动态光源：像枪口火焰一样照亮前方，挖穿夜间暗色叠加层
        const intensity = darkness;
        DayNightSystem.addLight(
            leftLight.x + forwardX * beamLength * 0.4,
            leftLight.y + forwardY * beamLength * 0.4,
            beamLength * 0.6 * intensity + 40,
            '255,235,170',
            4
        );
        DayNightSystem.addLight(
            rightLight.x + forwardX * beamLength * 0.4,
            rightLight.y + forwardY * beamLength * 0.4,
            beamLength * 0.6 * intensity + 40,
            '255,235,170',
            4
        );

        const perpX = -forwardY;
        const perpY = forwardX;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (const light of [leftLight, rightLight]) {
            const tipX = light.x + forwardX * beamLength;
            const tipY = light.y + forwardY * beamLength;
            const halfW = spread * 1.6;
            const edgeAx = tipX + perpX * halfW;
            const edgeAy = tipY + perpY * halfW;
            const edgeBx = tipX - perpX * halfW;
            const edgeBy = tipY - perpY * halfW;

            const gradient = ctx.createRadialGradient(
                light.x, light.y, 0,
                light.x + forwardX * beamLength, light.y + forwardY * beamLength,
                halfW
            );
            gradient.addColorStop(0, `rgba(255,240,180,${0.55 * intensity})`);
            gradient.addColorStop(0.4, `rgba(255,235,170,${0.28 * intensity})`);
            gradient.addColorStop(1, 'rgba(255,235,170,0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(light.x, light.y);
            ctx.lineTo(edgeAx, edgeAy);
            ctx.arc(tipX, tipY, halfW, Math.atan2(edgeAy - tipY, edgeAx - tipX), Math.atan2(edgeBy - tipY, edgeBx - tipX));
            ctx.lineTo(light.x, light.y);
            ctx.closePath();
            ctx.fill();
        }

        // 灯光本体辉光（灯罩处）
        for (const light of [leftLight, rightLight]) {
            const glow = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, 26);
            glow.addColorStop(0, `rgba(255,250,210,${0.9 * intensity})`);
            glow.addColorStop(1, 'rgba(255,240,180,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(light.x, light.y, 26, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

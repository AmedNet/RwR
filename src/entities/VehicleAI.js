// src/entities/VehicleAI.js
// AI 驾驶系统 + 载具战斗（从 CombatAI.js 拆出）
// 所有函数接收 ai 实例作为第一参数，不依赖 this
import { GameState } from '../core/GameState.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import * as SoundManager from '../utils/SoundManager.js';
import { ParticleType } from '../utils/EffectsManager.js';
import { GrenadeBullet } from './GrenadeBullet.js';
import { AIRank } from '../core/RankSystem.js';

// ─── 驾驶/载具战斗常量 ───
export const VEHICLE_ENGAGE_RANGE = 500;
export const DRIVER_MIN_RANK = AIRank.SERGEANT;
export const VEHICLE_SEARCH_RANGE = 300;
export const VEHICLE_BOARD_CHECK_INTERVAL = 120;
export const MIN_PASSENGERS_TO_DEPART = 2;

// ─── 载具瞄准 ───
export function updateVehicleAim(ai, target) {
        // 载具中的瞄准逻辑，使用独立的计时器
        if (ai._vehicleTarget !== target) {
            ai._vehicleTarget = target;
            const weapon = ai.getActiveWeapon();
            // 载具中瞄准更快（移动目标变化快）
            const delay = Math.floor(ai.getAimDelay(weapon) * 0.5);
            ai._vehicleAimTimer = delay;
        }
        if (ai._vehicleAimTimer > 0) {
            ai._vehicleAimTimer--;
            return false;
        }
        return true;
    }

// ─── 尝试上车 ───
export function tryBoardVehicle(ai) {
        // 军衔不够不能驾驶
        if (ai.rank < DRIVER_MIN_RANK) return;
        // 已经在车上
        if (ai.mountedVehicle) return;
        // 定时器检查
        ai.vehicleBoardTimer++;
        if (ai.vehicleBoardTimer < VEHICLE_BOARD_CHECK_INTERVAL) return;
        ai.vehicleBoardTimer = 0;

        const vehicles = GameState.vehicles;
        if (!vehicles || vehicles.length === 0) return;

        let nearestVehicle = null;
        let nearestDist = Infinity;

        for (const v of vehicles) {
            if (!v.alive || v.isFull()) continue;
            // 驾驶座必须空着
            if (v.occupants[0]) continue;
            const dist = Math.hypot(v.x - ai.x, v.y - ai.y);
            if (dist > VEHICLE_SEARCH_RANGE) continue;
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestVehicle = v;
            }
        }

        if (nearestVehicle) {
            if (nearestVehicle.mount(ai, 0)) {
                console.log(`🚗 ${ai.faction} AI驾驶员(★${ai.rank + 1})上车`);
            }
        }
    }

// ─── AI 驾驶逻辑（含卡住检测/脱困/传送） ───
export function updateAIDriving(ai, vehicle) {
        if (!vehicle || !vehicle.alive) return;

        // 更新座位位置（驾驶员也要同步）
        const seatPos = vehicle.getSeatWorldPosition(0);
        ai.x = seatPos.x;
        ai.y = seatPos.y;

        // 更新状态效果（龙卷风伤害等）
        ai.updateStatusEffects();

        // AI驾驶员独立搜索敌人并控制炮塔；车内目标改为瞄准其载具中心。
        const { target: enemyTarget } = ai.getClosestTarget();
        const vehicleCombatTarget = enemyTarget?.mountedVehicle?.alive
            ? enemyTarget.mountedVehicle
            : enemyTarget;
        const visibleVehicleTarget = vehicleCombatTarget && ai.hasLineBetween(vehicle, vehicleCombatTarget)
            ? vehicleCombatTarget
            : null;
        vehicle.updateWeapons(ai, visibleVehicleTarget);

        // 检查发车条件：乘客数（不含驾驶员）
        const passengerCount = vehicle.occupants.filter((o, i) => i > 0 && o).length;
        let throttle = 0;
        let steering = 0;

        if (passengerCount >= MIN_PASSENGERS_TO_DEPART) {
            // 满足发车条件，选择目标
            const { target: captureTarget } = ai.getClosestTargetPoint();

            let targetX, targetY;
            if (captureTarget) {
                targetX = captureTarget.x;
                targetY = captureTarget.y;
            } else if (enemyTarget) {
                targetX = enemyTarget.x;
                targetY = enemyTarget.y;
            } else {
                // 无目标，原地怠速
                vehicle.updatePhysics(0, 0, 1);
                return;
            }

            // 计算目标角度
            const dx = targetX - vehicle.x;
            const dy = targetY - vehicle.y;
            const targetAngle = Math.atan2(dy, dx);

            // ─── 卡住检测与脱困 ───
            const moved = Math.hypot(vehicle.x - ai._driveLastX, vehicle.y - ai._driveLastY);
            ai._driveLastX = vehicle.x;
            ai._driveLastY = vehicle.y;

            if (ai._driveStuckRecoverTimer > 0) {
                // 脱困模式：全速倒车 + 大角度转向
                ai._driveStuckRecoverTimer--;
                throttle = -0.8;
                steering = ai._driveStuckDir;
                if (ai._driveStuckRecoverTimer === 0) {
                    // 脱困结束：强制旋转车身角度，避免立刻朝墙开
                    const randomAngleOffset = (Math.PI / 3) + Math.random() * (Math.PI / 3); // 60°~120°
                    vehicle.angle += ai._driveStuckDir > 0 ? randomAngleOffset : -randomAngleOffset;
                    ai._driveStuckTimer = 0;
                }
            } else if (Math.abs(vehicle.currentSpeed) > 2 && moved < 2) {
                // 速度很低且几乎没移动 → 可能卡住了
                ai._driveStuckTimer++;
                if (ai._driveStuckTimer > 30) {
                    // 进入脱困模式：全速倒车 + 随机方向转向，持续 60 帧
                    ai._driveStuckRecoverTimer = 60;
                    ai._driveStuckDir = Math.random() < 0.5 ? -1 : 1;
                    ai._driveStuckTimer = 0;
                    ai._driveStuckCount++;
                    throttle = -0.8;
                    steering = ai._driveStuckDir;
                    
                    // 连续卡住15次以上，传送到己方据点
                    if (ai._driveStuckCount >= 15) {
                        const friendlyPoints = GameState.capturePoints.filter(point => point.owner === ai.faction);
                        if (friendlyPoints.length > 0) {
                            const targetPoint = friendlyPoints[Math.floor(Math.random() * friendlyPoints.length)];
                            vehicle.x = targetPoint.x;
                            vehicle.y = targetPoint.y;
                            vehicle.currentSpeed = 0;
                            vehicle.velocityX = 0;
                            vehicle.velocityY = 0;
                            // 同步所有乘客位置
                            for (let i = 0; i < vehicle.occupants.length; i++) {
                                const occupant = vehicle.occupants[i];
                                if (occupant) {
                                    const seatPos = vehicle.getSeatWorldPosition(i);
                                    occupant.x = seatPos.x;
                                    occupant.y = seatPos.y;
                                }
                            }
                            console.log(`🚗 AI驾驶员连续卡住${ai._driveStuckCount}次，传送到己方据点`);
                            ai._driveStuckCount = 0;
                            ai._driveStuckRecoverTimer = 0;
                        }
                    }
                }
            } else {
                // 正常行驶中，重置卡住计时
                ai._driveStuckTimer = 0;
                ai._driveStuckCount = 0; // 正常移动时重置连续卡住计数
            }

            // 正常驾驶逻辑（非脱困模式时）
            if (ai._driveStuckRecoverTimer === 0) {
                // 计算角度差，归一化到 [-PI, PI]
                let angleDiff = targetAngle - vehicle.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                // 计算转向和油门
                steering = Math.max(-1, Math.min(1, angleDiff * 2));
                const absAngleDiff = Math.abs(angleDiff);
                if (absAngleDiff < Math.PI * 2 / 3) {
                    throttle = 1;
                } else {
                    throttle = 0.3;
                }
            }
        }

        // 计算地形/天气速度因子
        const speedFactor = GameState.map ? GameState.map.getSpeedFactor(vehicle.x, vehicle.y) : 1;
        const weatherSpeed = WeatherSystem.getSpeedMultiplier();
        const terrainSpeed = speedFactor * weatherSpeed;

        // 更新载具物理
        vehicle.updatePhysics(throttle, steering, terrainSpeed);

        // 处理碰撞位移（同Player逻辑）
        const newX = vehicle.x + vehicle.velocityX;
        const newY = vehicle.y + vehicle.velocityY;
        if (GameState.map && GameState.map.isWalkable(newX, newY, vehicle.radius)) {
            vehicle.x = newX;
            vehicle.y = newY;
        }
    }

// ─── 载具中战斗（乘客射击） ───
export function updateVehicleCombat(ai, vehicle) {
        if (!vehicle || !vehicle.alive || !ai.alive) return;

        // 更新座位置（使用座位世界坐标）
        const seatPos = vehicle.getSeatWorldPosition(ai.vehicleSeat);
        ai.x = seatPos.x;
        ai.y = seatPos.y;

        // 更新武器相关
        ai.updateStatusEffects();
        const weapon = ai.getActiveWeapon();
        if (weapon) {
            weapon.updateReload();
            weapon.updateRecoilAndSpread();
        }

        // 自动换弹
        if (weapon && weapon.ammo === 0 && !weapon.isReloading && weapon.config.type !== 'melee') {
            if (weapon.isInfiniteAmmo || weapon.config.type !== 'launcher') {
                weapon.startReload();
                if (weapon.isInfiniteAmmo) SoundManager.playReload(weapon.config.type, ai);
            }
        }

        // 寻找最近的敌人
        let closestTarget = null;
        let closestDist = Infinity;
        const engageRange = VEHICLE_ENGAGE_RANGE;
        for (const target of ai.getTargets()) {
            if (!target.alive) continue;
            const d = Math.hypot(target.x - ai.x, target.y - ai.y);
            if (d < engageRange && d < closestDist) {
                if (ai.hasLineBetween({ x: ai.x, y: ai.y }, target)) {
                    closestTarget = target;
                    closestDist = d;
                }
            }
        }

        if (!weapon || !closestTarget) return;

        // 武器选择（在载具中只使用主武器槽1）——必须在类型检查之前
        if (ai.activeWeaponSlot !== 1 && ai.weapons[1]) {
            ai.activeWeaponSlot = 1;
        }
        // 重新获取切换后的武器
        const activeWeapon = ai.getActiveWeapon();
        if (!activeWeapon) return;

        // 载具乘客不能用医疗包/近战/手雷射击
        const weaponType = activeWeapon.config.type;
        if (weaponType === 'medical' || weaponType === 'melee' || weaponType === 'grenade') return;

        // 存储瞄准角度供渲染使用（世界坐标系）
        ai._vehicleAimAngle = Math.atan2(closestTarget.y - ai.y, closestTarget.x - ai.x);

        // 射击冷却和瞄准
        if (ai.shootCooldown > 0) {
            ai.shootCooldown--;
        } else if (activeWeapon.canShoot() && updateVehicleAim(ai, closestTarget)) {
            // 载具中的射击方向——从座位指向目标
            const angle = Math.atan2(closestTarget.y - ai.y, closestTarget.x - ai.x);
            const speed = activeWeapon.config.bulletSpeed || ai.bulletSpeed;
            
            // 防御性检查：确保速度有效
            if (!isFinite(speed) || speed <= 0) {
                ai.shootCooldown = 30; // 无效武器，给个长冷却
                return;
            }
            
            const predicted = ai.predictTargetPosition(closestTarget, speed);
            const fireAngle = Math.atan2(predicted.y - ai.y, predicted.x - ai.x);
            
            // 防御性检查：确保角度有效
            if (!isFinite(fireAngle)) {
                ai.shootCooldown = 30;
                return;
            }
            
            const angleOffset = activeWeapon.getShotAngleOffset() || 0;

            if (activeWeapon.config.type === 'shotgun') {
                const pellets = activeWeapon.config.pellets || 8;
                const spreadAngle = activeWeapon.config.spreadAngle || 0.35;
                for (let i = 0; i < pellets; i++) {
                    const pelletAngle = fireAngle + (Math.random() - 0.5) * spreadAngle + angleOffset;
                    ai.spawnBullet(pelletAngle, speed, activeWeapon, activeWeapon.config.range || 250);
                }
            } else if (activeWeapon.config.arcRange) {
                GameState.bullets.push(new GrenadeBullet(
                    ai.x, ai.y,
                    predicted.x, predicted.y,
                    activeWeapon.config,
                    ai
                ));
            } else {
                ai.spawnBullet(fireAngle + angleOffset, speed, activeWeapon, null);
            }

            // 播放枪声和枪口火焰
            if (['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'launcher'].includes(weaponType)) {
                SoundManager.playShoot(weaponType, ai);
                EffectsManager.spawnMuzzleFlash(ai.x, ai.y, fireAngle, weaponType);
            }

            activeWeapon.consumeAmmo();
            activeWeapon.applyRecoilAndSpread();
            
            // 确保冷却时间有效（至少1帧，默认10帧）
            const delay = activeWeapon.config.shootDelay;
            ai.shootCooldown = (isFinite(delay) && delay > 0) ? delay : 10;

            // 火箭筒堆叠消耗
            if (weaponType === 'launcher' && activeWeapon.config.maxStack) {
                activeWeapon.consumeStack();
                if (activeWeapon.stackCount <= 0) ai.weapons[ai.activeWeaponSlot] = null;
            }

            // 抛壳
            const noShellTypes = ['melee', 'grenade', 'medical', 'launcher'];
            if (!noShellTypes.includes(weaponType)) {
                EffectsManager.spawnShellCasing(ai.x, ai.y, weaponType);
                SoundManager.playShellEject(weaponType, ai);
            }
        }
    }

// 统一导出对象，供 CombatAI/Vehicle 以 VehicleAI.xxx() 方式调用
export const VehicleAI = {
    updateVehicleAim,
    tryBoardVehicle,
    updateAIDriving,
    updateVehicleCombat,
};

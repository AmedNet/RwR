// src/systems/CollisionSystem.js
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Terrain } from '../core/Map.js';
import { EffectsManager, ParticleType } from '../utils/EffectsManager.js';
import { playExplosion, playBulletHit, playRicochet, playHelmetHit } from '../utils/SoundManager.js';
import { getRankConfig, AIRank } from '../core/RankSystem.js';
import { SupportSystem } from '../core/SupportSystem.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { getHelmetConfig, HelmetTier, tryRicochet, RICOCHET_IMMUNE_TYPES } from '../core/HelmetSystem.js';
import { triggerHitMarker, triggerKill } from '../rendering/CrosshairRenderer.js';

/** 碰撞特效配置常量 */
const COLLISION_FX = {
    HIT_PARTICLE_COUNT: 6,
    PLAYER_HIT_SHAKE_INTENSITY: 6,
    PLAYER_HIT_SHAKE_DURATION: 8,
    SPARK_PARTICLE_COUNT: 6,
    ENEMY_DEATH_PARTICLE_COUNT: 15,
    ENEMY_DEATH_SHAKE_INTENSITY: 5,
    ENEMY_DEATH_SHAKE_DURATION: 6,
    KILL_RP_REWARD: 10,
};

/** 不可通行的地形类型集合 */
const SOLID_TERRAIN = new Set([Terrain.HOUSE, Terrain.MOUNTAIN]);

export const CollisionSystem = {
    // ─── 基础碰撞检测 ───

    /** 线段与圆的碰撞检测（防止高速子弹穿透） */
    lineCircleCollision(x1, y1, x2, y2, cx, cy, radius) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const fx = x1 - cx;
        const fy = y1 - cy;
        const a = dx * dx + dy * dy;
        if (a === 0) return (fx * fx + fy * fy) < radius * radius;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - radius * radius;
        let discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return false;
        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);
        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
    },

    /** 圆与矩形碰撞解决（用于地图房屋/山丘） */
    resolveCircleMap(entity) {
        const map = GameState.map;
        if (!map) return null;
        const radius = entity.radius;
        const tileSize = map.tileSize;
        const minCol = Math.floor((entity.x - radius) / tileSize);
        const maxCol = Math.floor((entity.x + radius) / tileSize);
        const minRow = Math.floor((entity.y - radius) / tileSize);
        const maxRow = Math.floor((entity.y + radius) / tileSize);
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                if (!SOLID_TERRAIN.has(map.getTile(col, row))) continue;
                const tileLeft = col * tileSize;
                const tileTop = row * tileSize;
                const closestX = Math.max(tileLeft, Math.min(entity.x, tileLeft + tileSize));
                const closestY = Math.max(tileTop, Math.min(entity.y, tileTop + tileSize));
                const dx = entity.x - closestX;
                const dy = entity.y - closestY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < radius) {
                    const overlap = radius - dist;
                    if (dist > 0) {
                        entity.x += (dx / dist) * overlap;
                        entity.y += (dy / dist) * overlap;
                    } else {
                        entity.x += radius;
                    }
                    // 返回碰撞点（墙壁上离实体最近的点）
                    return { x: closestX, y: closestY };
                }
            }
        }
        return null;
    },

    // ─── 主碰撞检测入口 ───

    checkAll() {
        const { player, enemies, teammates, bullets, vehicles, map } = GameState;
        if (!player) return;
        this._checkEntitiesVsMap(player, enemies, teammates, vehicles);
        this._checkVehicleImpacts(vehicles, [player, ...enemies, ...teammates]);
        this._checkBulletsVsMap(bullets, map);
        this._checkBulletVsBullet(bullets);
        this._checkBulletsVsVehicles(bullets, vehicles);
        this._checkBulletsVsEntities(bullets, player, enemies, teammates);
        GameState.bullets = GameState.bullets.filter(b => b.alive);
        GameState.enemies = GameState.enemies.filter(e => e.alive);
        GameState.vehicles = GameState.vehicles.filter(v => v.alive);
    },

    // ─── 实体 vs 地图 ───

    _checkEntitiesVsMap(player, enemies, teammates, vehicles = []) {
        const allEntities = [player, ...enemies, ...teammates, ...vehicles]
            .filter(e => e && e.alive && !e.mountedVehicle);
        for (const entity of allEntities) {
            const hitPoint = this.resolveCircleMap(entity);
            // 如果是载具且发生了碰撞，通知载具
            if (hitPoint && entity.hitObstacle) {
                entity.hitObstacle(hitPoint);
            }
        }
    },

    _checkVehicleImpacts(vehicles, entities) {
        if (!vehicles || vehicles.length === 0) return;
        // 车与车碰撞（OBB 贴合分离，每对只处理一次，避免互相镶嵌）
        for (let i = 0; i < vehicles.length; i++) {
            const a = vehicles[i];
            if (!a.alive) continue;
            for (let j = i + 1; j < vehicles.length; j++) {
                const b = vehicles[j];
                if (!b.alive) continue;
                if (!a.overlapsEntity(b)) continue;
                this._separateVehiclesOBB(a, b);
            }
        }

        for (const vehicle of vehicles) {
            if (!vehicle.alive) continue;
            for (const entity of entities) {
                if (!entity || !entity.alive || entity.mountedVehicle) continue;
                if (!vehicle.overlapsEntity(entity)) continue;
                // 先尝试用撞击伤害推开（需要车速）
                const impactResult = vehicle.tryImpact(entity);
                if (impactResult) {
                    EffectsManager.spawnParticles(entity.x, entity.y, ParticleType.HIT, COLLISION_FX.HIT_PARTICLE_COUNT);
                    EffectsManager.addDamageNumber(entity.x, entity.y, vehicle.impactDamage, entity === GameState.player);
                } else {
                    // 车速不足时也把实体推出车体外形，防止穿模
                    this._pushEntityOutOfVehicle(entity, vehicle);
                }
            }
        }
    },

    // 按车辆 OBB 朝向，将实体沿最小重叠轴推出车体外
    _pushEntityOutOfVehicle(entity, vehicle) {
        const dx = entity.x - vehicle.x;
        const dy = entity.y - vehicle.y;
        const ca = Math.cos(vehicle.angle);
        const sa = Math.sin(vehicle.angle);
        const forward = dx * ca + dy * sa;
        const lateral = -dx * sa + dy * ca;
        const halfF = vehicle.height / 2 + entity.radius;
        const halfL = vehicle.width / 2 + entity.radius;
        const overF = halfF - Math.abs(forward);
        const overL = halfL - Math.abs(lateral);
        if (overF <= 0 || overL <= 0) return;
        if (overF < overL) {
            const sign = forward >= 0 ? 1 : -1;
            const nx = ca * sign;
            const ny = sa * sign;
            entity.x += nx * overF;
            entity.y += ny * overF;
        } else {
            const sign = lateral >= 0 ? 1 : -1;
            const nx = -sa * sign;
            const ny = ca * sign;
            entity.x += nx * overL;
            entity.y += ny * overL;
        }
    },

    // 两个载具按各自 OBB 朝向做最小平移分离（SAT，取两轴最小重叠）
    _separateVehiclesOBB(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const axes = [
            { x: Math.cos(a.angle), y: Math.sin(a.angle) },
            { x: -Math.sin(a.angle), y: Math.cos(a.angle) },
            { x: Math.cos(b.angle), y: Math.sin(b.angle) },
            { x: -Math.sin(b.angle), y: Math.cos(b.angle) },
        ];
        let minOverlap = Infinity;
        let mtvX = 0, mtvY = 0;
        for (const ax of axes) {
            const aF = Math.abs((dx) * ax.x + (dy) * ax.y);
            // a 在该轴上的半投影
            const aHalf = (a.height / 2) * Math.abs((Math.cos(a.angle) * ax.x + Math.sin(a.angle) * ax.y))
                + (a.width / 2) * Math.abs((-Math.sin(a.angle) * ax.x + Math.cos(a.angle) * ax.y));
            const bHalf = (b.height / 2) * Math.abs((Math.cos(b.angle) * ax.x + Math.sin(b.angle) * ax.y))
                + (b.width / 2) * Math.abs((-Math.sin(b.angle) * ax.x + Math.cos(b.angle) * ax.y));
            const overlap = aHalf + bHalf - aF;
            if (overlap <= 0) return; // 该轴已分离
            if (overlap < minOverlap) {
                minOverlap = overlap;
                mtvX = ax.x;
                mtvY = ax.y;
            }
        }
        // 法线方向指向把 b 推离 a
        if (dx * mtvX + dy * mtvY < 0) {
            mtvX = -mtvX;
            mtvY = -mtvY;
        }
        const push = minOverlap * 0.5;
        a.x -= mtvX * push;
        a.y -= mtvY * push;
        b.x += mtvX * push;
        b.y += mtvY * push;
    },

    // ─── 子弹 vs 地图 ───

    _checkBulletsVsMap(bullets, map) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) continue;
            // 跳过抛物线弹道（GrenadeBullet自己处理碰撞）
            if (bullet.isArcProjectile) continue;
            if (!map) continue;
            const { col, row } = map.worldToTile(bullet.x, bullet.y);
            if (!SOLID_TERRAIN.has(map.getTile(col, row))) continue;
            this._triggerBulletExplosion(bullet);
            bullet.alive = false;
            bullets.splice(i, 1);
        }
    },

    // ─── 子弹 vs 子弹抵消 ───

    _checkBulletVsBullet(bullets) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b1 = bullets[i];
            if (!b1.alive) continue;
            for (let j = i - 1; j >= 0; j--) {
                const b2 = bullets[j];
                if (!b2.alive) continue;
                if (b1.isEnemy === b2.isEnemy) continue;
                const dx = b1.x - b2.x;
                const dy = b1.y - b2.y;
                if (Math.sqrt(dx * dx + dy * dy) < b1.radius + b2.radius) {
                    b1.alive = false;
                    b2.alive = false;
                    break;
                }
            }
        }
    },

    // ─── 子弹 vs 载具 ───

    _checkBulletsVsVehicles(bullets, vehicles) {
        if (!vehicles || vehicles.length === 0) return;
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) continue;
            if (bullet.isArcProjectile) continue;
            for (const v of vehicles) {
                if (!v.alive) continue;
                // 车内玩家的子弹从车体范围内发射，不应撞回自己的载具。
                if (bullet.shooter && bullet.shooter.mountedVehicle === v) continue;
                if (this._bulletHitsVehicle(bullet, v)) {
                    if (bullet.explosion) {
                        this._triggerBulletExplosion(bullet, v);
                    } else if (v.type === "armored") {
                        // 装甲载具：普通子弹完全跳弹，不造成伤害
                        EffectsManager.spawnRicochetEffect(
                            bullet.x,
                            bullet.y,
                            Math.atan2(bullet.vy, bullet.vx),
                            true
                        );
                        playHelmetHit(bullet.x);
                    } else {
                        const windshieldHit = v.hitWindshield(bullet);
                        let damageDealt = 0;
                        if (windshieldHit) {
                            damageDealt = windshieldHit.damage;
                            if (windshieldHit.shattered) {
                                EffectsManager.spawnGlassShards(windshieldHit.x, windshieldHit.y, 8);
                            }
                            EffectsManager.spawnParticles(windshieldHit.x, windshieldHit.y, ParticleType.SPARK, 6);
                            playHelmetHit(bullet.x);
                        } else {
                            damageDealt = bullet.damage;
                            EffectsManager.spawnParticles(bullet.x, bullet.y, ParticleType.SPARK, 12);
                            EffectsManager.spawnRicochetEffect(
                                bullet.x,
                                bullet.y,
                                Math.atan2(bullet.vy, bullet.vx),
                                true
                            );
                            playBulletHit(bullet.x);
                        }
                        v.takeDamage(damageDealt);
                        EffectsManager.addDamageNumber(v.x, v.y - v.radius, damageDealt, true);
                    }
                    bullet.alive = false;
                    break;
                }
            }
        }
    },

    // ─── 子弹 vs 实体 ───

    _checkBulletsVsEntities(bullets, player, enemies, teammates) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) {
                bullets.splice(i, 1);
                continue;
            }
            // 跳过抛物线弹道（GrenadeBullet自己处理伤害）
            if (bullet.isArcProjectile) continue;
            const bulletUsed = bullet.isEnemy
                ? this._checkEnemyBulletVsEntities(bullet, player, teammates)
                : this._checkPlayerBulletVsEnemies(bullet, player, enemies);
            if (bulletUsed) {
                this._triggerBulletExplosion(bullet);
                bullets.splice(i, 1);
            }
        }
    },

    /** 敌人子弹 → 玩家 & 队友 */
    _checkEnemyBulletVsEntities(bullet, player, teammates) {
        // 玩家死亡动画中/已死亡时不再被子弹命中（与队友/敌人的 !alive 守卫一致，避免击中尸体）
        if (player.alive && !player.dying && this._bulletHitsCircle(bullet, player)) {
            this._onBulletHitPlayer(bullet, player);
            return true;
        }
        for (let j = teammates.length - 1; j >= 0; j--) {
            const teammate = teammates[j];
            if (!teammate.alive) continue;
            if (this._bulletHitsCircle(bullet, teammate)) {
                this._onBulletHitTeammate(bullet, teammate, teammates, j);
                return true;
            }
        }
        return false;
    },

    /** 玩家/队友子弹 → 敌人 */
    _checkPlayerBulletVsEnemies(bullet, player, enemies) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (!enemy.alive) continue;
            if (bullet.penetration && bullet.hitTargets.has(enemy)) continue;
            if (!this._bulletHitsCircle(bullet, enemy)) continue;
            this._onBulletHitEnemy(bullet, enemy, player, enemies, j);
            // 穿透逻辑：子弹继续飞行
            if (bullet.penetration && bullet.remainingPenetration > 0) {
                bullet.hitTargets.add(enemy);
                bullet.remainingPenetration--;
                bullet.damage *= bullet.penetration.damageDecay;
                continue;
            }
            return true;
        }
        return false;
    },

    // ─── 碰撞命中辅助 ───

    /** 检测子弹是否命中圆形目标 */
    _bulletHitsCircle(bullet, target) {
        const hitRadius = bullet.radius + target.radius;
        return this.lineCircleCollision(
            bullet.prevX ?? bullet.x, bullet.prevY ?? bullet.y,
            bullet.x, bullet.y,
            target.x, target.y, hitRadius
        );
    },

    /** 沿子弹运动线段检测载具旋转矩形，覆盖 BTR 的车头和车尾。 */
    _bulletHitsVehicle(bullet, vehicle) {
        const cos = Math.cos(vehicle.angle);
        const sin = Math.sin(vehicle.angle);
        const toLocal = (x, y) => {
            const dx = x - vehicle.x;
            const dy = y - vehicle.y;
            return {
                forward: dx * cos + dy * sin,
                lateral: -dx * sin + dy * cos
            };
        };

        const start = toLocal(bullet.prevX ?? bullet.x, bullet.prevY ?? bullet.y);
        const end = toLocal(bullet.x, bullet.y);
        const halfForward = vehicle.height / 2 + bullet.radius;
        const halfLateral = vehicle.width / 2 + bullet.radius;
        let tMin = 0;
        let tMax = 1;

        for (const [from, to, halfSize] of [
            [start.forward, end.forward, halfForward],
            [start.lateral, end.lateral, halfLateral]
        ]) {
            const delta = to - from;
            if (Math.abs(delta) < 1e-8) {
                if (from < -halfSize || from > halfSize) return false;
                continue;
            }
            let enter = (-halfSize - from) / delta;
            let exit = (halfSize - from) / delta;
            if (enter > exit) [enter, exit] = [exit, enter];
            tMin = Math.max(tMin, enter);
            tMax = Math.min(tMax, exit);
            if (tMin > tMax) return false;
        }
        return true;
    },

    // ─── 命中处理回调 ───

    _onBulletHitPlayer(bullet, player) {
        // 防弹衣减伤/跳弹判定（与 AI 头盔机制一致）
        if (player.armorDurability > 0) {
            const armorConfig = WeaponRegistry.armor;
            const weaponType = bullet.weaponType || null;
            // 跳弹判定（免疫武器不触发，与 AI 头盔共用 RICOCHET_IMMUNE_TYPES）
            if (weaponType && !RICOCHET_IMMUNE_TYPES.has(weaponType)) {
                if (Math.random() < armorConfig.ricochetChance) {
                    bullet.alive = false;
                    player.armorDurability = Math.max(0, player.armorDurability - 2);
                    EffectsManager.spawnRicochetEffect(bullet.x, bullet.y);
                    playRicochet(player);
                    return;
                }
            }
            // 减伤
            bullet.damage = Math.floor(bullet.damage * (1 - armorConfig.damageReduction));
            // 扣耐久
            player.armorDurability = Math.max(0, player.armorDurability - armorConfig.durabilityPerHit);
        }
        player.takeDamage(bullet.damage, bullet.x, bullet.y, bullet.vx, bullet.vy);
        EffectsManager.spawnParticles(bullet.x, bullet.y, ParticleType.HIT, COLLISION_FX.HIT_PARTICLE_COUNT);
        EffectsManager.addDamageNumber(bullet.x, bullet.y, bullet.damage, true);
        EffectsManager.triggerShake(COLLISION_FX.PLAYER_HIT_SHAKE_INTENSITY, COLLISION_FX.PLAYER_HIT_SHAKE_DURATION);
        playBulletHit(player);
        EventBus.emit('player_hurt', { health: player.health });
        if (!player.alive && !GameState.gameOver) {
            GameState.triggerDeath();
            EventBus.emit('game_over');
            // 敌方击杀玩家获得RP
            SupportSystem.onEnemyKill(true);
        }
    },

    _onBulletHitTeammate(bullet, teammate, teammates, index) {
        // 头盔跳弹/减伤判定
        if (teammate.hasHelmet && teammate.hasHelmet() && teammate.helmet !== HelmetTier.NONE) {
            const weaponType = bullet.weaponType || null;
            if (tryRicochet(teammate.helmet, weaponType)) {
                bullet.alive = false;
                EffectsManager.spawnRicochetEffect(bullet.x, bullet.y);
                playRicochet(teammate);
                return;
            }
            const helmetCfg = getHelmetConfig(teammate.helmet);
            bullet.damage = Math.floor(bullet.damage * (1 - helmetCfg.damageReduction));
        }
        teammate.takeDamage(bullet.damage, bullet.x, bullet.y, bullet.vx, bullet.vy);
        playBulletHit(teammate);
        if (!teammate.alive) {
            console.log('💔 队友阵亡，加入重生队列');
            GameState.teammateRespawnQueue.push({ timer: GameState.config.teammate.respawnDelay });
            // 敌方击杀队友获得RP
            SupportSystem.onEnemyKill(false);
        }
    },

    _onBulletHitEnemy(bullet, enemy, player, enemies, index) {
        // 头盔跳弹/减伤判定
        if (enemy.hasHelmet && enemy.hasHelmet() && enemy.helmet !== HelmetTier.NONE) {
            const weaponType = bullet.weaponType || null;
            if (tryRicochet(enemy.helmet, weaponType)) {
                // 跳弹：完全免伤
                bullet.alive = false;
                EffectsManager.spawnRicochetEffect(bullet.x, bullet.y);
                playRicochet(enemy);
                return;
            }
            // 减伤：降低子弹伤害
            const helmetCfg = getHelmetConfig(enemy.helmet);
            bullet.damage = Math.floor(bullet.damage * (1 - helmetCfg.damageReduction));
        }
        const wasDying = enemy.dying;
        enemy.takeDamage(bullet.damage, bullet.x, bullet.y, bullet.vx, bullet.vy);
        if (bullet.knockback > 0) {
            const kbAngle = Math.atan2(bullet.vy, bullet.vx);
            enemy.x += Math.cos(kbAngle) * bullet.knockback;
            enemy.y += Math.sin(kbAngle) * bullet.knockback;
        }
        EffectsManager.spawnParticles(bullet.x, bullet.y, ParticleType.SPARK, COLLISION_FX.SPARK_PARTICLE_COUNT);
        EffectsManager.addDamageNumber(enemy.x, enemy.y, bullet.damage, false);
        playBulletHit(enemy);
        if (bullet.shooter === player) triggerHitMarker();
        // 检测敌人刚进入dying状态的瞬间（takeDamage中设置的）
        if (!wasDying && enemy.dying) {
            EffectsManager.triggerShake(COLLISION_FX.ENEMY_DEATH_SHAKE_INTENSITY, COLLISION_FX.ENEMY_DEATH_SHAKE_DURATION);
            if (bullet.shooter === player && player.alive) {
                player.addKill();
                triggerKill();
                const rankCfg = getRankConfig(enemy.rank || AIRank.PRIVATE);
                const rpReward = rankCfg.killReward;
                GameState.rp += rpReward;
                console.log(`💰 击杀${rankCfg.name}！+${rpReward} RP (当前: ${GameState.rp})`);
            }
        }
    },

    // ─── 辅助工具 ───

    /** 触发爆炸弹的爆炸效果（命中墙壁或实体时调用） */
    _triggerBulletExplosion(bullet, directHitTarget = null) {
        if (!bullet.explosion) return;
        playExplosion(bullet);
        window.dispatchEvent(new CustomEvent('grenade_explode', {
            detail: {
                x: bullet.x,
                y: bullet.y,
                radius: bullet.explosion.radius,
                damage: bullet.explosion.damage,
                directHitTarget
            }
        }));
    }
};

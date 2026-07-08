// src/systems/CollisionSystem.js
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Terrain } from '../core/Map.js';
import { EffectsManager, ParticleType } from '../utils/EffectsManager.js';
import { playExplosion } from '../utils/SoundManager.js';

export const CollisionSystem = {
    // 线段与圆的碰撞检测（防止高速子弹穿透）
    lineCircleCollision(x1, y1, x2, y2, cx, cy, radius) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const fx = x1 - cx;
        const fy = y1 - cy;
        const a = dx * dx + dy * dy;
        if (a === 0) {
            // 子弹没有移动（首帧），退化为点检测
            return (fx * fx + fy * fy) < radius * radius;
        }
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - radius * radius;
        let discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return false;
        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);
        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
    },

    // 圆与矩形碰撞解决（用于地图房屋）
    resolveCircleMap(entity) {
        const map = GameState.map;
        if (!map) return;
        const radius = entity.radius;
        const tileSize = map.tileSize;
        
        // 检查实体周围的地图格子
        const minCol = Math.floor((entity.x - radius) / tileSize);
        const maxCol = Math.floor((entity.x + radius) / tileSize);
        const minRow = Math.floor((entity.y - radius) / tileSize);
        const maxRow = Math.floor((entity.y + radius) / tileSize);
        
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const tile = map.getTile(col, row);
                if (tile === Terrain.HOUSE || tile === Terrain.MOUNTAIN) {
                    // 计算方格的世界坐标边界
                    const tileLeft = col * tileSize;
                    const tileRight = tileLeft + tileSize;
                    const tileTop = row * tileSize;
                    const tileBottom = tileTop + tileSize;
                    
                    // 找到方格上离实体中心最近的点
                    const closestX = Math.max(tileLeft, Math.min(entity.x, tileRight));
                    const closestY = Math.max(tileTop, Math.min(entity.y, tileBottom));
                    
                    // 计算距离
                    const dx = entity.x - closestX;
                    const dy = entity.y - closestY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // 如果距离小于半径，说明发生碰撞
                    if (dist < radius) {
                        // 计算重叠量并推开
                        const overlap = radius - dist;
                        if (dist > 0) {
                            entity.x += (dx / dist) * overlap;
                            entity.y += (dy / dist) * overlap;
                        } else {
                            // 实体中心在方格内，向任意方向推开
                            entity.x += radius;
                        }
                        return;
                    }
                }
            }
        }
    },

    checkAll() {
        const { player, enemies, teammates, bullets, capturePoints, map } = GameState;
        if (!player || GameState.gameOver) return;

        // ---- 所有移动单位 vs 地图房屋 ----
        const allEntities = [player, ...enemies, ...teammates].filter(e => e && e.alive);
        for (const entity of allEntities) {
            this.resolveCircleMap(entity);
        }

        // ---- 子弹 vs 地图房屋 ----
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) continue;
            if (map) {
                const { col, row } = map.worldToTile(bullet.x, bullet.y);
                const tile = map.getTile(col, row);
                if (tile === Terrain.HOUSE || tile === Terrain.MOUNTAIN) {
                    // 爆炸弹命中墙壁触发爆炸
                    if (bullet.explosion) {
                        playExplosion(bullet);
                        window.dispatchEvent(new CustomEvent('grenade_explode', {
                            detail: { x: bullet.x, y: bullet.y, radius: bullet.explosion.radius, damage: bullet.explosion.damage }
                        }));
                    }
                    bullet.alive = false;
                    bullets.splice(i, 1);
                    continue;
                }
            }
        }

        // ---- 子弹 vs 子弹抵消 ----
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b1 = bullets[i];
            if (!b1.alive) continue;
            for (let j = i - 1; j >= 0; j--) {
                const b2 = bullets[j];
                if (!b2.alive) continue;
                if (b1.isEnemy !== b2.isEnemy) {
                    const dx = b1.x - b2.x;
                    const dy = b1.y - b2.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < b1.radius + b2.radius) {
                        b1.alive = false;
                        b2.alive = false;
                        break;
                    }
                }
            }
        }

        // ---- 子弹 vs 实体（玩家、队友、敌人） ----
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) {
                bullets.splice(i, 1);
                continue;
            }
            let bulletUsed = false;

            if (bullet.isEnemy) {
                // 敌人子弹 -> 玩家和队友
                // 玩家
                const hitRadiusPlayer = bullet.radius + player.radius;
                if (this.lineCircleCollision(bullet.prevX ?? bullet.x, bullet.prevY ?? bullet.y, bullet.x, bullet.y, player.x, player.y, hitRadiusPlayer)) {
                    player.takeDamage(bullet.damage, bullet.x, bullet.y);
                    bulletUsed = true;
                    // 特效：玩家受伤
                    EffectsManager.spawnParticles(bullet.x, bullet.y, ParticleType.HIT, 6);
                    EffectsManager.addDamageNumber(bullet.x, bullet.y, bullet.damage, true);
                    EffectsManager.triggerShake(6, 8);
                    // 触发玩家受伤事件
                    EventBus.emit('player_hurt', { health: player.health });
                    if (!player.alive) {
                        GameState.gameOver = true;
                        EventBus.emit('game_over');
                    }
                }
                if (!bulletUsed) {
                    for (let j = teammates.length - 1; j >= 0; j--) {
                        const teammate = teammates[j];
                        if (!teammate.alive) continue;
                        const hitRadiusTeammate = bullet.radius + teammate.radius;
                        if (this.lineCircleCollision(bullet.prevX ?? bullet.x, bullet.prevY ?? bullet.y, bullet.x, bullet.y, teammate.x, teammate.y, hitRadiusTeammate)) {
                            teammate.takeDamage(bullet.damage, bullet.x, bullet.y);
                            bulletUsed = true;
                            if (!teammate.alive) {
                                console.log('💔 队友阵亡，加入重生队列');
                                // 加入重生队列
                                GameState.teammateRespawnQueue.push({
                                    timer: GameState.config.teammate.respawnDelay
                                });
                                teammates.splice(j, 1);
                            }
                            break;
                        }
                    }
                }
            } else {
                // 玩家/队友子弹 -> 敌人
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    if (!enemy.alive) continue;
                    
                    // 穿透子弹跳过已击中目标
                    if (bullet.penetration && bullet.hitTargets.has(enemy)) continue;
                    
                    const hitRadiusEnemy = bullet.radius + enemy.radius;
                    if (this.lineCircleCollision(bullet.prevX ?? bullet.x, bullet.prevY ?? bullet.y, bullet.x, bullet.y, enemy.x, enemy.y, hitRadiusEnemy)) {
                        enemy.takeDamage(bullet.damage, bullet.x, bullet.y);
                        
                        // 击退效果
                        if (bullet.knockback > 0) {
                            const kbAngle = Math.atan2(bullet.vy, bullet.vx);
                            enemy.x += Math.cos(kbAngle) * bullet.knockback;
                            enemy.y += Math.sin(kbAngle) * bullet.knockback;
                        }
                        // 特效：子弹击中敌人
                        EffectsManager.spawnParticles(bullet.x, bullet.y, ParticleType.SPARK, 6);
                        EffectsManager.addDamageNumber(enemy.x, enemy.y, bullet.damage, false);
                        if (!enemy.alive) {
                            // 特效：敌人死亡爆炸
                            EffectsManager.spawnParticles(enemy.x, enemy.y, ParticleType.EXPLOSION, 15);
                            EffectsManager.triggerShake(5, 6);
                            // 只有玩家本人击杀才计分（排除队友击杀）
                            if (bullet.shooter === player && player.alive) {
                                player.addKill();
                                // 增加RP（金钱）
                                GameState.rp += 10;
                                console.log(`💰 击杀敌人！+10 RP (当前: ${GameState.rp})`);
                            }
                            // 立即移除（最后移除，确保特效用到了 enemy 坐标）
                            enemies.splice(j, 1);
                        }
                        
                        // 穿透逻辑
                        if (bullet.penetration && bullet.remainingPenetration > 0) {
                            // 记录已击中，减少穿透次数，衰减伤害
                            bullet.hitTargets.add(enemy);
                            bullet.remainingPenetration--;
                            bullet.damage *= bullet.penetration.damageDecay;
                            // 不设置 bulletUsed，子弹继续飞行
                        } else {
                            bulletUsed = true;
                            break;
                        }
                    }
                }
            }

            if (bulletUsed) {
                // 爆炸弹命中实体后触发爆炸
                if (bullet.explosion) {
                    playExplosion(bullet);
                    window.dispatchEvent(new CustomEvent('grenade_explode', {
                        detail: { x: bullet.x, y: bullet.y, radius: bullet.explosion.radius, damage: bullet.explosion.damage }
                    }));
                }
                bullets.splice(i, 1);
            }
        }

        // ---- 敌人 vs 玩家/队友（碰撞伤害已移除）----

        GameState.bullets = GameState.bullets.filter(b => b.alive);
    }
};

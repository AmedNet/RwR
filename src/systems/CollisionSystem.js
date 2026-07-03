// src/systems/CollisionSystem.js
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Terrain } from '../core/Map.js';

export const CollisionSystem = {
    // 圆与矩形碰撞解决（用于地图房屋）
    resolveCircleMap(entity) {
        const map = GameState.map;
        if (!map) return;
        const radius = entity.radius;
        // 检查实体中心附近的格子，如果不可通行则推开
        const margin = radius * 0.8;
        const checkPoints = [
            { dx: 0, dy: 0 },
            { dx: margin, dy: 0 },
            { dx: -margin, dy: 0 },
            { dx: 0, dy: margin },
            { dx: 0, dy: -margin },
            { dx: margin, dy: margin },
            { dx: -margin, dy: -margin },
            { dx: margin, dy: -margin },
            { dx: -margin, dy: margin }
        ];
        for (const pt of checkPoints) {
            const wx = entity.x + pt.dx;
            const wy = entity.y + pt.dy;
            const { col, row } = map.worldToTile(wx, wy);
            const tile = map.getTile(col, row);
            if (tile === Terrain.HOUSE) {
                // 简单推开：沿方向反推
                const overlap = radius * 0.6;
                const angle = Math.atan2(wy - entity.y, wx - entity.x);
                entity.x -= Math.cos(angle) * overlap;
                entity.y -= Math.sin(angle) * overlap;
                break;
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
                if (tile === Terrain.HOUSE) {
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
                let dx = bullet.x - player.x;
                let dy = bullet.y - player.y;
                if (dx*dx + dy*dy < (bullet.radius + player.radius) ** 2) {
                    player.takeDamage(bullet.damage);
                    bulletUsed = true;
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
                        dx = bullet.x - teammate.x;
                        dy = bullet.y - teammate.y;
                        if (dx*dx + dy*dy < (bullet.radius + teammate.radius) ** 2) {
                            teammate.takeDamage(bullet.damage);
                            bulletUsed = true;
                            if (!teammate.alive) {
                                console.log('💔 队友阵亡');
                                // 立即移除（也可等全局过滤）
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
                    const dx = bullet.x - enemy.x;
                    const dy = bullet.y - enemy.y;
                    if (dx*dx + dy*dy < (bullet.radius + enemy.radius) ** 2) {
                        enemy.takeDamage(bullet.damage);
                        bulletUsed = true;
                        if (!enemy.alive) {
                            // 立即移除
                            enemies.splice(j, 1);
                            if (player && player.alive) {
                                player.addKill();
                            }
                        }
                        break;
                    }
                }
            }

            if (bulletUsed) {
                bullets.splice(i, 1);
            }
        }

        // ---- 敌人 vs 玩家/队友（碰撞伤害） ----
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!enemy.alive) continue;
            // 对玩家
            let dx = enemy.x - player.x;
            let dy = enemy.y - player.y;
            if (dx*dx + dy*dy < (enemy.radius + player.radius) ** 2) {
                player.takeDamage(5);
                EventBus.emit('player_hurt', { health: player.health });
                if (!player.alive) {
                    GameState.gameOver = true;
                    EventBus.emit('game_over');
                }
                const angle = Math.atan2(dy, dx);
                enemy.x += Math.cos(angle) * 20;
                enemy.y += Math.sin(angle) * 20;
                continue;
            }
            // 对队友
            for (let j = teammates.length - 1; j >= 0; j--) {
                const teammate = teammates[j];
                if (!teammate.alive) continue;
                dx = enemy.x - teammate.x;
                dy = enemy.y - teammate.y;
                if (dx*dx + dy*dy < (enemy.radius + teammate.radius) ** 2) {
                    teammate.takeDamage(5);
                    if (!teammate.alive) {
                        console.log('💔 队友阵亡');
                        teammates.splice(j, 1);
                    }
                    const angle = Math.atan2(dy, dx);
                    enemy.x += Math.cos(angle) * 20;
                    enemy.y += Math.sin(angle) * 20;
                    break;
                }
            }
        }

        GameState.bullets = GameState.bullets.filter(b => b.alive);
    }
};
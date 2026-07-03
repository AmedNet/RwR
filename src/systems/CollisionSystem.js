// src/systems/CollisionSystem.js
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';

export const CollisionSystem = {
    resolveCircleObstacle(entity, obstacle) {
        const cx = entity.x;
        const cy = entity.y;
        const radius = entity.radius;
        const closestX = Math.max(obstacle.x, Math.min(cx, obstacle.x + obstacle.width));
        const closestY = Math.max(obstacle.y, Math.min(cy, obstacle.y + obstacle.height));
        const dx = cx - closestX;
        const dy = cy - closestY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < radius && dist > 0.001) {
            const overlap = radius - dist;
            const normX = dx / dist;
            const normY = dy / dist;
            entity.x += normX * overlap;
            entity.y += normY * overlap;
        } else if (dist < 0.001) {
            entity.x += radius;
        }
    },

    checkAll() {
        const { player, enemies, bullets, obstacles } = GameState;
        if (!player || GameState.gameOver) return;

        // 1. 玩家 vs 障碍物
        for (const obstacle of obstacles) {
            if (obstacle.collidesWithCircle(player.x, player.y, player.radius)) {
                this.resolveCircleObstacle(player, obstacle);
            }
        }

        // 2. 敌人 vs 障碍物
        for (const enemy of enemies) {
            for (const obstacle of obstacles) {
                if (obstacle.collidesWithCircle(enemy.x, enemy.y, enemy.radius)) {
                    this.resolveCircleObstacle(enemy, obstacle);
                }
            }
        }

        // 3. 子弹 vs 障碍物
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) continue;
            let hit = false;
            for (const obstacle of obstacles) {
                if (obstacle.collidesWithCircle(bullet.x, bullet.y, bullet.radius)) {
                    bullet.alive = false;
                    hit = true;
                    break;
                }
            }
            if (hit) {
                bullets.splice(i, 1);
            }
        }

        // 4. 子弹 vs 子弹抵消（不同阵营）
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

        // 5. 子弹 vs 实体（原有）
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) {
                bullets.splice(i, 1);
                continue;
            }
            let bulletUsed = false;
            if (bullet.isEnemy) {
                const dx = bullet.x - player.x;
                const dy = bullet.y - player.y;
                if (dx*dx + dy*dy < (bullet.radius + player.radius) ** 2) {
                    player.takeDamage(bullet.damage);
                    bulletUsed = true;
                    if (!player.alive) {
                        GameState.gameOver = true;
                        EventBus.emit('game_over');
                    }
                }
            } else {
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    const dx = bullet.x - enemy.x;
                    const dy = bullet.y - enemy.y;
                    if (dx*dx + dy*dy < (bullet.radius + enemy.radius) ** 2) {
                        enemy.takeDamage(bullet.damage);
                        bulletUsed = true;
                        if (!enemy.alive) {
                            enemies.splice(j, 1);
                            player.addKill();
                        }
                        break;
                    }
                }
            }
            if (bulletUsed) {
                bullets.splice(i, 1);
            }
        }

        // 6. 敌人 vs 玩家
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            if (dx*dx + dy*dy < (enemy.radius + player.radius) ** 2) {
                player.takeDamage(5);
                if (!player.alive) {
                    GameState.gameOver = true;
                    EventBus.emit('game_over');
                }
                const angle = Math.atan2(dy, dx);
                enemy.x += Math.cos(angle) * 20;
                enemy.y += Math.sin(angle) * 20;
            }
        }

        GameState.bullets = GameState.bullets.filter(b => b.alive);
    }
};
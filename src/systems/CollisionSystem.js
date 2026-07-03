// src/systems/CollisionSystem.js
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';

export const CollisionSystem = {
    checkAll() {
        const { player, enemies, bullets } = GameState;
        if (!player || GameState.gameOver) return;

        // 子弹 vs 实体
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) {
                bullets.splice(i, 1);
                continue;
            }

            let bulletUsed = false;

            if (bullet.isEnemy) {
                // 敌人子弹 → 玩家
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
                // 玩家子弹 → 敌人
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

        // 敌人 vs 玩家（碰撞伤害）
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
    }
};
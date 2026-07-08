// src/systems/CollisionSystem.js
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Terrain } from '../core/Map.js';
import { EffectsManager, ParticleType } from '../utils/EffectsManager.js';
import { playExplosion, playBulletHit } from '../utils/SoundManager.js';

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
        if (!map) return;
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
                    return;
                }
            }
        }
    },

    // ─── 主碰撞检测入口 ───

    checkAll() {
        const { player, enemies, teammates, bullets, map } = GameState;
        if (!player || GameState.gameOver) return;
        this._checkEntitiesVsMap(player, enemies, teammates);
        this._checkBulletsVsMap(bullets, map);
        this._checkBulletVsBullet(bullets);
        this._checkBulletsVsEntities(bullets, player, enemies, teammates);
        GameState.bullets = GameState.bullets.filter(b => b.alive);
    },

    // ─── 实体 vs 地图 ───

    _checkEntitiesVsMap(player, enemies, teammates) {
        const allEntities = [player, ...enemies, ...teammates].filter(e => e && e.alive);
        for (const entity of allEntities) {
            this.resolveCircleMap(entity);
        }
    },

    // ─── 子弹 vs 地图 ───

    _checkBulletsVsMap(bullets, map) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) continue;
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

    // ─── 子弹 vs 实体 ───

    _checkBulletsVsEntities(bullets, player, enemies, teammates) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.alive) {
                bullets.splice(i, 1);
                continue;
            }
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
        if (this._bulletHitsCircle(bullet, player)) {
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

    // ─── 命中处理回调 ───

    _onBulletHitPlayer(bullet, player) {
        player.takeDamage(bullet.damage, bullet.x, bullet.y);
        EffectsManager.spawnParticles(bullet.x, bullet.y, ParticleType.HIT, COLLISION_FX.HIT_PARTICLE_COUNT);
        EffectsManager.addDamageNumber(bullet.x, bullet.y, bullet.damage, true);
        EffectsManager.triggerShake(COLLISION_FX.PLAYER_HIT_SHAKE_INTENSITY, COLLISION_FX.PLAYER_HIT_SHAKE_DURATION);
        EffectsManager.spawnBloodSplatter(bullet.x, bullet.y, bullet.vx, bullet.vy, bullet.damage);
        playBulletHit(player);
        EventBus.emit('player_hurt', { health: player.health });
        if (!player.alive) {
            GameState.gameOver = true;
            EventBus.emit('game_over');
        }
    },

    _onBulletHitTeammate(bullet, teammate, teammates, index) {
        teammate.takeDamage(bullet.damage, bullet.x, bullet.y);
        EffectsManager.spawnBloodSplatter(bullet.x, bullet.y, bullet.vx, bullet.vy, bullet.damage);
        playBulletHit(teammate);
        if (!teammate.alive) {
            console.log('💔 队友阵亡，加入重生队列');
            GameState.teammateRespawnQueue.push({ timer: GameState.config.teammate.respawnDelay });
            teammates.splice(index, 1);
        }
    },

    _onBulletHitEnemy(bullet, enemy, player, enemies, index) {
        enemy.takeDamage(bullet.damage, bullet.x, bullet.y);
        if (bullet.knockback > 0) {
            const kbAngle = Math.atan2(bullet.vy, bullet.vx);
            enemy.x += Math.cos(kbAngle) * bullet.knockback;
            enemy.y += Math.sin(kbAngle) * bullet.knockback;
        }
        EffectsManager.spawnParticles(bullet.x, bullet.y, ParticleType.SPARK, COLLISION_FX.SPARK_PARTICLE_COUNT);
        EffectsManager.addDamageNumber(enemy.x, enemy.y, bullet.damage, false);
        EffectsManager.spawnBloodSplatter(bullet.x, bullet.y, bullet.vx, bullet.vy, bullet.damage);
        playBulletHit(enemy);
        if (!enemy.alive) {
            EffectsManager.spawnParticles(enemy.x, enemy.y, ParticleType.EXPLOSION, COLLISION_FX.ENEMY_DEATH_PARTICLE_COUNT);
            EffectsManager.triggerShake(COLLISION_FX.ENEMY_DEATH_SHAKE_INTENSITY, COLLISION_FX.ENEMY_DEATH_SHAKE_DURATION);
            if (bullet.shooter === player && player.alive) {
                player.addKill();
                GameState.rp += COLLISION_FX.KILL_RP_REWARD;
                console.log(`💰 击杀敌人！+${COLLISION_FX.KILL_RP_REWARD} RP (当前: ${GameState.rp})`);
            }
            enemies.splice(index, 1);
        }
    },

    // ─── 辅助工具 ───

    /** 触发爆炸弹的爆炸效果（命中墙壁或实体时调用） */
    _triggerBulletExplosion(bullet) {
        if (!bullet.explosion) return;
        playExplosion(bullet);
        window.dispatchEvent(new CustomEvent('grenade_explode', {
            detail: { x: bullet.x, y: bullet.y, radius: bullet.explosion.radius, damage: bullet.explosion.damage }
        }));
    }
};
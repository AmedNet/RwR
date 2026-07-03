// src/entities/Teammate.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { Bullet } from './Bullet.js';

export class Teammate extends Entity {
    constructor(x, y, config) {
        super(x, y, {
            health: config.health || 50,
            speed: config.speed || 2.2,
            radius: config.radius || 15
        });
        this.shootCooldown = 0;
        this.shootDelay = config.shootDelay || 25;
        this.damage = config.damage || 15;
        this.bulletSpeed = config.bulletSpeed || 6;
        this.followDistance = 100 + Math.random() * 50; // 跟随距离随机
        this.color = '#42A5F5'; // 蓝色，区别于玩家绿色
        this.alive = true;
    }

    // 获取最近的可攻击目标（敌人）
    getClosestEnemy() {
        let target = null;
        let minDist = Infinity;
        for (const enemy of GameState.enemies) {
            if (!enemy.alive) continue;
            const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (d < minDist) {
                minDist = d;
                target = enemy;
            }
        }
        return { target, distance: minDist };
    }

    // 寻找最近的敌方据点（用于进攻）
    getClosestEnemyPoint() {
        let target = null;
        let minDist = Infinity;
        for (const point of GameState.capturePoints) {
            if (point.owner === 'player') continue; // 己方据点不去
            const d = Math.hypot(point.x - this.x, point.y - this.y);
            if (d < minDist) {
                minDist = d;
                target = point;
            }
        }
        return { target, distance: minDist };
    }

    // 判断是否在己方据点内
    isInFriendlyPoint() {
        for (const point of GameState.capturePoints) {
            if (point.owner === 'player' && this.contains(point)) {
                return true;
            }
        }
        return false;
    }

    // 检测自己是否在据点内
    contains(point) {
        const dx = point.x - this.x;
        const dy = point.y - this.y;
        return dx*dx + dy*dy < (point.radius + this.radius) ** 2;
    }

    update() {
        if (GameState.gameOver || !this.alive) return;
        const player = GameState.player;
        if (!player || !player.alive) return;

        // 1. 寻找最近的敌人
        const { target, distance } = this.getClosestEnemy();

        // 2. 寻找最近的敌方据点
        const { target: captureTarget, distance: captureDist } = this.getClosestEnemyPoint();

        // 3. 判断战术策略：
        //    - 有敌人（< 400）-> 优先战斗
        //    - 有非己方据点 -> 前往攻占（优先去最近的敌方据点）
        //    - 所有据点都是己方的 -> 去最近的己方据点巡逻
        const hasNearbyEnemy = target && distance < 400;

        let moveX = 0, moveY = 0;
        let targetX = null, targetY = null;

        if (hasNearbyEnemy) {
            // 战斗模式：侧向环绕敌人
            const angleToEnemy = Math.atan2(target.y - this.y, target.x - this.x);
            moveX = -Math.sin(angleToEnemy) * 0.5;
            moveY = Math.cos(angleToEnemy) * 0.5;
        } else if (captureTarget) {
            // 有非己方据点 -> 前往攻占（任何距离）
            targetX = captureTarget.x;
            targetY = captureTarget.y;
        } else {
            // 所有据点都是己方的 -> 去最近的己方据点驻守
            let nearestFriendly = null;
            let nearestFriendlyDist = Infinity;
            for (const point of GameState.capturePoints) {
                if (point.owner === 'player') {
                    const d = Math.hypot(point.x - this.x, point.y - this.y);
                    if (d < nearestFriendlyDist) {
                        nearestFriendlyDist = d;
                        nearestFriendly = point;
                    }
                }
            }
            if (nearestFriendly) {
                const dx = nearestFriendly.x - this.x;
                const dy = nearestFriendly.y - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 60) {
                    targetX = nearestFriendly.x;
                    targetY = nearestFriendly.y;
                } else {
                    // 已在据点附近，小幅巡逻
                    moveX = (Math.random() - 0.5) * 0.4;
                    moveY = (Math.random() - 0.5) * 0.4;
                }
            }
        }

        // 如果目标是据点，计算移动方向
        if (targetX !== null && targetY !== null) {
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 40) { // 还没到据点，继续前进
                moveX = dx / dist;
                moveY = dy / dist;
            } else {
                // 已到达据点附近，小幅徘徊
                moveX = (Math.random() - 0.5) * 0.3;
                moveY = (Math.random() - 0.5) * 0.3;
            }
        }

        // 归一化并应用速度（考虑地形减速）
        const len = Math.hypot(moveX, moveY);
        if (len > 0.01) {
            const speedFactor = GameState.map ? GameState.map.getSpeedFactor(this.x, this.y) : 1;
            const finalSpeed = this.speed * speedFactor;
            this.x += (moveX / len) * finalSpeed;
            this.y += (moveY / len) * finalSpeed;
        }

        // 地图碰撞（防止走入房屋等不可通行区域）
        if (GameState.map && !GameState.map.isWalkable(this.x, this.y, this.radius)) {
            // 回退到上一帧位置（简单处理，也可以尝试推开）
            // 这里简化：直接拉回
            const dxBack = this.x - (this.x - (moveX / len) * this.speed);
            const dyBack = this.y - (this.y - (moveY / len) * this.speed);
            this.x -= dxBack * 0.8;
            this.y -= dyBack * 0.8;
            // 如果仍然不可通行，直接重置到玩家附近
            if (!GameState.map.isWalkable(this.x, this.y, this.radius)) {
                this.x = player.x + (Math.random() - 0.5) * 80;
                this.y = player.y + (Math.random() - 0.5) * 80;
            }
        }

        // 世界边界限制
        const world = GameState.config.world;
        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        // 3. 射击逻辑
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        } else if (target && distance < 350) {
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            const bullet = new Bullet(
                this.x + Math.cos(angle) * this.radius,
                this.y + Math.sin(angle) * this.radius,
                Math.cos(angle) * this.bulletSpeed,
                Math.sin(angle) * this.bulletSpeed,
                false, // 友军子弹属于玩家阵营
                this.damage
            );
            GameState.bullets.push(bullet);
            this.shootCooldown = this.shootDelay;
        }
    }

    draw(ctx) {
        ctx.save();
        // 身体（蓝色）
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#0D47A1';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 友军标识（空心星）
        ctx.fillStyle = '#BBDEFB';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', 0, -2);

        // 血条
        const hpPercent = this.health / this.maxHealth;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-18, -25, 36, 4);
        ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : (hpPercent > 0.3 ? '#FFC107' : '#f44336');
        ctx.fillRect(-18, -25, 36 * hpPercent, 4);
        ctx.restore();
    }
}
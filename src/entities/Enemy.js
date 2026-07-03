// src/entities/Enemy.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { Bullet } from './Bullet.js';

export class Enemy extends Entity {
    constructor(x, y, config) {
        const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
        super(x, y, {
            health: config.health,
            speed: speed,
            radius: config.radius
        });
        this.shootCooldown = 0;
        this.shootDelay = config.shootDelayMin + Math.floor(Math.random() * (config.shootDelayMax - config.shootDelayMin));
        const colors = GameState.config.colors;
        const hue = colors.enemyHueMin + Math.random() * (colors.enemyHueMax - colors.enemyHueMin);
        this.color = `hsl(${hue}, 70%, 50%)`;
        this.damage = config.damage;
        this.config = config;
    }

    getTargets() {
        const targets = [];
        if (GameState.player && GameState.player.alive) {
            targets.push(GameState.player);
        }
        for (const teammate of GameState.teammates) {
            if (teammate.alive) {
                targets.push(teammate);
            }
        }
        return targets;
    }

    // 寻找最近的敌方据点（非敌方阵营的据点）
    getClosestTargetPoint() {
        let target = null;
        let minDist = Infinity;
        for (const point of GameState.capturePoints) {
            if (point.owner === 'enemy') continue; // 己方据点不去
            const d = Math.hypot(point.x - this.x, point.y - this.y);
            if (d < minDist) {
                minDist = d;
                target = point;
            }
        }
        return { target, distance: minDist };
    }

    update() {
        if (GameState.gameOver) return;

        // 优先级1: 寻找最近的己方据点（敌方归属）-> 前往占领
        const { target: captureTarget, distance: captureDist } = this.getClosestTargetPoint();
        
        // 优先级2: 寻找附近的敌人（玩家/队友）
        const targets = this.getTargets();
        let closestTarget = null;
        let closestDist = Infinity;
        for (const t of targets) {
            if (!t.alive) continue;
            const d = Math.hypot(t.x - this.x, t.y - this.y);
            if (d < closestDist) {
                closestDist = d;
                closestTarget = t;
            }
        }

        let targetX = null, targetY = null;
        let hasEnemyTarget = false;

        // 决策逻辑：如果有据点可占领，优先去据点
        // 但如果敌人挡在路上或离得很近，先打敌人
        if (captureTarget && (closestDist > 300 || !closestTarget)) {
            // 去占领据点
            targetX = captureTarget.x;
            targetY = captureTarget.y;
        } else if (closestTarget) {
            // 攻击最近的敌人
            targetX = closestTarget.x;
            targetY = closestTarget.y;
            hasEnemyTarget = true;
        }

        // 移动向目标
        if (targetX !== null && targetY !== null) {
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 10) {
                const normX = dx / dist;
                const normY = dy / dist;
                const speedFactor = GameState.map ? GameState.map.getSpeedFactor(this.x, this.y) : 1;
                const finalSpeed = this.speed * speedFactor;
                let newX = this.x + normX * finalSpeed;
                let newY = this.y + normY * finalSpeed;
                // 地图碰撞检测
                if (GameState.map && !GameState.map.isWalkable(newX, newY, this.radius)) {
                    if (GameState.map.isWalkable(newX, this.y, this.radius)) {
                        this.x = newX;
                    } else if (GameState.map.isWalkable(this.x, newY, this.radius)) {
                        this.y = newY;
                    }
                } else {
                    this.x = newX;
                    this.y = newY;
                }
            }
        }

        // 世界边界
        const world = GameState.config.world;
        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        // 射击：只攻击敌人目标（不射击据点）
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        } else if (hasEnemyTarget && closestTarget && closestDist < 400) {
            const angle = Math.atan2(closestTarget.y - this.y, closestTarget.x - this.x);
            const speed = 4.5;
            const bullet = new Bullet(
                this.x + Math.cos(angle) * this.radius,
                this.y + Math.sin(angle) * this.radius,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                true,
                this.damage
            );
            GameState.bullets.push(bullet);
            this.shootCooldown = this.shootDelay;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#4a0000';
        ctx.lineWidth = 2;
        ctx.stroke();

        const hpPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(-20, -25, 40, 5);
        ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : (hpPercent > 0.3 ? '#FFC107' : '#f44336');
        ctx.fillRect(-20, -25, 40 * hpPercent, 5);

        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✧', 0, 0);
        ctx.restore();
    }
}
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

    update() {
        if (GameState.gameOver) return;

        // 寻找最近目标
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

        if (!closestTarget) return;

        // 移动向目标
        const dx = closestTarget.x - this.x;
        const dy = closestTarget.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
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

        // 世界边界
        const world = GameState.config.world;
        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        // 射击
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        } else if (closestTarget && closestDist < 400) {
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
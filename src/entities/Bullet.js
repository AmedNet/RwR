// src/entities/Bullet.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';

export class Bullet extends Entity {
    constructor(x, y, vx, vy, isEnemy, damage, isPlayer = false, knockback = 0, bulletRadius = null, maxRange = null) {
        const config = GameState.config.bullet;
        super(x, y, {
            radius: bulletRadius || config.radius,
            health: 1,
            speed: 0
        });
        this.startX = x;
        this.startY = y;
        this.vx = vx;
        this.vy = vy;
        this.isEnemy = isEnemy;
        this.isPlayer = isPlayer;
        this.damage = damage;
        this.knockback = knockback;
        this.maxRange = maxRange; // 最大射程（像素），超过后消失
        this.life = config.life;
        this.alive = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        // 检查最大射程（霰弹枪用）
        if (this.maxRange) {
            const dist = Math.hypot(this.x - this.startX, this.y - this.startY);
            if (dist > this.maxRange) {
                this.alive = false;
                return;
            }
        }

        const world = GameState.config.world;
        if (this.life <= 0 || this.x < -20 || this.x > world.width + 20 ||
            this.y < -20 || this.y > world.height + 20) {
            this.alive = false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isEnemy ? '#ff5252' : '#FFD740';
        ctx.shadowColor = this.isEnemy ? '#ff1744' : '#ffab00';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.restore();
    }
}
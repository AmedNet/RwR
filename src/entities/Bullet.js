// src/entities/Bullet.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import * as SoundManager from '../utils/SoundManager.js';

export class Bullet extends Entity {
    constructor(x, y, vx, vy, isEnemy, damage, isPlayer = false, knockback = 0, bulletRadius = null, maxRange = null, penetration = null, explosion = null, hasTrail = false, bulletColor = null, bulletGlow = null, shooter = null) {
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
        this.maxRange = maxRange; // 最大射程（像素），超过则消失
        this.life = config.life;
        this.alive = true;

        // 穿透属性（狙击枪用）
        this.penetration = penetration; // { maxTargets, damageDecay }
        this.hitTargets = new Set();    // 已击中目标集合
        this.remainingPenetration = penetration ? penetration.maxTargets : 0;

        // 爆炸弹属性（M82/AT4用）
        this.explosion = explosion; // { radius, damage }

        // 火箭弹拖尾（AT4用）
        this.hasTrail = hasTrail;
        this.trailTimer = 0;

        // 子弹颜色（由武器配置决定）
        this.bulletColor = bulletColor;
        this.bulletGlow = bulletGlow;

        // 射击者引用（用于判断击杀归属）
        this.shooter = shooter;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        // 火箭弹拖尾特效
        if (this.hasTrail && this.alive) {
            this.trailTimer++;
            if (this.trailTimer % 2 === 0) {
                EffectsManager.spawnRocketTrail(this.x, this.y);
            }
        }

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

        // 注意：碰撞检测由 CollisionSystem.js 统一处理，不在这里重复
    }

    draw(ctx) {
        ctx.save();
        if (this.hasTrail) {
            // 火箭弹：更大、使用武器配置的颜色
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = this.bulletColor || '#ff6d00';
            ctx.shadowColor = this.bulletGlow || '#ff3d00';
            ctx.shadowBlur = 20;
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            // 使用武器配置的颜色，如果没有则使用默认颜色
            if (this.bulletColor) {
                ctx.fillStyle = this.bulletColor;
                ctx.shadowColor = this.bulletGlow || this.bulletColor;
            } else {
                ctx.fillStyle = this.isEnemy ? '#ff5252' : '#FFD740';
                ctx.shadowColor = this.isEnemy ? '#ff1744' : '#ffab00';
            }
            ctx.shadowBlur = 15;
            ctx.fill();
        }
        ctx.restore();
    }
}

// src/entities/GrenadeBullet.js
// XM320 榴弹发射器专用实体 - 抛物线弹道，落地即炸
import { GameState } from '../core/GameState.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import { playExplosion } from '../utils/SoundManager.js';
import { getRankConfig, AIRank } from '../core/RankSystem.js';

export class GrenadeBullet {
    constructor(x, y, targetX, targetY, config, shooter) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.alive = true;

        // 目标点（受最大距离限制）
        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.hypot(dx, dy);
        const maxDist = config.arcRange || 500;

        if (dist > maxDist) {
            const ratio = maxDist / dist;
            this.targetX = x + dx * ratio;
            this.targetY = y + dy * ratio;
        } else {
            this.targetX = targetX;
            this.targetY = targetY;
        }

        // 抛物线参数
        const actualDist = Math.hypot(this.targetX - x, this.targetY - y);
        this.totalFrames = Math.max(25, Math.min(50, actualDist * 0.08));
        this.elapsed = 0;
        this.arcHeight = Math.min(60, actualDist * 0.12);

        // 爆炸参数
        this.damage = config.damage || 180;
        this.explosionRadius = config.explosionRadius || 120;
        this.explosionDamage = config.explosionDamage || 150;
        this.shrapnelRadius = config.shrapnelRadius || 200;
        this.shrapnelDamage = config.shrapnelDamage || 50;
        this.knockback = config.knockback || 40;

        // 射击者引用（用于击杀归属判定）
        this.shooter = shooter;

        // 碰撞系统跳过标记
        this.isArcProjectile = true;

        // 视觉
        this.bulletColor = config.bulletColor || '#b0c800';
        this.bulletGlow = config.bulletGlow || '#cdb500';
    }

    update() {
        if (!this.alive) return;

        this.elapsed++;

        const progress = Math.min(1, this.elapsed / this.totalFrames);
        const t = progress * Math.PI;

        // 地面投影坐标（用于碰撞检测和伤害判定）
        this.groundX = this.startX + (this.targetX - this.startX) * progress;
        this.groundY = this.startY + (this.targetY - this.startY) * progress;
        // 弧线视觉坐标（用于绘制）
        this.x = this.groundX;
        this.y = this.groundY - this.arcHeight * Math.sin(t);

        // 到达目标点 → 爆炸
        if (progress >= 1 || this.elapsed >= this.totalFrames) {
            this.explode();
            return;
        }

        // 碰到障碍 → 爆炸（使用地面投影坐标）
        const map = GameState.map;
        if (map && !map.isWalkable(this.groundX, this.groundY, this.radius)) {
            this.explode();
            return;
        }

        // 世界边界检查
        const world = GameState.config.world;
        if (this.groundX < this.radius || this.groundX > world.width - this.radius ||
            this.groundY < this.radius || this.groundY > world.height - this.radius) {
            this.alive = false;
            return;
        }
    }

    explode() {
        if (!this.alive) return;
        this.alive = false;

        // 使用地面投影坐标（实体在地面上，不是弧线上）
        const hitX = this.groundX;
        const hitY = this.groundY;

        // 音效 + 视觉
        playExplosion(this);
        EffectsManager.spawnGrenadeExplosion(hitX, hitY, this.explosionRadius);

        // 收集所有可伤害实体
        const entities = [
            ...GameState.enemies.filter(e => e.alive),
            ...GameState.teammates.filter(t => t.alive)
        ];
        if (GameState.player && GameState.player.alive) entities.push(GameState.player);

        for (const entity of entities) {
            if (entity === this.shooter) continue;

            const d = Math.hypot(entity.x - hitX, entity.y - hitY);
            const isPlayerEntity = entity === GameState.player;
            const wasDying = entity.dying;

            // 主爆炸范围
            if (d < this.explosionRadius) {
                const dmg = Math.floor(this.explosionDamage * (1 - d / this.explosionRadius * 0.5));
                if (dmg > 0) {
                    entity.takeDamage(dmg, hitX, hitY);
                    EffectsManager.addDamageNumber(entity.x, entity.y, dmg, isPlayerEntity);
                }
                const angle = Math.atan2(entity.y - hitY, entity.x - hitX);
                const kb = this.knockback * (1 - d / this.explosionRadius);
                entity.x += Math.cos(angle) * kb;
                entity.y += Math.sin(angle) * kb;
            }
            // 破片范围
            else if (d < this.shrapnelRadius) {
                const dmg = Math.floor(this.shrapnelDamage * (1 - (d - this.explosionRadius) / (this.shrapnelRadius - this.explosionRadius)));
                if (dmg > 0) {
                    entity.takeDamage(dmg, hitX, hitY);
                    EffectsManager.addDamageNumber(entity.x, entity.y, dmg, isPlayerEntity);
                }
                const angle = Math.atan2(entity.y - hitY, entity.x - hitX);
                const kb = this.knockback * 0.5 * (1 - d / this.shrapnelRadius);
                entity.x += Math.cos(angle) * kb;
                entity.y += Math.sin(angle) * kb;
            }

            // 击杀归属判定
            if (!wasDying && entity.dying && this.shooter === GameState.player && GameState.player.alive) {
                GameState.player.addKill();
                const rankCfg = getRankConfig(entity.rank || AIRank.PRIVATE);
                const rpReward = rankCfg.killReward;
                GameState.rp += rpReward;
            }
        }
    }

    draw(ctx) {
        if (!this.alive) return;

        ctx.save();

        // 飞行中显示轨迹光晕
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        ctx.fill();

        // 榴弹主体
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.bulletColor;
        ctx.shadowColor = this.bulletGlow;
        ctx.shadowBlur = 12;
        ctx.fill();

        // 高光
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(-2, -2, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();

        ctx.restore();
    }
}

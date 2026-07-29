// src/entities/GrenadeBullet.js
// XM320 榴弹发射器专用实体 - 抛物线弹道，落地即炸
import { GameState } from '../core/GameState.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import { playAutocannonImpact, playExplosion } from '../utils/SoundManager.js';
import { getRankConfig, AIRank } from '../core/RankSystem.js';

export class GrenadeBullet {
    constructor(x, y, targetX, targetY, config, shooter) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.groundX = x;
        this.groundY = y;
        this.radius = 8;
        this.alive = true;
        this.isArcProjectile = true;
        this.flightAngle = Math.atan2(targetY - y, targetX - x);

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
        this.totalFrames = config.projectileSpeed
            ? Math.max(4, actualDist / config.projectileSpeed)
            : Math.max(25, Math.min(50, actualDist * 0.08));
        this.elapsed = 0;
        this.flatTrajectory = config.flatTrajectory === true;
        this.arcHeight = this.flatTrajectory ? 0 : Math.min(60, actualDist * 0.12);
        this.ignoreObstacles = config.ignoreObstacles === true;

        // 爆炸参数
        this.damage = config.damage || 180;
        this.explosionRadius = config.explosionRadius || 120;
        this.explosionDamage = config.explosionDamage || 150;
        this.shrapnelRadius = config.shrapnelRadius || 200;
        this.shrapnelDamage = config.shrapnelDamage || 50;
        this.knockback = config.knockback || 40;
        this.bulletColor = config.bulletColor;
        this.bulletGlow = config.bulletGlow;
        this.effectScale = config.effectScale ?? 1;
        this.explosionShakeIntensity = config.explosionShakeIntensity;
        this.explosionShakeDuration = config.explosionShakeDuration;
        this.impactSound = config.impactSound || null;

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
        const previousGroundX = this.groundX;
        const previousGroundY = this.groundY;

        const progress = Math.min(1, this.elapsed / this.totalFrames);
        const t = progress * Math.PI;

        // 地面投影坐标（用于碰撞检测和伤害判定）
        this.groundX = this.startX + (this.targetX - this.startX) * progress;
        this.groundY = this.startY + (this.targetY - this.startY) * progress;
        // 弧线视觉坐标（用于绘制）
        this.x = this.groundX;
        this.y = this.groundY - this.arcHeight * Math.sin(t);

        // 平射炮弹沿本帧运动线段检测首个障碍、单位或载具，避免高速穿透。
        if (this.flatTrajectory) {
            const impact = this._findFlatTrajectoryImpact(
                previousGroundX,
                previousGroundY,
                this.groundX,
                this.groundY
            );
            if (impact) {
                this.groundX = impact.x;
                this.groundY = impact.y;
                this.x = impact.x;
                this.y = impact.y;
                this.explode(impact.target);
                return;
            }
        }

        // 到达目标点 → 爆炸
        if (progress >= 1 || this.elapsed >= this.totalFrames) {
            this.explode();
            return;
        }

        // 碰到障碍 → 爆炸（使用地面投影坐标）
        const map = GameState.map;
        if (!this.ignoreObstacles && map && !map.isWalkable(this.groundX, this.groundY, this.radius)) {
            this.explode();
            return;
        }

        // 世界边界检查
        const world = GameState.world;
        if (this.groundX < this.radius || this.groundX > world.width - this.radius ||
            this.groundY < this.radius || this.groundY > world.height - this.radius) {
            this.alive = false;
            return;
        }
    }

    _findFlatTrajectoryImpact(startX, startY, endX, endY) {
        const distance = Math.hypot(endX - startX, endY - startY);
        const steps = Math.max(1, Math.ceil(distance / Math.max(4, this.radius * 0.75)));
        const map = GameState.map;
        const entities = [
            ...GameState.enemies.filter(e => e.alive),
            ...GameState.teammates.filter(t => t.alive)
        ];
        if (GameState.player?.alive) entities.push(GameState.player);

        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            const y = startY + (endY - startY) * progress;

            if (!this.ignoreObstacles && map && !map.isWalkable(x, y, this.radius)) {
                return { x, y, target: null };
            }

            for (const vehicle of GameState.vehicles) {
                if (!vehicle.alive || this.shooter?.mountedVehicle === vehicle) continue;
                const dx = x - vehicle.x;
                const dy = y - vehicle.y;
                const forward = dx * Math.cos(vehicle.angle) + dy * Math.sin(vehicle.angle);
                const lateral = -dx * Math.sin(vehicle.angle) + dy * Math.cos(vehicle.angle);
                if (Math.abs(forward) <= vehicle.height / 2 + this.radius &&
                    Math.abs(lateral) <= vehicle.width / 2 + this.radius) {
                    return { x, y, target: vehicle };
                }
            }

            for (const entity of entities) {
                if (entity === this.shooter || entity.mountedVehicle) continue;
                if (Math.hypot(entity.x - x, entity.y - y) <= entity.radius + this.radius) {
                    return { x, y, target: entity };
                }
            }
        }
        return null;
    }

    explode(directHitTarget = null) {
        if (!this.alive) return;
        this.alive = false;

        // 使用地面投影坐标（实体在地面上，不是弧线上）
        const hitX = this.groundX;
        const hitY = this.groundY;

        // 音效 + 视觉
        if (this.impactSound === 'autocannon') playAutocannonImpact(this);
        else playExplosion(this);
        EffectsManager.spawnGrenadeExplosion(hitX, hitY, this.explosionRadius, {
            scale: this.effectScale,
            shakeIntensity: this.explosionShakeIntensity,
            shakeDuration: this.explosionShakeDuration
        });

        // 收集所有可伤害实体
        const entities = [
            ...GameState.enemies.filter(e => e.alive),
            ...GameState.teammates.filter(t => t.alive)
        ];
        if (GameState.player && GameState.player.alive) entities.push(GameState.player);

        for (const entity of entities) {
            if (entity === this.shooter) continue;
            if (entity.mountedVehicle) continue;

            const d = entity === directHitTarget ? 0 : Math.hypot(entity.x - hitX, entity.y - hitY);
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

        for (const vehicle of GameState.vehicles.filter(v => v.alive)) {
            if (this.shooter?.mountedVehicle === vehicle) continue;
            const d = vehicle === directHitTarget ? 0 : Math.hypot(vehicle.x - hitX, vehicle.y - hitY);
            if (d >= this.explosionRadius) continue;
            const dmg = Math.floor(this.explosionDamage * (1 - d / this.explosionRadius * 0.5));
            if (dmg <= 0) continue;
            const actualDamage = Math.min(vehicle.health, dmg);
            vehicle.takeDamage(actualDamage);
            EffectsManager.addDamageNumber(vehicle.x, vehicle.y, actualDamage, false);
        }
    }

    draw(ctx) {
        if (!this.alive) return;

        ctx.save();
        
        // 旋转坐标系，让弹体沿飞行方向
        ctx.rotate(this.flightAngle);

        // 曳光尾迹（长条渐变）
        if (this.flatTrajectory !== false && this.arcHeight === 0) {
            const trailLength = 35;
            const trailGradient = ctx.createLinearGradient(-trailLength, 0, 0, 0);
            trailGradient.addColorStop(0, 'rgba(255, 140, 0, 0)');
            trailGradient.addColorStop(0.3, 'rgba(255, 180, 50, 0.4)');
            trailGradient.addColorStop(1, 'rgba(255, 220, 100, 0.9)');
            ctx.fillStyle = trailGradient;
            ctx.beginPath();
            ctx.moveTo(-trailLength, -2);
            ctx.lineTo(0, -1.5);
            ctx.lineTo(0, 1.5);
            ctx.lineTo(-trailLength, 2);
            ctx.closePath();
            ctx.fill();
        }

        // 弹体主体（长条形穿甲弹）
        const bodyLength = 14;
        const bodyWidth = 4;
        
        // 弹体金属渐变
        const bodyGradient = ctx.createLinearGradient(0, -bodyWidth, 0, bodyWidth);
        bodyGradient.addColorStop(0, '#8B6914');
        bodyGradient.addColorStop(0.3, this.bulletColor || '#FFB300');
        bodyGradient.addColorStop(0.5, '#FFD54F');
        bodyGradient.addColorStop(0.7, this.bulletColor || '#FFB300');
        bodyGradient.addColorStop(1, '#8B6914');
        
        ctx.fillStyle = bodyGradient;
        ctx.shadowColor = this.bulletGlow || '#FF6F00';
        ctx.shadowBlur = 8;
        
        // 弹体形状（带尖头）
        ctx.beginPath();
        ctx.moveTo(bodyLength, 0);  // 尖头
        ctx.quadraticCurveTo(bodyLength * 0.7, -bodyWidth, 0, -bodyWidth);
        ctx.lineTo(-bodyLength * 0.3, -bodyWidth * 0.8);
        ctx.lineTo(-bodyLength * 0.3, bodyWidth * 0.8);
        ctx.lineTo(0, bodyWidth);
        ctx.quadraticCurveTo(bodyLength * 0.7, bodyWidth, bodyLength, 0);
        ctx.closePath();
        ctx.fill();
        
        // 弹体高光
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 200, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(bodyLength * 0.8, -bodyWidth * 0.3);
        ctx.lineTo(-bodyLength * 0.2, -bodyWidth * 0.6);
        ctx.stroke();

        ctx.restore();
    }
}

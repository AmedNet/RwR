// src/entities/Grenade.js
import { GameState } from '../core/GameState.js';

export class Grenade {
    constructor(x, y, targetX, targetY, config) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.radius = 6;
        this.alive = true;
        this.landed = false;
        this.fuseTimer = config.fuseTime || 120;

        // 参数化抛物线 - 精确落点
        this.targetX = targetX;
        this.targetY = targetY;
        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.hypot(dx, dy);
        const maxDist = config.range || 400;
        
        // 飞行时间（帧数）- 距离越远飞行时间越长
        this.totalFrames = Math.max(30, Math.min(60, dist * 0.1));
        this.elapsed = 0;
        
        // 抛物线高度 - 距离越远弧度越大
        this.arcHeight = Math.min(80, dist * 0.15);

        this.damage = config.damage || 60;
        this.explosionRadius = config.explosionRadius || 120;
        this.owner = 'player';
    }

    update() {
        if (!this.alive) return;

        this.elapsed++;
        
        // 参数化抛物线运动
        const progress = Math.min(1, this.elapsed / this.totalFrames);
        const t = progress * Math.PI; // 0 到 π
        
        // 水平线性插值
        this.x = this.startX + (this.targetX - this.startX) * progress;
        // 垂直线性插值 + 抛物线弧度
        this.y = this.startY + (this.targetY - this.startY) * progress - this.arcHeight * Math.sin(t);

        // 检查是否着地（到达目标或碰到障碍）
        if (progress >= 1 || this.elapsed >= this.totalFrames) {
            this.landed = true;
        }

        // 碰到障碍立即爆炸
        const map = GameState.map;
        if (map && !map.isWalkable(this.x, this.y, this.radius)) {
            this.explode();
            return;
        }

        // 世界边界检查
        const world = GameState.config.world;
        if (this.x < this.radius || this.x > world.width - this.radius ||
            this.y < this.radius || this.y > world.height - this.radius) {
            this.alive = false;
            return;
        }

        // 着地后开始引信倒计时
        if (this.landed) {
            this.fuseTimer--;
            if (this.fuseTimer <= 0) this.explode();
        }
    }

    explode() {
        if (!this.alive) return;
        this.alive = false;
        window.dispatchEvent(new CustomEvent('grenade_explode', {
            detail: { x: this.x, y: this.y, radius: this.explosionRadius, damage: this.damage }
        }));
    }

    draw(ctx) {
        if (!this.alive) return;
        const cam = GameState.camera;
        const sx = Math.round(this.x - cam.x);
        const sy = Math.round(this.y - cam.y);

        ctx.save();
        // 抛物线飞行时显示轨迹光晕
        if (!this.landed) {
            ctx.beginPath();
            ctx.arc(sx, sy, this.radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 100, 0, 0.4)';
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5252';
        ctx.fill();
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 2;
        ctx.stroke();
        // 引信闪光
        if (this.fuseTimer > 0 && this.fuseTimer < 60) {
            ctx.beginPath();
            ctx.arc(sx, sy, this.radius + 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 200, 0, 0.6)';
            ctx.fill();
        }
        ctx.restore();
    }
}

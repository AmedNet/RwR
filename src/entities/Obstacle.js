// src/entities/Obstacle.js
import { GameState } from '../core/GameState.js';

export class Obstacle {
    constructor(x, y, width, height, color = '#8B7355') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.alive = true;
    }

    // 矩形碰撞检测（圆形 vs AABB）
    collidesWithCircle(cx, cy, radius) {
        const closestX = Math.max(this.x, Math.min(cx, this.x + this.width));
        const closestY = Math.max(this.y, Math.min(cy, this.y + this.height));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return (dx * dx + dy * dy) < (radius * radius);
    }

    draw(ctx) {
        const cam = GameState.camera;
        const sx = this.x - cam.x;
        const sy = this.y - cam.y;
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.fillRect(sx, sy, this.width, this.height);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, this.width, this.height);
        // 纹理线
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < this.width; i += 12) {
            ctx.beginPath();
            ctx.moveTo(sx + i, sy);
            ctx.lineTo(sx + i, sy + this.height);
            ctx.stroke();
        }
        ctx.restore();
    }
}
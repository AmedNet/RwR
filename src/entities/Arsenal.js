// src/entities/Arsenal.js
import { GameState } from '../core/GameState.js';

export class Arsenal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 60; // 交互范围
        this.isOpen = false; // 是否打开购买界面
    }

    // 检测玩家是否在交互范围内
    contains(entity) {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        return dx * dx + dy * dy < (this.radius + entity.radius) ** 2;
    }

    // 切换打开/关闭状态
    toggle() {
        this.isOpen = !this.isOpen;
    }

    draw(ctx) {
        const cam = GameState.camera;
        const sx = this.x - cam.x;
        const sy = this.y - cam.y;

        ctx.save();

        // 军械库底座（方形建筑）
        const size = this.radius * 1.2;
        ctx.fillStyle = '#5D4037'; // 深棕色
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);

        // 边框
        ctx.strokeStyle = '#3E2723';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - size / 2, sy - size / 2, size, size);

        // 屋顶（三角形）
        ctx.beginPath();
        ctx.moveTo(sx - size / 2 - 5, sy - size / 2);
        ctx.lineTo(sx, sy - size / 2 - 25);
        ctx.lineTo(sx + size / 2 + 5, sy - size / 2);
        ctx.closePath();
        ctx.fillStyle = '#795548';
        ctx.fill();
        ctx.strokeStyle = '#3E2723';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 门
        ctx.fillStyle = '#212121';
        ctx.fillRect(sx - 12, sy + 10, 24, size / 2 - 10);

        // 武器图标
        ctx.fillStyle = '#FFD700';
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔫', sx, sy - 10);

        // 交互提示（玩家靠近时显示）
        const player = GameState.player;
        if (player && this.contains(player) && !this.isOpen) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(sx - 60, sy - this.radius - 45, 120, 30);
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText('按 E 打开', sx, sy - this.radius - 30);
        }

        ctx.restore();
    }
}
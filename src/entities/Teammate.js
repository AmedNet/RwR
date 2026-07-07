// src/entities/Teammate.js
import { CombatAI } from './CombatAI.js';

export class Teammate extends CombatAI {
    constructor(x, y, config) {
        super(
            x,
            y,
            {
                health: config.health || 60,
                speed: config.speed || 2.5,
                radius: config.radius || 15
            },
            {
                faction: 'player',
                bulletIsEnemy: false,
                color: '#42A5F5',
                damage: config.damage || 15,
                shootDelay: config.shootDelay || 25,
                bulletSpeed: config.bulletSpeed || 6
            }
        );
        this.config = config;
    }

    drawBody(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = this.getRoleStroke();
        ctx.lineWidth = 3;
        ctx.stroke();
        this.drawHealthBar(ctx, -18, -25, 36, 4);
        ctx.fillStyle = '#BBDEFB';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icons = ['◆', '▲', '●'];
        ctx.fillText(icons[this.role] || '✦', 0, -2);
        ctx.restore();
    }
}

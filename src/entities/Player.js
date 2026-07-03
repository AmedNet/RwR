// src/entities/Player.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Bullet } from './Bullet.js';

export class Player extends Entity {
    constructor(x, y, config) {
        super(x, y, {
            health: config.health,
            speed: config.speed,
            radius: config.radius
        });
        this.rank = 0;
        this.rankNames = ['列兵', '下士', '中士', '上士'];
        this.shootCooldown = 0;
        this.shootDelay = config.shootDelay;
        this.bulletSpeed = config.bulletSpeed;
        this.damage = config.damage;
        this.config = config;
    }

    getRankName() {
        return this.rankNames[Math.min(this.rank, this.rankNames.length - 1)];
    }

    addRank() {
        if (this.rank < this.rankNames.length - 1) {
            this.rank++;
            this.health = Math.min(this.health + 20, this.maxHealth);
            EventBus.emit('player_rank_up', { rank: this.rank, health: this.health });
        }
    }

    addKill() {
        GameState.kills++;
        EventBus.emit('player_kill', { kills: GameState.kills });
        if (GameState.kills % GameState.config.rankUpKills === 0) {
            this.addRank();
        }
        // UI更新由事件驱动
    }

    update() {
        if (GameState.gameOver) return;

        const keys = GameState.keys;
        let dx = 0, dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
        if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            dx = dx / len * this.speed;
            dy = dy / len * this.speed;
            this.x += dx;
            this.y += dy;
        }

        const canvas = document.getElementById('gameCanvas');
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        if (this.shootCooldown > 0) this.shootCooldown--;
    }

    shoot() {
        if (GameState.gameOver) return;
        if (this.shootCooldown > 0) return;

        const mouse = GameState.mouse;
        const angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        const speed = this.bulletSpeed;
        const bullet = new Bullet(
            this.x + Math.cos(angle) * this.radius,
            this.y + Math.sin(angle) * this.radius,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            false,
            this.damage
        );
        GameState.bullets.push(bullet);
        this.shootCooldown = this.shootDelay;
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = GameState.config.colors.player;
        ctx.fill();
        ctx.strokeStyle = GameState.config.colors.playerStroke;
        ctx.lineWidth = 3;
        ctx.stroke();

        const angle = Math.atan2(GameState.mouse.y - this.y, GameState.mouse.x - this.x);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(angle) * 30, this.y + Math.sin(angle) * 30);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.fillStyle = '#FFD700';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★'.repeat(Math.min(this.rank + 1, 4)), this.x, this.y - 28);
        ctx.restore();
    }
}
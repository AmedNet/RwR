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
            dx = dx / len;
            dy = dy / len;
            // 速度因子（河流减速）
            let speedFactor = 1;
            if (GameState.map) {
                speedFactor = GameState.map.getSpeedFactor(this.x, this.y);
            }
            const finalSpeed = this.speed * speedFactor;
            let newX = this.x + dx * finalSpeed;
            let newY = this.y + dy * finalSpeed;
            // 检查地图碰撞（房屋不可通行）
            if (GameState.map && !GameState.map.isWalkable(newX, newY, this.radius)) {
                // 尝试分别沿X和Y移动
                if (GameState.map.isWalkable(newX, this.y, this.radius)) {
                    this.x = newX;
                } else if (GameState.map.isWalkable(this.x, newY, this.radius)) {
                    this.y = newY;
                }
                // 否则不动
            } else {
                this.x = newX;
                this.y = newY;
            }
        }

        // 边界限制（世界边界）
        const world = GameState.config.world;
        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        if (this.shootCooldown > 0) this.shootCooldown--;
    }

    shoot() {
        if (GameState.gameOver || this.shootCooldown > 0) return;
        const mouse = GameState.mouse;
        const screenX = this.x - GameState.camera.x;
        const screenY = this.y - GameState.camera.y;
        const angle = Math.atan2(mouse.y - screenY, mouse.x - screenX);
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
        // 身体
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = GameState.config.colors.player;
        ctx.fill();
        ctx.strokeStyle = GameState.config.colors.playerStroke;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 枪管
        const screenX = this.x - GameState.camera.x;
        const screenY = this.y - GameState.camera.y;
        const angle = Math.atan2(GameState.mouse.y - screenY, GameState.mouse.x - screenX);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 6;
        ctx.stroke();

        // 军衔星
        ctx.fillStyle = '#FFD700';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★'.repeat(Math.min(this.rank + 1, 4)), 0, -28);
        ctx.restore();
    }
}
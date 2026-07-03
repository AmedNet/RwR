// src/entities/CapturePoint.js
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';

export class CapturePoint {
    constructor(x, y, radius = 80, id = 0) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.id = id;
        this.owner = null; // 'player' 或 'enemy' 或 null
        this.captureProgress = 0; // 0-100
        this.captureSpeed = 2;     // 每帧增加
        this.color = '#FFD740';
        this.flagColor = '#888';
    }

    // 检测某单位是否在据点内
    contains(entity) {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        return dx*dx + dy*dy < (this.radius + entity.radius) ** 2;
    }

    // 更新占领状态
    update() {
        // 统计据点内的玩家和敌人数量
        let playerCount = 0;
        let enemyCount = 0;
        const player = GameState.player;
        if (player && player.alive && this.contains(player)) {
            playerCount++;
        }
        for (const teammate of GameState.teammates) {
            if (teammate.alive && this.contains(teammate)) {
                playerCount++;
            }
        }
        for (const enemy of GameState.enemies) {
            if (enemy.alive && this.contains(enemy)) {
                enemyCount++;
            }
        }

        // 决定占领进度变化
        if (playerCount > 0 && enemyCount === 0) {
            // 只有玩家方，向玩家推进
            if (this.owner === 'enemy') {
                this.captureProgress -= this.captureSpeed * (playerCount / 2);
                if (this.captureProgress <= 0) {
                    this.captureProgress = 0;
                    this.owner = null;
                }
            } else {
                this.captureProgress += this.captureSpeed * (playerCount / 2);
                if (this.captureProgress >= 100) {
                    this.captureProgress = 100;
                    if (this.owner !== 'player') {
                        this.owner = 'player';
                        EventBus.emit('point_captured', { point: this, owner: 'player' });
                    }
                }
            }
        } else if (enemyCount > 0 && playerCount === 0) {
            // 只有敌方
            if (this.owner === 'player') {
                this.captureProgress += this.captureSpeed * (enemyCount / 2);
                if (this.captureProgress >= 100) {
                    this.captureProgress = 100;
                    this.owner = null; // 中立
                }
            } else {
                this.captureProgress -= this.captureSpeed * (enemyCount / 2);
                if (this.captureProgress <= 0) {
                    this.captureProgress = 0;
                    if (this.owner !== 'enemy') {
                        this.owner = 'enemy';
                        EventBus.emit('point_captured', { point: this, owner: 'enemy' });
                    }
                }
            }
        } else if (playerCount > 0 && enemyCount > 0) {
            // 双方都在，僵持，进度不变（或缓慢偏向人数多的一方）
            const diff = playerCount - enemyCount;
            if (Math.abs(diff) > 1) {
                // 人数优势方缓慢推进
                const speed = this.captureSpeed * 0.5 * diff / Math.abs(diff);
                if (this.owner === 'player') {
                    this.captureProgress = Math.min(100, this.captureProgress + speed);
                } else if (this.owner === 'enemy') {
                    this.captureProgress = Math.max(0, this.captureProgress - speed);
                } else {
                    // 中立，向人多方偏
                    if (diff > 0) this.captureProgress = Math.min(100, this.captureProgress + speed);
                    else this.captureProgress = Math.max(0, this.captureProgress + speed);
                }
            }
        } else {
            // 没人，缓慢回归中立
            if (this.captureProgress > 50) {
                this.captureProgress -= 0.5;
                if (this.captureProgress < 50) this.captureProgress = 50;
            } else if (this.captureProgress < 50) {
                this.captureProgress += 0.5;
                if (this.captureProgress > 50) this.captureProgress = 50;
            }
            if (this.captureProgress === 50) {
                this.owner = null;
            }
        }

        // 根据占领状态更新颜色
        if (this.owner === 'player') {
            this.flagColor = '#4CAF50';
        } else if (this.owner === 'enemy') {
            this.flagColor = '#f44336';
        } else {
            this.flagColor = '#888';
        }
    }

    draw(ctx) {
        const cam = GameState.camera;
        const sx = this.x - cam.x;
        const sy = this.y - cam.y;

        ctx.save();
        // 据点光圈
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fill();
        ctx.strokeStyle = this.flagColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 进度条（环绕）
        const progress = this.captureProgress / 100;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius - 10, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * progress);
        ctx.strokeStyle = this.flagColor;
        ctx.lineWidth = 6;
        ctx.stroke();

        // 旗帜图标
        ctx.fillStyle = '#fff';
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚩', sx, sy - 5);
        ctx.restore();
    }
}
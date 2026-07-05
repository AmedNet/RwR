// src/entities/CapturePoint.js
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';

export class CapturePoint {
    constructor(x, y, radius = 80, owner = null, id = 0) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.id = id;
        this.owner = owner; // 'player' 或 'enemy' 或 null
        // 根据初始归属设置进度
        if (owner === 'player') {
            this.captureProgress = 100;
        } else if (owner === 'enemy') {
            this.captureProgress = 0;
        } else {
            this.captureProgress = 50;
        }
        this.captureSpeed = 2;
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
            // 只有玩家方 -> 进度增加（朝100）
            this.captureProgress = Math.min(100, this.captureProgress + this.captureSpeed * playerCount);
            if (this.captureProgress >= 100 && this.owner !== 'player') {
                this.owner = 'player';
                EventBus.emit('point_captured', { point: this, owner: 'player' });
            }
        } else if (enemyCount > 0 && playerCount === 0) {
            // 只有敌方 -> 进度减少（朝0）
            this.captureProgress = Math.max(0, this.captureProgress - this.captureSpeed * enemyCount);
            if (this.captureProgress <= 0 && this.owner !== 'enemy') {
                this.owner = 'enemy';
                EventBus.emit('point_captured', { point: this, owner: 'enemy' });
            }
        } else if (playerCount > 0 && enemyCount > 0) {
            // 双方都在 -> 计算净偏向
            const diff = playerCount - enemyCount;
            if (diff !== 0) {
                this.captureProgress = Math.min(100, Math.max(0, this.captureProgress + (this.captureSpeed * 0.5 * diff)));
                if (this.captureProgress >= 100 && this.owner !== 'player') {
                    this.owner = 'player';
                    EventBus.emit('point_captured', { point: this, owner: 'player' });
                } else if (this.captureProgress <= 0 && this.owner !== 'enemy') {
                    this.owner = 'enemy';
                    EventBus.emit('point_captured', { point: this, owner: 'enemy' });
                }
            }
        } else {
            // 没人 -> 只有中立据点才缓慢回归50，已占领的据点保持状态
            if (this.owner === null) {
                if (this.captureProgress > 50) {
                    this.captureProgress = Math.max(50, this.captureProgress - 0.5);
                } else if (this.captureProgress < 50) {
                    this.captureProgress = Math.min(50, this.captureProgress + 0.5);
                }
            }
            // 已占领的据点（owner === 'player' 或 'enemy'）无人时保持不变
        }
        
        // 颜色更新
        if (this.owner === 'player') this.flagColor = '#4CAF50';
        else if (this.owner === 'enemy') this.flagColor = '#f44336';
        else this.flagColor = '#888';
    }

    draw(ctx) {
        const cam = GameState.camera;
        const zoom = cam.zoom || 1;
        const offsetX = cam.offsetX || 0;
        const offsetY = cam.offsetY || 0;
        const logicalW = ctx.canvas.clientWidth || ctx.canvas.width;
        const logicalH = ctx.canvas.clientHeight || ctx.canvas.height;
        const cx = logicalW / 2;
        const cy = logicalH / 2;
        
        // 使用与 Renderer.toScreen() 相同的变换
        const sx = (this.x - cam.x) * zoom + cx * (1 - zoom) - offsetX;
        const sy = (this.y - cam.y) * zoom + cy * (1 - zoom) - offsetY;
        const scaledRadius = this.radius * zoom;

        ctx.save();
        // 据点光圈
        ctx.beginPath();
        ctx.arc(sx, sy, scaledRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fill();
        ctx.strokeStyle = this.flagColor;
        ctx.lineWidth = 3 * zoom;
        ctx.setLineDash([8 * zoom, 8 * zoom]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 进度条（环绕）
        const progress = this.captureProgress / 100;
        ctx.beginPath();
        ctx.arc(sx, sy, scaledRadius - 10 * zoom, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * progress);
        ctx.strokeStyle = this.flagColor;
        ctx.lineWidth = 6 * zoom;
        ctx.stroke();

        // 旗帜图标
        ctx.fillStyle = '#fff';
        ctx.font = `${30 * zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚩', sx, sy - 5 * zoom);
        ctx.restore();
    }
}
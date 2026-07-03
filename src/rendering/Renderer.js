// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';

export const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    get camera() {
        return GameState.camera;
    },

    toScreen(wx, wy) {
        return {
            x: wx - this.camera.x,
            y: wy - this.camera.y
        };
    },

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },

    drawGrid() {
        const ctx = this.ctx;
        const world = GameState.config.world;
        const step = 50;
        // 只绘制视口范围内的网格
        const startX = Math.floor(this.camera.x / step) * step;
        const startY = Math.floor(this.camera.y / step) * step;
        const endX = this.camera.x + this.canvas.width;
        const endY = this.camera.y + this.canvas.height;

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = startX; x <= endX; x += step) {
            const screenX = x - this.camera.x;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.canvas.height);
            ctx.stroke();
        }
        for (let y = startY; y <= endY; y += step) {
            const screenY = y - this.camera.y;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(this.canvas.width, screenY);
            ctx.stroke();
        }
    },

    drawEntities() {
        const ctx = this.ctx;
        const { player, enemies, bullets } = GameState;
        for (const b of bullets) {
            const pos = this.toScreen(b.x, b.y);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            b.draw(ctx);
            ctx.restore();
        }
        for (const e of enemies) {
            const pos = this.toScreen(e.x, e.y);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            e.draw(ctx);
            ctx.restore();
        }
        if (player) {
            const pos = this.toScreen(player.x, player.y);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            player.draw(ctx);
            ctx.restore();
        }
    },

    drawGameOver() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 56px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀 阵亡', this.canvas.width/2, this.canvas.height/2 - 30);
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        const rank = GameState.player ? GameState.player.getRankName() : '列兵';
        ctx.fillText(`最终军衔: ${rank}  |  击杀: ${GameState.kills}`, this.canvas.width/2, this.canvas.height/2 + 40);
        ctx.fillStyle = '#aaa';
        ctx.font = '18px sans-serif';
        ctx.fillText('按 R 键重新开始', this.canvas.width/2, this.canvas.height/2 + 90);
        ctx.restore();
    },

    render() {
        this.clear();
        this.drawGrid();
        this.drawEntities();
        if (GameState.gameOver) {
            this.drawGameOver();
        }
    }
};
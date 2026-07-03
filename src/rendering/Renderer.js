// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';

export const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    logicalWidth: 0,
    logicalHeight: 0,

    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        const width = rect.width;
        const height = rect.height;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
        this.logicalWidth = width;
        this.logicalHeight = height;
    },

    get width() { return this.logicalWidth || this.canvas.clientWidth; },
    get height() { return this.logicalHeight || this.canvas.clientHeight; },

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    },

    drawGrid() {
        const ctx = this.ctx;
        const world = GameState.config.world;
        const step = 50;
        const startX = Math.floor(GameState.camera.x / step) * step;
        const startY = Math.floor(GameState.camera.y / step) * step;
        const endX = GameState.camera.x + this.width;
        const endY = GameState.camera.y + this.height;

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = startX; x <= endX; x += step) {
            const sx = x - GameState.camera.x;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, this.height);
            ctx.stroke();
        }
        for (let y = startY; y <= endY; y += step) {
            const sy = y - GameState.camera.y;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(this.width, sy);
            ctx.stroke();
        }
        ctx.restore();
    },

    toScreen(wx, wy) {
        return { x: wx - GameState.camera.x, y: wy - GameState.camera.y };
    },

    drawEntities() {
        const ctx = this.ctx;
        const { player, enemies, bullets, obstacles } = GameState;

        // 障碍物
        for (const obs of obstacles) {
            obs.draw(ctx);
        }

        // 子弹
        for (const b of bullets) {
            const pos = this.toScreen(b.x, b.y);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            b.draw(ctx);
            ctx.restore();
        }
        // 敌人
        for (const e of enemies) {
            const pos = this.toScreen(e.x, e.y);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            e.draw(ctx);
            ctx.restore();
        }
        // 玩家
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
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 56px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀 阵亡', this.width/2, this.height/2 - 30);
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        const rank = GameState.player ? GameState.player.getRankName() : '列兵';
        ctx.fillText(`最终军衔: ${rank}  |  击杀: ${GameState.kills}`, this.width/2, this.height/2 + 40);
        ctx.fillStyle = '#aaa';
        ctx.font = '18px sans-serif';
        ctx.fillText('按 R 键重新开始', this.width/2, this.height/2 + 90);
        ctx.restore();
    },

    render() {
        this.clear();
        this.drawGrid();
        this.drawEntities();
        if (GameState.gameOver) this.drawGameOver();
    }
};
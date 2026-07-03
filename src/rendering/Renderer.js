// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';

export const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < this.canvas.width; i += 50) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, this.canvas.height);
            ctx.stroke();
        }
        for (let i = 0; i < this.canvas.height; i += 50) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(this.canvas.width, i);
            ctx.stroke();
        }
    },

    drawEntities() {
        const { player, enemies, bullets } = GameState;
        for (const b of bullets) b.draw(this.ctx);
        for (const e of enemies) e.draw(this.ctx);
        if (player) player.draw(this.ctx);
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
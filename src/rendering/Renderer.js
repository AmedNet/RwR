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

    toScreen(wx, wy) {
        return { x: wx - GameState.camera.x, y: wy - GameState.camera.y };
    },

    render() {
        const ctx = this.ctx;
        this.clear();

        // 绘制地图
        if (GameState.map) {
            GameState.map.draw(ctx, GameState.camera);
        }

        // 绘制据点
        for (const point of GameState.capturePoints) {
            point.draw(ctx);
        }

        // 绘制实体
        const { player, enemies, teammates, bullets } = GameState;
        for (const b of bullets) {
            if (!b.alive) continue;
            const pos = this.toScreen(b.x, b.y);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            b.draw(ctx);
            ctx.restore();
        }
        for (const e of enemies) {
            if (!e.alive) continue;
            const pos = this.toScreen(e.x, e.y);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            e.draw(ctx);
            ctx.restore();
        }
        for (const t of teammates) {
            if (!t.alive) continue;
            const pos = this.toScreen(t.x, t.y);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            t.draw(ctx);
            ctx.restore();
        }
        if (player && player.alive) {
            const pos = this.toScreen(player.x, player.y);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            player.draw(ctx);
            ctx.restore();
        }

        // Game Over
        if (GameState.gameOver) {
            this.drawGameOver();
        }

        // 小地图由外部单独调用（在 main.js 的 gameLoop 中）
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
        ctx.fillText(`最终军衔: ${rank}  |  击杀: ${GameState.kills}  |  得分: ${GameState.score}`, this.width/2, this.height/2 + 40);
        ctx.fillStyle = '#aaa';
        ctx.font = '18px sans-serif';
        ctx.fillText('按 R 键重新开始', this.width/2, this.height/2 + 90);
        ctx.restore();
    }
};
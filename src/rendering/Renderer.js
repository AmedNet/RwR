// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';

export const Renderer = {
    canvas: null,
    ctx: null,
    logicalWidth: 0,
    logicalHeight: 0,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('❌ 找不到 gameCanvas!');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        console.log('✅ Renderer 初始化成功');
    },

    resize() {
        if (!this.canvas) this.init();
        if (!this.canvas) return;

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
        console.log(`📐 画布尺寸: ${width}x${height}`);
    },

    get width() {
        return this.logicalWidth || (this.canvas ? this.canvas.clientWidth : 0);
    },
    get height() {
        return this.logicalHeight || (this.canvas ? this.canvas.clientHeight : 0);
    },

    clear() {
        if (!this.ctx) {
            console.warn('Renderer: ctx 未初始化');
            return;
        }
        this.ctx.clearRect(0, 0, this.width, this.height);
    },

    toScreen(wx, wy) {
        return { x: wx - GameState.camera.x, y: wy - GameState.camera.y };
    },

    render() {
        if (!this.ctx) {
            console.warn('⚠️ Renderer: ctx 未初始化，无法渲染');
            return;
        }
        this.clear();

        // 绘制地图
        if (GameState.map) {
            GameState.map.draw(this.ctx, GameState.camera);
        } else {
            // 如果没有地图，绘制一个简单的提示
            this.ctx.fillStyle = '#2d4a22';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('地图加载中...', this.width/2, this.height/2);
        }

        // 绘制据点
        for (const point of GameState.capturePoints) {
            point.draw(this.ctx);
        }

        // 绘制实体
        const { player, enemies, teammates, bullets } = GameState;
        for (const b of bullets) {
            if (!b.alive) continue;
            const pos = this.toScreen(b.x, b.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            b.draw(this.ctx);
            this.ctx.restore();
        }
        for (const e of enemies) {
            if (!e.alive) continue;
            const pos = this.toScreen(e.x, e.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            e.draw(this.ctx);
            this.ctx.restore();
        }
        for (const t of teammates) {
            if (!t.alive) continue;
            const pos = this.toScreen(t.x, t.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            t.draw(this.ctx);
            this.ctx.restore();
        }
        if (player && player.alive) {
            const pos = this.toScreen(player.x, player.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            player.draw(this.ctx);
            this.ctx.restore();
        }

        // Game Over
        if (GameState.gameOver) {
            this.drawGameOver();
        }
    },

    drawGameOver() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 永久战败（无据点可复活）
        if (GameState.permanentDefeat) {
            ctx.fillStyle = '#ff1744';
            ctx.font = 'bold 56px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💀 战败', this.width/2, this.height/2 - 60);
            ctx.fillStyle = '#fff';
            ctx.font = '24px sans-serif';
            ctx.fillText(`所有据点已失守，游戏结束`, this.width/2, this.height/2);
            ctx.fillStyle = '#ff9800';
            ctx.font = '20px sans-serif';
            const rank = GameState.player ? GameState.player.getRankName() : '列兵';
            ctx.fillText(`最终军衔: ${rank}  |  击杀: ${GameState.kills}  |  得分: ${GameState.score}`, this.width/2, this.height/2 + 50);
            ctx.restore();
            return;
        }

        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 56px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀 阵亡', this.width/2, this.height/2 - 120);
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        const rank = GameState.player ? GameState.player.getRankName() : '列兵';
        ctx.fillText(`军衔: ${rank}  |  击杀: ${GameState.kills}  |  得分: ${GameState.score}`, this.width/2, this.height/2 - 60);

        // 列出己方据点供选择
        const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('选择复活据点:', this.width/2, this.height/2 - 10);

        if (playerPoints.length > 0) {
            ctx.font = '20px sans-serif';
            for (let i = 0; i < playerPoints.length; i++) {
                const p = playerPoints[i];
                const y = this.height/2 + 30 + i * 40;
                ctx.fillStyle = '#4CAF50';
                ctx.fillText(`[${i + 1}]`, this.width/2 - 120, y);
                ctx.fillStyle = '#fff';
                ctx.fillText(`据点 #${i + 1}  (${Math.round(p.x)}, ${Math.round(p.y)})`, this.width/2 - 60, y);
            }
        } else {
            ctx.fillStyle = '#ff9800';
            ctx.font = '20px sans-serif';
            ctx.fillText('⚠️ 无己方据点！失守即败！', this.width/2, this.height/2 + 30);
        }

        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.fillText('按数字键 1-6 选择据点复活', this.width/2, this.height/2 + 30 + Math.max(playerPoints.length, 1) * 40 + 20);
        ctx.restore();
    }
};
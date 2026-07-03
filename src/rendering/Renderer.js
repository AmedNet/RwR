// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';
import { EffectsManager } from '../utils/EffectsManager.js';

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

        // 控制HUD显示
        const menuOpen = GameState.inventoryOpen || GameState.arsenalOpen;
        const hud = document.getElementById('hud');
        if (hud) {
            hud.style.display = menuOpen ? 'none' : 'flex';
        }

        // Game Over 优先级最高
        if (GameState.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.drawGameOver();
            return;
        }

        // 如果菜单打开，跳过游戏世界渲染
        if (menuOpen) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            if (GameState.arsenalOpen) {
                this.drawArsenalShop();
            } else if (GameState.inventoryOpen) {
                this.drawInventory();
            }
            return;
        }

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

        // 绘制军械库
        if (GameState.arsenal) {
            GameState.arsenal.draw(this.ctx);
        }

        // 绘制实体（优化：减少save/restore）
        const { player, enemies, teammates, bullets } = GameState;
        
// 子弹
for (const b of bullets) {
    if (!b.alive) continue;
    const pos = this.toScreen(b.x, b.y);
    this.ctx.save();
    this.ctx.translate(pos.x, pos.y);
    b.draw(this.ctx);
    this.ctx.restore();
}
        
        // 敌人（优化：批量渲染）
        for (const e of enemies) {
            if (!e.alive) continue;
            const pos = this.toScreen(e.x, e.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            e.draw(this.ctx);
            this.ctx.restore();
        }
        
        // 队友（优化：批量渲染）
        for (const t of teammates) {
            if (!t.alive) continue;
            const pos = this.toScreen(t.x, t.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            t.draw(this.ctx);
            this.ctx.restore();
        }
        
        // 玩家
        if (player && player.alive) {
            const pos = this.toScreen(player.x, player.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            player.draw(this.ctx);
            this.ctx.restore();
        }

        // 绘制特效（粒子、伤害数字）
        EffectsManager.draw(this.ctx, GameState.camera);
    },

    drawInventory() {
        const ctx = this.ctx;
        ctx.save();

        // 半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 标题
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎒 背包', this.width / 2, 80);

        // 玩家信息
        const player = GameState.player;
        if (player) {
            ctx.fillStyle = '#fff';
            ctx.font = '24px sans-serif';
            ctx.fillText(`军衔: ${player.getRankName()}`, this.width / 2, 140);

            // 血量条
            const barWidth = 300;
            const barHeight = 30;
            const barX = this.width / 2 - barWidth / 2;
            const barY = 170;

            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const hpPercent = player.health / player.maxHealth;
            ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : (hpPercent > 0.3 ? '#FFC107' : '#f44336');
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`${Math.floor(player.health)} / ${player.maxHealth}`, this.width / 2, barY + barHeight / 2);
        }

        // RP值
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(`💰 RP: ${GameState.rp}`, this.width / 2, 240);

        // 背包格子
        const slotSize = 80;
        const slotGap = 20;
        const slotsPerRow = 4;
        const startX = this.width / 2 - (slotsPerRow * slotSize + (slotsPerRow - 1) * slotGap) / 2;
        const startY = 300;

        for (let i = 0; i < 4; i++) {
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;
            const x = startX + col * (slotSize + slotGap);
            const y = startY + row * (slotSize + slotGap);

            // 格子背景
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(x, y, slotSize, slotSize);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, slotSize, slotSize);

            // 物品
            const item = GameState.inventory[i];
            if (item) {
                ctx.font = '36px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.icon || '📦', x + slotSize / 2, y + slotSize / 2);
            } else {
                // 空槽位编号
                ctx.fillStyle = '#666';
                ctx.font = '16px sans-serif';
                ctx.fillText(`[${i + 1}]`, x + slotSize / 2, y + slotSize - 15);
            }
        }

        // 底部提示
        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('按 Q 关闭背包', this.width / 2, startY + 120);

        ctx.restore();
    },

    drawArsenalShop() {
        const ctx = this.ctx;
        ctx.save();

        // 半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 标题
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔫 军械库', this.width / 2, 80);

        // 商品列表（暂无商品）
        const items = [];

        const startY = 160;
        const itemHeight = 90;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const y = startY + i * itemHeight;

            // 商品背景
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(this.width / 2 - 200, y, 400, 70);
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.width / 2 - 200, y, 400, 70);

            // 图标
            ctx.font = '32px sans-serif';
            ctx.fillText(item.icon, this.width / 2 - 160, y + 35);

            // 名称
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(item.name, this.width / 2 - 110, y + 25);

            // 描述
            ctx.fillStyle = '#aaa';
            ctx.font = '14px sans-serif';
            ctx.fillText(item.desc, this.width / 2 - 110, y + 50);

            // 价格
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`$${item.price}`, this.width / 2 + 170, y + 25);

            // 按键提示
            ctx.fillStyle = '#4CAF50';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(`[${item.key}]`, this.width / 2 + 170, y + 50);
        }

        // 底部提示
        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('按数字键购买 | 按 E 关闭', this.width / 2, startY + items.length * itemHeight + 40);

        ctx.restore();
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
        ctx.fillText('阵亡', this.width/2, this.height/2 - 120);
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
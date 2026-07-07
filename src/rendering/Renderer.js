// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { drawWeaponHUD } from './WeaponHUD.js';
import { drawInventory } from './InventoryUI.js';
import { drawArsenalShop } from './ArsenalUI.js';
import { drawDebug } from './DebugUI.js';
import { drawGameOver } from './GameOverUI.js';

export const Renderer = {
    canvas: null,
    ctx: null,
    logicalWidth: 0,
    logicalHeight: 0,
    weaponImages: {}, // 武器贴图缓存 { weaponId: HTMLImageElement }
    weaponImagesLoaded: {},

    // 预加载武器贴图
    loadWeaponImages() {
        for (const [id, config] of Object.entries(WeaponRegistry)) {
            if (!config.imagePath) continue;
            const img = new Image();
            img.src = config.imagePath;
            this.weaponImages[id] = img;
            this.weaponImagesLoaded[id] = false;
            img.onload = () => { this.weaponImagesLoaded[id] = true; };
        }
    },

    // 获取武器贴图，如果未加载返回 null
    getWeaponImage(weaponId) {
        if (this.weaponImagesLoaded[weaponId]) {
            return this.weaponImages[weaponId];
        }
        return null;
    },

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
        const zoom = GameState.camera.zoom || 1;
        const offsetX = GameState.camera.offsetX || 0;
        const offsetY = GameState.camera.offsetY || 0;
        const cx = this.logicalWidth / 2;
        const cy = this.logicalHeight / 2;
        return {
            x: (wx - GameState.camera.x) * zoom + cx * (1 - zoom) - offsetX,
            y: (wy - GameState.camera.y) * zoom + cy * (1 - zoom) - offsetY
        };
    },

    render() {
        if (!this.ctx) {
            console.warn('⚠️ Renderer: ctx 未初始化，无法渲染');
            return;
        }
        this.clear();

        // 确保武器贴图已加载
        if (Object.keys(this.weaponImages).length === 0) {
            this.loadWeaponImages();
        }

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
            drawGameOver(this.ctx, this);
            return;
        }

        // 如果菜单打开，跳过游戏世界渲染
        if (menuOpen) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            if (GameState.arsenalOpen) {
                drawArsenalShop(this.ctx, this);
            } else if (GameState.inventoryOpen) {
                drawInventory(this.ctx, this);
            }
            return;
        }

        // Debug面板（覆盖在游戏世界上方）
        if (GameState.debugOpen) {
            drawDebug(this.ctx, this);
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

        // 绘制地面武器
        for (const pickup of GameState.weaponPickups) {
            if (!pickup.alive) continue;
            pickup.draw(this.ctx, GameState.camera);
        }

        // 绘制手雷
        for (const g of GameState.grenades) {
            g.draw(this.ctx);
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

        // 绘制武器 HUD（不再菜单或 GameOver 时显示）
        drawWeaponHUD(this.ctx, this);
    }
};

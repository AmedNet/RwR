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

    /** 绘制全屏半透明遮罩 */
    _drawOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.ctx.fillRect(0, 0, this.width, this.height);
    },

    /** 在世界坐标位置绘制实体（save/translate/draw/restore） */
    _drawAtWorldPos(entity) {
        const pos = this.toScreen(entity.x, entity.y);
        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        entity.draw(this.ctx);
        this.ctx.restore();
    },

    /** 绘制游戏世界（地图、血迹、据点、军械库、地面物品、实体、特效） */
    _renderWorld() {
        // 地图
        if (GameState.map) {
            GameState.map.draw(this.ctx, GameState.camera);
        } else {
            this.ctx.fillStyle = '#2d4a22';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('地图加载中...', this.width / 2, this.height / 2);
        }

        EffectsManager.drawBloodStains(this.ctx, GameState.camera);

        for (const point of GameState.capturePoints) {
            point.draw(this.ctx);
        }

        if (GameState.arsenal) {
            GameState.arsenal.draw(this.ctx);
        }

        for (const pickup of GameState.weaponPickups) {
            if (pickup.alive) this._drawAtWorldPos(pickup);
        }

        for (const g of GameState.grenades) {
            g.draw(this.ctx);
        }
    },

    /** 绘制所有实体（子弹、敌人、队友、玩家） */
    _renderEntities() {
        const { player, enemies, teammates, bullets } = GameState;

        for (const b of bullets) {
            if (b.alive) this._drawAtWorldPos(b);
        }
        for (const e of enemies) {
            if (e.alive) this._drawAtWorldPos(e);
        }
        for (const t of teammates) {
            if (t.alive) this._drawAtWorldPos(t);
        }
        if (player && player.alive) {
            this._drawAtWorldPos(player);
        }
    },

    /** 绘制 HUD 层（特效、武器HUD、状态效果） */
    _renderHUD() {
        EffectsManager.draw(this.ctx, GameState.camera);
        drawWeaponHUD(this.ctx, this);

        const { player } = GameState;
        if (player && player.alive && player.statusEffects && player.statusEffects.length > 0) {
            this.drawStatusEffectsHUD(this.ctx, player);
        }
    },

    render() {
        if (!this.ctx) {
            console.warn('⚠️ Renderer: ctx 未初始化，无法渲染');
            return;
        }
        this.clear();

        if (Object.keys(this.weaponImages).length === 0) {
            this.loadWeaponImages();
        }

        const menuOpen = GameState.inventoryOpen || GameState.arsenalOpen;
        const hud = document.getElementById('hud');
        if (hud) {
            hud.style.display = menuOpen ? 'none' : 'flex';
        }

        // Game Over 优先级最高
        if (GameState.gameOver) {
            this._drawOverlay();
            drawGameOver(this.ctx, this);
            return;
        }

        // 菜单打开时跳过世界渲染
        if (menuOpen) {
            this._drawOverlay();
            if (GameState.arsenalOpen) {
                drawArsenalShop(this.ctx, this);
            } else if (GameState.inventoryOpen) {
                drawInventory(this.ctx, this);
            }
            return;
        }

        // Debug 面板
        if (GameState.debugOpen) {
            drawDebug(this.ctx, this);
            return;
        }

        this._renderWorld();
        this._renderEntities();
        this._renderHUD();
    },

    drawStatusEffectsHUD(ctx, player) {
        const EFFECT_START_X = 20;
        const EFFECT_START_Y = 80;
        const ICON_SIZE = 32;
        const ICON_SPACING = 8;
        const FPS = 60;

        for (let i = 0; i < player.statusEffects.length; i++) {
            const effect = player.statusEffects[i];
            const x = EFFECT_START_X;
            const y = EFFECT_START_Y + i * (ICON_SIZE + ICON_SPACING);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(x, y, ICON_SIZE, ICON_SIZE);

            ctx.strokeStyle = effect.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, ICON_SIZE, ICON_SIZE);

            ctx.fillStyle = effect.color;
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(effect.icon, x + ICON_SIZE / 2, y + ICON_SIZE / 2 - 2);

            const seconds = Math.ceil(effect.remaining / FPS);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(seconds + 's', x + ICON_SIZE / 2, y + ICON_SIZE - 6);
        }
    }
};

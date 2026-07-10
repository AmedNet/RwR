// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { drawWeaponHUD } from './WeaponHUD.js';
import { drawInventory } from './InventoryUI.js';
import { drawArsenalShop } from './ArsenalUI.js';
import { drawDebug } from './DebugUI.js';
import { drawGameOver } from './GameOverUI.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { DayNightSystem } from '../core/DayNightSystem.js';

export const Renderer = {
    canvas: null,
    ctx: null,
    logicalWidth: 0,
    logicalHeight: 0,
    weaponImages: {}, // 武器贴图缓存 { weaponId: HTMLImageElement }
    weaponImagesLoaded: {},
    _dayNightCanvas: null,
    _dayNightCtx: null,

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
        // 同步视口尺寸到 GameState（供天气系统等使用）
        GameState.viewport.width = width;
        GameState.viewport.height = height;
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
    _drawAtWorldPos(entity, isPlayer = false) {
        const pos = this.toScreen(entity.x, entity.y);
        
        // 计算能见度（仅特定天气生效：雾天、暴风雪、沙尘暴等）
        let visibilityAlpha = 1.0;
        if (!isPlayer && GameState.player && GameState.player.alive) {
            const fogRadius = WeatherSystem.getFogRadius();
            const awarenessMult = WeatherSystem.getAwarenessMultiplier();
            
            // 只在特定天气下启用能见度效果
            const hasVisibilityEffect = fogRadius > 0 || awarenessMult < 0.8;
            
            if (hasVisibilityEffect) {
                const dx = entity.x - GameState.player.x;
                const dy = entity.y - GameState.player.y;
                const dist = Math.hypot(dx, dy);
                
                const baseVisibility = 400;
                const effectiveVisibility = fogRadius > 0 
                    ? Math.min(baseVisibility, fogRadius * 0.8) 
                    : baseVisibility * awarenessMult;
                
                if (dist > effectiveVisibility * 0.4) {
                    const fadeStart = effectiveVisibility * 0.4;
                    const fadeEnd = effectiveVisibility;
                    if (dist < fadeEnd) {
                        const t = (dist - fadeStart) / (fadeEnd - fadeStart);
                        visibilityAlpha = 1.0 - t * t;
                    } else {
                        visibilityAlpha = 0.08;
                    }
                }
                visibilityAlpha = Math.max(0.08, visibilityAlpha);
            }
        }
        
        this.ctx.save();
        this.ctx.globalAlpha = visibilityAlpha;
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
            if (pickup.alive) this._drawAtWorldPos(pickup, false);
        }

        for (const g of GameState.grenades) {
            g.draw(this.ctx);
        }
    },

    /** 绘制所有实体（子弹、敌人、队友、玩家） */
    _renderEntities() {
        const { player, enemies, teammates, bullets } = GameState;

        for (const b of bullets) {
            if (b.alive) this._drawAtWorldPos(b, false);
        }
        for (const e of enemies) {
            if (e.alive) this._drawAtWorldPos(e, false);
        }
        for (const t of teammates) {
            if (t.alive) this._drawAtWorldPos(t, false);
        }
        if (player && player.alive) {
            this._drawAtWorldPos(player, true);
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


    /** 绘制昼夜循环层（环境色调 + 动态光照） */
    _renderDayNight() {
        const darkness = DayNightSystem.getAmbientDarkness();
        if (darkness < 0.01 && DayNightSystem.lightSources.length === 0) return;

        const w = this.width;
        const h = this.height;

        // 复用离屏 canvas
        if (!this._dayNightCanvas || this._dayNightCanvas.width !== Math.ceil(w) || this._dayNightCanvas.height !== Math.ceil(h)) {
            this._dayNightCanvas = document.createElement('canvas');
            this._dayNightCanvas.width = Math.ceil(w);
            this._dayNightCanvas.height = Math.ceil(h);
            this._dayNightCtx = this._dayNightCanvas.getContext('2d');
        }

        const offCtx = this._dayNightCtx;
        offCtx.clearRect(0, 0, w, h);

        // 填充环境色调遮罩
        if (darkness > 0.01) {
            const tint = DayNightSystem.getTint();
            offCtx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
            offCtx.fillRect(0, 0, w, h);

            // 动态光照"挖洞"
            if (DayNightSystem.lightSources.length > 0) {
                offCtx.save();
                offCtx.globalCompositeOperation = 'destination-out';

                for (const light of DayNightSystem.lightSources) {
                    const pos = this.toScreen(light.x, light.y);
                    const lifeRatio = light.life / light.maxLife;
                    const currentRadius = light.radius * lifeRatio;

                    if (currentRadius < 1) continue;

                    const gradient = offCtx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, currentRadius);
                    gradient.addColorStop(0, `rgba(0,0,0,${lifeRatio})`);
                    gradient.addColorStop(0.5, `rgba(0,0,0,${lifeRatio * 0.5})`);
                    gradient.addColorStop(1, 'rgba(0,0,0,0)');

                    offCtx.fillStyle = gradient;
                    offCtx.beginPath();
                    offCtx.arc(pos.x, pos.y, currentRadius, 0, Math.PI * 2);
                    offCtx.fill();
                }

                offCtx.restore();
            }
        }

        // 将离屏 canvas 绘制到主 canvas
        this.ctx.drawImage(this._dayNightCanvas, 0, 0);
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
            hud.style.display = (menuOpen || GameState.gameOver) ? 'none' : 'flex';
        }

        // Game Over 优先级最高
        if (GameState.gameOver) {
            if (!GameState.permanentDefeat) {
                // 非永久战败：渲染世界 + 天气 + 较轻遮罩，让玩家看到战场
                this._renderWorld();
                this._renderEntities();
                // 保留天气视觉效果
                WeatherSystem.drawCloudShadows(this.ctx, GameState.camera);
                WeatherSystem.drawParticles(this.ctx);
                WeatherSystem.drawOverlay(this.ctx, this);
                WeatherSystem.drawWeatherEdgeEffects(this.ctx, this);
                WeatherSystem.drawLightning(this.ctx, this);
                // 昼夜渲染层
                this._renderDayNight();
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                this.ctx.fillRect(0, 0, this.width, this.height);
            } else {
                this._drawOverlay();
            }
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
        // 天气渲染层
        WeatherSystem.drawCloudShadows(this.ctx, GameState.camera);
        WeatherSystem.drawParticles(this.ctx);
        WeatherSystem.drawOverlay(this.ctx, this);
        WeatherSystem.drawWeatherEdgeEffects(this.ctx, this);
        WeatherSystem.drawLightning(this.ctx, this);
        // 昼夜渲染层
        this._renderDayNight();
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

// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { drawWeaponHUD } from './WeaponHUD.js';
import { drawInventory } from './InventoryUI.js';
import { GLASS, drawGlassPanel, easeOutCubic, easeInOutCubic } from './GlassUI.js';
import { drawArsenalShop } from './ArsenalUI.js';
import { drawDebug } from './DebugUI.js';
import { drawGameOver } from './GameOverUI.js';
import { drawRadioUI, updateRadioAnimation, updateRadioNoPermit, drawRadioNoPermit } from './RadioUI.js';
import { drawSupportEffects } from './SupportEffectRenderer.js';
import { drawVehicleChatBubbles, drawAIMonologues } from './BubbleRenderer.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { TornadoSystem } from '../core/TornadoSystem.js';
import { WEATHER_DEFS } from '../core/WeatherDefs.js';
import { DayNightSystem } from '../core/DayNightSystem.js';
import { PostProcess } from './PostProcess.js';
import { drawCrosshair, isCrosshairActive } from './CrosshairRenderer.js';
import { drawPauseMenu, updatePauseAnimation } from './PauseMenuUI.js';
import { drawSettings, updateSettingsAnimation } from './SettingsUI.js';

export const Renderer = {
    canvas: null,
    ctx: null,
    _offscreenCanvas: null,
    _offscreenCtx: null,
    _dayNightCanvas: null,
    _dayNightCtx: null,
    _blurCanvas: null,  // 用于毛玻璃模糊效果
    _blurCtx: null,
    _blurNeededNextFrame: false, // 上一帧用过模糊面板则本帧预先捕获，避免每帧无条件全屏拷贝
    _blurredThisFrame: false,   // 本帧是否已捕获过模糊画面（懒捕获兜底用）
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
        // 创建离屏 canvas 用于渲染游戏画面（使用 OffscreenCanvas 实现零拷贝上传）
        this._offscreenCanvas = null; // 将在 resize() 中创建
        this._offscreenCtx = null;

        // 先用临时 canvas 避免 null ctx（resize() 会替换）
        this.ctx = document.createElement('canvas').getContext('2d');

        // 初始化模糊 canvas 用于毛玻璃效果
        this._blurCanvas = document.createElement('canvas');
        this._blurCtx = this._blurCanvas.getContext('2d');

        // 初始化后处理管线
        PostProcess.init();

        console.log('✅ Renderer 初始化成功');
    },

    resize() {
        if (!this.canvas) this.init();
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = rect.width;
        const height = rect.height;

        // 离屏 canvas 使用 DPR 缩放，保证 Retina 屏上文字清晰
        // 使用 OffscreenCanvas 实现零拷贝上传到 WebGL
        const canvasWidth = Math.ceil(width * dpr);
        const canvasHeight = Math.ceil(height * dpr);

        // 仅在尺寸变化时重建 canvas，避免频繁 resize 产生废弃对象
        const needsRebuild = !this._offscreenCanvas ||
            this._offscreenCanvas.width !== canvasWidth ||
            this._offscreenCanvas.height !== canvasHeight;

        if (needsRebuild) {
            if (typeof OffscreenCanvas !== 'undefined') {
                this._offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
            } else {
                // 降级方案：使用普通 canvas
                this._offscreenCanvas = document.createElement('canvas');
                this._offscreenCanvas.width = canvasWidth;
                this._offscreenCanvas.height = canvasHeight;
            }
            this._offscreenCtx = this._offscreenCanvas.getContext('2d');
            this._offscreenCtx.setTransform(1, 0, 0, 1, 0, 0); // 重置变换
            this._offscreenCtx.scale(dpr, dpr);
            this.ctx = this._offscreenCtx; // 同步 this.ctx 引用
        }

        this.logicalWidth = width;
        this.logicalHeight = height;
        // 同步视口尺寸到 GameState（供天气系统等使用）
        GameState.viewport.width = width;
        GameState.viewport.height = height;
        // 调整后处理 canvas 尺寸
        PostProcess.resize(width, height);

        // 同步昼夜遮罩 canvas 尺寸
        if (this._dayNightCanvas) {
            this._dayNightCanvas.width = Math.ceil(width);
            this._dayNightCanvas.height = Math.ceil(height);
        }

        // 同步模糊 canvas 尺寸（使用逻辑尺寸，非 DPR 缩放）
        if (this._blurCanvas) {
            this._blurCanvas.width = Math.ceil(width);
            this._blurCanvas.height = Math.ceil(height);
        }

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
    
    // 捕获当前 offscreen 画面到模糊 canvas（在绘制 UI 前调用）
    _captureFrameForBlur() {
        if (!this._blurCanvas || !this._offscreenCanvas) return;
        const w = this.width;
        const h = this.height;
        if (this._blurCanvas.width !== w || this._blurCanvas.height !== h) {
            this._blurCanvas.width = w;
            this._blurCanvas.height = h;
        }
        this._blurCtx.clearRect(0, 0, w, h);
        // 从 offscreenCanvas（物理像素）绘制到 blurCanvas（逻辑像素）
        // offscreenCanvas 尺寸是 width*dpr x height*dpr，需要正确缩放
        this._blurCtx.drawImage(
            this._offscreenCanvas,
            0, 0, this._offscreenCanvas.width, this._offscreenCanvas.height,  // source (physical pixels)
            0, 0, w, h  // destination (logical pixels)
        );
        this._blurredThisFrame = true;
    },
    
    // 全屏模糊（覆盖整个画面）
    _drawBlurBackground() {
        if (!this._blurCanvas || !this.ctx) return;
        const w = this.width;
        const h = this.height;
        this.ctx.save();
        // 先清空画布，移除锐利内容
        this.ctx.clearRect(0, 0, w, h);
        // 绘制模糊版本
        this.ctx.filter = 'blur(18px)';
        this.ctx.drawImage(this._blurCanvas, 0, 0, w, h);
        this.ctx.filter = 'none';
        this.ctx.restore();
    },
    
    // 全屏模糊（带 alpha，用于背包打开/关闭动画过渡）
    _drawBlurBackgroundAlpha(alpha) {
        if (!this._blurCanvas || !this.ctx) return;
        if (alpha <= 0) return;
        if (!this._blurredThisFrame) this._captureFrameForBlur();
        this._blurNeededNextFrame = true; // 本帧使用模糊画面，下一帧预先捕获
        const w = this.width;
        const h = this.height;
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.filter = 'blur(18px)';
        this.ctx.drawImage(this._blurCanvas, 0, 0, w, h);
        this.ctx.filter = 'none';
        this.ctx.restore();
    },

    // 区域模糊（用于 HUD 面板，裁剪到指定区域）
    _drawBlurRegion(x, y, w, h, radius = 0) {
        if (!this._blurCanvas || !this.ctx) return;
        if (!this._blurredThisFrame) this._captureFrameForBlur();
        this._blurNeededNextFrame = true; // 本帧使用模糊画面，下一帧预先捕获
        this.ctx.save();
        if (radius > 0) {
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, w, h, radius);
            this.ctx.clip();
        } else {
            this.ctx.beginPath();
            this.ctx.rect(x, y, w, h);
            this.ctx.clip();
        }
        // 先清空裁剪区域，移除锐利内容
        this.ctx.clearRect(x - 1, y - 1, w + 2, h + 2);
        // 绘制模糊版本
        this.ctx.filter = 'blur(14px)';
        this.ctx.drawImage(this._blurCanvas, 0, 0, this.width, this.height);
        this.ctx.filter = 'none';
        this.ctx.restore();
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
        for (const loot of GameState.lootPickups) {
            if (loot.alive) this._drawAtWorldPos(loot, false);
        }


        // 先绘制尘土（在车辆下面）
        EffectsManager.drawDustOnly(this.ctx, GameState.camera);
        
        // 载具
        for (const v of GameState.vehicles) {
            if (v.alive) this._drawAtWorldPos(v, false);
        }

        // 载具 AI 闲聊气泡
        drawVehicleChatBubbles(this.ctx, this.toScreen.bind(this));
        // AI 战场自言自语气泡
        drawAIMonologues(this.ctx, this.toScreen.bind(this));
        for (const g of GameState.grenades) {
            g.draw(this.ctx);
        }

        // 渲染支援系统视觉效果
        drawSupportEffects(this.ctx, this.toScreen.bind(this));
    },

    /** 渲染载具 AI 闲聊气泡 */


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
            if (t.alive && !t.mountedVehicle) this._drawAtWorldPos(t, false);
        }
        if (player && (player.alive || player.dying) && !player.mountedVehicle) {
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
        // 动态准星（最顶层 HUD）
        drawCrosshair(this.ctx);
    },

    _renderDayNightOverlay() {
        const darkness = DayNightSystem.getAmbientDarkness();
        if (darkness < 0.01 && DayNightSystem.lightSources.length === 0) return;

        const w = this.width;
        const h = this.height;

        if (!this._dayNightCanvas) {
            this._dayNightCanvas = document.createElement('canvas');
            this._dayNightCanvas.width = Math.ceil(w);
            this._dayNightCanvas.height = Math.ceil(h);
            this._dayNightCtx = this._dayNightCanvas.getContext('2d');
        }

        const offCtx = this._dayNightCtx;
        offCtx.clearRect(0, 0, w, h);

        if (darkness > 0.01) {
            const tint = DayNightSystem.getTint();
            offCtx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
            offCtx.fillRect(0, 0, w, h);

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

        this.ctx.drawImage(this._dayNightCanvas, 0, 0);
    },

    // 更新闪电和火光数据到着色器
    _updateShaderLighting() {
        // 闪电数据
        const flash = WeatherSystem.lightningFlash > 0 ? WeatherSystem.lightningFlash / 10 : 0;
        PostProcess.updateLightning(flash);

        // 积水反射强度（基于天气）
        let rainIntensity = 0;
        const currentDef = WeatherSystem.getWeatherDef();
        const transitionProgress = WeatherSystem.transitionProgress;

        // 计算雨水强度
        const getRainIntensity = (def) => {
            if (!def) return 0;
            // 雨天和酸雨都有积水效果
            if (def.particleType === 'rain' || def.particleType === 'acid') {
                // 归一化到 0-1，最大密度 24
                return Math.min(1, (def.particleDensity || 0) / 24);
            }
            return 0;
        };

        if (currentDef) {
            const currentRain = getRainIntensity(currentDef);

            // 过渡期间：获取前一个天气定义并插值
            if (WeatherSystem.transitioning && transitionProgress < 1) {
                // 获取前一个天气定义
                const prevDef = WeatherSystem.previous ?
                    WEATHER_DEFS[WeatherSystem.previous] : null;
                const prevRain = prevDef ? getRainIntensity(prevDef) : 0;
                rainIntensity = prevRain * (1 - transitionProgress) + currentRain * transitionProgress;
            } else {
                rainIntensity = currentRain;
            }
        }

        PostProcess.updateRain(rainIntensity);

        // 龙卷风浓雾 — 基于玩家到龙卷风中心的距离
        let tornadoFogIntensity = 0;
        if (WeatherSystem.current === 'tornado' && TornadoSystem.center && GameState.player) {
            const dx = GameState.player.x - TornadoSystem.center.x;
            const dy = GameState.player.y - TornadoSystem.center.y;
            const dist = Math.hypot(dx, dy);
            const fogRange = 4000; // 4000px 内开始起雾
            if (dist < fogRange) {
                tornadoFogIntensity = 1.0 - (dist / fogRange);
                // 非线性增强：越近越浓
                tornadoFogIntensity = tornadoFogIntensity * tornadoFogIntensity;
            }
        }
        PostProcess.updateTornadoFog(tornadoFogIntensity);
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

        // 更新电台动画
        updateRadioAnimation();
        // 更新“无权限打开电台”提示动画（独立于电台面板，电台此时未必打开）
        updateRadioNoPermit();
        // 更新暂停菜单 / 设置面板动画（自驱 deltaTime，倒带式；需在分支判断前推进，保证关闭动画能播完）
        updatePauseAnimation();
        updateSettingsAnimation();

        const menuOpen = GameState.inventoryOpen || GameState.arsenalOpen || GameState.radioOpen || GameState.debugOpen || GameState.paused || GameState.settingsOpen;
        const hud = document.getElementById('hud');
        if (hud) {
            hud.style.display = (menuOpen || GameState.gameOver) ? 'none' : 'flex';
        }

        // 准星显示时隐藏系统鼠标；准星不显示（菜单/死亡/医疗包/战利品）时恢复系统鼠标
        const canvas = document.getElementById("gameCanvas");
        if (canvas) {
            canvas.style.cursor = isCrosshairActive() ? "none" : "default";
        }

        // Game Over 优先级最高
        if (GameState.gameOver) {
            // 渲染世界 + 天气，捕获后做全屏毛玻璃模糊背板（与背包/军械库/电台同管线）
            this._renderWorld();
            this._renderEntities();
            WeatherSystem.drawCloudShadows(this.ctx, GameState.camera);
            WeatherSystem.drawParticles(this.ctx);
            WeatherSystem.drawOverlay(this.ctx, this);
            WeatherSystem.drawWeatherEdgeEffects(this.ctx, this);

            // === 死亡界面延迟+弹出动画推进（自驱 deltaTime） ===
            // 死亡瞬间先延迟 1s（此期间只渲染战场、遮罩渐黑），1s 后 easeOutCubic 弹出毛玻璃背板+卡片
            const tNow = performance.now();
            if (GameState._gameOverAppearLastTime == null) GameState._gameOverAppearLastTime = tNow;
            const dt = Math.min((tNow - GameState._gameOverAppearLastTime) / 1000, 0.05);
            GameState._gameOverAppearLastTime = tNow;
            if (GameState.gameOverDelay < 1) {
                GameState.gameOverDelay = Math.min(1, GameState.gameOverDelay + dt);
            } else if (GameState.gameOverAppearAnim < 1) {
                GameState.gameOverAppearAnim = Math.min(1, GameState.gameOverAppearAnim + dt / 0.28); // ~280ms 弹出
            }
            const eased = easeOutCubic(GameState.gameOverAppearAnim);

            this._captureFrameForBlur();
            // 模糊背板随弹出动画渐入（弹出期才显形，延迟期为 0）
            this._drawBlurBackgroundAlpha(0.85 * eased);
            // 延迟期战场渐黑（0→0.55 随延迟 0→1 加深），弹出期保持 0.55
            this.ctx.fillStyle = `rgba(0,0,0,${0.55 * GameState.gameOverDelay})`;
            this.ctx.fillRect(0, 0, this.width, this.height);

            this._updateShaderLighting();
            drawGameOver(this.ctx, this);   // 内部读 gameOverDelay/gameOverAppearAnim 做早退与 scale/alpha
            this._renderDayNightOverlay();
            PostProcess.apply(this._offscreenCanvas, this);
            return;
        }

        // 暂停 + 设置：渲染冻结世界 + 毛玻璃模糊背景 + UI 叠加（与背包/军械库同管线）
        // 暂停菜单作底层（暂停期间始终绘制），设置面板从暂停菜单进入后叠在上层
        if (GameState.paused || GameState.pauseAnimDirection === 'closing' ||
            GameState.settingsOpen || GameState.settingsAnimDirection === 'closing') {
            this._renderWorld();
            this._renderEntities();
            WeatherSystem.drawCloudShadows(this.ctx, GameState.camera);
            WeatherSystem.drawParticles(this.ctx);
            WeatherSystem.drawOverlay(this.ctx, this);
            WeatherSystem.drawWeatherEdgeEffects(this.ctx, this);

            this._captureFrameForBlur();

            // 模糊背板取暂停/设置两者进度的较大值，保证 暂停→设置 过渡时模糊不回落闪烁
            const _pauseRaw = Math.max(GameState.pauseAnimProgress, GameState.settingsAnimProgress);
            const blurP = easeOutCubic(_pauseRaw);
            this._drawBlurBackgroundAlpha(0.85 * blurP);

            // 设置打开时暂停菜单 cross-fade 淡出（设置淡入、暂停淡出，二者不同屏叠加）
            const _settingsP = easeOutCubic(GameState.settingsAnimProgress || 0);
            if (GameState.paused || GameState.pauseAnimDirection === 'closing') {
                drawPauseMenu(this.ctx, this, 1 - _settingsP);
            }
            if (GameState.settingsOpen || GameState.settingsAnimDirection === 'closing') {
                drawSettings(this.ctx, this);
            }

            this._updateShaderLighting();
            this._renderDayNightOverlay();
            PostProcess.apply(this._offscreenCanvas, this);
            return;
        }

        // Debug 面板
        if (GameState.debugOpen) {
            drawDebug(this.ctx, this);
            this._updateShaderLighting();
            this._renderDayNightOverlay();
            PostProcess.apply(this._offscreenCanvas, this);
            return;
        }

        // 电台：渲染世界 + 毛玻璃模糊背景 + UI叠加（与背包/军械库同管线）
        if (GameState.radioOpen || GameState.radioAnimDirection === 'closing') {
            this._renderWorld();
            this._renderEntities();
            WeatherSystem.drawCloudShadows(this.ctx, GameState.camera);
            WeatherSystem.drawParticles(this.ctx);
            WeatherSystem.drawOverlay(this.ctx, this);
            WeatherSystem.drawWeatherEdgeEffects(this.ctx, this);

            // 捕获当前画面用于模糊效果
            this._captureFrameForBlur();

            // 全屏毛玻璃背板：与电台动画进度同步（easeOutCubic，倒带式：关闭时 progress 1→0 模糊随之恢复清晰）
            // 电台模糊调淡（0.5 < 背包/军械库的 0.85），便于看清战场选投放点
            const _radioRaw = GameState.radioAnimProgress;
            const blurP = easeOutCubic(_radioRaw);
            this._drawBlurBackgroundAlpha(0.5 * blurP);

            drawRadioUI(this.ctx, this);
            this._updateShaderLighting();
            this._renderDayNightOverlay();
            PostProcess.apply(this._offscreenCanvas, this);
            return;
        }

        // 背包界面：渲染世界 + 模糊背景 + UI叠加
        if (GameState.inventoryOpen || GameState.inventoryAnimDirection === 'closing') {
            // 先渲染世界到 offscreen canvas
            this._renderWorld();
            this._renderEntities();
            WeatherSystem.drawCloudShadows(this.ctx, GameState.camera);
            WeatherSystem.drawParticles(this.ctx);
            WeatherSystem.drawOverlay(this.ctx, this);
            WeatherSystem.drawWeatherEdgeEffects(this.ctx, this);
            
            // 捕获当前画面用于模糊效果
            this._captureFrameForBlur();
            
            // 应用高斯模糊背景：与 InventoryUI 动画同步（倒带式）
            // 打开/关闭共用 easeOutCubic(rawP)：rawP 关闭时 1→0，模糊随之从 0.85→0 恢复清晰
            const _invRaw = GameState.inventoryAnimProgress;
            const blurP = easeOutCubic(_invRaw);
            this._drawBlurBackgroundAlpha(0.85 * blurP);

            // 过渡态 WeaponHUD：开/关包时 HUD 与背包同步滑入/滑出 + 淡入/淡出。
            // - 位移 slide = rawP（线性，与背包同步铺开，距离够大足以看清）。
            // - 透明度 hudAlpha = easeInOutCubic(1 - rawP)：首尾缓、中段缓，呼吸感。
            //   背包自身关包仅 ~230ms，纯线性 0→1 给人"瞬间消失/出现"的错觉；
            //   easeInOutCubic 让 alpha 在两端驻留较久（开/关包初末段几乎不动），
            //   中段平滑过渡，肉眼能清晰感知渐变而非硬切。
            //   关包末帧 rawP≈0 → hudAlpha=easeInOutCubic(1)=1（满显） == 下一帧主分支满显 ✓ 零跳变。
            const slide = _invRaw;                 // = rawP：关包 1→0 落定 / 开包 0→1 滑出
            const hudAlpha = easeInOutCubic(1 - _invRaw);
            if (hudAlpha > 0.05) {
                drawWeaponHUD(this.ctx, this, {
                    alpha: hudAlpha,              // 关包缓入 0→1 / 开包缓出 1→0
                    panelOffsetX: slide * 64,     // 右侧面板滑移距离
                    bottomOffsetY: slide * 56,   // 底部栏滑移距离
                });
            }

            // 绘制背包 UI
            drawInventory(this.ctx, this);
            this._updateShaderLighting();
            this._renderDayNightOverlay();
            PostProcess.apply(this._offscreenCanvas, this);
            return;
        }

        // 军械库界面：渲染世界 + 毛玻璃模糊背景 + UI 叠加（与背包同管线、同语言）
        if (GameState.arsenalOpen || GameState.arsenalAnimDirection === 'closing') {
            this._renderWorld();
            this._renderEntities();
            WeatherSystem.drawCloudShadows(this.ctx, GameState.camera);
            WeatherSystem.drawParticles(this.ctx);
            WeatherSystem.drawOverlay(this.ctx, this);
            WeatherSystem.drawWeatherEdgeEffects(this.ctx, this);

            // 捕获当前画面用于模糊效果
            this._captureFrameForBlur();

            // 全屏毛玻璃背板：与军械库动画进度同步（easeOutCubic，平滑无回弹；
            // arsen 无回弹，与 ArsenalUI 面板的 easeOutBack 回弹刻意解耦）
            const _arRaw = GameState.arsenalAnimProgress;
            const blurP = easeOutCubic(_arRaw);
            this._drawBlurBackgroundAlpha(0.85 * blurP);

            // 军械库商店 UI 内部自行推进动画进度并应用 scale/fade/offset 变换
            drawArsenalShop(this.ctx, this);

            this._updateShaderLighting();
            this._renderDayNightOverlay();
            PostProcess.apply(this._offscreenCanvas, this);
            return;
        }

        // 其他菜单打开时跳过世界渲染
        if (menuOpen) {
            this._drawOverlay();
            this._updateShaderLighting();
            this._renderDayNightOverlay();
            PostProcess.apply(this._offscreenCanvas, this);
            return;
        }

        this._renderWorld();
        this._renderEntities();
        // 天气渲染层
        WeatherSystem.drawCloudShadows(this.ctx, GameState.camera);
        WeatherSystem.drawParticles(this.ctx);
        WeatherSystem.drawOverlay(this.ctx, this);
        WeatherSystem.drawWeatherEdgeEffects(this.ctx, this);

        // 捕获当前画面用于 HUD 面板模糊效果
        // 按上一帧是否使用模糊面板预测：未使用则跳过全屏拷贝；真正需要时由 _drawBlurRegion 兜底懒捕获
        // 先回收预测位（_drawBlur* 使用时会重新 raise），再据其决定是否预捕
        const _needBlurPrev = this._blurNeededNextFrame;
        this._blurNeededNextFrame = false;
        this._blurredThisFrame = false;
        if (_needBlurPrev) {
            this._captureFrameForBlur();
        }

        this._renderHUD();

        // 无权限打开电台提示图（HUD 之上、最顶层覆盖层）
        drawRadioNoPermit(this.ctx, this);

        // FPS显示
        if (GameState.debugShowFPS) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(8, 8, 90, 28);
            this.ctx.fillStyle = GameState.fps >= 50 ? '#4CAF50' : GameState.fps >= 30 ? '#FF9800' : '#f44336';
            this.ctx.font = 'bold 16px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(GameState.fps + ' FPS', 16, 22);
            this.ctx.restore();
        }

        // 应用后处理效果并输出到 WebGL canvas
        this._updateShaderLighting();
        this._renderDayNightOverlay();
        PostProcess.apply(this._offscreenCanvas, this);
    },

    drawStatusEffectsHUD(ctx, player) {
        const EFFECT_START_X = 20;
        const EFFECT_START_Y = 80;
        const ICON_SIZE = 40;
        const ICON_SPACING = 8;
        const FPS = 60;
        const FONT = '-apple-system, "SF Pro Display", sans-serif';

        for (let i = 0; i < player.statusEffects.length; i++) {
            const effect = player.statusEffects[i];
            const x = EFFECT_START_X;
            const y = EFFECT_START_Y + i * (ICON_SIZE + ICON_SPACING);
            const r = GLASS.radiusSmall;

            // 局部毛玻璃模糊 + 玻璃底板
            this._drawBlurRegion(x, y, ICON_SIZE, ICON_SIZE, r);
            drawGlassPanel(ctx, x, y, ICON_SIZE, ICON_SIZE, r);

            // 左侧效果色竖条
            ctx.save();
            ctx.fillStyle = effect.color;
            ctx.beginPath();
            ctx.roundRect(x + 4, y + 6, 4, ICON_SIZE - 12, 2);
            ctx.fill();
            ctx.restore();

            // emoji 图标
            ctx.fillStyle = effect.color;
            ctx.font = '22px ' + FONT;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(effect.icon, x + ICON_SIZE / 2 + 6, y + ICON_SIZE / 2 - 6);

            // 倒计时数字（三档色阶）
            const seconds = Math.ceil(effect.remaining / FPS);
            const ratio = effect.duration > 0 ? effect.remaining / effect.duration : 1;
            const remainColor = ratio <= 0.25 ? GLASS.ammoCritical
                : ratio <= 0.5 ? GLASS.ammoLow
                : GLASS.textPrimary;
            ctx.fillStyle = remainColor;
            ctx.font = '600 11px ' + FONT;
            ctx.fillText(seconds + 's', x + ICON_SIZE / 2 + 6, y + ICON_SIZE - 7);
        }
    }
};

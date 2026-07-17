// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { drawWeaponHUD } from './WeaponHUD.js';
import { drawInventory } from './InventoryUI.js';
import { drawArsenalShop } from './ArsenalUI.js';
import { drawDebug } from './DebugUI.js';
import { drawGameOver } from './GameOverUI.js';
import { drawRadioUI, updateRadioAnimation } from './RadioUI.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { TornadoSystem } from '../core/TornadoSystem.js';
import { WEATHER_DEFS } from '../core/WeatherDefs.js';
import { DayNightSystem } from '../core/DayNightSystem.js';
import { SupportSystem } from '../core/SupportSystem.js';
import { PostProcess } from './PostProcess.js';
import { VehicleChatSystem } from '../utils/VehicleChatSystem.js';
import { AIMonologueSystem } from '../utils/AIMonologueSystem.js';

export const Renderer = {
    canvas: null,
    ctx: null,
    _offscreenCanvas: null,
    _offscreenCtx: null,
    _dayNightCanvas: null,
    _dayNightCtx: null,
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
        this._renderVehicleChatBubbles();
        // AI 战场自言自语气泡
        this._renderAIMonologues();
        for (const g of GameState.grenades) {
            g.draw(this.ctx);
        }

        // 渲染支援系统视觉效果
        this._renderSupportEffects();
    },

    /** 渲染载具 AI 闲聊气泡 */
    _renderVehicleChatBubbles() {
        const ctx = this.ctx;
        for (const vehicle of GameState.vehicles) {
            if (!vehicle.alive) continue;
            for (let i = 0; i < vehicle.occupants.length; i++) {
                const bubble = VehicleChatSystem.getBubble(vehicle, i);
                if (!bubble) continue;
                const seatPos = vehicle.getSeatWorldPosition(i);
                const screenPos = this.toScreen(seatPos.x, seatPos.y);
                this._drawSpeechBubble(ctx, screenPos.x, screenPos.y, bubble.text, bubble.timer, bubble.maxTimer);
            }
        }
    },

    /** 绘制液态毛玻璃风格对话气泡 */
    _drawSpeechBubble(ctx, sx, sy, text, timer, maxTimer) {
        const maxWidth = 180;
        const paddingX = 14;
        const paddingY = 10;
        const fontSize = 12;
        const lineHeight = fontSize * 1.4;
        const tailHeight = 12;
        const bubbleY = sy - 65;
        const cornerRadius = 12;

        // 淡入淡出动画
        const fadeInFrames = 15;
        const fadeOutFrames = 60;
        const elapsed = maxTimer - timer;
        let alpha = 1.0;
        if (elapsed < fadeInFrames) {
            alpha = elapsed / fadeInFrames;
        } else if (timer < fadeOutFrames) {
            alpha = timer / fadeOutFrames;
        }
        // 弹性缩放
        const scaleProgress = Math.min(1, elapsed / 12);
        const scale = 0.85 + 0.15 * scaleProgress;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx, bubbleY);
        ctx.scale(scale, scale);
        ctx.translate(-sx, -bubbleY);

        // 测量文字并换行
        ctx.font = `500 ${fontSize}px -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif`;
        const chars = text.split('');
        const textLines = [];
        let currentLine = '';
        for (const char of chars) {
            const testLine = currentLine + char;
            if (ctx.measureText(testLine).width > maxWidth - paddingX * 2) {
                textLines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) textLines.push(currentLine);

        const textHeight = textLines.length * lineHeight;
        const bubbleWidth = Math.min(maxWidth, Math.max(...textLines.map(l => ctx.measureText(l).width)) + paddingX * 2);
        const bubbleHeight = textHeight + paddingY * 2;
        const bx = sx - bubbleWidth / 2;
        const by = bubbleY - bubbleHeight;

        // 绘制气泡路径（含尾巴）
        const drawBubblePath = () => {
            ctx.beginPath();
            // 左上角
            ctx.moveTo(bx + cornerRadius, by);
            // 上边
            ctx.lineTo(bx + bubbleWidth - cornerRadius, by);
            // 右上角
            ctx.arcTo(bx + bubbleWidth, by, bx + bubbleWidth, by + cornerRadius, cornerRadius);
            // 右边
            ctx.lineTo(bx + bubbleWidth, by + bubbleHeight - cornerRadius);
            // 右下角
            ctx.arcTo(bx + bubbleWidth, by + bubbleHeight, bx + bubbleWidth - cornerRadius, by + bubbleHeight, cornerRadius);
            // 下边（右半）
            ctx.lineTo(sx + 8, by + bubbleHeight);
            // 尾巴
            ctx.lineTo(sx, by + bubbleHeight + tailHeight);
            ctx.lineTo(sx - 8, by + bubbleHeight);
            // 下边（左半）
            ctx.lineTo(bx + cornerRadius, by + bubbleHeight);
            // 左下角
            ctx.arcTo(bx, by + bubbleHeight, bx, by + bubbleHeight - cornerRadius, cornerRadius);
            // 左边
            ctx.lineTo(bx, by + cornerRadius);
            // 左上角
            ctx.arcTo(bx, by, bx + cornerRadius, by, cornerRadius);
            ctx.closePath();
        };

        // 1. 外层柔和阴影（液态感）
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        drawBubblePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
        ctx.fill();
        ctx.restore();

        // 2. 毛玻璃底层（半透明白色 + 轻微模糊模拟）
        drawBubblePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.fill();

        // 3. 内层渐变（液态光泽感）
        const glassGradient = ctx.createLinearGradient(bx, by, bx, by + bubbleHeight);
        glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        glassGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
        glassGradient.addColorStop(0.7, 'rgba(240, 245, 255, 0.08)');
        glassGradient.addColorStop(1, 'rgba(220, 230, 250, 0.25)');
        drawBubblePath();
        ctx.fillStyle = glassGradient;
        ctx.fill();

        // 4. 顶部高光条（液态反光）
        ctx.save();
        drawBubblePath();
        ctx.clip();
        const highlightGradient = ctx.createLinearGradient(bx, by, bx, by + bubbleHeight * 0.35);
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlightGradient;
        ctx.fillRect(bx, by, bubbleWidth, bubbleHeight * 0.35);
        ctx.restore();

        // 5. 边缘描边（玻璃质感）
        drawBubblePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 6. 内边缘细线（增强层次）
        drawBubblePath();
        ctx.strokeStyle = 'rgba(180, 200, 230, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 7. 文字（带轻微阴影增强可读性）
        ctx.save();
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = 'rgba(30, 40, 60, 0.92)';
        ctx.font = `500 ${fontSize}px -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i < textLines.length; i++) {
            ctx.fillText(textLines[i], sx, by + paddingY + i * lineHeight);
        }
        ctx.restore();

        ctx.restore();
    },

    /** 渲染 AI 战场自言自语气泡 */
    _renderAIMonologues() {
        const ctx = this.ctx;
        const allAI = [...GameState.enemies, ...GameState.teammates];
        for (const ai of allAI) {
            if (!ai || !ai.alive) continue;
            if (ai.mountedVehicle) continue; // 载具内的AI不显示自言自语
            const bubble = AIMonologueSystem.getBubble(ai);
            if (!bubble) continue;
            const screenPos = this.toScreen(ai.x, ai.y);
            // 自言自语气泡稍微偏小，用不同的渲染方法
            this._drawMonologueBubble(ctx, screenPos.x, screenPos.y, bubble.text, bubble.timer, bubble.maxTimer);
        }
    },

    /** 绘制自言自语气泡（比载具聊天更小更低调） */
    _drawMonologueBubble(ctx, sx, sy, text, timer, maxTimer) {
        const maxWidth = 140;
        const paddingX = 10;
        const paddingY = 7;
        const fontSize = 10;
        const lineHeight = fontSize * 1.35;
        const tailHeight = 8;
        const bubbleY = sy - 45;
        const cornerRadius = 8;

        // 淡入淡出
        const fadeInFrames = 12;
        const fadeOutFrames = 45;
        const elapsed = maxTimer - timer;
        let alpha = 1.0;
        if (elapsed < fadeInFrames) {
            alpha = elapsed / fadeInFrames;
        } else if (timer < fadeOutFrames) {
            alpha = timer / fadeOutFrames;
        }

        // 轻微弹性
        const scaleProgress = Math.min(1, elapsed / 10);
        const scale = 0.88 + 0.12 * scaleProgress;

        ctx.save();
        ctx.globalAlpha = alpha * 0.85; // 整体比载具聊天更透明
        ctx.translate(sx, bubbleY);
        ctx.scale(scale, scale);
        ctx.translate(-sx, -bubbleY);

        // 测量文字并换行
        ctx.font = `400 ${fontSize}px -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif`;
        const chars = text.split('');
        const textLines = [];
        let currentLine = '';
        for (const char of chars) {
            const testLine = currentLine + char;
            if (ctx.measureText(testLine).width > maxWidth - paddingX * 2) {
                textLines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) textLines.push(currentLine);

        const textHeight = textLines.length * lineHeight;
        const bubbleWidth = Math.min(maxWidth, Math.max(...textLines.map(l => ctx.measureText(l).width)) + paddingX * 2);
        const bubbleHeight = textHeight + paddingY * 2;
        const bx = sx - bubbleWidth / 2;
        const by = bubbleY - bubbleHeight;

        // 绘制气泡路径（含尾巴）
        const drawPath = () => {
            ctx.beginPath();
            ctx.moveTo(bx + cornerRadius, by);
            ctx.lineTo(bx + bubbleWidth - cornerRadius, by);
            ctx.arcTo(bx + bubbleWidth, by, bx + bubbleWidth, by + cornerRadius, cornerRadius);
            ctx.lineTo(bx + bubbleWidth, by + bubbleHeight - cornerRadius);
            ctx.arcTo(bx + bubbleWidth, by + bubbleHeight, bx + bubbleWidth - cornerRadius, by + bubbleHeight, cornerRadius);
            ctx.lineTo(sx + 5, by + bubbleHeight);
            ctx.lineTo(sx, by + bubbleHeight + tailHeight);
            ctx.lineTo(sx - 5, by + bubbleHeight);
            ctx.lineTo(bx + cornerRadius, by + bubbleHeight);
            ctx.arcTo(bx, by + bubbleHeight, bx, by + bubbleHeight - cornerRadius, cornerRadius);
            ctx.lineTo(bx, by + cornerRadius);
            ctx.arcTo(bx, by, bx + cornerRadius, by, cornerRadius);
            ctx.closePath();
        };

        // 阴影
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        drawPath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
        ctx.fill();
        ctx.restore();

        // 毛玻璃底层（比载具聊天更淡）
        drawPath();
        ctx.fillStyle = 'rgba(240, 245, 255, 0.55)';
        ctx.fill();

        // 液态渐变
        const glassGradient = ctx.createLinearGradient(bx, by, bx, by + bubbleHeight);
        glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        glassGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)');
        glassGradient.addColorStop(1, 'rgba(210, 225, 250, 0.2)');
        drawPath();
        ctx.fillStyle = glassGradient;
        ctx.fill();

        // 顶部高光
        ctx.save();
        drawPath();
        ctx.clip();
        const hlGrad = ctx.createLinearGradient(bx, by, bx, by + bubbleHeight * 0.3);
        hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = hlGrad;
        ctx.fillRect(bx, by, bubbleWidth, bubbleHeight * 0.3);
        ctx.restore();

        // 边缘描边
        drawPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 文字
        ctx.fillStyle = 'rgba(50, 60, 80, 0.85)';
        ctx.font = `400 ${fontSize}px -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i < textLines.length; i++) {
            ctx.fillText(textLines[i], sx, by + paddingY + i * lineHeight);
        }

        ctx.restore();
    },

    /** 渲染支援系统视觉效果（烟雾、空投、炮击标记） */
    _renderSupportEffects() {
        const time = Date.now();

        // 渲染烟雾区域
        for (const zone of SupportSystem.smokeZones) {
            const pos = this.toScreen(zone.x, zone.y);
            const radius = zone.radius * (GameState.camera.zoom || 1);

            // 烟雾淡入淡出
            const fadeIn = Math.min(1, (zone.maxDuration - zone.duration) / 30);
            const fadeOut = Math.min(1, zone.duration / 60);
            const alpha = Math.min(fadeIn, fadeOut) * 0.6;

            // 多层烟雾效果
            for (let i = 0; i < 3; i++) {
                const offset = Math.sin(time * 0.001 + i * 2) * radius * 0.1;
                const r = radius * (0.7 + i * 0.15);
                const gradient = this.ctx.createRadialGradient(
                    pos.x + offset, pos.y + offset * 0.5, 0,
                    pos.x + offset, pos.y + offset * 0.5, r
                );
                gradient.addColorStop(0, `rgba(180,180,180,${alpha * 0.4})`);
                gradient.addColorStop(0.5, `rgba(150,150,150,${alpha * 0.25})`);
                gradient.addColorStop(1, 'rgba(120,120,120,0)');

                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(pos.x + offset, pos.y + offset * 0.5, r, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // 烟雾边缘粒子
            const particleCount = 8;
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2 + time * 0.0005;
                const dist = radius * (0.6 + Math.sin(time * 0.002 + i) * 0.2);
                const px = pos.x + Math.cos(angle) * dist;
                const py = pos.y + Math.sin(angle) * dist;
                const pSize = 3 + Math.sin(time * 0.003 + i * 1.5) * 2;

                this.ctx.fillStyle = `rgba(200,200,200,${alpha * 0.3})`;
                this.ctx.beginPath();
                this.ctx.arc(px, py, pSize, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // 渲染炮击序列标记
        for (const seq of SupportSystem.artillerySequences) {
            const pos = this.toScreen(seq.x, seq.y);
            const radius = seq.bombRadius * (GameState.camera.zoom || 1);

            // 炮击区域警告圈（脉冲）
            const pulse = Math.sin(time * 0.008) * 0.3 + 0.7;
            const isPlayerFaction = seq.faction === 'player';
            const color = isPlayerFaction ? '100,181,246' : '255,82,82';

            // 外圈警告
            this.ctx.strokeStyle = `rgba(${color},${0.4 * pulse})`;
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([8, 4]);
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // 内圈填充
            const gradient = this.ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
            gradient.addColorStop(0, `rgba(${color},${0.15 * pulse})`);
            gradient.addColorStop(0.7, `rgba(${color},${0.05 * pulse})`);
            gradient.addColorStop(1, `rgba(${color},0)`);
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // 十字准星
            const crossSize = 12;
            this.ctx.strokeStyle = `rgba(${color},${0.6 * pulse})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x - crossSize, pos.y);
            this.ctx.lineTo(pos.x + crossSize, pos.y);
            this.ctx.moveTo(pos.x, pos.y - crossSize);
            this.ctx.lineTo(pos.x, pos.y + crossSize);
            this.ctx.stroke();

            // 剩余轮数文字
            this.ctx.fillStyle = `rgba(${color},0.8)`;
            this.ctx.font = 'bold 11px "Courier New", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'top';
            this.ctx.fillText(`${seq.roundsLeft} rounds`, pos.x, pos.y + radius + 6);
        }

        // 渲染空投物（下落动画）
        for (const drop of SupportSystem.supplyDrops) {
            const pos = this.toScreen(drop.x, drop.y);
            const progress = 1 - (drop.timer / 90); // 0~1 下落进度
            const scale = 0.3 + progress * 0.7;
            const alpha = 0.4 + progress * 0.6;

            // 降落伞效果（上方）
            if (progress < 0.8) {
                const parachuteY = pos.y - 30 * (1 - progress);
                const parachuteSize = 20 * scale;

                // 伞面
                this.ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
                this.ctx.beginPath();
                this.ctx.arc(pos.x, parachuteY, parachuteSize, Math.PI, 0);
                this.ctx.fill();

                // 伞绳
                this.ctx.strokeStyle = `rgba(200,200,200,${alpha * 0.4})`;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x - parachuteSize, parachuteY);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.moveTo(pos.x + parachuteSize, parachuteY);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
            }

            // 空投箱
            const boxSize = 14 * scale;
            const isWeapon = drop.weapons && drop.weapons.length > 0;
            const boxColor = isWeapon ? '255,152,0' : '76,175,80';

            // 箱子阴影
            this.ctx.fillStyle = `rgba(0,0,0,${alpha * 0.3})`;
            this.ctx.fillRect(pos.x - boxSize + 2, pos.y - boxSize + 2, boxSize * 2, boxSize * 2);

            // 箱子本体
            this.ctx.fillStyle = `rgba(${boxColor},${alpha})`;
            this.ctx.fillRect(pos.x - boxSize, pos.y - boxSize, boxSize * 2, boxSize * 2);

            // 箱子边框
            this.ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(pos.x - boxSize, pos.y - boxSize, boxSize * 2, boxSize * 2);

            // 箱子图标
            this.ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
            this.ctx.font = `${12 * scale}px sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(isWeapon ? '🔫' : '📦', pos.x, pos.y);

            // 落点标记（地面）
            const markerPulse = Math.sin(time * 0.006) * 3 + 10;
            this.ctx.strokeStyle = `rgba(${boxColor},${0.4 * (1 - progress)})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y + boxSize + 5, markerPulse, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // 渲染伞兵空降
        for (const p of SupportSystem.paratroopers) {
            const pos = this.toScreen(p.currentX, p.currentY);
            const progress = 1 - (p.timer / p.maxTimer);
            const scale = 0.5 + progress * 0.5;
            const alpha = 0.3 + progress * 0.7;

            // 降落伞（上方）
            if (progress < 0.85) {
                const parachuteY = pos.y - 25 * (1 - progress);
                const parachuteSize = 18 * scale;

                // 伞面（摇摆动画）
                const sway = Math.sin(time * 0.008 + p.targetX) * 3;
                this.ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
                this.ctx.beginPath();
                this.ctx.arc(pos.x + sway, parachuteY, parachuteSize, Math.PI, 0);
                this.ctx.fill();

                // 伞绳
                this.ctx.strokeStyle = `rgba(200,200,200,${alpha * 0.5})`;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x + sway - parachuteSize, parachuteY);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.moveTo(pos.x + sway + parachuteSize, parachuteY);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
            }

            // 伞兵小人
            const bodySize = 10 * scale;
            const color = p.elite ? '255,215,0' : '66,165,245'; // 精英金色，普通蓝色

            // 身体
            this.ctx.fillStyle = `rgba(${color},${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, bodySize, 0, Math.PI * 2);
            this.ctx.fill();

            // 边框
            this.ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.6})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();

            // 精英标记（星星）
            if (p.elite) {
                this.ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                this.ctx.font = `${8 * scale}px sans-serif`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('★', pos.x, pos.y);
            }

            // 落点标记（地面）
            const targetPos = this.toScreen(p.targetX, p.targetY);
            const markerPulse = Math.sin(time * 0.006) * 2 + 6;
            this.ctx.strokeStyle = `rgba(${color},${0.3 * (1 - progress)})`;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.arc(targetPos.x, targetPos.y, markerPulse, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // 渲染载具空投
        for (const drop of SupportSystem.vehicleDrops) {
            const pos = this.toScreen(drop.currentX, drop.currentY);
            const targetPos = this.toScreen(drop.targetX, drop.targetY);
            const progress = 1 - (drop.timer / drop.maxTimer);
            const scale = 0.3 + progress * 0.7;
            const alpha = 0.4 + progress * 0.6;

            // 地面阴影
            const shadowScale = 0.3 + progress * 0.7;
            this.ctx.fillStyle = `rgba(0,0,0,${0.15 + progress * 0.2})`;
            this.ctx.beginPath();
            this.ctx.ellipse(targetPos.x, targetPos.y, 30 * shadowScale, 14 * shadowScale, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // 降落伞（橙白条纹）
            if (progress < 0.88) {
                const parachuteY = pos.y - 50 * (1 - progress);
                const parachuteSize = 36 * scale;
                const sway = Math.sin(time * 0.005 + drop.targetX * 0.01) * 4;

                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(pos.x + sway, parachuteY, parachuteSize, Math.PI, 0);
                this.ctx.closePath();
                this.ctx.clip();

                this.ctx.fillStyle = `rgba(255,140,0,${alpha * 0.85})`;
                this.ctx.fillRect(pos.x + sway - parachuteSize, parachuteY - parachuteSize, parachuteSize * 2, parachuteSize);

                const stripeW = (parachuteSize * 2) / 5;
                for (let s = 0; s < 5; s += 2) {
                    this.ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
                    this.ctx.fillRect(pos.x + sway - parachuteSize + s * stripeW, parachuteY - parachuteSize, stripeW, parachuteSize);
                }
                this.ctx.restore();

                this.ctx.strokeStyle = `rgba(200,120,0,${alpha * 0.6})`;
                this.ctx.lineWidth = 1.5;
                this.ctx.beginPath();
                this.ctx.arc(pos.x + sway, parachuteY, parachuteSize, Math.PI, 0);
                this.ctx.stroke();

                this.ctx.strokeStyle = `rgba(180,180,180,${alpha * 0.5})`;
                this.ctx.lineWidth = 1;
                for (let r = 0; r < 4; r++) {
                    const attachX = pos.x + sway - parachuteSize + (r + 0.5) * (parachuteSize * 2 / 4);
                    this.ctx.beginPath();
                    this.ctx.moveTo(attachX, parachuteY);
                    this.ctx.lineTo(pos.x, pos.y - 8 * scale);
                    this.ctx.stroke();
                }
            }

            // 载具本体（简化吉普）
            const jeepSize = 48 * scale;
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = '#5C4033';
            this.ctx.beginPath();
            this.ctx.roundRect(pos.x - jeepSize * 0.35, pos.y - jeepSize * 0.5, jeepSize * 0.7, jeepSize, 4 * scale);
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.4})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            this.ctx.fillStyle = `rgba(150,200,255,${alpha * 0.5})`;
            this.ctx.fillRect(pos.x - jeepSize * 0.25, pos.y - jeepSize * 0.4, jeepSize * 0.5, jeepSize * 0.2);
            this.ctx.fillStyle = `rgba(30,30,30,${alpha * 0.8})`;
            for (const [wx, wy] of [[-0.35,-0.25],[0.35,-0.25],[-0.35,0.3],[0.35,0.3]]) {
                this.ctx.beginPath();
                this.ctx.arc(pos.x + jeepSize * wx, pos.y + jeepSize * wy, 4 * scale, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();

            // 落点标记
            const markerPulse = Math.sin(time * 0.006) * 3 + 8;
            this.ctx.strokeStyle = `rgba(100,181,246,${0.5 * (1 - progress * 0.5)})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([4, 3]);
            this.ctx.beginPath();
            this.ctx.arc(targetPos.x, targetPos.y, markerPulse, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            const crossSize = markerPulse * 0.6;
            this.ctx.strokeStyle = `rgba(100,181,246,${0.4 * (1 - progress * 0.5)})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(targetPos.x - crossSize, targetPos.y);
            this.ctx.lineTo(targetPos.x + crossSize, targetPos.y);
            this.ctx.moveTo(targetPos.x, targetPos.y - crossSize);
            this.ctx.lineTo(targetPos.x, targetPos.y + crossSize);
            this.ctx.stroke();

            if (progress < 0.7) {
                const heightM = Math.round((1 - progress) * 200);
                this.ctx.fillStyle = `rgba(100,181,246,${0.5 * (1 - progress)})`;
                this.ctx.font = '9px "Courier New", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(heightM + 'm', pos.x, pos.y + jeepSize * 0.6 + 10);
            }
        }

        // 渲染死神支援（MQ-9无人机投弹）- 三阶段电影级特效
        for (const strike of SupportSystem.reaperStrikes) {
            const pos = this.toScreen(strike.x, strike.y);
            const elapsed = strike.totalDuration - strike.timer;

            // ========== 阶段1：无人机飞入 + 激光标定（0-9秒）==========
            if (strike.phase === 'drone') {
                const droneProgress = elapsed / strike.droneFlyDuration;

                // 无人机从屏幕左侧飞入
                const droneStartX = pos.x - 800;
                const droneEndX = pos.x;
                const droneY = pos.y - 200;
                const droneX = droneStartX + (droneEndX - droneStartX) * Math.min(1, droneProgress * 1.5);

                // 无人机剪影（简化图形）
                const droneAlpha = Math.min(0.7, droneProgress * 2);
                this.ctx.fillStyle = `rgba(40,40,40,${droneAlpha})`;
                this.ctx.beginPath();
                // 机身
                this.ctx.ellipse(droneX, droneY, 25, 8, 0, 0, Math.PI * 2);
                this.ctx.fill();
                // 机翼
                this.ctx.fillRect(droneX - 35, droneY - 2, 70, 4);
                // 尾翼
                this.ctx.fillRect(droneX - 25, droneY - 8, 10, 6);

                // 无人机阴影（地面）
                const shadowProgress = Math.min(1, droneProgress * 2);
                this.ctx.fillStyle = `rgba(0,0,0,${0.15 * shadowProgress})`;
                this.ctx.beginPath();
                this.ctx.ellipse(pos.x, pos.y + 5, 30 * shadowProgress, 8 * shadowProgress, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // 激光标定（3秒后开始）- 真实军事激光指示器效果
                if (droneProgress > 0.33) {
                    const laserProgress = (droneProgress - 0.33) / 0.67;
                    const laserAlpha = laserProgress * 0.7;

                    // 激光线（从无人机到地面，有轻微抖动）
                    const jitterX = (Math.random() - 0.5) * 2;
                    const jitterY = (Math.random() - 0.5) * 2;
                    this.ctx.strokeStyle = `rgba(255,30,30,${laserAlpha})`;
                    this.ctx.lineWidth = 1.5;
                    this.ctx.setLineDash([3, 6]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(droneX, droneY + 8);
                    this.ctx.lineTo(pos.x + jitterX, pos.y + jitterY);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);

                    // 激光点（地面，有随机抖动，不是完美圆形）
                    const pulse = Math.sin(time * 0.02) * 0.4 + 0.6;
                    const laserRadius = 6 + laserProgress * 8;
                    const dotJitter = (Math.random() - 0.5) * 3;

                    // 激光点光晕
                    const glowGradient = this.ctx.createRadialGradient(
                        pos.x + dotJitter, pos.y + dotJitter, 0,
                        pos.x + dotJitter, pos.y + dotJitter, laserRadius * 2
                    );
                    glowGradient.addColorStop(0, `rgba(255,50,50,${laserAlpha * pulse})`);
                    glowGradient.addColorStop(0.5, `rgba(255,30,30,${laserAlpha * pulse * 0.4})`);
                    glowGradient.addColorStop(1, 'rgba(255,0,0,0)');
                    this.ctx.fillStyle = glowGradient;
                    this.ctx.beginPath();
                    this.ctx.arc(pos.x + dotJitter, pos.y + dotJitter, laserRadius * 2, 0, Math.PI * 2);
                    this.ctx.fill();

                    // 激光点核心
                    this.ctx.fillStyle = `rgba(255,80,80,${laserAlpha * pulse})`;
                    this.ctx.beginPath();
                    this.ctx.arc(pos.x + dotJitter, pos.y + dotJitter, laserRadius * 0.6, 0, Math.PI * 2);
                    this.ctx.fill();

                    // 旋转标记线（4条，随时间旋转）
                    const rotation = time * 0.003;
                    const markerRadius = 50 - laserProgress * 25;
                    this.ctx.strokeStyle = `rgba(255,60,60,${laserAlpha * 0.8})`;
                    this.ctx.lineWidth = 2;
                    for (let i = 0; i < 4; i++) {
                        const angle = rotation + (i * Math.PI / 2);
                        const x1 = pos.x + Math.cos(angle) * (markerRadius - 10);
                        const y1 = pos.y + Math.sin(angle) * (markerRadius - 10);
                        const x2 = pos.x + Math.cos(angle) * markerRadius;
                        const y2 = pos.y + Math.sin(angle) * markerRadius;
                        this.ctx.beginPath();
                        this.ctx.moveTo(x1, y1);
                        this.ctx.lineTo(x2, y2);
                        this.ctx.stroke();
                    }

                    // 分段式锁定进度条（军事风格）
                    const barWidth = 80;
                    const barHeight = 4;
                    const barX = pos.x - barWidth / 2;
                    const barY = pos.y + markerRadius + 15;

                    // 进度条背景
                    this.ctx.fillStyle = `rgba(40,40,40,${laserAlpha * 0.6})`;
                    this.ctx.fillRect(barX, barY, barWidth, barHeight);

                    // 进度条分段
                    const segments = 10;
                    const filledSegments = Math.floor(laserProgress * segments);
                    for (let i = 0; i < filledSegments; i++) {
                        const segX = barX + (i / segments) * barWidth;
                        const segWidth = barWidth / segments - 1;
                        this.ctx.fillStyle = `rgba(255,60,60,${laserAlpha * 0.9})`;
                        this.ctx.fillRect(segX, barY, segWidth, barHeight);
                    }

                    // 军事风格文字信息
                    this.ctx.fillStyle = `rgba(255,80,80,${laserAlpha * 0.95})`;
                    this.ctx.font = 'bold 9px "Courier New", monospace';
                    this.ctx.textAlign = 'left';
                    this.ctx.textBaseline = 'top';

                    // 坐标信息
                    const coordX = Math.floor(pos.x / 10) * 10;
                    const coordY = Math.floor(pos.y / 10) * 10;
                    this.ctx.fillText(`TGT: ${coordX},${coordY}`, pos.x + markerRadius + 10, pos.y - 25);

                    // 距离和方位
                    const dist = Math.floor(80 + Math.random() * 5);
                    const bearing = Math.floor((rotation * 180 / Math.PI) % 360);
                    this.ctx.fillText(`RNG: ${dist}m`, pos.x + markerRadius + 10, pos.y - 13);
                    this.ctx.fillText(`BRG: ${bearing}°`, pos.x + markerRadius + 10, pos.y - 1);

                    // 锁定状态（闪烁）
                    if (laserProgress > 0.8) {
                        const lockFlash = Math.sin(time * 0.015) > 0;
                        if (lockFlash) {
                            this.ctx.fillStyle = `rgba(255,100,100,${laserAlpha})`;
                            this.ctx.font = 'bold 11px "Courier New", monospace';
                            this.ctx.textAlign = 'center';
                            this.ctx.fillText('LOCKED', pos.x, pos.y - markerRadius - 15);
                        }
                    }
                }

                // 警告文字（闪烁）
                if (droneProgress > 0.5) {
                    const warnPulse = Math.sin(time * 0.008) > 0 ? 1 : 0.3;
                    this.ctx.fillStyle = `rgba(255,82,82,${warnPulse * 0.8})`;
                    this.ctx.font = 'bold 14px "Courier New", monospace';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText('⚠ MISSILE INCOMING ⚠', pos.x, pos.y - 80);
                }
            }

            // ========== 阶段2：炸弹下落（9-10秒）==========
            else if (strike.phase === 'bomb') {
                const bombElapsed = elapsed - strike.droneFlyDuration;
                const bombProgress = bombElapsed / strike.bombFallDuration;
                const bombScale = 0.4 + bombProgress * 0.6;

                // 炸弹从上方快速下落
                const bombStartY = pos.y - 500;
                const bombEndY = pos.y;
                const bombY = bombStartY + (bombEndY - bombStartY) * bombProgress;
                const bombSize = 14 * bombScale;

                // 运动模糊效果（拖尾）
                for (let i = 0; i < 5; i++) {
                    const trailY = bombY - i * 20;
                    const trailAlpha = (1 - i / 5) * 0.3 * (1 - bombProgress);
                    this.ctx.fillStyle = `rgba(80,80,80,${trailAlpha})`;
                    this.ctx.beginPath();
                    this.ctx.ellipse(pos.x, trailY, bombSize * 0.8, bombSize * 1.2, 0, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                // 炸弹阴影（地面，快速放大）
                const shadowAlpha = 0.3 + bombProgress * 0.4;
                const shadowSize = 25 + bombProgress * 50;
                this.ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
                this.ctx.beginPath();
                this.ctx.ellipse(pos.x, pos.y + 5, shadowSize, shadowSize * 0.3, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // 炸弹本体
                this.ctx.fillStyle = `rgba(50,50,50,${0.9})`;
                this.ctx.beginPath();
                this.ctx.ellipse(pos.x, bombY, bombSize, bombSize * 1.8, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // 炸弹高光
                this.ctx.fillStyle = `rgba(150,150,150,${0.5 * bombScale})`;
                this.ctx.beginPath();
                this.ctx.ellipse(pos.x - bombSize * 0.3, bombY - bombSize * 0.6, bombSize * 0.3, bombSize * 0.5, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // 尾翼
                this.ctx.strokeStyle = `rgba(70,70,70,${0.7})`;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x - bombSize, bombY + bombSize);
                this.ctx.lineTo(pos.x - bombSize * 1.5, bombY + bombSize * 2);
                this.ctx.moveTo(pos.x + bombSize, bombY + bombSize);
                this.ctx.lineTo(pos.x + bombSize * 1.5, bombY + bombSize * 2);
                this.ctx.stroke();

                // 目标标记（快速脉冲）
                const warnPulse = Math.sin(time * 0.02) * 0.4 + 0.6;
                this.ctx.strokeStyle = `rgba(255,50,50,${warnPulse})`;
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([8, 4]);
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }

            // ========== 阶段3：爆炸（10秒后，持续4秒）==========
            else if (strike.phase === 'exploded') {
                const explosionProgress = 1 - (strike.fadeOutTimer / 240);  // 4秒总时长

                // 地面裂纹效果（前1秒）
                if (explosionProgress < 0.25) {
                    const crackProgress = explosionProgress / 0.25;
                    const crackAlpha = 0.8 * (1 - crackProgress);
                    this.ctx.strokeStyle = `rgba(255,100,0,${crackAlpha})`;
                    this.ctx.lineWidth = 3;

                    // 放射状裂纹
                    for (let i = 0; i < 12; i++) {
                        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.2;
                        const crackLength = strike.bombRadius * 0.4 * crackProgress;
                        const startX = pos.x + Math.cos(angle) * 20;
                        const startY = pos.y + Math.sin(angle) * 20;
                        const endX = pos.x + Math.cos(angle) * crackLength;
                        const endY = pos.y + Math.sin(angle) * crackLength;

                        this.ctx.beginPath();
                        this.ctx.moveTo(startX, startY);
                        // 锯齿状裂纹
                        const segments = 5;
                        for (let j = 1; j <= segments; j++) {
                            const t = j / segments;
                            const jitter = (Math.random() - 0.5) * 15;
                            const midX = startX + (endX - startX) * t + jitter;
                            const midY = startY + (endY - startY) * t + jitter;
                            this.ctx.lineTo(midX, midY);
                        }
                        this.ctx.stroke();
                    }
                }

                // 多层冲击波（扩展到800像素）
                for (let i = 0; i < 5; i++) {
                    const waveDelay = i * 0.08;
                    const waveProgress = Math.max(0, explosionProgress - waveDelay);
                    if (waveProgress <= 0) continue;

                    const waveRadius = strike.bombRadius * waveProgress;
                    const waveAlpha = 0.6 * (1 - waveProgress) * (1 - i * 0.15);

                    // 冲击波环（带发光效果）
                    const waveGradient = this.ctx.createRadialGradient(
                        pos.x, pos.y, waveRadius * 0.9,
                        pos.x, pos.y, waveRadius
                    );
                    waveGradient.addColorStop(0, `rgba(255,${200 - i * 20},${80 - i * 10},0)`);
                    waveGradient.addColorStop(0.5, `rgba(255,${180 - i * 25},${60 - i * 15},${waveAlpha})`);
                    waveGradient.addColorStop(1, `rgba(255,${150 - i * 30},${40 - i * 20},0)`);

                    this.ctx.strokeStyle = waveGradient;
                    this.ctx.lineWidth = 8 - i;
                    this.ctx.beginPath();
                    this.ctx.arc(pos.x, pos.y, waveRadius, 0, Math.PI * 2);
                    this.ctx.stroke();
                }

                // 中心火球（更大更持久）
                const fireRadius = strike.bombRadius * 0.6 * Math.min(1, explosionProgress * 1.5);
                const fireAlpha = explosionProgress < 0.3 ? 0.9 : 0.9 * (1 - (explosionProgress - 0.3) / 0.7);

                // 多层火球渐变
                const gradient = this.ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, fireRadius);
                gradient.addColorStop(0, `rgba(255,255,240,${fireAlpha})`);
                gradient.addColorStop(0.2, `rgba(255,220,100,${fireAlpha * 0.95})`);
                gradient.addColorStop(0.4, `rgba(255,160,50,${fireAlpha * 0.8})`);
                gradient.addColorStop(0.6, `rgba(255,100,30,${fireAlpha * 0.6})`);
                gradient.addColorStop(0.8, `rgba(200,50,10,${fireAlpha * 0.3})`);
                gradient.addColorStop(1, `rgba(150,30,5,0)`);
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, fireRadius, 0, Math.PI * 2);
                this.ctx.fill();

                // 火球内部闪烁（模拟爆炸不稳定）
                if (explosionProgress < 0.5) {
                    const flickerIntensity = Math.sin(time * 0.03) * 0.3 + 0.7;
                    const flickerRadius = fireRadius * 0.4 * flickerIntensity;
                    const flickerGradient = this.ctx.createRadialGradient(
                        pos.x, pos.y, 0,
                        pos.x, pos.y, flickerRadius
                    );
                    flickerGradient.addColorStop(0, `rgba(255,255,255,${fireAlpha * 0.8})`);
                    flickerGradient.addColorStop(1, `rgba(255,200,100,0)`);
                    this.ctx.fillStyle = flickerGradient;
                    this.ctx.beginPath();
                    this.ctx.arc(pos.x, pos.y, flickerRadius, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                // 蘑菇云效果（更大更壮观，持续2秒）
                if (explosionProgress < 0.5) {
                    const cloudProgress = explosionProgress / 0.5;
                    const cloudY = pos.y - 250 * cloudProgress;
                    const cloudRadius = 80 + cloudProgress * 120;
                    const cloudAlpha = 0.5 * (1 - cloudProgress * 0.7);

                    // 烟柱（更粗）
                    const pillarWidth = 40 + cloudProgress * 30;
                    this.ctx.fillStyle = `rgba(60,60,60,${cloudAlpha * 0.7})`;
                    this.ctx.fillRect(pos.x - pillarWidth / 2, pos.y - 180 * cloudProgress, pillarWidth, 180 * cloudProgress);

                    // 烟柱内部火光
                    if (cloudProgress < 0.6) {
                        const innerGlow = this.ctx.createRadialGradient(
                            pos.x, pos.y - 90 * cloudProgress, 0,
                            pos.x, pos.y - 90 * cloudProgress, pillarWidth
                        );
                        innerGlow.addColorStop(0, `rgba(255,150,50,${cloudAlpha * 0.4})`);
                        innerGlow.addColorStop(1, `rgba(255,100,30,0)`);
                        this.ctx.fillStyle = innerGlow;
                        this.ctx.fillRect(pos.x - pillarWidth, pos.y - 180 * cloudProgress, pillarWidth * 2, 180 * cloudProgress);
                    }

                    // 蘑菇头（更大，多层）
                    for (let i = 0; i < 3; i++) {
                        const layerOffset = i * 15;
                        const layerRadius = cloudRadius - layerOffset;
                        const layerAlpha = cloudAlpha * (1 - i * 0.2);

                        this.ctx.fillStyle = `rgba(${80 + i * 10},${80 + i * 10},${80 + i * 10},${layerAlpha})`;
                        this.ctx.beginPath();
                        this.ctx.arc(pos.x, cloudY + layerOffset, layerRadius, 0, Math.PI * 2);
                        this.ctx.fill();
                    }

                    // 蘑菇头边缘火光
                    const edgeGlow = this.ctx.createRadialGradient(
                        pos.x, cloudY, cloudRadius * 0.8,
                        pos.x, cloudY, cloudRadius
                    );
                    edgeGlow.addColorStop(0, `rgba(255,120,40,0)`);
                    edgeGlow.addColorStop(0.7, `rgba(255,100,30,${cloudAlpha * 0.3})`);
                    edgeGlow.addColorStop(1, `rgba(255,80,20,0)`);
                    this.ctx.fillStyle = edgeGlow;
                    this.ctx.beginPath();
                    this.ctx.arc(pos.x, cloudY, cloudRadius, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                // 碎片飞溅效果（前1.5秒）
                if (explosionProgress < 0.375) {
                    const debrisProgress = explosionProgress / 0.375;
                    const debrisAlpha = 0.8 * (1 - debrisProgress);

                    for (let i = 0; i < 20; i++) {
                        const angle = (i / 20) * Math.PI * 2 + time * 0.001;
                        const distance = strike.bombRadius * 0.5 * debrisProgress;
                        const debrisX = pos.x + Math.cos(angle) * distance;
                        const debrisY = pos.y + Math.sin(angle) * distance - debrisProgress * 100;
                        const debrisSize = 4 + Math.random() * 4;

                        this.ctx.fillStyle = `rgba(${100 + Math.random() * 50},${50 + Math.random() * 30},${20 + Math.random() * 20},${debrisAlpha})`;
                        this.ctx.beginPath();
                        this.ctx.arc(debrisX, debrisY, debrisSize, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                }
            }
        }
        // 渲染疣猪支援（A-10攻击机机炮扫射）
        for (const strafe of SupportSystem.a10Strafes) {
            const elapsed = strafe.totalDuration - strafe.timer;

            // 计算扫射区域的屏幕坐标
            const startPos = this.toScreen(strafe.startX, strafe.startY);
            const endPos = this.toScreen(strafe.endX, strafe.endY);
            const centerPos = this.toScreen(strafe.x, strafe.y);

            // ========== 阶段1：飞机飞入（0-8秒）==========
            if (strafe.phase === 'flyIn') {
                const flyProgress = elapsed / strafe.flyInDuration;

                // 飞机从屏幕外飞入
                const planeStartX = startPos.x - (endPos.x - startPos.x) * 0.5;
                const planeStartY = startPos.y - (endPos.y - startPos.y) * 0.5 - 300;
                const planeEndX = startPos.x;
                const planeEndY = startPos.y;

                const planeX = planeStartX + (planeEndX - planeStartX) * flyProgress;
                const planeY = planeStartY + (planeEndY - planeStartY) * flyProgress;

                // A-10 剪影（简化图形，沿扫射方向）
                const planeAlpha = Math.min(0.8, flyProgress * 2);
                this.ctx.save();
                this.ctx.translate(planeX, planeY);
                this.ctx.rotate(strafe.angle);

                // 机身
                this.ctx.fillStyle = `rgba(60,60,60,${planeAlpha})`;
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 35, 10, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // 机翼（A-10 特征性的直翼）
                this.ctx.fillRect(-40, -3, 80, 6);

                // 双引擎
                this.ctx.fillStyle = `rgba(50,50,50,${planeAlpha})`;
                this.ctx.beginPath();
                this.ctx.ellipse(-15, -12, 8, 5, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.ellipse(-15, 12, 8, 5, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // 尾翼
                this.ctx.fillRect(-30, -8, 12, 4);

                this.ctx.restore();

                // 飞机阴影（地面）
                const shadowAlpha = 0.15 * flyProgress;
                this.ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
                this.ctx.beginPath();
                this.ctx.ellipse(centerPos.x, centerPos.y + 5, 40, 12, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // 扫射区域预览（3秒后开始显示）
                if (flyProgress > 0.375) {
                    const previewAlpha = (flyProgress - 0.375) / 0.625 * 0.4;

                    // 长方形扫射区域
                    this.ctx.save();
                    this.ctx.translate(centerPos.x, centerPos.y);
                    this.ctx.rotate(strafe.angle);

                    // 区域边框（闪烁）
                    const borderPulse = Math.sin(time * 0.01) * 0.3 + 0.7;
                    this.ctx.strokeStyle = `rgba(255,100,50,${previewAlpha * borderPulse})`;
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([8, 4]);
                    this.ctx.strokeRect(-strafe.strafeLength / 2, -strafe.strafeWidth / 2,
                        strafe.strafeLength, strafe.strafeWidth);
                    this.ctx.setLineDash([]);

                    // 区域填充
                    this.ctx.fillStyle = `rgba(255,80,30,${previewAlpha * 0.15})`;
                    this.ctx.fillRect(-strafe.strafeLength / 2, -strafe.strafeWidth / 2,
                        strafe.strafeLength, strafe.strafeWidth);

                    // 中心线
                    this.ctx.strokeStyle = `rgba(255,120,60,${previewAlpha * 0.6})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(-strafe.strafeLength / 2, 0);
                    this.ctx.lineTo(strafe.strafeLength / 2, 0);
                    this.ctx.stroke();

                    this.ctx.restore();

                    // 警告文字（闪烁）
                    if (flyProgress > 0.6) {
                        const warnPulse = Math.sin(time * 0.012) > 0 ? 1 : 0.3;
                        this.ctx.fillStyle = `rgba(255,120,50,${warnPulse * 0.9})`;
                        this.ctx.font = 'bold 14px "Courier New", monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText('⚠ STRAFE INCOMING ⚠', centerPos.x, centerPos.y - 80);
                    }
                }
            }

            // ========== 阶段2：扫射（8-11秒）==========
            else if (strafe.phase === 'strafing') {
                const strafeElapsed = elapsed - strafe.flyInDuration;
                const strafeProgress = strafeElapsed / strafe.strafeDuration;

                // 飞机沿扫射方向移动
                const planeX = startPos.x + (endPos.x - startPos.x) * strafeProgress;
                const planeY = startPos.y + (endPos.y - startPos.y) * strafeProgress;

                // A-10 剪影
                this.ctx.save();
                this.ctx.translate(planeX, planeY);
                this.ctx.rotate(strafe.angle);

                // 机身
                this.ctx.fillStyle = 'rgba(60,60,60,0.9)';
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 35, 10, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // 机翼
                this.ctx.fillRect(-40, -3, 80, 6);

                // 双引擎
                this.ctx.fillStyle = 'rgba(50,50,50,0.9)';
                this.ctx.beginPath();
                this.ctx.ellipse(-15, -12, 8, 5, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.ellipse(-15, 12, 8, 5, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // 尾翼
                this.ctx.fillRect(-30, -8, 12, 4);

                // 机炮闪光效果
                const muzzleFlash = Math.random() > 0.3;
                if (muzzleFlash) {
                    this.ctx.fillStyle = 'rgba(255,200,50,0.8)';
                    this.ctx.beginPath();
                    this.ctx.ellipse(35, 0, 8, 4, 0, 0, Math.PI * 2);
                    this.ctx.fill();

                    // 枪口火焰
                    this.ctx.fillStyle = 'rgba(255,150,30,0.6)';
                    this.ctx.beginPath();
                    this.ctx.ellipse(40, 0, 12, 6, 0, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                this.ctx.restore();

                // 扫射区域高亮
                this.ctx.save();
                this.ctx.translate(centerPos.x, centerPos.y);
                this.ctx.rotate(strafe.angle);

                // 已扫射过的区域（逐渐变暗）
                const sweptLength = strafe.strafeLength * strafeProgress;
                this.ctx.fillStyle = 'rgba(255,80,30,0.1)';
                this.ctx.fillRect(-strafe.strafeLength / 2, -strafe.strafeWidth / 2,
                    sweptLength, strafe.strafeWidth);

                // 扫射前沿（明亮）
                const frontX = -strafe.strafeLength / 2 + sweptLength;
                this.ctx.strokeStyle = 'rgba(255,150,50,0.6)';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(frontX, -strafe.strafeWidth / 2);
                this.ctx.lineTo(frontX, strafe.strafeWidth / 2);
                this.ctx.stroke();

                this.ctx.restore();

                // 烟尘效果（沿扫射路径）
                if (Math.random() > 0.7) {
                    const dustX = startPos.x + (endPos.x - startPos.x) * (strafeProgress - 0.1);
                    const dustY = startPos.y + (endPos.y - startPos.y) * (strafeProgress - 0.1);

                    EffectsManager.particles.push({
                        x: dustX + (Math.random() - 0.5) * strafe.strafeWidth,
                        y: dustY + (Math.random() - 0.5) * strafe.strafeWidth,
                        vx: (Math.random() - 0.5) * 2,
                        vy: -1 - Math.random() * 2,
                        life: 40 + Math.random() * 20,
                        maxLife: 60,
                        color: '#666',
                        size: 10 + Math.random() * 10,
                        type: 'smoke'
                    });
                }
            }

            // ========== 阶段3：淡出（11-13秒）==========
            else if (strafe.phase === 'fadeOut') {
                const fadeProgress = 1 - (strafe.fadeOutTimer / 180);

                // 飞机飞离
                const planeX = endPos.x + (endPos.x - startPos.x) * fadeProgress * 0.5;
                const planeY = endPos.y + (endPos.y - startPos.y) * fadeProgress * 0.5 - fadeProgress * 200;

                // A-10 剪影（逐渐变小）
                const planeAlpha = 0.9 * (1 - fadeProgress);
                this.ctx.save();
                this.ctx.translate(planeX, planeY);
                this.ctx.rotate(strafe.angle);
                this.ctx.scale(1 - fadeProgress * 0.3, 1 - fadeProgress * 0.3);

                this.ctx.fillStyle = `rgba(60,60,60,${planeAlpha})`;
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 35, 10, 0, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.fillRect(-40, -3, 80, 6);

                this.ctx.fillStyle = `rgba(50,50,50,${planeAlpha})`;
                this.ctx.beginPath();
                this.ctx.ellipse(-15, -12, 8, 5, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.ellipse(-15, 12, 8, 5, 0, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.fillRect(-30, -8, 12, 4);

                this.ctx.restore();

                // 扫射区域残留烟尘
                this.ctx.save();
                this.ctx.translate(centerPos.x, centerPos.y);
                this.ctx.rotate(strafe.angle);

                const residualAlpha = 0.15 * (1 - fadeProgress);
                this.ctx.fillStyle = `rgba(255,80,30,${residualAlpha})`;
                this.ctx.fillRect(-strafe.strafeLength / 2, -strafe.strafeWidth / 2,
                    strafe.strafeLength, strafe.strafeWidth);

                this.ctx.restore();
            }
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
            if (t.alive && !t.mountedVehicle) this._drawAtWorldPos(t, false);
        }
        if (player && player.alive && !player.mountedVehicle) {
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

        const menuOpen = GameState.inventoryOpen || GameState.arsenalOpen || GameState.radioOpen || GameState.debugOpen;
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
                // 昼夜渲染层
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                this.ctx.fillRect(0, 0, this.width, this.height);
                this._updateShaderLighting();
            } else {
                this._drawOverlay();
            }
            this._updateShaderLighting();
            drawGameOver(this.ctx, this);
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

        // 电台：渲染世界 + UI叠加（透明背景）
        if (GameState.radioOpen) {
            this._renderWorld();
            this._renderEntities();
            WeatherSystem.drawCloudShadows(this.ctx, GameState.camera);
            WeatherSystem.drawParticles(this.ctx);
            WeatherSystem.drawOverlay(this.ctx, this);
            WeatherSystem.drawWeatherEdgeEffects(this.ctx, this);
            drawRadioUI(this.ctx, this);
            this._updateShaderLighting();
            this._renderDayNightOverlay();
            PostProcess.apply(this._offscreenCanvas, this);
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
        this._renderHUD();

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

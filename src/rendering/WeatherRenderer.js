// src/rendering/WeatherRenderer.js
// 天气渲染逻辑：云影、粒子、叠加、闪电
import { GameState } from '../core/GameState.js';
import { WEATHER_DEFS, lerp } from '../core/WeatherDefs.js';
import { TornadoSystem } from '../core/TornadoSystem.js';

export const WeatherRenderer = {
    // ─── 渲染：云团阴影（多层叠加，更自然蓬松） ───
    drawCloudShadows(weatherSystem, ctx, camera) {
        const prevDef = WEATHER_DEFS[weatherSystem.previous];
        const currDef = WEATHER_DEFS[weatherSystem.current];
        const t = weatherSystem.transitionProgress;
        const alpha = weatherSystem.transitioning ? lerp(prevDef.cloudAlpha, currDef.cloudAlpha, t) : currDef.cloudAlpha;
        
        if (alpha <= 0.001) return;
        
        const zoom = camera.zoom || 1;
        const offsetX = camera.offsetX || 0;
        const offsetY = camera.offsetY || 0;
        const camX = camera.x;
        const camY = camera.y;
        const logicalW = ctx.canvas.clientWidth || ctx.canvas.width;
        const logicalH = ctx.canvas.clientHeight || ctx.canvas.height;
        const cx = logicalW / 2;
        const cy = logicalH / 2;
        
        ctx.save();
        
        for (const cloud of weatherSystem.clouds) {
            const worldX = cloud.x;
            const worldY = cloud.y;
            const screenX = (worldX - camX) * zoom + cx * (1 - zoom) - offsetX;
            const screenY = (worldY - camY) * zoom + cy * (1 - zoom) - offsetY;
            const sw = cloud.w * zoom;
            const sh = cloud.h * zoom;
            
            if (screenX + sw < -100 || screenX > logicalW + 100 ||
                screenY + sh < -100 || screenY > logicalH + 100) continue;
            
            const baseAlpha = alpha * (cloud.alpha / 0.15) * 2.2;
            const centerX = screenX + sw / 2;
            const centerY = screenY + sh / 2;
            
            // 多层叠加：不用椭圆裁剪，用 fillRect + 径向渐变自然淡出
            const layers = [
                { dx: 0, dy: 0, rx: sw * 0.5, ry: sh * 0.5, a: baseAlpha * 0.85 },
                { dx: sw * 0.2, dy: -sh * 0.15, rx: sw * 0.38, ry: sh * 0.38, a: baseAlpha * 0.6 },
                { dx: -sw * 0.18, dy: sh * 0.12, rx: sw * 0.4, ry: sh * 0.35, a: baseAlpha * 0.55 },
                { dx: sw * 0.12, dy: sh * 0.18, rx: sw * 0.32, ry: sh * 0.4, a: baseAlpha * 0.5 },
                { dx: -sw * 0.22, dy: -sh * 0.1, rx: sw * 0.3, ry: sh * 0.32, a: baseAlpha * 0.45 },
                { dx: sw * 0.08, dy: -sh * 0.2, rx: sw * 0.28, ry: sh * 0.3, a: baseAlpha * 0.4 },
                { dx: -sw * 0.1, dy: sh * 0.22, rx: sw * 0.25, ry: sh * 0.28, a: baseAlpha * 0.35 },
            ];
            
            for (const layer of layers) {
                const lx = centerX + layer.dx;
                const ly = centerY + layer.dy;
                const gradientR = Math.max(layer.rx, layer.ry);
                
                const gradient = ctx.createRadialGradient(lx, ly, 0, lx, ly, gradientR);
                gradient.addColorStop(0, `rgba(0,0,0,${layer.a})`);
                gradient.addColorStop(0.2, `rgba(0,0,0,${layer.a * 0.85})`);
                gradient.addColorStop(0.4, `rgba(0,0,0,${layer.a * 0.6})`);
                gradient.addColorStop(0.6, `rgba(0,0,0,${layer.a * 0.3})`);
                gradient.addColorStop(0.8, `rgba(0,0,0,${layer.a * 0.1})`);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                
                ctx.fillStyle = gradient;
                // 用 fillRect 填充渐变范围，不用椭圆裁剪
                ctx.fillRect(lx - gradientR, ly - gradientR, gradientR * 2, gradientR * 2);
            }
        }
        
        ctx.restore();
    },
    
    // ─── 渲染：天气粒子 ───
    drawParticles(weatherSystem, ctx) {
        const cam = GameState.camera;
        const zoom = cam.zoom || 1;
        const offsetX = cam.offsetX || 0;
        const offsetY = cam.offsetY || 0;
        const logicalW = ctx.canvas.clientWidth || ctx.canvas.width;
        const logicalH = ctx.canvas.clientHeight || ctx.canvas.height;
        const cx = logicalW / 2;
        const cy = logicalH / 2;
        
        const toScreen = (wx, wy) => ({
            x: (wx - cam.x) * zoom + cx * (1 - zoom) - offsetX,
            y: (wy - cam.y) * zoom + cy * (1 - zoom) - offsetY
        });
        
        ctx.save();
        
        // 绘制天气粒子（世界坐标）
        for (const p of weatherSystem.particles) {
            const pos = toScreen(p.x, p.y);
            const alpha = Math.min(1, p.life / (p.maxLife || 20));
            ctx.globalAlpha = alpha;
            
            switch (p.type) {
                case 'rain':
                case 'acid': {
                    // 雨滴：细长垂直线条，风只造成轻微偏移
                    const rainLen = 8 + p.vy * 1.5;
                    const windTilt = p.vx * 0.8;
                    const color = p.isAcid
                        ? `rgba(80,255,80,${alpha * 0.8})`
                        : `rgba(180,210,255,${alpha * 0.65})`;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = Math.max(0.8, p.size * zoom * 0.5);
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y);
                    ctx.lineTo(pos.x + windTilt, pos.y + rainLen);
                    ctx.stroke();
                    break;
                }
                case 'tornadoRain': {
                    // 龙卷风降雨：与普通过程类似，但更密集更亮
                    const rainLen = 10 + p.vy * 1.8;
                    const windTilt = p.vx * 0.6;
                    ctx.strokeStyle = `rgba(170,190,215,${alpha * 0.75})`;
                    ctx.lineWidth = Math.max(1.0, p.size * zoom * 0.6);
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y);
                    ctx.lineTo(pos.x + windTilt, pos.y + rainLen);
                    ctx.stroke();
                    break;
                }
                case 'snow': {
                    // 六角雪花形状，更高透明度
                    const size = p.size * zoom * 1.2;
                    const snowAlpha = alpha * 0.75;
                    
                    ctx.save();
                    ctx.translate(pos.x, pos.y);
                    ctx.rotate(p.phase || 0);
                    
                    // 绘制六角雪花
                    ctx.strokeStyle = `rgba(255,255,255,${snowAlpha})`;
                    ctx.lineWidth = Math.max(0.8, size * 0.15);
                    ctx.lineCap = 'round';
                    
                    // 6条主臂
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
                        ctx.stroke();
                        
                        // 每条臂上的小分支
                        if (size > 3) {
                            const branchLen = size * 0.3;
                            const branchPos = size * 0.6;
                            const bx = Math.cos(angle) * branchPos;
                            const by = Math.sin(angle) * branchPos;
                            
                            ctx.beginPath();
                            ctx.moveTo(bx, by);
                            ctx.lineTo(
                                bx + Math.cos(angle + Math.PI/3) * branchLen,
                                by + Math.sin(angle + Math.PI/3) * branchLen
                            );
                            ctx.stroke();
                            
                            ctx.beginPath();
                            ctx.moveTo(bx, by);
                            ctx.lineTo(
                                bx + Math.cos(angle - Math.PI/3) * branchLen,
                                by + Math.sin(angle - Math.PI/3) * branchLen
                            );
                            ctx.stroke();
                        }
                    }
                    
                    ctx.restore();
                    break;
                }
                case 'wind':
                    // 暴风：沿风向的流线
                    const windAngle = Math.atan2(p.vy, p.vx);
                    const lineLen = p.length * zoom;
                    const endX = pos.x + Math.cos(windAngle) * lineLen;
                    const endY = pos.y + Math.sin(windAngle) * lineLen;
                    
                    // 渐变透明度：从尾到头
                    const gradient = ctx.createLinearGradient(pos.x, pos.y, endX, endY);
                    const baseAlpha = (p.alpha || 0.15) * alpha;
                    gradient.addColorStop(0, `rgba(200,210,220,0)`);
                    gradient.addColorStop(0.3, `rgba(200,210,220,${baseAlpha * 0.5})`);
                    gradient.addColorStop(1, `rgba(220,230,240,${baseAlpha})`);
                    
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = (p.thickness || 1.0) * zoom;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                    break;
                case 'sand':
                    // 增强沙粒：更大更密集
                    const sandSize = p.size * zoom * 1.8;
                    ctx.fillStyle = `rgba(200,170,100,${alpha * 0.85})`;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, sandSize, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'hail':
                    // 冰雹：小颗粒，带轻微高光
                    const hailSize = p.size * zoom * 0.6;
                    ctx.fillStyle = `rgba(230,240,255,${alpha * 0.85})`;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, hailSize, 0, Math.PI * 2);
                    ctx.fill();
                    // 小高光
                    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
                    ctx.beginPath();
                    ctx.arc(pos.x - hailSize * 0.2, pos.y - hailSize * 0.2, hailSize * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'splash':
                    ctx.fillStyle = p.color || `rgba(150,180,220,${alpha * 0.6})`;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, p.size * zoom, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'steam': {
                    // 酸雨蒸汽：绿色半透明烟雾，向上飘散
                    const steamSize = p.size * zoom * (1 + (1 - alpha) * 0.5);
                    const steamAlpha = alpha * 0.4;
                    ctx.fillStyle = `rgba(100,255,100,${steamAlpha})`;
                    ctx.shadowColor = 'rgba(80,255,80,0.3)';
                    ctx.shadowBlur = steamSize;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, steamSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    break;
                }
                case 'hailSplash':
                    // 冰雹碎片：白色小点
                    ctx.fillStyle = `rgba(240,250,255,${alpha * 0.9})`;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, p.size * zoom, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'hailImpact':
                    // 冰雹冲击波：扩散的圆环
                    const impactRadius = p.size * zoom * (1 + (1 - alpha) * 2);
                    ctx.strokeStyle = `rgba(200,220,255,${alpha * 0.5})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, impactRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case 'ember': {
                    // 血月浮尘：红色发光粒子
                    const emberSize = p.size * zoom * 1.2;
                    ctx.fillStyle = `rgba(255,${80 + Math.floor(alpha * 80)},30,${alpha * 0.8})`;
                    ctx.shadowColor = 'rgba(255,100,30,0.7)';
                    ctx.shadowBlur = emberSize * 3;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, emberSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    break;
                }
                case 'debris':
                    // 增强碎片：更大更明显
                    const debrisSize = p.size * zoom * 1.6;
                    ctx.fillStyle = `rgba(120,100,80,${alpha * 0.9})`;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, debrisSize, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'dustCloud': {
                    // 龙卷风底部尘土云：半透明棕色烟雾
                    const dustSize = p.size * zoom * (1 + (1 - alpha) * 0.8);
                    const dustAlpha = alpha * 0.35;
                    ctx.fillStyle = `rgba(140,120,90,${dustAlpha})`;
                    ctx.shadowColor = 'rgba(120,100,70,0.2)';
                    ctx.shadowBlur = dustSize * 0.5;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, dustSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    break;
                }
            }
        }
        
        // 龙卷风渲染（委托给 TornadoSystem）
        if (weatherSystem.current === 'tornado' && TornadoSystem.center) {
            TornadoSystem.draw(ctx, toScreen, weatherSystem);
        }
        
        ctx.restore();
    },

    // ─── 渲染：全屏叠加 + 雾 ───
    drawOverlay(weatherSystem, ctx, renderer) {
        const prevDef = WEATHER_DEFS[weatherSystem.previous];
        const currDef = WEATHER_DEFS[weatherSystem.current];
        const t = weatherSystem.transitionProgress;
        const w = renderer.width;
        const h = renderer.height;
        
        // 增强颜色叠加
        const overlayAlpha = weatherSystem.transitioning ? lerp(prevDef.overlayAlpha, currDef.overlayAlpha, t) : currDef.overlayAlpha;
        if (overlayAlpha > 0.001) {
            const overlayColor = currDef.overlayColor;
            ctx.fillStyle = `rgba(${overlayColor},${overlayAlpha * 1.5})`;
            ctx.fillRect(0, 0, w, h);
        }
        
        // 增强雾效果（消散时同步淡出，避免突兀消失）
        const fogRadius = weatherSystem.getFogRadius();
        if (fogRadius > 5 && GameState.player && GameState.player.alive) {
            const player = GameState.player;
            const zoom = GameState.camera.zoom || 1;
            const offsetX = GameState.camera.offsetX || 0;
            const offsetY = GameState.camera.offsetY || 0;
            const cxScreen = w / 2;
            const cyScreen = h / 2;
            const px = (player.x - GameState.camera.x) * zoom + cxScreen * (1 - zoom) - offsetX;
            const py = (player.y - GameState.camera.y) * zoom + cyScreen * (1 - zoom) - offsetY;
            
            const innerR = fogRadius * zoom * 0.3;
            const outerR = fogRadius * zoom * 1.8;
            
            // 消散系数：fogRadius 越小，雾越淡（平滑淡出而非突然消失）
            const fadeFactor = Math.min(1, fogRadius / 250);
            
            const gradient = ctx.createRadialGradient(px, py, innerR, px, py, outerR);
            gradient.addColorStop(0, 'rgba(200,200,200,0)');
            gradient.addColorStop(0.3, `rgba(185,185,185,${0.06 * fadeFactor})`);
            gradient.addColorStop(0.5, `rgba(180,180,180,${0.1 * fadeFactor})`);
            gradient.addColorStop(0.7, `rgba(160,160,160,${0.3 * fadeFactor})`);
            gradient.addColorStop(0.85, `rgba(150,150,150,${0.45 * fadeFactor})`);
            gradient.addColorStop(1, `rgba(140,140,140,${0.6 * fadeFactor})`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
            
            // 消散阶段：在雾边缘生成飘散的薄雾残缕（视觉过渡更自然）
            if (fadeFactor < 0.8 && fadeFactor > 0.02) {
                const wispCount = Math.floor(12 * (1 - fadeFactor));
                const time = weatherSystem.frameCount * 0.008;
                ctx.save();
                for (let i = 0; i < wispCount; i++) {
                    const angle = (i / wispCount) * Math.PI * 2 + time + Math.sin(time * 0.7 + i) * 0.3;
                    const dist = outerR * (0.6 + Math.sin(time * 0.5 + i * 1.3) * 0.3);
                    const wispX = px + Math.cos(angle) * dist;
                    const wispY = py + Math.sin(angle) * dist;
                    const wispR = (20 + Math.sin(time + i * 2) * 10) * zoom;
                    const wispAlpha = 0.08 * fadeFactor * (0.5 + Math.sin(time * 1.5 + i) * 0.5);
                    
                    const wispGrad = ctx.createRadialGradient(wispX, wispY, 0, wispX, wispY, wispR);
                    wispGrad.addColorStop(0, `rgba(190,190,190,${wispAlpha})`);
                    wispGrad.addColorStop(1, 'rgba(190,190,190,0)');
                    ctx.fillStyle = wispGrad;
                    ctx.fillRect(wispX - wispR, wispY - wispR, wispR * 2, wispR * 2);
                }
                ctx.restore();
            }
        }
        
        // 天气特定晕影效果
        const isStormy = ['thunderstorm', 'heavyRain', 'blizzard', 'sandstorm', 'tornado', 'windStorm'].includes(weatherSystem.current);
        const isEerie = ['bloodMoon', 'eclipse'].includes(weatherSystem.current);
        
        if (isStormy) {
            // 暴风雨/暴风雪等：暗角晕影
            const vignetteAlpha = 0.3;
            const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(0.7, `rgba(0,0,0,${vignetteAlpha * 0.5})`);
            gradient.addColorStop(1, `rgba(0,0,0,${vignetteAlpha})`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
        }
        
        // 血月红色薄雾覆盖层
        if (weatherSystem.current === 'bloodMoon') {
            const mistAlpha = 0.08 + Math.sin(weatherSystem.frameCount * 0.01) * 0.02;
            ctx.fillStyle = `rgba(120,0,0,${mistAlpha})`;
            ctx.fillRect(0, 0, w, h);
            
            // 红色脉动光晕
            const pulseAlpha = 0.15 + Math.sin(weatherSystem.frameCount * 0.03) * 0.05;
            const pulseGrad = ctx.createRadialGradient(w/2, h/2, Math.min(w,h) * 0.2, w/2, h/2, Math.max(w,h) * 0.6);
            pulseGrad.addColorStop(0, `rgba(150,0,0,0)`);
            pulseGrad.addColorStop(0.7, `rgba(120,0,0,${pulseAlpha * 0.3})`);
            pulseGrad.addColorStop(1, `rgba(80,0,0,${pulseAlpha})`);
            ctx.fillStyle = pulseGrad;
            ctx.fillRect(0, 0, w, h);
        }
        
        if (isEerie) {
            // 血月/日食：特殊色调晕影
            const color = weatherSystem.current === 'bloodMoon' ? '80,0,0' : '0,0,0';
            const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
            gradient.addColorStop(0, `rgba(${color},0)`);
            gradient.addColorStop(0.6, `rgba(${color},0.15)`);
            gradient.addColorStop(1, `rgba(${color},0.4)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
        }
        
        // 日食效果：简洁的暗角 + 微弱日冕
        if (weatherSystem.current === 'eclipse' || (weatherSystem.transitioning && (weatherSystem.current === 'eclipse' || weatherSystem.previous === 'eclipse'))) {
            const eclipseAlpha = weatherSystem.current === 'eclipse' ? (weatherSystem.transitioning ? t : 1) : (weatherSystem.transitioning ? 1 - t : 0);
            if (eclipseAlpha > 0.01) {
                // 深色暗角
                const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
                gradient.addColorStop(0, 'rgba(0,0,0,0)');
                gradient.addColorStop(0.5, `rgba(0,0,0,${0.15 * eclipseAlpha})`);
                gradient.addColorStop(0.8, `rgba(0,0,0,${0.4 * eclipseAlpha})`);
                gradient.addColorStop(1, `rgba(0,0,0,${0.6 * eclipseAlpha})`);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, w, h);
                
                // 微弱的日冕光晕（不画射线）
                const coronaR = Math.min(w, h) * 0.12;
                const coronaGrad = ctx.createRadialGradient(w/2, h/2, coronaR * 0.5, w/2, h/2, coronaR * 1.2);
                coronaGrad.addColorStop(0, `rgba(255,250,230,${0.25 * eclipseAlpha})`);
                coronaGrad.addColorStop(0.5, `rgba(255,240,200,${0.1 * eclipseAlpha})`);
                coronaGrad.addColorStop(1, 'rgba(255,220,180,0)');
                ctx.fillStyle = coronaGrad;
                ctx.beginPath();
                ctx.arc(w/2, h/2, coronaR * 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },
    
    // ─── 渲染：冷天全屏淡蓝 + 沙尘暴全屏淡黄（低密度） ───
    drawWeatherEdgeEffects(weatherSystem, ctx, renderer) {
        const w = renderer.width;
        const h = renderer.height;
        const frame = weatherSystem.frameCount;

        // 冷天全屏淡蓝覆盖（小雪/暴风雪）
        const isCold = weatherSystem.current === 'snow' || weatherSystem.current === 'blizzard';
        if (isCold) {
            const intensity = weatherSystem.current === 'blizzard' ? 0.08 : 0.05;
            
            // 全屏淡蓝色覆盖
            ctx.fillStyle = `rgba(200,220,255,${intensity})`;
            ctx.fillRect(0, 0, w, h);
            
            // 少量冰晶闪烁（全屏随机分布）
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            for (let i = 0; i < 8; i++) {
                const seed = (i * 7919 + frame * 2) % 10000;
                const seed2 = (i * 6271 + frame * 3) % 10000;
                const cx = seed % w;
                const cy = seed2 % h;
                const twinkle = Math.sin(frame * 0.08 + i * 1.7) * 0.5 + 0.5;
                ctx.globalAlpha = twinkle * 0.4;
                ctx.beginPath();
                ctx.arc(cx, cy, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // 沙尘暴全屏淡黄覆盖
        const isSandy = weatherSystem.current === 'sandstorm';
        if (isSandy) {
            ctx.fillStyle = 'rgba(160,130,60,0.03)';
            ctx.fillRect(0, 0, w, h);

            const windAngle = weatherSystem.windAngle;
            const windStr = weatherSystem.windStrength;
            const windDx = Math.cos(windAngle) * windStr;
            const windDy = Math.sin(windAngle) * windStr;
            const driftX = -windDy * 0.55;
            const driftY = windDx * 0.55;
            const noise = Math.sin(frame * 0.03) * 0.2 + 0.8;

            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = 'rgba(205,170,120,0.22)';
            ctx.lineWidth = 1.1;
            ctx.lineCap = 'round';
            for (let i = 0; i < 28; i++) {
                const y = ((frame * 3 + i * 61) % (h + 220)) - 110;
                const x = ((i * 113 + frame * windDx * 10) % (w + 320)) - 160;
                const len = 90 + (i % 5) * 24;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + windDx * len * noise + driftX * 24, y + windDy * len * noise + driftY * 24);
                ctx.stroke();
            }
            ctx.restore();

            ctx.fillStyle = 'rgba(185,155,105,0.18)';
            for (let i = 0; i < 35; i++) {
                const seed = (i * 4999 + frame * 3) % 10000;
                const seed2 = (i * 3571 + frame * 5) % 10000;
                let cx = (seed + windDx * frame * 2.4) % w;
                let cy = (seed2 + windDy * frame * 2.4) % h;
                if (cx < 0) cx += w;
                if (cy < 0) cy += h;
                ctx.globalAlpha = 0.06 + Math.sin(frame * 0.06 + i) * 0.02;
                ctx.beginPath();
                ctx.arc(cx, cy, 0.8 + (i % 3) * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // 暴风全屏风幕效果 - 更自然的氛围层
        const isWindy = weatherSystem.current === 'windStorm';
        if (isWindy) {
            // 极淡的全屏覆盖，营造风沙感
            ctx.fillStyle = 'rgba(150,155,165,0.025)';
            ctx.fillRect(0, 0, w, h);

            const windAngle = weatherSystem.windAngle;
            const windStr = weatherSystem.windStrength;
            const windDx = Math.cos(windAngle);
            const windDy = Math.sin(windAngle);

            // 远处的风带 - 非常淡，只在背景
            ctx.save();
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.06;
            ctx.strokeStyle = 'rgba(180,190,200,0.15)';
            ctx.lineWidth = 0.8;
            
            for (let i = 0; i < 15; i++) {
                const seed = (i * 7919 + frame * 2) % 10000;
                const seed2 = (i * 3571 + frame * 3) % 10000;
                let baseX = ((seed + windDx * frame * 8) % (w + 600)) - 300;
                let baseY = ((seed2 + windDy * frame * 8) % (h + 600)) - 300;
                if (baseX < -300) baseX += w + 600;
                if (baseY < -300) baseY += h + 600;

                const len = 200 + (i % 4) * 50;
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(baseX + windDx * len, baseY + windDy * len);
                ctx.stroke();
            }
            
            // 中层风线 - 增加层次感
            ctx.globalAlpha = 0.08;
            ctx.strokeStyle = 'rgba(170,180,190,0.18)';
            ctx.lineWidth = 1.0;
            
            for (let i = 0; i < 12; i++) {
                const seed = (i * 6173 + frame * 4) % 10000;
                const seed2 = (i * 4219 + frame * 5) % 10000;
                let baseX = ((seed + windDx * frame * 12) % (w + 500)) - 250;
                let baseY = ((seed2 + windDy * frame * 12) % (h + 500)) - 250;
                if (baseX < -250) baseX += w + 500;
                if (baseY < -250) baseY += h + 500;

                const len = 150 + (i % 3) * 40;
                const wave = Math.sin(frame * 0.03 + i) * 15;
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(baseX + windDx * len + wave, baseY + windDy * len);
                ctx.stroke();
            }
            
            // 近处风线 - 更明显，速度更快
            ctx.globalAlpha = 0.1;
            ctx.strokeStyle = 'rgba(160,170,180,0.22)';
            ctx.lineWidth = 1.3;
            
            for (let i = 0; i < 8; i++) {
                const seed = (i * 5119 + frame * 7) % 10000;
                const seed2 = (i * 3877 + frame * 8) % 10000;
                let baseX = ((seed + windDx * frame * 18) % (w + 400)) - 200;
                let baseY = ((seed2 + windDy * frame * 18) % (h + 400)) - 200;
                if (baseX < -200) baseX += w + 400;
                if (baseY < -200) baseY += h + 400;

                const len = 100 + (i % 3) * 30;
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(baseX + windDx * len, baseY + windDy * len);
                ctx.stroke();
            }
            
            // 地面碎屑 - 小颗粒沿地面滚动
            ctx.fillStyle = 'rgba(120,110,100,0.15)';
            for (let i = 0; i < 20; i++) {
                const seed = (i * 4397 + frame * 6) % 10000;
                const seed2 = (i * 3119 + frame * 7) % 10000;
                let gx = ((seed + windDx * frame * 10) % (w + 200)) - 100;
                let gy = ((seed2 + windDy * frame * 10) % (h + 200)) - 100;
                if (gx < -100) gx += w + 200;
                if (gy < -100) gy += h + 200;
                
                const size = 1.5 + (i % 3) * 0.8;
                const bounce = Math.abs(Math.sin(frame * 0.08 + i * 1.3)) * 3;
                
                ctx.globalAlpha = 0.12 + Math.sin(frame * 0.05 + i) * 0.03;
                ctx.beginPath();
                ctx.arc(gx, gy - bounce, size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 阵风脉冲效果
            const gustPhase = Math.sin(frame * 0.02) * 0.5 + 0.5;
            if (gustPhase > 0.7) {
                const gustAlpha = (gustPhase - 0.7) * 0.3;
                ctx.globalAlpha = gustAlpha;
                ctx.fillStyle = 'rgba(180,190,200,0.08)';
                ctx.fillRect(0, 0, w, h);
            }
            
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    },

    // ─── 渲染：闪电（增强亮度） ───
    drawLightning(weatherSystem, ctx, renderer) {
        const flash = weatherSystem.lightningFlash;
        const distantFlash = weatherSystem.distantFlash || 0;
        
        if (flash <= 0 && distantFlash <= 0) return;
        
        const w = renderer.width;
        const h = renderer.height;
        
        // 远处闪光（较暗，延迟前的预兆）
        if (distantFlash > 0) {
            const distantIntensity = distantFlash / 10;
            ctx.fillStyle = `rgba(200,210,255,${distantIntensity * 0.3})`;
            ctx.fillRect(0, 0, w, h);
        }
        
        if (flash <= 0) return;
        
        const flashIntensity = flash / 10;
        
        // 增强闪光亮度
        ctx.fillStyle = `rgba(255,255,255,${flashIntensity * 0.6})`;
        ctx.fillRect(0, 0, w, h);
        
        const branches = weatherSystem.lightningBranches;
        if (branches && branches.length > 0 && flash > 3) {
            ctx.save();
            
            for (const segments of branches) {
                if (segments.length < 2) continue;
                
                // 外层光晕
                ctx.strokeStyle = `rgba(150,180,255,${flashIntensity * 0.5})`;
                ctx.lineWidth = 8;
                ctx.shadowColor = 'rgba(100,150,255,0.8)';
                ctx.shadowBlur = 15;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(segments[0].x, segments[0].y);
                for (let i = 1; i < segments.length; i++) {
                    ctx.lineTo(segments[i].x, segments[i].y);
                }
                ctx.stroke();
                
                // 中层
                ctx.strokeStyle = `rgba(200,220,255,${flashIntensity * 0.8})`;
                ctx.lineWidth = 4;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.moveTo(segments[0].x, segments[0].y);
                for (let i = 1; i < segments.length; i++) {
                    ctx.lineTo(segments[i].x, segments[i].y);
                }
                ctx.stroke();
                
                // 内层核心
                ctx.strokeStyle = `rgba(255,255,255,${flashIntensity * 1.0})`;
                ctx.lineWidth = 2;
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.moveTo(segments[0].x, segments[0].y);
                for (let i = 1; i < segments.length; i++) {
                    ctx.lineTo(segments[i].x, segments[i].y);
                }
                ctx.stroke();
            }
            
            ctx.restore();
        }
    }
};

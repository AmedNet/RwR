// src/rendering/SupportEffectRenderer.js
// 支援特效渲染：烟雾/火炮/空投/伞兵/载具空投/死神/A10（从 Renderer.js 拆出）
import { GameState } from '../core/GameState.js';
import { SupportSystem } from '../core/SupportSystem.js';
import { EffectsManager } from '../utils/EffectsManager.js';

export function drawSupportEffects(ctx, toScreen) {
        const time = Date.now();

        // 渲染烟雾区域
        for (const zone of SupportSystem.smokeZones) {
            const pos = toScreen(zone.x, zone.y);
            const radius = zone.radius * (GameState.camera.zoom || 1);

            // 烟雾淡入淡出
            const fadeIn = Math.min(1, (zone.maxDuration - zone.duration) / 30);
            const fadeOut = Math.min(1, zone.duration / 60);
            const alpha = Math.min(fadeIn, fadeOut) * 0.6;

            // 多层烟雾效果
            for (let i = 0; i < 3; i++) {
                const offset = Math.sin(time * 0.001 + i * 2) * radius * 0.1;
                const r = radius * (0.7 + i * 0.15);
                const gradient = ctx.createRadialGradient(
                    pos.x + offset, pos.y + offset * 0.5, 0,
                    pos.x + offset, pos.y + offset * 0.5, r
                );
                gradient.addColorStop(0, `rgba(180,180,180,${alpha * 0.4})`);
                gradient.addColorStop(0.5, `rgba(150,150,150,${alpha * 0.25})`);
                gradient.addColorStop(1, 'rgba(120,120,120,0)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(pos.x + offset, pos.y + offset * 0.5, r, 0, Math.PI * 2);
                ctx.fill();
            }

            // 烟雾边缘粒子
            const particleCount = 8;
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2 + time * 0.0005;
                const dist = radius * (0.6 + Math.sin(time * 0.002 + i) * 0.2);
                const px = pos.x + Math.cos(angle) * dist;
                const py = pos.y + Math.sin(angle) * dist;
                const pSize = 3 + Math.sin(time * 0.003 + i * 1.5) * 2;

                ctx.fillStyle = `rgba(200,200,200,${alpha * 0.3})`;
                ctx.beginPath();
                ctx.arc(px, py, pSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 渲染炮击序列标记
        for (const seq of SupportSystem.artillerySequences) {
            const pos = toScreen(seq.x, seq.y);
            const radius = seq.bombRadius * (GameState.camera.zoom || 1);

            // 炮击区域警告圈（脉冲）
            const pulse = Math.sin(time * 0.008) * 0.3 + 0.7;
            const isPlayerFaction = seq.faction === 'player';
            const color = isPlayerFaction ? '100,181,246' : '255,82,82';

            // 外圈警告
            ctx.strokeStyle = `rgba(${color},${0.4 * pulse})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // 内圈填充
            const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
            gradient.addColorStop(0, `rgba(${color},${0.15 * pulse})`);
            gradient.addColorStop(0.7, `rgba(${color},${0.05 * pulse})`);
            gradient.addColorStop(1, `rgba(${color},0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();

            // 十字准星
            const crossSize = 12;
            ctx.strokeStyle = `rgba(${color},${0.6 * pulse})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(pos.x - crossSize, pos.y);
            ctx.lineTo(pos.x + crossSize, pos.y);
            ctx.moveTo(pos.x, pos.y - crossSize);
            ctx.lineTo(pos.x, pos.y + crossSize);
            ctx.stroke();

            // 剩余轮数文字
            ctx.fillStyle = `rgba(${color},0.8)`;
            ctx.font = 'bold 11px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${seq.roundsLeft} rounds`, pos.x, pos.y + radius + 6);
        }

        // 渲染空投物（下落动画）
        for (const drop of SupportSystem.supplyDrops) {
            const pos = toScreen(drop.x, drop.y);
            const progress = 1 - (drop.timer / 90); // 0~1 下落进度
            const scale = 0.3 + progress * 0.7;
            const alpha = 0.4 + progress * 0.6;

            // 降落伞效果（上方）
            if (progress < 0.8) {
                const parachuteY = pos.y - 30 * (1 - progress);
                const parachuteSize = 20 * scale;

                // 伞面
                ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
                ctx.beginPath();
                ctx.arc(pos.x, parachuteY, parachuteSize, Math.PI, 0);
                ctx.fill();

                // 伞绳
                ctx.strokeStyle = `rgba(200,200,200,${alpha * 0.4})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pos.x - parachuteSize, parachuteY);
                ctx.lineTo(pos.x, pos.y);
                ctx.moveTo(pos.x + parachuteSize, parachuteY);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }

            // 空投箱
            const boxSize = 14 * scale;
            const isWeapon = drop.weapons && drop.weapons.length > 0;
            const boxColor = isWeapon ? '255,152,0' : '76,175,80';

            // 箱子阴影
            ctx.fillStyle = `rgba(0,0,0,${alpha * 0.3})`;
            ctx.fillRect(pos.x - boxSize + 2, pos.y - boxSize + 2, boxSize * 2, boxSize * 2);

            // 箱子本体
            ctx.fillStyle = `rgba(${boxColor},${alpha})`;
            ctx.fillRect(pos.x - boxSize, pos.y - boxSize, boxSize * 2, boxSize * 2);

            // 箱子边框
            ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x - boxSize, pos.y - boxSize, boxSize * 2, boxSize * 2);

            // 箱子图标
            ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
            ctx.font = `${12 * scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(isWeapon ? '🔫' : '📦', pos.x, pos.y);

            // 落点标记（地面）
            const markerPulse = Math.sin(time * 0.006) * 3 + 10;
            ctx.strokeStyle = `rgba(${boxColor},${0.4 * (1 - progress)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y + boxSize + 5, markerPulse, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 渲染伞兵空降
        for (const p of SupportSystem.paratroopers) {
            const pos = toScreen(p.currentX, p.currentY);
            const progress = 1 - (p.timer / p.maxTimer);
            const scale = 0.5 + progress * 0.5;
            const alpha = 0.3 + progress * 0.7;

            // 降落伞（上方）
            if (progress < 0.85) {
                const parachuteY = pos.y - 25 * (1 - progress);
                const parachuteSize = 18 * scale;

                // 伞面（摇摆动画）
                const sway = Math.sin(time * 0.008 + p.targetX) * 3;
                ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
                ctx.beginPath();
                ctx.arc(pos.x + sway, parachuteY, parachuteSize, Math.PI, 0);
                ctx.fill();

                // 伞绳
                ctx.strokeStyle = `rgba(200,200,200,${alpha * 0.5})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pos.x + sway - parachuteSize, parachuteY);
                ctx.lineTo(pos.x, pos.y);
                ctx.moveTo(pos.x + sway + parachuteSize, parachuteY);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }

            // 伞兵小人
            const bodySize = 10 * scale;
            const color = p.elite ? '255,215,0' : '66,165,245'; // 精英金色，普通蓝色

            // 身体
            ctx.fillStyle = `rgba(${color},${alpha})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, bodySize, 0, Math.PI * 2);
            ctx.fill();

            // 边框
            ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.6})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 精英标记（星星）
            if (p.elite) {
                ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                ctx.font = `${8 * scale}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('★', pos.x, pos.y);
            }

            // 落点标记（地面）
            const targetPos = toScreen(p.targetX, p.targetY);
            const markerPulse = Math.sin(time * 0.006) * 2 + 6;
            ctx.strokeStyle = `rgba(${color},${0.3 * (1 - progress)})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(targetPos.x, targetPos.y, markerPulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 渲染载具空投
        for (const drop of SupportSystem.vehicleDrops) {
            const pos = toScreen(drop.currentX, drop.currentY);
            const targetPos = toScreen(drop.targetX, drop.targetY);
            const progress = 1 - (drop.timer / drop.maxTimer);
            const scale = 0.3 + progress * 0.7;
            const alpha = 0.4 + progress * 0.6;
            const isBTR = drop.vehicleId === 'btr80';

            // 地面阴影
            const shadowScale = 0.3 + progress * 0.7;
            ctx.fillStyle = `rgba(0,0,0,${0.15 + progress * 0.2})`;
            ctx.beginPath();
            ctx.ellipse(
                targetPos.x,
                targetPos.y,
                (isBTR ? 40 : 30) * shadowScale,
                (isBTR ? 18 : 14) * shadowScale,
                0, 0, Math.PI * 2
            );
            ctx.fill();

            // 降落伞（橙白条纹）
            if (progress < 0.88) {
                const parachuteY = pos.y - 50 * (1 - progress);
                const parachuteSize = 36 * scale;
                const sway = Math.sin(time * 0.005 + drop.targetX * 0.01) * 4;

                ctx.save();
                ctx.beginPath();
                ctx.arc(pos.x + sway, parachuteY, parachuteSize, Math.PI, 0);
                ctx.closePath();
                ctx.clip();

                ctx.fillStyle = `rgba(255,140,0,${alpha * 0.85})`;
                ctx.fillRect(pos.x + sway - parachuteSize, parachuteY - parachuteSize, parachuteSize * 2, parachuteSize);

                const stripeW = (parachuteSize * 2) / 5;
                for (let s = 0; s < 5; s += 2) {
                    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
                    ctx.fillRect(pos.x + sway - parachuteSize + s * stripeW, parachuteY - parachuteSize, stripeW, parachuteSize);
                }
                ctx.restore();

                ctx.strokeStyle = `rgba(200,120,0,${alpha * 0.6})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(pos.x + sway, parachuteY, parachuteSize, Math.PI, 0);
                ctx.stroke();

                ctx.strokeStyle = `rgba(180,180,180,${alpha * 0.5})`;
                ctx.lineWidth = 1;
                for (let r = 0; r < 4; r++) {
                    const attachX = pos.x + sway - parachuteSize + (r + 0.5) * (parachuteSize * 2 / 4);
                    ctx.beginPath();
                    ctx.moveTo(attachX, parachuteY);
                    ctx.lineTo(pos.x, pos.y - 8 * scale);
                    ctx.stroke();
                }
            }

            // 载具本体（空投阶段使用简化剪影）
            const jeepSize = 48 * scale;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = isBTR ? '#596443' : '#5C4033';
            ctx.beginPath();
            ctx.roundRect(
                pos.x - jeepSize * (isBTR ? 0.4 : 0.35),
                pos.y - jeepSize * (isBTR ? 0.58 : 0.5),
                jeepSize * (isBTR ? 0.8 : 0.7),
                jeepSize * (isBTR ? 1.16 : 1),
                4 * scale
            );
            ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (isBTR) {
                ctx.fillStyle = '#38412d';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - jeepSize * 0.1, jeepSize * 0.18, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(pos.x - 2 * scale, pos.y - jeepSize * 0.62, 4 * scale, jeepSize * 0.42);
            } else {
                ctx.fillStyle = `rgba(150,200,255,${alpha * 0.5})`;
                ctx.fillRect(pos.x - jeepSize * 0.25, pos.y - jeepSize * 0.4, jeepSize * 0.5, jeepSize * 0.2);
            }
            ctx.fillStyle = `rgba(30,30,30,${alpha * 0.8})`;
            const wheelPoints = isBTR
                ? [[-0.42,-0.42],[0.42,-0.42],[-0.42,-0.14],[0.42,-0.14],[-0.42,0.16],[0.42,0.16],[-0.42,0.44],[0.42,0.44]]
                : [[-0.35,-0.25],[0.35,-0.25],[-0.35,0.3],[0.35,0.3]];
            for (const [wx, wy] of wheelPoints) {
                ctx.beginPath();
                ctx.arc(pos.x + jeepSize * wx, pos.y + jeepSize * wy, 4 * scale, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // 落点标记
            const markerPulse = Math.sin(time * 0.006) * 3 + 8;
            ctx.strokeStyle = `rgba(100,181,246,${0.5 * (1 - progress * 0.5)})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(targetPos.x, targetPos.y, markerPulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            const crossSize = markerPulse * 0.6;
            ctx.strokeStyle = `rgba(100,181,246,${0.4 * (1 - progress * 0.5)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(targetPos.x - crossSize, targetPos.y);
            ctx.lineTo(targetPos.x + crossSize, targetPos.y);
            ctx.moveTo(targetPos.x, targetPos.y - crossSize);
            ctx.lineTo(targetPos.x, targetPos.y + crossSize);
            ctx.stroke();

            if (progress < 0.7) {
                const heightM = Math.round((1 - progress) * 200);
                ctx.fillStyle = `rgba(100,181,246,${0.5 * (1 - progress)})`;
                ctx.font = '9px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(heightM + 'm', pos.x, pos.y + jeepSize * 0.6 + 10);
            }
        }

        // 渲染死神支援（MQ-9无人机投弹）- 三阶段电影级特效
        for (const strike of SupportSystem.reaperStrikes) {
            const pos = toScreen(strike.x, strike.y);
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
                ctx.fillStyle = `rgba(40,40,40,${droneAlpha})`;
                ctx.beginPath();
                // 机身
                ctx.ellipse(droneX, droneY, 25, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                // 机翼
                ctx.fillRect(droneX - 35, droneY - 2, 70, 4);
                // 尾翼
                ctx.fillRect(droneX - 25, droneY - 8, 10, 6);

                // 无人机阴影（地面）
                const shadowProgress = Math.min(1, droneProgress * 2);
                ctx.fillStyle = `rgba(0,0,0,${0.15 * shadowProgress})`;
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 5, 30 * shadowProgress, 8 * shadowProgress, 0, 0, Math.PI * 2);
                ctx.fill();

                // 激光标定（3秒后开始）- 真实军事激光指示器效果
                if (droneProgress > 0.33) {
                    const laserProgress = (droneProgress - 0.33) / 0.67;
                    const laserAlpha = laserProgress * 0.7;

                    // 激光线（从无人机到地面，有轻微抖动）
                    const jitterX = (Math.random() - 0.5) * 2;
                    const jitterY = (Math.random() - 0.5) * 2;
                    ctx.strokeStyle = `rgba(255,30,30,${laserAlpha})`;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([3, 6]);
                    ctx.beginPath();
                    ctx.moveTo(droneX, droneY + 8);
                    ctx.lineTo(pos.x + jitterX, pos.y + jitterY);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // 激光点（地面，有随机抖动，不是完美圆形）
                    const pulse = Math.sin(time * 0.02) * 0.4 + 0.6;
                    const laserRadius = 6 + laserProgress * 8;
                    const dotJitter = (Math.random() - 0.5) * 3;

                    // 激光点光晕
                    const glowGradient = ctx.createRadialGradient(
                        pos.x + dotJitter, pos.y + dotJitter, 0,
                        pos.x + dotJitter, pos.y + dotJitter, laserRadius * 2
                    );
                    glowGradient.addColorStop(0, `rgba(255,50,50,${laserAlpha * pulse})`);
                    glowGradient.addColorStop(0.5, `rgba(255,30,30,${laserAlpha * pulse * 0.4})`);
                    glowGradient.addColorStop(1, 'rgba(255,0,0,0)');
                    ctx.fillStyle = glowGradient;
                    ctx.beginPath();
                    ctx.arc(pos.x + dotJitter, pos.y + dotJitter, laserRadius * 2, 0, Math.PI * 2);
                    ctx.fill();

                    // 激光点核心
                    ctx.fillStyle = `rgba(255,80,80,${laserAlpha * pulse})`;
                    ctx.beginPath();
                    ctx.arc(pos.x + dotJitter, pos.y + dotJitter, laserRadius * 0.6, 0, Math.PI * 2);
                    ctx.fill();

                    // 旋转标记线（4条，随时间旋转）
                    const rotation = time * 0.003;
                    const markerRadius = 50 - laserProgress * 25;
                    ctx.strokeStyle = `rgba(255,60,60,${laserAlpha * 0.8})`;
                    ctx.lineWidth = 2;
                    for (let i = 0; i < 4; i++) {
                        const angle = rotation + (i * Math.PI / 2);
                        const x1 = pos.x + Math.cos(angle) * (markerRadius - 10);
                        const y1 = pos.y + Math.sin(angle) * (markerRadius - 10);
                        const x2 = pos.x + Math.cos(angle) * markerRadius;
                        const y2 = pos.y + Math.sin(angle) * markerRadius;
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }

                    // 分段式锁定进度条（军事风格）
                    const barWidth = 80;
                    const barHeight = 4;
                    const barX = pos.x - barWidth / 2;
                    const barY = pos.y + markerRadius + 15;

                    // 进度条背景
                    ctx.fillStyle = `rgba(40,40,40,${laserAlpha * 0.6})`;
                    ctx.fillRect(barX, barY, barWidth, barHeight);

                    // 进度条分段
                    const segments = 10;
                    const filledSegments = Math.floor(laserProgress * segments);
                    for (let i = 0; i < filledSegments; i++) {
                        const segX = barX + (i / segments) * barWidth;
                        const segWidth = barWidth / segments - 1;
                        ctx.fillStyle = `rgba(255,60,60,${laserAlpha * 0.9})`;
                        ctx.fillRect(segX, barY, segWidth, barHeight);
                    }

                    // 军事风格文字信息
                    ctx.fillStyle = `rgba(255,80,80,${laserAlpha * 0.95})`;
                    ctx.font = 'bold 9px "Courier New", monospace';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';

                    // 坐标信息
                    const coordX = Math.floor(pos.x / 10) * 10;
                    const coordY = Math.floor(pos.y / 10) * 10;
                    ctx.fillText(`TGT: ${coordX},${coordY}`, pos.x + markerRadius + 10, pos.y - 25);

                    // 距离和方位
                    const dist = Math.floor(80 + Math.random() * 5);
                    const bearing = Math.floor((rotation * 180 / Math.PI) % 360);
                    ctx.fillText(`RNG: ${dist}m`, pos.x + markerRadius + 10, pos.y - 13);
                    ctx.fillText(`BRG: ${bearing}°`, pos.x + markerRadius + 10, pos.y - 1);

                    // 锁定状态（闪烁）
                    if (laserProgress > 0.8) {
                        const lockFlash = Math.sin(time * 0.015) > 0;
                        if (lockFlash) {
                            ctx.fillStyle = `rgba(255,100,100,${laserAlpha})`;
                            ctx.font = 'bold 11px "Courier New", monospace';
                            ctx.textAlign = 'center';
                            ctx.fillText('LOCKED', pos.x, pos.y - markerRadius - 15);
                        }
                    }
                }

                // 警告文字（闪烁）
                if (droneProgress > 0.5) {
                    const warnPulse = Math.sin(time * 0.008) > 0 ? 1 : 0.3;
                    ctx.fillStyle = `rgba(255,82,82,${warnPulse * 0.8})`;
                    ctx.font = 'bold 14px "Courier New", monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('⚠ MISSILE INCOMING ⚠', pos.x, pos.y - 80);
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
                    ctx.fillStyle = `rgba(80,80,80,${trailAlpha})`;
                    ctx.beginPath();
                    ctx.ellipse(pos.x, trailY, bombSize * 0.8, bombSize * 1.2, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 炸弹阴影（地面，快速放大）
                const shadowAlpha = 0.3 + bombProgress * 0.4;
                const shadowSize = 25 + bombProgress * 50;
                ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 5, shadowSize, shadowSize * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();

                // 炸弹本体
                ctx.fillStyle = `rgba(50,50,50,${0.9})`;
                ctx.beginPath();
                ctx.ellipse(pos.x, bombY, bombSize, bombSize * 1.8, 0, 0, Math.PI * 2);
                ctx.fill();

                // 炸弹高光
                ctx.fillStyle = `rgba(150,150,150,${0.5 * bombScale})`;
                ctx.beginPath();
                ctx.ellipse(pos.x - bombSize * 0.3, bombY - bombSize * 0.6, bombSize * 0.3, bombSize * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();

                // 尾翼
                ctx.strokeStyle = `rgba(70,70,70,${0.7})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pos.x - bombSize, bombY + bombSize);
                ctx.lineTo(pos.x - bombSize * 1.5, bombY + bombSize * 2);
                ctx.moveTo(pos.x + bombSize, bombY + bombSize);
                ctx.lineTo(pos.x + bombSize * 1.5, bombY + bombSize * 2);
                ctx.stroke();

                // 目标标记（快速脉冲）
                const warnPulse = Math.sin(time * 0.02) * 0.4 + 0.6;
                ctx.strokeStyle = `rgba(255,50,50,${warnPulse})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 4]);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // ========== 阶段3：爆炸（10秒后，持续4秒）==========
            else if (strike.phase === 'exploded') {
                const explosionProgress = 1 - (strike.fadeOutTimer / 240);  // 4秒总时长

                // 地面裂纹效果（前1秒）
                if (explosionProgress < 0.25) {
                    const crackProgress = explosionProgress / 0.25;
                    const crackAlpha = 0.8 * (1 - crackProgress);
                    ctx.strokeStyle = `rgba(255,100,0,${crackAlpha})`;
                    ctx.lineWidth = 3;

                    // 放射状裂纹
                    for (let i = 0; i < 12; i++) {
                        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.2;
                        const crackLength = strike.bombRadius * 0.4 * crackProgress;
                        const startX = pos.x + Math.cos(angle) * 20;
                        const startY = pos.y + Math.sin(angle) * 20;
                        const endX = pos.x + Math.cos(angle) * crackLength;
                        const endY = pos.y + Math.sin(angle) * crackLength;

                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        // 锯齿状裂纹
                        const segments = 5;
                        for (let j = 1; j <= segments; j++) {
                            const t = j / segments;
                            const jitter = (Math.random() - 0.5) * 15;
                            const midX = startX + (endX - startX) * t + jitter;
                            const midY = startY + (endY - startY) * t + jitter;
                            ctx.lineTo(midX, midY);
                        }
                        ctx.stroke();
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
                    const waveGradient = ctx.createRadialGradient(
                        pos.x, pos.y, waveRadius * 0.9,
                        pos.x, pos.y, waveRadius
                    );
                    waveGradient.addColorStop(0, `rgba(255,${200 - i * 20},${80 - i * 10},0)`);
                    waveGradient.addColorStop(0.5, `rgba(255,${180 - i * 25},${60 - i * 15},${waveAlpha})`);
                    waveGradient.addColorStop(1, `rgba(255,${150 - i * 30},${40 - i * 20},0)`);

                    ctx.strokeStyle = waveGradient;
                    ctx.lineWidth = 8 - i;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, waveRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // 中心火球（更大更持久）
                const fireRadius = strike.bombRadius * 0.6 * Math.min(1, explosionProgress * 1.5);
                const fireAlpha = explosionProgress < 0.3 ? 0.9 : 0.9 * (1 - (explosionProgress - 0.3) / 0.7);

                // 多层火球渐变
                const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, fireRadius);
                gradient.addColorStop(0, `rgba(255,255,240,${fireAlpha})`);
                gradient.addColorStop(0.2, `rgba(255,220,100,${fireAlpha * 0.95})`);
                gradient.addColorStop(0.4, `rgba(255,160,50,${fireAlpha * 0.8})`);
                gradient.addColorStop(0.6, `rgba(255,100,30,${fireAlpha * 0.6})`);
                gradient.addColorStop(0.8, `rgba(200,50,10,${fireAlpha * 0.3})`);
                gradient.addColorStop(1, `rgba(150,30,5,0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, fireRadius, 0, Math.PI * 2);
                ctx.fill();

                // 火球内部闪烁（模拟爆炸不稳定）
                if (explosionProgress < 0.5) {
                    const flickerIntensity = Math.sin(time * 0.03) * 0.3 + 0.7;
                    const flickerRadius = fireRadius * 0.4 * flickerIntensity;
                    const flickerGradient = ctx.createRadialGradient(
                        pos.x, pos.y, 0,
                        pos.x, pos.y, flickerRadius
                    );
                    flickerGradient.addColorStop(0, `rgba(255,255,255,${fireAlpha * 0.8})`);
                    flickerGradient.addColorStop(1, `rgba(255,200,100,0)`);
                    ctx.fillStyle = flickerGradient;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, flickerRadius, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 蘑菇云效果（更大更壮观，持续2秒）
                if (explosionProgress < 0.5) {
                    const cloudProgress = explosionProgress / 0.5;
                    const cloudY = pos.y - 250 * cloudProgress;
                    const cloudRadius = 80 + cloudProgress * 120;
                    const cloudAlpha = 0.5 * (1 - cloudProgress * 0.7);

                    // 烟柱（更粗）
                    const pillarWidth = 40 + cloudProgress * 30;
                    ctx.fillStyle = `rgba(60,60,60,${cloudAlpha * 0.7})`;
                    ctx.fillRect(pos.x - pillarWidth / 2, pos.y - 180 * cloudProgress, pillarWidth, 180 * cloudProgress);

                    // 烟柱内部火光
                    if (cloudProgress < 0.6) {
                        const innerGlow = ctx.createRadialGradient(
                            pos.x, pos.y - 90 * cloudProgress, 0,
                            pos.x, pos.y - 90 * cloudProgress, pillarWidth
                        );
                        innerGlow.addColorStop(0, `rgba(255,150,50,${cloudAlpha * 0.4})`);
                        innerGlow.addColorStop(1, `rgba(255,100,30,0)`);
                        ctx.fillStyle = innerGlow;
                        ctx.fillRect(pos.x - pillarWidth, pos.y - 180 * cloudProgress, pillarWidth * 2, 180 * cloudProgress);
                    }

                    // 蘑菇头（更大，多层）
                    for (let i = 0; i < 3; i++) {
                        const layerOffset = i * 15;
                        const layerRadius = cloudRadius - layerOffset;
                        const layerAlpha = cloudAlpha * (1 - i * 0.2);

                        ctx.fillStyle = `rgba(${80 + i * 10},${80 + i * 10},${80 + i * 10},${layerAlpha})`;
                        ctx.beginPath();
                        ctx.arc(pos.x, cloudY + layerOffset, layerRadius, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // 蘑菇头边缘火光
                    const edgeGlow = ctx.createRadialGradient(
                        pos.x, cloudY, cloudRadius * 0.8,
                        pos.x, cloudY, cloudRadius
                    );
                    edgeGlow.addColorStop(0, `rgba(255,120,40,0)`);
                    edgeGlow.addColorStop(0.7, `rgba(255,100,30,${cloudAlpha * 0.3})`);
                    edgeGlow.addColorStop(1, `rgba(255,80,20,0)`);
                    ctx.fillStyle = edgeGlow;
                    ctx.beginPath();
                    ctx.arc(pos.x, cloudY, cloudRadius, 0, Math.PI * 2);
                    ctx.fill();
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

                        ctx.fillStyle = `rgba(${100 + Math.random() * 50},${50 + Math.random() * 30},${20 + Math.random() * 20},${debrisAlpha})`;
                        ctx.beginPath();
                        ctx.arc(debrisX, debrisY, debrisSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
        // 渲染疣猪支援（A-10攻击机机炮扫射）
        for (const strafe of SupportSystem.a10Strafes) {
            const elapsed = strafe.totalDuration - strafe.timer;

            // 计算扫射区域的屏幕坐标
            const startPos = toScreen(strafe.startX, strafe.startY);
            const endPos = toScreen(strafe.endX, strafe.endY);
            const centerPos = toScreen(strafe.x, strafe.y);

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
                ctx.save();
                ctx.translate(planeX, planeY);
                ctx.rotate(strafe.angle);

                // 机身
                ctx.fillStyle = `rgba(60,60,60,${planeAlpha})`;
                ctx.beginPath();
                ctx.ellipse(0, 0, 35, 10, 0, 0, Math.PI * 2);
                ctx.fill();

                // 机翼（A-10 特征性的直翼）
                ctx.fillRect(-40, -3, 80, 6);

                // 双引擎
                ctx.fillStyle = `rgba(50,50,50,${planeAlpha})`;
                ctx.beginPath();
                ctx.ellipse(-15, -12, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(-15, 12, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();

                // 尾翼
                ctx.fillRect(-30, -8, 12, 4);

                ctx.restore();

                // 飞机阴影（地面）
                const shadowAlpha = 0.15 * flyProgress;
                ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
                ctx.beginPath();
                ctx.ellipse(centerPos.x, centerPos.y + 5, 40, 12, 0, 0, Math.PI * 2);
                ctx.fill();

                // 扫射区域预览（3秒后开始显示）
                if (flyProgress > 0.375) {
                    const previewAlpha = (flyProgress - 0.375) / 0.625 * 0.4;

                    // 长方形扫射区域
                    ctx.save();
                    ctx.translate(centerPos.x, centerPos.y);
                    ctx.rotate(strafe.angle);

                    // 区域边框（闪烁）
                    const borderPulse = Math.sin(time * 0.01) * 0.3 + 0.7;
                    ctx.strokeStyle = `rgba(255,100,50,${previewAlpha * borderPulse})`;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([8, 4]);
                    ctx.strokeRect(-strafe.strafeLength / 2, -strafe.strafeWidth / 2,
                        strafe.strafeLength, strafe.strafeWidth);
                    ctx.setLineDash([]);

                    // 区域填充
                    ctx.fillStyle = `rgba(255,80,30,${previewAlpha * 0.15})`;
                    ctx.fillRect(-strafe.strafeLength / 2, -strafe.strafeWidth / 2,
                        strafe.strafeLength, strafe.strafeWidth);

                    // 中心线
                    ctx.strokeStyle = `rgba(255,120,60,${previewAlpha * 0.6})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(-strafe.strafeLength / 2, 0);
                    ctx.lineTo(strafe.strafeLength / 2, 0);
                    ctx.stroke();

                    ctx.restore();

                    // 警告文字（闪烁）
                    if (flyProgress > 0.6) {
                        const warnPulse = Math.sin(time * 0.012) > 0 ? 1 : 0.3;
                        ctx.fillStyle = `rgba(255,120,50,${warnPulse * 0.9})`;
                        ctx.font = 'bold 14px "Courier New", monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('⚠ STRAFE INCOMING ⚠', centerPos.x, centerPos.y - 80);
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
                ctx.save();
                ctx.translate(planeX, planeY);
                ctx.rotate(strafe.angle);

                // 机身
                ctx.fillStyle = 'rgba(60,60,60,0.9)';
                ctx.beginPath();
                ctx.ellipse(0, 0, 35, 10, 0, 0, Math.PI * 2);
                ctx.fill();

                // 机翼
                ctx.fillRect(-40, -3, 80, 6);

                // 双引擎
                ctx.fillStyle = 'rgba(50,50,50,0.9)';
                ctx.beginPath();
                ctx.ellipse(-15, -12, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(-15, 12, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();

                // 尾翼
                ctx.fillRect(-30, -8, 12, 4);

                // 机炮闪光效果
                const muzzleFlash = Math.random() > 0.3;
                if (muzzleFlash) {
                    ctx.fillStyle = 'rgba(255,200,50,0.8)';
                    ctx.beginPath();
                    ctx.ellipse(35, 0, 8, 4, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // 枪口火焰
                    ctx.fillStyle = 'rgba(255,150,30,0.6)';
                    ctx.beginPath();
                    ctx.ellipse(40, 0, 12, 6, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();

                // 扫射区域高亮
                ctx.save();
                ctx.translate(centerPos.x, centerPos.y);
                ctx.rotate(strafe.angle);

                // 已扫射过的区域（逐渐变暗）
                const sweptLength = strafe.strafeLength * strafeProgress;
                ctx.fillStyle = 'rgba(255,80,30,0.1)';
                ctx.fillRect(-strafe.strafeLength / 2, -strafe.strafeWidth / 2,
                    sweptLength, strafe.strafeWidth);

                // 扫射前沿（明亮）
                const frontX = -strafe.strafeLength / 2 + sweptLength;
                ctx.strokeStyle = 'rgba(255,150,50,0.6)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(frontX, -strafe.strafeWidth / 2);
                ctx.lineTo(frontX, strafe.strafeWidth / 2);
                ctx.stroke();

                ctx.restore();

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
                ctx.save();
                ctx.translate(planeX, planeY);
                ctx.rotate(strafe.angle);
                ctx.scale(1 - fadeProgress * 0.3, 1 - fadeProgress * 0.3);

                ctx.fillStyle = `rgba(60,60,60,${planeAlpha})`;
                ctx.beginPath();
                ctx.ellipse(0, 0, 35, 10, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillRect(-40, -3, 80, 6);

                ctx.fillStyle = `rgba(50,50,50,${planeAlpha})`;
                ctx.beginPath();
                ctx.ellipse(-15, -12, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(-15, 12, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillRect(-30, -8, 12, 4);

                ctx.restore();

                // 扫射区域残留烟尘
                ctx.save();
                ctx.translate(centerPos.x, centerPos.y);
                ctx.rotate(strafe.angle);

                const residualAlpha = 0.15 * (1 - fadeProgress);
                ctx.fillStyle = `rgba(255,80,30,${residualAlpha})`;
                ctx.fillRect(-strafe.strafeLength / 2, -strafe.strafeWidth / 2,
                    strafe.strafeLength, strafe.strafeWidth);

                ctx.restore();
            }
        }

    }

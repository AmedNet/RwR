// src/rendering/BubbleRenderer.js
// 气泡渲染：载具 AI 闲聊气泡 + AI 战场自言自语气泡（从 Renderer.js 拆出）
import { GameState } from '../core/GameState.js';
import { VehicleChatSystem } from '../utils/VehicleChatSystem.js';
import { AIMonologueSystem } from '../utils/AIMonologueSystem.js';

export function drawVehicleChatBubbles(ctx, toScreen) {
        for (const vehicle of GameState.vehicles) {
            if (!vehicle.alive) continue;
            for (let i = 0; i < vehicle.occupants.length; i++) {
                const bubble = VehicleChatSystem.getBubble(vehicle, i);
                if (!bubble) continue;
                const seatPos = vehicle.getSeatWorldPosition(i);
                const screenPos = toScreen(seatPos.x, seatPos.y);
                drawSpeechBubble(ctx, screenPos.x, screenPos.y, bubble.text, bubble.timer, bubble.maxTimer);
            }
        }
    }

export function drawSpeechBubble(ctx, sx, sy, text, timer, maxTimer) {
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
    }

export function drawAIMonologues(ctx, toScreen) {
        const allAI = [...GameState.enemies, ...GameState.teammates];
        for (const ai of allAI) {
            if (!ai || !ai.alive) continue;
            if (ai.mountedVehicle) continue; // 载具内的AI不显示自言自语
            const bubble = AIMonologueSystem.getBubble(ai);
            if (!bubble) continue;
            const screenPos = toScreen(ai.x, ai.y);
            // 自言自语气泡稍微偏小，用不同的渲染方法
            drawMonologueBubble(ctx, screenPos.x, screenPos.y, bubble.text, bubble.timer, bubble.maxTimer);
        }
    }

export function drawMonologueBubble(ctx, sx, sy, text, timer, maxTimer) {
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
    }

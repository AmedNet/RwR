// === 液态毛玻璃 UI 共享样式与辅助函数 ===

export const GLASS = {
    // 深色背景
    bg: 'rgba(15, 20, 30, 0.75)',
    // 边框
    border: 'rgba(100, 150, 200, 0.3)',
    borderHighlight: 'rgba(120, 180, 240, 0.4)',
    // 文字
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.8)',
    textDim: 'rgba(255, 255, 255, 0.5)',
    // 血量
    hpHigh: '#4ade80',
    hpMid: '#fbbf24',
    hpLow: '#f87171',
    // 弹药
    ammoNormal: '#4ade80',
    ammoLow: '#fbbf24',
    ammoCritical: '#f87171',
    // 槽位
    slotBg: 'rgba(20, 30, 45, 0.6)',
    slotActiveBg: 'rgba(40, 60, 90, 0.7)',
    slotActiveBorder: 'rgba(100, 180, 255, 0.6)',
    // 圆角
    radius: 20,
    radiusSmall: 12,
};

// 缓动函数
export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// 入出对称的三次缓动，关闭动画时让前后都缓，给人更顺滑的过渡感
export function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 绘制液态毛玻璃面板
export function drawGlassPanel(ctx, x, y, w, h, radius = GLASS.radius, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;

    // 柔和阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;

    // 深色背景 - 依赖 Renderer 的模糊效果
    ctx.fillStyle = GLASS.bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();

    // 重置阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 边框渐变
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, GLASS.borderHighlight);
    grad.addColorStop(0.5, GLASS.border);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 顶部高光
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + radius, y + 0.5);
    ctx.lineTo(x + w - radius, y + 0.5);
    ctx.stroke();

    ctx.restore();
}

// 绘制圆角进度条
export function drawProgressBar(ctx, x, y, w, h, ratio, color, bgColor = 'rgba(255, 255, 255, 0.1)') {
    // 背景槽
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();

    if (ratio > 0) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, w * ratio, h, h / 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.roundRect(x, y, w * ratio, h / 2, [h / 2, h / 2, 0, 0]);
        ctx.fill();
    }
}

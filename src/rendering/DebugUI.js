// src/rendering/DebugUI.js
import { GameState } from '../core/GameState.js';

export function drawDebug(ctx, renderer) {
    ctx.save();

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, renderer.width, renderer.height);

    // 标题
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐛 Debug 面板', renderer.width / 2, 80);

    // 当前RP
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`💰 当前 RP: ${GameState.rp}`, renderer.width / 2, 150);

    // 按钮配置
    const buttons = [
        { label: '+100 RP', value: 100, color: '#4CAF50' },
        { label: '+500 RP', value: 500, color: '#2196F3' },
        { label: '+1000 RP', value: 1000, color: '#9C27B0' }
    ];

    const btnW = 180;
    const btnH = 60;
    const btnGap = 20;
    const startX = renderer.width / 2 - (buttons.length * btnW + (buttons.length - 1) * btnGap) / 2;
    const btnY = 220;

    // 存储按钮位置供点击检测
    renderer.debugButtons = [];

    buttons.forEach((btn, i) => {
        const x = startX + i * (btnW + btnGap);

        // 按钮背景
        ctx.fillStyle = btn.color;
        ctx.beginPath();
        ctx.roundRect(x, btnY, btnW, btnH, 10);
        ctx.fill();

        // 按钮边框
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 按钮文字
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, x + btnW / 2, btnY + btnH / 2);

        // 保存按钮位置
        renderer.debugButtons.push({ x, y: btnY, w: btnW, h: btnH, value: btn.value });
    });

    // 额外功能按钮
    const extraButtons = [
        { label: '满血', action: 'heal', color: '#f44336' }
    ];

    const extraBtnY = btnY + btnH + 30;
    const extraStartX = renderer.width / 2 - (extraButtons.length * btnW + (extraButtons.length - 1) * btnGap) / 2;

    extraButtons.forEach((btn, i) => {
        const x = extraStartX + i * (btnW + btnGap);

        ctx.fillStyle = btn.color;
        ctx.beginPath();
        ctx.roundRect(x, extraBtnY, btnW, btnH, 10);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, x + btnW / 2, extraBtnY + btnH / 2);

        renderer.debugButtons.push({ x, y: extraBtnY, w: btnW, h: btnH, action: btn.action });
    });

    // 底部提示
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('点击按钮生效 | 按 ESC 或 9+1 关闭', renderer.width / 2, renderer.height - 40);

    ctx.restore();
}
// src/rendering/QuickResultUI.js
// 快速模式结算界面（胜利/失败 + 重试/下一把/返回主菜单），毛玻璃风格，镜像 PauseMenuUI。
// 弹出动画（quickResultDelay 延迟渐黑 → quickResultAppearAnim easeOutBack 弹出）由 Renderer 驱动，
// 热区写入 GameState.quickResultHitAreas 供 QuickResultHandler 命中。
import { GameState } from '../core/GameState.js';
import { GLASS, easeOutCubic, easeOutBack, drawGlassPanel } from './GlassUI.js';

const FONT = '-apple-system, "SF Pro Display", sans-serif';
const MONO = '"Courier New", monospace';

export function drawQuickResult(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;

    // 延迟期（渐黑）不画卡片也不 push 热区
    if (GameState.appear.quickResult.delay < 1) { GameState.quickResultHitAreas = []; return; }
    const rawP = GameState.appear.quickResult.progress;
    const eased = easeOutCubic(rawP);
    if (eased <= 0) { GameState.quickResultHitAreas = []; return; }

    const victory = GameState.quickResult === 'victory';

    // 缩放 + 上浮 + 淡入（easeOutBack 末端回弹，对齐暂停菜单）
    const scaleP = easeOutBack(rawP);
    const scale = 0.92 + 0.08 * scaleP;
    const offsetY = (1 - scaleP) * 24;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -H / 2 + offsetY);
    ctx.globalAlpha = eased;

    const panelW = 340;
    const panelH = 356;
    const px = W / 2 - panelW / 2;
    const py = H / 2 - panelH / 2;

    drawGlassPanel(ctx, px, py, panelW, panelH, GLASS.radius);

    // 标题（胜利绿 / 失败红）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = victory ? '#4ade80' : '#ff1744';
    ctx.font = `bold 34px ${MONO}`;
    ctx.fillText(victory ? '胜 利' : '失 败', W / 2, py + 54);
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(victory ? 'M I S S I O N   C O M P L E T E' : 'K . I . A .', W / 2, py + 84);

    // 统计
    const rank = GameState.player ? GameState.player.getRankName() : '列兵';
    ctx.fillStyle = GLASS.textSecondary;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`军衔: ${rank}   |   击杀: ${GameState.kills}`, W / 2, py + 116);

    // 分隔线
    ctx.strokeStyle = GLASS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 24, py + 138);
    ctx.lineTo(px + panelW - 24, py + 138);
    ctx.stroke();

    // 按钮（热区写入 GameState.quickResultHitAreas，供 QuickResultHandler 命中检测）
    GameState.quickResultHitAreas = [];
    const btnW = 240, btnH = 46, btnX = W / 2 - btnW / 2;
    const mouse = GameState.mouse;
    const buttons = [
        { id: 'retry', label: '重  试',       y: py + 156 },
        { id: 'next',  label: '下一把',       y: py + 210 },
        { id: 'menu',  label: '返回主菜单',   y: py + 264 },
    ];
    for (const btn of buttons) {
        const hover = mouse.x >= btnX && mouse.x <= btnX + btnW &&
                      mouse.y >= btn.y && mouse.y <= btn.y + btnH;
        // hover 高亮底
        ctx.fillStyle = hover ? 'rgba(100,180,255,0.16)' : 'rgba(20,30,45,0.6)';
        ctx.beginPath();
        ctx.roundRect(btnX, btn.y, btnW, btnH, GLASS.radiusSmall);
        ctx.fill();
        ctx.strokeStyle = hover ? GLASS.slotActiveBorder : GLASS.border;
        ctx.lineWidth = hover ? 1.5 : 1;
        ctx.stroke();
        // 文字
        ctx.fillStyle = hover ? GLASS.textPrimary : GLASS.textSecondary;
        ctx.font = `${hover ? '600 ' : ''}16px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, W / 2, btn.y + btnH / 2);

        GameState.quickResultHitAreas.push({ id: btn.id, x: btnX, y: btn.y, w: btnW, h: btnH });
    }

    // 底部快捷键提示
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `11px ${MONO}`;
    ctx.fillText('R 重试   ·   N 下一把   ·   ESC 主菜单', W / 2, py + panelH - 20);

    ctx.restore();
}

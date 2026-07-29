// src/rendering/BattleReportUI.js
// 战地模式胜利战报（占领全部据点触发；毛玻璃卡片，点击/按键关闭后继续游玩）。
// 弹出动画（battleReportAppearAnim easeOutCubic + easeOutBack 回弹）由 Renderer 驱动，镜像 QuickResultUI。
// 只有一个动作（继续），故不用热区机制——整个覆盖层可点击关闭，按钮仅作视觉锚点。
import { GameState } from '../core/GameState.js';
import { GLASS, easeOutCubic, easeOutBack, drawGlassPanel } from './GlassUI.js';

const FONT = '-apple-system, "SF Pro Display", sans-serif';
const MONO = '"Courier New", monospace';

export function drawBattleReport(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;

    const rawP = GameState.battleReportAppearAnim;
    const eased = easeOutCubic(rawP);
    if (eased <= 0) return;

    // 缩放 + 上浮 + 淡入（easeOutBack 末端回弹，对齐 QuickResult）
    const scaleP = easeOutBack(rawP);
    const scale = 0.92 + 0.08 * scaleP;
    const offsetY = (1 - scaleP) * 24;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -H / 2 + offsetY);
    ctx.globalAlpha = eased;

    const panelW = 400;
    const panelH = 348;
    const px = W / 2 - panelW / 2;
    const py = H / 2 - panelH / 2;

    drawGlassPanel(ctx, px, py, panelW, panelH, GLASS.radius);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 标题（胜利绿）
    ctx.fillStyle = '#4ade80';
    ctx.font = `bold 36px ${MONO}`;
    ctx.fillText('胜 利', W / 2, py + 52);
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('M I S S I O N   C O M P L E T E', W / 2, py + 82);

    // 统计（军衔 / 击杀 / 得分 / 用时）
    const rank = GameState.player ? GameState.player.getRankName() : '列兵';
    const totalSec = Math.floor((GameState.matchFrames || 0) / 60);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    ctx.fillStyle = GLASS.textSecondary;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`军衔: ${rank}   |   击杀: ${GameState.kills}   |   得分: ${GameState.score}`, W / 2, py + 116);
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`用时 ${min} 分 ${sec} 秒`, W / 2, py + 140);

    // 分隔线
    ctx.strokeStyle = GLASS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 28, py + 162);
    ctx.lineTo(px + panelW - 28, py + 162);
    ctx.stroke();

    // 战报叙事（涌现式：引用本局真实数据）
    ctx.fillStyle = GLASS.textSecondary;
    ctx.font = `14px ${FONT}`;
    ctx.fillText(`第 ${min} 分 ${sec} 秒，蓝军攻陷最后一座据点。`, W / 2, py + 190);
    ctx.fillText(`${rank}在此役中击毙 ${GameState.kills} 名敌军，战线彻底崩溃。`, W / 2, py + 214);

    // 继续按钮（视觉锚点；整个覆盖层均可点击关闭）
    const btnW = 240, btnH = 48, btnX = W / 2 - btnW / 2, btnY = py + 244;
    const mouse = GameState.mouse;
    const hover = mouse.x >= btnX && mouse.x <= btnX + btnW &&
                  mouse.y >= btnY && mouse.y <= btnY + btnH;
    ctx.fillStyle = hover ? 'rgba(100,180,255,0.16)' : 'rgba(20,30,45,0.6)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, GLASS.radiusSmall);
    ctx.fill();
    ctx.strokeStyle = hover ? GLASS.slotActiveBorder : GLASS.border;
    ctx.lineWidth = hover ? 1.5 : 1;
    ctx.stroke();
    ctx.fillStyle = hover ? GLASS.textPrimary : GLASS.textSecondary;
    ctx.font = `${hover ? '600 ' : ''}16px ${FONT}`;
    ctx.fillText('继续作战', W / 2, btnY + btnH / 2);

    // 底部提示
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `11px ${MONO}`;
    ctx.fillText('点击任意处或按任意键继续', W / 2, py + panelH - 20);

    ctx.restore();
}

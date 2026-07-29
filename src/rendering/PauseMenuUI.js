// src/rendering/PauseMenuUI.js
// 暂停菜单 - 毛玻璃风格，对齐军械库/背包/电台（自驱 deltaTime 动画 + 热区写入 GameState）
import { GameState } from '../core/GameState.js';
import { GLASS, easeOutCubic, easeOutBack, drawGlassPanel } from './GlassUI.js';

const FONT = '-apple-system, "SF Pro Display", sans-serif';
const MONO = '"Courier New", monospace';

// 暂停菜单动画推进（自驱 deltaTime，镜像 RadioUI.updateRadioAnimation 的倒带式结构）
export function updatePauseAnimation() {
    const now = performance.now();
    if (GameState.panels.pause._lastTime == null) GameState.panels.pause._lastTime = now;
    const dt = Math.min((now - GameState.panels.pause._lastTime) / 1000, 0.05);
    GameState.panels.pause._lastTime = now;

    const speed = GameState.panels.pause.direction === 'closing' ? 4.4 : 3.6; // 关 ~0.23s / 开 ~0.28s
    if (GameState.panels.pause.direction === 'opening') {
        GameState.panels.pause.progress = Math.min(1, GameState.panels.pause.progress + speed * dt);
        if (GameState.panels.pause.progress >= 1) GameState.panels.pause.direction = null;
    } else if (GameState.panels.pause.direction === 'closing') {
        GameState.panels.pause.progress = Math.max(0, GameState.panels.pause.progress - speed * dt);
        if (GameState.panels.pause.progress <= 0) {
            GameState.panels.pause.open = false;
            GameState.panels.pause.direction = null;
            GameState.panels.pause._lastTime = null;
        }
    }
}

export function drawPauseMenu(ctx, renderer, alphaScale = 1) {
    const W = renderer.width;
    const H = renderer.height;

    const rawP = GameState.panels.pause.progress || 0;
    const eased = easeOutCubic(rawP);
    if (eased <= 0) { GameState.pauseHitAreas = []; return; }

    // 缩放 + 上浮 + 淡入（打开用 easeOutBack 回弹，关闭用线性收落，对齐军械库）
    const scaleP = GameState.panels.pause.direction === 'opening' ? easeOutBack(rawP) : rawP;
    const scale = 0.92 + 0.08 * scaleP;
    const offsetY = (1 - scaleP) * 24;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -H / 2 + offsetY);
    ctx.globalAlpha = eased * alphaScale;

    const panelW = 320;
    const panelH = 300;
    const px = W / 2 - panelW / 2;
    const py = H / 2 - panelH / 2;

    drawGlassPanel(ctx, px, py, panelW, panelH, GLASS.radius);

    // 标题
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `bold 30px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P A U S E D', W / 2, py + 56);
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('游戏已暂停', W / 2, py + 86);

    // 分隔线
    ctx.strokeStyle = GLASS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 24, py + 108);
    ctx.lineTo(px + panelW - 24, py + 108);
    ctx.stroke();

    // 按钮（热区写入 GameState.pauseHitAreas，供 PauseHandler 命中检测）
    GameState.pauseHitAreas = [];
    const btnW = 220, btnH = 52, btnX = W / 2 - btnW / 2;
    const mouse = GameState.mouse;
    const buttons = [
        { id: 'settings', label: '设  置', y: py + 132 },
        { id: 'quit',     label: '退出到主菜单', y: py + 200 },
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

        GameState.pauseHitAreas.push({ id: btn.id, x: btnX, y: btn.y, w: btnW, h: btnH });
    }

    // 底部提示
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `11px ${MONO}`;
    ctx.fillText('按 ESC 恢复游戏', W / 2, py + panelH - 24);

    ctx.restore();
}

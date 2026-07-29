// src/rendering/GameOverUI.js
import { GameState } from '../core/GameState.js';
import { GLASS, easeOutCubic, drawGlassPanel } from './GlassUI.js';

// 毛玻璃统一字体（标题/数字保留等宽作军事终端味锚点）
const FONT = '-apple-system, "SF Pro Display", sans-serif';
const MONO = '"Courier New", monospace';

// 末端轻过冲再回弹，呼吸感（焦点滑动用，与背包/军械库/电台本地复制体字面相同）
const easeOutBack = t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// 战术地图尺寸
const MAP_W = 360;
const MAP_H = 260;
const MAP_PAD = 12;

// 据点圆点半径（模块常量，供循环内外共用，避免作用域逃逸）
const BASE_R = 8;

export function drawGameOver(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;
    const cx = W / 2;
    const cy = H / 2;

    const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
    const allPoints = GameState.capturePoints;
    const worldW = GameState.world.width;
    const worldH = GameState.world.height;

    // === 死亡界面延迟+弹出动画：延迟期（gameOverDelay < 1）不画卡片也不 push 热区 ===
    if (GameState.appear.gameOver.delay < 1) return;
    const appearRaw = GameState.appear.gameOver.progress;
    const appear = easeOutCubic(appearRaw);

    // === 焦点滑动自驱 deltaTime（与背包/军械库/电台同取法） ===
    const now = performance.now();
    if (GameState.focus.gameOver._lastTime == null) GameState.focus.gameOver._lastTime = now;
    const deltaTime = (now - GameState.focus.gameOver._lastTime) / 1000;
    GameState.focus.gameOver._lastTime = now;
    const dt = Math.min(deltaTime, 0.05);

    // === 卡片布局：固定尺寸绕屏幕几何中心居中 ===
    const innerPad = 20;
    const headerH = 86;             // 标题"阵亡" + 统计
    const mapTitleH = 24;           // 地图标题
    const mapGap = 8;               // 地图标题与地图之间
    const listGap = 16;             // 地图与底部列表之间
    const listH = 44;               // 底部据点列表行高
    const footerGap = 14;

    const cardW = MAP_W + innerPad * 2;
    const cardH = innerPad + headerH + mapTitleH + mapGap + MAP_H + listGap + listH + footerGap + innerPad;
    const cardX = cx - cardW / 2;
    const cardY = cy - cardH / 2;

    // === 主面板毛玻璃（随弹出动画淡入 + 从下 20px 滑入落位）===
    ctx.save();
    ctx.globalAlpha *= appear;
    ctx.translate(0, -20 * (1 - appear));
    drawGlassPanel(ctx, cardX, cardY, cardW, cardH, GLASS.radius);

    // ---- 普通阵亡：战术地图复活选择 ----
    // 标题 "阵亡" + 统计
    ctx.fillStyle = '#ff1744';
    ctx.font = `bold 34px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('阵亡', cx, cardY + innerPad + 24);

    const rank = GameState.player ? GameState.player.getRankName() : '列兵';
    ctx.fillStyle = GLASS.textSecondary;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`军衔: ${rank}   |   击杀: ${GameState.kills}   |   得分: ${GameState.score}`, cx, cardY + innerPad + 58);

    // 顶部分隔线
    ctx.strokeStyle = GLASS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + innerPad, cardY + innerPad + headerH);
    ctx.lineTo(cardX + cardW - innerPad, cardY + innerPad + headerH);
    ctx.stroke();

    // 地图标题
    const mapTitleY = cardY + innerPad + headerH;
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${MONO}`;
    ctx.fillText('选择复活据点 — 点击或按数字键', cx, mapTitleY + mapTitleH / 2);

    // === 战术地图（卡片内居中）===
    const mapX = cx - MAP_W / 2;
    const mapY = mapTitleY + mapTitleH + mapGap;
    const scaleX = (MAP_W - MAP_PAD * 2) / worldW;
    const scaleY = (MAP_H - MAP_PAD * 2) / worldH;
    const scale = Math.min(scaleX, scaleY);
    const drawW = worldW * scale;
    const drawH = worldH * scale;
    const ox = mapX + (MAP_W - drawW) / 2;
    const oy = mapY + (MAP_H - drawH) / 2;

    // 地图毛玻璃小卡片
    drawGlassPanel(ctx, mapX, mapY, MAP_W, MAP_H, GLASS.radiusSmall);

    // 绘制所有据点
    GameState.respawnHitAreas = [];
    const hoverIdx = GameState.gameOverSelectedPoint;
    let playerIdx = 0;

    // 先算选中据点目标坐标（供焦点滑动用）
    let selectedTargetX = null, selectedTargetY = null;
    if (hoverIdx >= 0 && hoverIdx < playerPoints.length) {
        const sp = playerPoints[hoverIdx];
        selectedTargetX = ox + sp.x * scale;
        selectedTargetY = oy + sp.y * scale;
    }

    // 据点焦点滑动推进（鼠标悬浮/数字键切选时据点高亮从旧据点滑到新据点）
    if (selectedTargetX != null) {
        if (GameState.focus.gameOver.index !== hoverIdx) {
            const hasFocus = (GameState.focus.gameOver.x != null && GameState.focus.gameOver.y != null);
            if (hasFocus) {
                GameState.focus.gameOver.fromX = GameState.focus.gameOver.x;
                GameState.focus.gameOver.fromY = GameState.focus.gameOver.y;
            } else {
                GameState.focus.gameOver.fromX = selectedTargetX;
                GameState.focus.gameOver.fromY = selectedTargetY;
                GameState.focus.gameOver.x = selectedTargetX;
                GameState.focus.gameOver.y = selectedTargetY;
            }
            GameState.focus.gameOver.anim = 0;
            GameState.focus.gameOver.index = hoverIdx;
        }
        GameState.focus.gameOver.anim = Math.min(1, GameState.focus.gameOver.anim + dt / 0.22);
        const t = easeOutBack(GameState.focus.gameOver.anim);
        GameState.focus.gameOver.x = GameState.focus.gameOver.fromX + (selectedTargetX - GameState.focus.gameOver.fromX) * t;
        GameState.focus.gameOver.y = GameState.focus.gameOver.fromY + (selectedTargetY - GameState.focus.gameOver.fromY) * t;
    }

    for (const pt of allPoints) {
        const px = ox + pt.x * scale;
        const py = oy + pt.y * scale;
        const isPlayer = pt.owner === 'player';
        const isEnemy = pt.owner === 'enemy';

        let color = '#666';
        if (isPlayer) color = '#4CAF50';
        else if (isEnemy) color = '#f44336';

        // 检测鼠标悬浮
        const mx = GameState.mouse.x;
        const my = GameState.mouse.y;
        const dist = Math.hypot(mx - px, my - py);
        const isHover = dist < BASE_R + 6;

        if (isPlayer) {
            // 悬浮检测：仅当鼠标在该据点上时写入 gameOverSelectedPoint
            // （之前 hoverIdx===playerIdx 会导致鼠标移开后旧值被锁死，无法切换到新据点）
            if (isHover) {
                GameState.gameOverSelectedPoint = playerIdx;
            }

            // 选中据点高亮画在焦点滑动后的 (fx,fy)（脉动呼吸 + 发光描边）
            if (isHover) {
                const fx = GameState.focus.gameOver.x;
                const fy = GameState.focus.gameOver.y;
                const pulse = Math.sin(now * 0.004) * 0.05 + 0.95;
                ctx.save();
                // 脉冲光圈
                ctx.fillStyle = `rgba(76, 175, 80, ${0.25 * pulse})`;
                ctx.beginPath();
                ctx.arc(fx, fy, BASE_R + 6, 0, Math.PI * 2);
                ctx.fill();
                // 选中亮色圆点 + 发光
                ctx.shadowColor = '#66BB6A';
                ctx.shadowBlur = 10 + pulse * 4;
                ctx.beginPath();
                ctx.arc(fx, fy, BASE_R, 0, Math.PI * 2);
                ctx.fillStyle = '#66BB6A';
                ctx.fill();
                ctx.shadowBlur = 0;
                // 白描边
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(fx, fy, BASE_R, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            } else {
                // 非选中己方据点：普通圆点
                ctx.beginPath();
                ctx.arc(px, py, BASE_R, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // 编号
            ctx.fillStyle = '#fff';
            ctx.font = `bold 11px ${MONO}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${playerIdx + 1}`, px, py);

            // 存储热区
            GameState.respawnHitAreas.push({ x: px, y: py, r: BASE_R + 6, index: playerIdx });
            playerIdx++;
        } else {
            // 敌方/中立据点
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.5;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // 悬浮据点下方显示名称
    if (hoverIdx >= 0 && hoverIdx < playerPoints.length) {
        const hp = playerPoints[hoverIdx];
        const fx = GameState.focus.gameOver.x;
        const fy = GameState.focus.gameOver.y;
        ctx.fillStyle = GLASS.textPrimary;
        ctx.font = `12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`据点 #${hoverIdx + 1}`, fx, fy + BASE_R + 8);
    }

    // ---- 底部据点列表（紧凑横排，毛玻璃小卡）----
    const listY = mapY + MAP_H + listGap + listH / 2;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < playerPoints.length; i++) {
        const bx = cx + (i - (playerPoints.length - 1) / 2) * 90;
        const by = listY;
        const isHov = hoverIdx === i;

        // 卡片毛玻璃底板
        drawGlassPanel(ctx, bx - 36, by - 16, 72, 32, GLASS.radiusSmall);
        if (isHov) {
            // 选中描边（绿）
            ctx.save();
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(bx - 36, by - 16, 72, 32, GLASS.radiusSmall);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = isHov ? GLASS.textPrimary : GLASS.textDim;
        ctx.fillText(`[${i + 1}] 据点`, bx, by);
    }
    ctx.restore();
}

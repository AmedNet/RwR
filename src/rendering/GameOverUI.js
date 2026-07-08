// src/rendering/GameOverUI.js
import { GameState } from '../core/GameState.js';

const MAP_W = 360;
const MAP_H = 260;
const MAP_PAD = 12;

export function drawGameOver(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;
    const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
    const allPoints = GameState.capturePoints;
    const worldW = GameState.config.world.width;
    const worldH = GameState.config.world.height;

    // ---- 永久战败 ----
    if (GameState.permanentDefeat) {
        ctx.save();
        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 56px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u{1F480} \u6218\u8D25', W / 2, H / 2 - 40);
        ctx.fillStyle = '#ccc';
        ctx.font = '22px sans-serif';
        ctx.fillText('\u6240\u6709\u53CB\u65B9\u5355\u4F4D\u5DF2\u9635\u4EA1\uFF0C\u6E38\u620F\u7ED3\u675F', W / 2, H / 2 + 10);
        const rank = GameState.player ? GameState.player.getRankName() : '\u5217\u5175';
        ctx.fillStyle = '#ff9800';
        ctx.font = '18px sans-serif';
        ctx.fillText(`\u6700\u7EC8\u519B\u8854: ${rank}  |  \u51FB\u6740: ${GameState.kills}  |  \u5F97\u5206: ${GameState.score}`, W / 2, H / 2 + 55);
        ctx.restore();
        return;
    }

    // ---- 普通阵亡：带战术地图的复活选择 ----
    ctx.save();

    // 顶部标题 + 统计
    ctx.fillStyle = '#ff1744';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u9635\u4EA1', W / 2, 48);

    const rank = GameState.player ? GameState.player.getRankName() : '\u5217\u5175';
    ctx.fillStyle = '#ddd';
    ctx.font = '18px sans-serif';
    ctx.fillText(`\u519B\u8854: ${rank}   |   \u51FB\u6740: ${GameState.kills}   |   \u5F97\u5206: ${GameState.score}`, W / 2, 85);

    // ---- 战术地图 ----
    const mapX = (W - MAP_W) / 2;
    const mapY = 110;
    const scaleX = (MAP_W - MAP_PAD * 2) / worldW;
    const scaleY = (MAP_H - MAP_PAD * 2) / worldH;
    const scale = Math.min(scaleX, scaleY);
    const drawW = worldW * scale;
    const drawH = worldH * scale;
    const ox = mapX + (MAP_W - drawW) / 2;
    const oy = mapY + (MAP_H - drawH) / 2;

    // 地图背景
    ctx.fillStyle = 'rgba(20, 30, 20, 0.85)';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.fillRect(mapX, mapY, MAP_W, MAP_H);
    ctx.strokeRect(mapX, mapY, MAP_W, MAP_H);

    // 地图标题
    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u9009\u62E9\u590D\u6D3B\u636E\u70B9 \u2014 \u70B9\u51FB\u6216\u6309\u6570\u5B57\u952E', W / 2, mapY + MAP_H + 18);

    // 绘制所有据点
    GameState.respawnHitAreas = [];
    const hoverIdx = GameState.gameOverSelectedPoint;
    let playerIdx = 0;

    for (const pt of allPoints) {
        const px = ox + pt.x * scale;
        const py = oy + pt.y * scale;
        const isPlayer = pt.owner === 'player';
        const isEnemy = pt.owner === 'enemy';

        const baseR = 8;
        let color = '#666';
        if (isPlayer) color = '#4CAF50';
        else if (isEnemy) color = '#f44336';

        // 检测鼠标悬浮
        const mx = GameState.mouse.x;
        const my = GameState.mouse.y;
        const dist = Math.hypot(mx - px, my - py);
        const isHover = dist < baseR + 6;

        if (isPlayer) {
            // 悬浮/选中高亮
            if (isHover || hoverIdx === playerIdx) {
                GameState.gameOverSelectedPoint = playerIdx;
                // 脉冲光圈
                ctx.beginPath();
                ctx.arc(px, py, baseR + 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(76, 175, 80, 0.25)';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(px, py, baseR, 0, Math.PI * 2);
            ctx.fillStyle = (isHover || hoverIdx === playerIdx) ? '#66BB6A' : color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 编号
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${playerIdx + 1}`, px, py);

            // 存储热区
            GameState.respawnHitAreas.push({ x: px, y: py, r: baseR + 6, index: playerIdx });
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
        const hpx = ox + hp.x * scale;
        const hpy = oy + hp.y * scale;
        ctx.fillStyle = '#fff';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`\u636E\u70B9 #${hoverIdx + 1}`, hpx, hpy + 14);
    }

    // ---- 底部据点列表（紧凑横排）----
    const listY = mapY + MAP_H + 40;
    if (playerPoints.length > 0) {
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < playerPoints.length; i++) {
            const bx = W / 2 + (i - (playerPoints.length - 1) / 2) * 90;
            const by = listY;
            const isHov = hoverIdx === i;

            ctx.fillStyle = isHov ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.08)';
            ctx.fillRect(bx - 36, by - 14, 72, 28);
            ctx.strokeStyle = isHov ? '#4CAF50' : 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx - 36, by - 14, 72, 28);

            ctx.fillStyle = isHov ? '#fff' : '#aaa';
            ctx.fillText(`[${i + 1}] \u636E\u70B9`, bx, by);
        }
    } else {
        ctx.fillStyle = '#ff9800';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u26A0\uFE0F \u65E0\u5DF1\u65B9\u636E\u70B9\uFF01\u6218\u53CB\u5168\u706D\u5373\u8D25\uFF01', W / 2, listY);
    }

    ctx.restore();
}

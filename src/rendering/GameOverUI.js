// src/rendering/GameOverUI.js
import { GameState } from '../core/GameState.js';

export function drawGameOver(ctx, renderer) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, renderer.width, renderer.height);

    // 永久战败（无据点可复活）
    if (GameState.permanentDefeat) {
        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 56px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀 战败', renderer.width/2, renderer.height/2 - 60);
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.fillText('所有据点已失守，游戏结束', renderer.width/2, renderer.height/2);
        ctx.fillStyle = '#ff9800';
        ctx.font = '20px sans-serif';
        const rank = GameState.player ? GameState.player.getRankName() : '列兵';
        ctx.fillText(`最终军衔: ${rank}  |  击杀: ${GameState.kills}  |  得分: ${GameState.score}`, renderer.width/2, renderer.height/2 + 50);
        ctx.restore();
        return;
    }

    ctx.fillStyle = '#ff1744';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('阵亡', renderer.width/2, renderer.height/2 - 120);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    const rank = GameState.player ? GameState.player.getRankName() : '列兵';
    ctx.fillText(`军衔: ${rank}  |  击杀: ${GameState.kills}  |  得分: ${GameState.score}`, renderer.width/2, renderer.height/2 - 60);

    // 列出己方据点供选择
    const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('选择复活据点:', renderer.width/2, renderer.height/2 - 10);

    if (playerPoints.length > 0) {
        ctx.font = '20px sans-serif';
        for (let i = 0; i < playerPoints.length; i++) {
            const p = playerPoints[i];
            const y = renderer.height/2 + 30 + i * 40;
            ctx.fillStyle = '#4CAF50';
            ctx.fillText(`[${i + 1}]`, renderer.width/2 - 120, y);
            ctx.fillStyle = '#fff';
            ctx.fillText(`据点 #${i + 1}  (${Math.round(p.x)}, ${Math.round(p.y)})`, renderer.width/2 - 60, y);
        }
    } else {
        ctx.fillStyle = '#ff9800';
        ctx.font = '20px sans-serif';
        ctx.fillText('⚠️ 无己方据点！失守即败！', renderer.width/2, renderer.height/2 + 30);
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('按数字键 1-6 选择据点复活', renderer.width/2, renderer.height/2 + 30 + Math.max(playerPoints.length, 1) * 40 + 20);
    ctx.restore();
}
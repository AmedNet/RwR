// src/rendering/InventoryUI.js
import { GameState } from '../core/GameState.js';

export function drawInventory(ctx, renderer) {
    ctx.save();

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, renderer.width, renderer.height);

    // 标题
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎒 背包', renderer.width / 2, 80);

    // 玩家信息
    const player = GameState.player;
    if (player) {
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.fillText(`军衔: ${player.getRankName()}`, renderer.width / 2, 140);

        // 血量条
        const barWidth = 300;
        const barHeight = 30;
        const barX = renderer.width / 2 - barWidth / 2;
        const barY = 170;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpPercent = player.health / player.maxHealth;
        ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : (hpPercent > 0.3 ? '#FFC107' : '#f44336');
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`${Math.floor(player.health)} / ${player.maxHealth}`, renderer.width / 2, barY + barHeight / 2);
    }

    // RP值
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`💰 RP: ${GameState.rp}`, renderer.width / 2, 240);

    // 背包格子
    const slotSize = 80;
    const slotGap = 20;
    const slotsPerRow = 4;
    const startX = renderer.width / 2 - (slotsPerRow * slotSize + (slotsPerRow - 1) * slotGap) / 2;
    const startY = 300;

    for (let i = 0; i < 4; i++) {
        const row = Math.floor(i / slotsPerRow);
        const col = i % slotsPerRow;
        const x = startX + col * (slotSize + slotGap);
        const y = startY + row * (slotSize + slotGap);

        // 格子背景
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, slotSize, slotSize);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, slotSize, slotSize);

        // 物品
        const item = GameState.inventory[i];
        if (item) {
            // 武器缩略图
            const invImg = renderer.getWeaponImage(item.id);
            if (invImg) {
                const invH = 50;
                const invScale = invH / invImg.naturalHeight;
                const invW = invImg.naturalWidth * invScale;
                ctx.drawImage(invImg, x + slotSize / 2 - invW / 2, y + slotSize / 2 - invH / 2 - 5, invW, invH);
            } else {
                ctx.font = '36px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.config.type === 'grenade' ? '💣' : '🔫', x + slotSize / 2, y + slotSize / 2);
            }
            // 武器名称
            ctx.fillStyle = '#aaa';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(item.config.name, x + slotSize / 2, y + slotSize - 4);
            // 弹药数
            if (item.config.type !== 'melee') {
                ctx.fillStyle = item.ammo === 0 ? '#ff5252' : 'rgba(255,255,255,0.7)';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText(`${item.ammo}`, x + slotSize - 4, y + 4);
            }
        } else {
            // 空槽位编号
            ctx.fillStyle = '#666';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`[${i + 1}]`, x + slotSize / 2, y + slotSize / 2);
        }
    }

    // 底部提示
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('按 Q 关闭背包', renderer.width / 2, startY + 120);

    ctx.restore();
}
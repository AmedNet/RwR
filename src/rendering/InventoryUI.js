// src/rendering/InventoryUI.js
import { GameState } from '../core/GameState.js';
import { RARITY_COLORS, RARITY_NAMES } from '../core/LootRegistry.js';

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
    ctx.fillText('\u{1F392} \u80CC\u5305', renderer.width / 2, 80);

    // 玩家信息
    const player = GameState.player;
    if (player) {
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.fillText(`\u519B\u8854: ${player.getRankName()}`, renderer.width / 2, 140);

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
    ctx.fillText(`\u{1F4B0} RP: ${GameState.rp}`, renderer.width / 2, 240);

    // 背包格子
    const slotSize = 80;
    const slotGap = 20;
    const slotsPerRow = 4;
    const startX = renderer.width / 2 - (slotsPerRow * slotSize + (slotsPerRow - 1) * slotGap) / 2;
    const startY = 300;

    // 记录每个格子的屏幕坐标，用于鼠标点击检测
    GameState.inventoryHitAreas = [];

    for (let i = 0; i < 7; i++) {
        const row = Math.floor(i / slotsPerRow);
        const col = i % slotsPerRow;
        const x = startX + col * (slotSize + slotGap);
        const y = startY + row * (slotSize + slotGap);

        const item = GameState.inventory[i];
        const isLoot = item && item.isLoot;
        const isSelected = i === GameState.inventorySelectedSlot;

        // 格子背景
        ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.18)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, slotSize, slotSize);

        // 边框颜色：战利品用稀有度颜色，武器用默认灰色
        if (isLoot) {
            ctx.strokeStyle = RARITY_COLORS[item.config.rarity] || '#666';
            ctx.lineWidth = isSelected ? 3 : 2;
        } else {
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
        }
        ctx.strokeRect(x, y, slotSize, slotSize);

        if (item) {
            if (isLoot) {
                // === 战利品渲染 ===
                // 大 emoji
                ctx.font = '36px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.config.emoji, x + slotSize / 2, y + slotSize / 2 - 5);

                // 物品名称（稀有度颜色）
                ctx.fillStyle = RARITY_COLORS[item.config.rarity] || '#aaa';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(item.config.name, x + slotSize / 2, y + slotSize - 4);

                // 右下角显示价值
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText(`$${item.config.value}`, x + slotSize - 4, y + 4);

                // 稀有度标签（左上角）
                ctx.fillStyle = RARITY_COLORS[item.config.rarity] || '#999';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(RARITY_NAMES[item.config.rarity] || '', x + 4, y + 4);
            } else {
                // === 武器渲染（原有逻辑） ===
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
                    ctx.fillText(item.config.type === 'grenade' ? '\u{1F4A3}' : '\u{1F52B}', x + slotSize / 2, y + slotSize / 2);
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
            }
        } else {
            // 空槽位编号
            ctx.fillStyle = '#666';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`[${i + 1}]`, x + slotSize / 2, y + slotSize / 2);
        }

        // 记录热区
        GameState.inventoryHitAreas.push({ x, y, w: slotSize, h: slotSize, index: i });
    }

    // 选中物品的详情/操作提示
    const totalRows = Math.ceil(7 / slotsPerRow);
    const slotsBottomY = startY + totalRows * (slotSize + slotGap);
    const selected = GameState.inventory[GameState.inventorySelectedSlot];

    if (selected) {
        if (selected.isLoot) {
            // 战利品详情
            const detailY = slotsBottomY + 10;
            // 描述文字
            ctx.fillStyle = '#ccc';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`"${selected.config.description}"`, renderer.width / 2, detailY);
            // 操作提示
            ctx.fillStyle = '#ff9800';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(`[D] \u4E22\u5F03 ${selected.config.name}    [\u53F3\u952E] \u4E22\u5F03\u5230\u811A\u4E0B`, renderer.width / 2, detailY + 24);
        } else {
            // 武器操作提示
            ctx.fillStyle = '#ff9800';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`[D] \u4E22\u5F03 ${selected.config.name}`, renderer.width / 2, slotsBottomY + 20);
        }
    }

    // 底部提示
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u6309 Q \u5173\u95ED\u80CC\u5305   \u70B9\u51FB\u683C\u5B50\u9009\u4E2D   D \u4E22\u5F03', renderer.width / 2, slotsBottomY + 50);

    ctx.restore();
}

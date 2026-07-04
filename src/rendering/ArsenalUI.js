// src/rendering/ArsenalUI.js
import { GameState } from '../core/GameState.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';

export function drawArsenalShop(ctx, renderer) {
    ctx.save();

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, renderer.width, renderer.height);

    // 标题
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔫 军械库', renderer.width / 2, 60);

    // RP 显示
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`💰 RP: ${GameState.rp}`, renderer.width / 2, 110);

    // --- 购买区 ---
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('━━━ 购买 ━━━', renderer.width / 2, 155);

    // 获取所有可购买商品
    const shopItems = Object.entries(WeaponRegistry).filter(([, config]) => config.buyPrice > 0);
    const itemX = renderer.width / 2;
    const itemW = 400;
    const itemH = 80;
    const rowGap = 15;
    const listTop = 190;
    const listViewportHeight = 280;
    const listBottom = listTop + listViewportHeight;
    const scrollOffset = GameState.arsenalScrollOffset || 0;
    const totalItemsHeight = shopItems.length * (itemH + rowGap);
    const maxScroll = Math.max(0, totalItemsHeight - listViewportHeight);

    // 限制滚动范围
    GameState.arsenalScrollOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
    const clampedScroll = GameState.arsenalScrollOffset;

    // 裁剪列表区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(itemX - itemW / 2 - 10, listTop, itemW + 20, listViewportHeight);
    ctx.clip();

    shopItems.forEach(([id, config], index) => {
        const itemY = listTop + index * (itemH + rowGap) - clampedScroll;
        const isSelected = index === GameState.arsenalSelectedIndex;

        // 跳过不在可视区域内的项
        if (itemY + itemH < listTop || itemY > listBottom) return;

        // 选中高亮边框
        if (isSelected) {
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 3;
            ctx.strokeRect(itemX - itemW / 2, itemY, itemW, itemH);
        }

        // 商品背景
        ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(itemX - itemW / 2, itemY, itemW, itemH);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(itemX - itemW / 2, itemY, itemW, itemH);

        // 武器贴图
        const shopImg = renderer.getWeaponImage(id);
        if (shopImg) {
            const shopH = 50;
            const shopScale = shopH / shopImg.naturalHeight;
            const shopW = shopImg.naturalWidth * shopScale;
            ctx.drawImage(shopImg, itemX - 170 - shopW / 2, itemY + itemH / 2 - shopH / 2, shopW, shopH);
        } else {
            ctx.font = '36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.type === 'grenade' ? '💣' : '🔫', itemX - 170, itemY + itemH / 2);
        }

        // 名称
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(config.name, itemX - 120, itemY + 32);
        ctx.fillStyle = '#aaa';
        ctx.font = '14px sans-serif';
        let typeText;
        if (config.type === 'grenade') {
            typeText = `装填 ${config.magSize} 发 | 手雷`;
        } else if (config.type === 'medical') {
            typeText = `数量 ${config.magSize} | 医疗用品`;
        } else if (config.type === 'pistol') {
            typeText = `弹容量 ${config.magSize} | 手枪`;
        } else {
            typeText = `弹容量 ${config.magSize} | 步枪`;
        }
        ctx.fillText(typeText, itemX - 120, itemY + 58);

        // 价格
        ctx.fillStyle = GameState.rp >= config.buyPrice ? '#FFD700' : '#ff5252';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`💰 ${config.buyPrice}`, itemX + 170, itemY + 30);

        // 选中指示器
        if (isSelected) {
            ctx.fillStyle = '#4CAF50';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('▶', itemX - itemW / 2 + 10, itemY + itemH / 2);
        }
    });

    ctx.restore(); // 恢复裁剪

    // 滚动指示器
    if (maxScroll > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        if (clampedScroll > 0) {
            ctx.fillText('▲ 更多商品', renderer.width / 2, listTop - 5);
        }
        if (clampedScroll < maxScroll) {
            ctx.fillText('▼ 更多商品', renderer.width / 2, listBottom + 15);
        }
    }

    // --- 出售区（固定底部）---
    const sellSectionY = listBottom + 30;
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('━━━ 出售 ━━━', renderer.width / 2, sellSectionY);

    // 选择背包位置的提示
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('当前选中: 背包第 ' + (GameState.arsenalSelectedSlot + 1) + ' 格', itemX, sellSectionY + 35);

    // 背包7格显示（自适应屏幕宽度）
    const maxSlotWidth = 90;
    const slotGap = 15;
    const totalWidthNeeded = 7 * maxSlotWidth + 6 * slotGap;
    const availableWidth = Math.min(renderer.width - 40, totalWidthNeeded);
    const slotSize = Math.floor((availableWidth - 6 * slotGap) / 7);
    const slotStartX = itemX - (7 * slotSize + 6 * slotGap) / 2;
    const slotStartY = sellSectionY + 60;

    for (let i = 0; i < 7; i++) {
        const sx = slotStartX + i * (slotSize + slotGap);
        const isSelected = i === GameState.arsenalSelectedSlot;

        ctx.fillStyle = isSelected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(sx, slotStartY, slotSize, slotSize);
        ctx.strokeStyle = isSelected ? '#4CAF50' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.strokeRect(sx, slotStartY, slotSize, slotSize);

        const weapon = GameState.inventory[i];
        if (weapon) {
            // 武器缩略图
            const sImg = renderer.getWeaponImage(weapon.id);
            if (sImg) {
                const sH = 50;
                const sScale = sH / sImg.naturalHeight;
                const sW = sImg.naturalWidth * sScale;
                ctx.drawImage(sImg, sx + slotSize / 2 - sW / 2, slotStartY + 8, sW, sH);
            } else {
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(weapon.config.type === 'grenade' ? '💣' : '🔫', sx + slotSize / 2, slotStartY + slotSize / 2 - 10);
            }
            ctx.fillStyle = '#aaa';
            ctx.font = '12px sans-serif';
            ctx.fillText(weapon.config.name, sx + slotSize / 2, slotStartY + slotSize - 15);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = '14px sans-serif';
            ctx.fillText('空', sx + slotSize / 2, slotStartY + slotSize / 2);
        }

        // 快捷键
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px sans-serif';
        ctx.fillText(`[${i + 1}]`, sx + 10, slotStartY + 15);
    }

    // 出售按钮
    const selectedWeapon = GameState.inventory[GameState.arsenalSelectedSlot];
    if (selectedWeapon && selectedWeapon.config.sellPrice > 0) {
        ctx.fillStyle = '#ff9800';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`[S] 出售 ${selectedWeapon.config.name} 获得 💰${selectedWeapon.config.sellPrice}`, itemX, slotStartY + slotSize + 35);
    } else {
        ctx.fillStyle = '#666';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('选中空槽或无出售价值', itemX, slotStartY + slotSize + 35);
    }

    // 底部提示
    ctx.fillStyle = '#aaa';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↑↓ 选择商品 | 1-7 选择背包格 | B 购买 | S 出售 | E 关闭', renderer.width / 2, renderer.height - 30);

    ctx.restore();
}
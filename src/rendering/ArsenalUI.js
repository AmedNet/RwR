// src/rendering/ArsenalUI.js
import { GameState } from '../core/GameState.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { RARITY_COLORS, RARITY_NAMES } from '../core/LootRegistry.js';

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// 7个细分分类
const CATEGORIES = [
    { name: '手枪', color: '#78909C', types: ['pistol'] },
    { name: '步枪', color: '#4CAF50', types: ['rifle'] },
    { name: '冲锋枪', color: '#8BC34A', types: ['smg'] },
    { name: '霰弹枪', color: '#FF9800', types: ['shotgun'] },
    { name: '狙击枪', color: '#2196F3', types: ['sniper'] },
    { name: '重武器', color: '#f44336', types: ['launcher'] },
    { name: '其他', color: '#9E9E9E', types: ['melee', 'grenade', 'medical'] }
];

// 获取武器类型的中文名称
function getTypeName(type) {
    const names = {
        rifle: '步枪', smg: '冲锋枪', shotgun: '霰弹枪',
        sniper: '狙击枪', pistol: '手枪',
        grenade: '手雷', launcher: '重武器', medical: '医疗',
        melee: '近战'
    };
    return names[type] || type;
}

// 绘制战术角标（HUD风格装饰）
function drawCornerBrackets(ctx, x, y, w, h, color, size = 12) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + size); ctx.lineTo(x, y); ctx.lineTo(x + size, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - size, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + h - size); ctx.lineTo(x, y + h); ctx.lineTo(x + size, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - size, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - size);
    ctx.stroke();
}

// 获取当前分类的商品列表
function getCategoryItems(categoryIndex) {
    const cat = CATEGORIES[categoryIndex];
    return Object.entries(WeaponRegistry).filter(([, config]) =>
        config.buyPrice >= 0 && cat.types.includes(config.type)
    );
}

export function drawArsenalShop(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;
    const cx = W / 2;

    ctx.save();

    // === 背景 ===
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, 'rgba(10, 15, 25, 0.92)');
    bgGrad.addColorStop(1, 'rgba(5, 10, 20, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 扫描线效果
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (let y = 0; y < H; y += 4) {
        ctx.fillRect(0, y, W, 1);
    }

    // === 标题区 ===
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A R S E N A L', cx, 32);

    // RP显示（右上角）
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`RP: ${GameState.rp}`, W - 30, 32);

    // === 布局参数 ===
    const sideBarW = 100;
    const sideBarTop = 60;
    const sideBarItemH = 36;
    const sideBarGap = 4;

    // 商品列表（居中于屏幕）
    const listW = Math.min(W - sideBarW - 90, 420);
    const listX = (W - listW) / 2;
    // 侧边栏贴着列表左侧
    const sideBarX = listX - sideBarW;
    const rightAreaCenterX = listX + listW / 2;
    const listTop = sideBarTop;
    const listH = 300;
    const itemH = 64;
    const rowGap = 5;

    // === 左侧分类侧边栏 ===
    CATEGORIES.forEach((cat, i) => {
        const ty = sideBarTop + i * (sideBarItemH + sideBarGap);
        const isActive = i === GameState.arsenalCategory;

        // 标签背景
        if (isActive) {
            ctx.fillStyle = cat.color + '33';
            ctx.fillRect(sideBarX, ty, sideBarW, sideBarItemH);
            // 左侧指示条
            ctx.fillStyle = cat.color;
            ctx.fillRect(sideBarX, ty, 3, sideBarItemH);
            // 发光
            ctx.shadowColor = cat.color;
            ctx.shadowBlur = 6;
            ctx.fillRect(sideBarX, ty, 3, sideBarItemH);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(sideBarX, ty, sideBarW, sideBarItemH);
        }

        // 边框
        ctx.strokeStyle = isActive ? cat.color + 'aa' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = isActive ? 1.5 : 0.5;
        ctx.strokeRect(sideBarX, ty, sideBarW, sideBarItemH);

        // 文字
        ctx.fillStyle = isActive ? '#fff' : 'rgba(255,255,255,0.45)';
        ctx.font = `${isActive ? 'bold ' : ''}13px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cat.name, sideBarX + sideBarW / 2, ty + sideBarItemH / 2);
    });

    // === 右侧商品列表区 ===
    // 列表背景面板
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(listX, listTop, listW, listH);
    drawCornerBrackets(ctx, listX, listTop, listW, listH, 'rgba(255,255,255,0.15)', 12);

    // 获取当前分类商品
    const items = getCategoryItems(GameState.arsenalCategory);
    const catColor = CATEGORIES[GameState.arsenalCategory].color;

    // 限制滚动
    const totalItemsH = items.length * (itemH + rowGap);
    const maxScroll = Math.max(0, totalItemsH - listH + 10);
    GameState.arsenalScrollOffset = Math.max(0, Math.min(GameState.arsenalScrollOffset || 0, maxScroll));
    const scroll = GameState.arsenalScrollOffset;

    // 限制选中索引
    if (GameState.arsenalSelectedIndex >= items.length) {
        GameState.arsenalSelectedIndex = Math.max(0, items.length - 1);
    }

    // 裁剪区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listTop, listW, listH);
    ctx.clip();

    items.forEach(([id, config], index) => {
        const iy = listTop + 6 + index * (itemH + rowGap) - scroll;
        const isSelected = index === GameState.arsenalSelectedIndex;

        if (iy + itemH < listTop || iy > listTop + listH) return;

        // 商品卡片背景
        if (isSelected) {
            ctx.fillStyle = catColor + '18';
            ctx.fillRect(listX + 6, iy, listW - 12, itemH);
            ctx.fillStyle = catColor;
            ctx.fillRect(listX + 6, iy, 3, itemH);
            ctx.shadowColor = catColor;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = catColor + '88';
            ctx.lineWidth = 1;
            ctx.strokeRect(listX + 6, iy, listW - 12, itemH);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(listX + 6, iy, listW - 12, itemH);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(listX + 6, iy, listW - 12, itemH);
        }

        // 武器贴图
        const imgAreaX = listX + 16;
        const shopImg = renderer.getWeaponImage(id);
        if (shopImg) {
            const maxImgH = 38;
            const maxImgW = 75;
            const scale = Math.min(maxImgH / shopImg.naturalHeight, maxImgW / shopImg.naturalWidth);
            const drawW = shopImg.naturalWidth * scale;
            const drawH = shopImg.naturalHeight * scale;
            ctx.drawImage(shopImg, imgAreaX + (maxImgW - drawW) / 2, iy + (itemH - drawH) / 2, drawW, drawH);
        }

        // 武器名称
        const textX = listX + 100;
        ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(config.name, textX, iy + 8);

        // 武器信息行
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '11px sans-serif';
        let info = getTypeName(config.type);
        if (config.type === 'launcher') {
            info += ` \u00B7 堆叠${config.maxStack}`;
        } else if (config.type === 'grenade' || config.type === 'medical') {
            info += ` \u00B7 堆叠${config.magSize}`;
        } else if (config.magSize) {
            info += ` \u00B7 弹容${config.magSize}`;
        }
        ctx.fillText(info, textX, iy + 28);

        // 伤害信息
        if (config.damage) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '10px sans-serif';
            ctx.fillText(`DMG: ${config.damage}`, textX, iy + 44);
        }

        // 价格（右侧）
        const priceX = listX + listW - 18;
        const canAfford = GameState.rp >= config.buyPrice;
        ctx.fillStyle = canAfford ? '#FFD700' : '#ff5252';
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.buyPrice === 0 ? '免费' : `$${config.buyPrice}`, priceX, iy + itemH / 2);
    });

    ctx.restore(); // 恢复裁剪

    // 滚动指示
    if (maxScroll > 0) {
        const scrollBarH = Math.max(20, listH * (listH / totalItemsH));
        const scrollBarY = listTop + (scroll / maxScroll) * (listH - scrollBarH);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(listX + listW - 4, scrollBarY, 3, scrollBarH);
    }

    // === 背包区域（与列表居中对齐） ===
    const invY = listTop + listH + 16;

    // 分隔线
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(listX, invY - 6); ctx.lineTo(listX + listW, invY - 6);
    ctx.stroke();

    // INVENTORY 标签
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('I N V E N T O R Y', rightAreaCenterX, invY + 4);

    // 背包格子（居中于右侧区域）
    const slotSize = 52;
    const slotGap = 6;
    const totalSlotsW = 7 * slotSize + 6 * slotGap;
    const slotStartX = rightAreaCenterX - totalSlotsW / 2;
    const slotY = invY + 18;

    for (let i = 0; i < 7; i++) {
        const sx = slotStartX + i * (slotSize + slotGap);
        const isSlotSel = i === GameState.arsenalSelectedSlot;
        const weapon = GameState.inventory[i];
        const isLootItem = weapon && weapon.isLoot;

        ctx.fillStyle = isSlotSel ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(sx, slotY, slotSize, slotSize);

        if (isSlotSel) {
            ctx.shadowColor = isLootItem ? (RARITY_COLORS[weapon.config.rarity] || catColor) : catColor;
            ctx.shadowBlur = 6;
            ctx.strokeStyle = isLootItem ? (RARITY_COLORS[weapon.config.rarity] || catColor) : catColor;
            ctx.lineWidth = 1.5;
        } else if (isLootItem) {
            ctx.strokeStyle = hexToRgba(RARITY_COLORS[weapon.config.rarity] || '#ffffff', 0.53) || 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 0.5;
        }
        ctx.strokeRect(sx, slotY, slotSize, slotSize);
        ctx.shadowBlur = 0;
        if (weapon) {
            const sImg = renderer.getWeaponImage(weapon.id);
            if (sImg) {
                const sH = 30;
                const sScale = sH / sImg.naturalHeight;
                const sW = sImg.naturalWidth * sScale;
                ctx.drawImage(sImg, sx + slotSize / 2 - sW / 2, slotY + 4, sW, sH);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(weapon.config.name, sx + slotSize / 2, slotY + slotSize - 2);

            // 堆叠数
            if (weapon.config.maxStack && weapon.config.maxStack > 1) {
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText(`${weapon.stackCount}`, sx + slotSize - 3, slotY + 2);
            }
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('-', sx + slotSize / 2, slotY + slotSize / 2);
        }

        // 快捷键编号
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${i + 1}`, sx + 3, slotY + 3);
    }

    // 出售提示
    const selWeapon = GameState.inventory[GameState.arsenalSelectedSlot];
    const sellY = slotY + slotSize + 10;
    if (selWeapon && selWeapon.isLoot) {
        // 战利品出售
        ctx.fillStyle = '#ff9800';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`[X] 出售 ${selWeapon.config.name} \u2192 +$${selWeapon.config.value}`, rightAreaCenterX, sellY);
    } else if (selWeapon && selWeapon.config.sellPrice > 0) {
        ctx.fillStyle = '#ff9800';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`[X] 出售 ${selWeapon.config.name} \u2192 +$${selWeapon.config.sellPrice}`, rightAreaCenterX, sellY);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('选中空槽或无法出售', rightAreaCenterX, sellY);
    }

    // === 底部操作提示 ===
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u2191/\u2193 分类   W/S 选择   1-7 背包   B 购买   X 出售   E 关闭', cx, H - 16);

    ctx.restore();
}
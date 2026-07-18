// src/rendering/ArsenalUI.js
import { GameState } from '../core/GameState.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { RARITY_COLORS, RARITY_NAMES } from '../core/LootRegistry.js';
import { GLASS, easeOutCubic, drawGlassPanel } from './GlassUI.js';

// 毛玻璃统一字体（标题保留等宽字作军事终端味锚点）
const FONT = '-apple-system, "SF Pro Display", sans-serif';
const MONO = '"Courier New", monospace';

// 打开收尾带轻微回弹（比背包的 easeOutCubic 更有力量感），关闭用 easeOutCubic 干净收落
const easeOutBack = t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

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

    // === 动画进度推进（自驱， jederzeit 与背包同结构） ===
    const now = performance.now();
    if (GameState._arsenalAnimLastTime == null) GameState._arsenalAnimLastTime = now;
    const deltaTime = (now - GameState._arsenalAnimLastTime) / 1000;
    GameState._arsenalAnimLastTime = now;
    const dt = Math.min(deltaTime, 0.05); // 防停顿后跳变

    const isClosingDir = GameState.arsenalAnimDirection === 'closing';
    const ANIM_SPEED_PER_SEC = isClosingDir ? 4.4 : 3.6; // 关包 ~0.23s / 开包 ~0.28s

    if (GameState.arsenalAnimDirection === 'opening') {
        GameState.arsenalAnimProgress = Math.min(1, GameState.arsenalAnimProgress + ANIM_SPEED_PER_SEC * dt);
        if (GameState.arsenalAnimProgress >= 1) GameState.arsenalAnimDirection = null;
    } else if (GameState.arsenalAnimDirection === 'closing') {
        GameState.arsenalAnimProgress = Math.max(0, GameState.arsenalAnimProgress - ANIM_SPEED_PER_SEC * dt);
        if (GameState.arsenalAnimProgress <= 0) {
            GameState.arsenalOpen = false;
            GameState.arsenalAnimDirection = null;
            GameState._arsenalAnimLastTime = null;
            return;
        }
    }

    const rawP = GameState.arsenalAnimProgress;
    // 打开含轻微回弹，关闭/静态用 easeOutCubic 干净收落
    const p = GameState.arsenalAnimDirection === 'opening'
        ? easeOutBack(rawP)
        : easeOutCubic(rawP);

    // === 面板变换：缩放 + 上浮 + 淡入，绕屏幕中心 ===
    // SPACE_SCALE：在开/关动画 scale 之上再乘，整体放大到舒适尺寸（约 1.5× 线性 = 2.25× 面积）
    const SPACE_SCALE = 1.1;
    const scale = (0.92 + 0.08 * p) * SPACE_SCALE;
    const offsetY = (1 - p) * 24;
    const alphaFactor = Math.max(0, Math.min(1, p));

    ctx.save();
    ctx.translate(cx, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -H / 2 + offsetY);
    ctx.globalAlpha = alphaFactor;

    // === 布局参数（大幅放大，避免拥挤） ===
    const sideBarW = 130;
    const sideBarItemH = 44;
    const sideBarGap = 6;
    const sideBarGroupGap = 12; // 侧边栏 与 列表 之间的缝隙

    // 商品列表宽度
    const listW = 640;
    // [侧边栏 + 列表] 作为一组整体横向居中（不再让侧边栏贴在单独居中的列表左侧导致重心偏左）
    const groupW = sideBarW + sideBarGroupGap + listW;
    const groupX = cx - groupW / 2;
    const sideBarX = groupX;
    const listX = groupX + sideBarW + sideBarGroupGap;
    const rightAreaCenterX = listX + listW / 2; // 背包行 / INVENTORY 标签 / 出售提示 居中参考

    const slotSize = 72;
    const slotGap = 8;
    const totalSlotsW = 7 * slotSize + 6 * slotGap;
    const slotStartX = rightAreaCenterX - totalSlotsW / 2;

    const itemH = 76;
    const rowGap = 6;

    // === 固定尺寸卡片，绕屏幕几何中心居中（横向 + 纵向都真正居中）===
    const headerH = 56;       // 顶栏：标题 + RP
    const innerPad = 20;      // 卡片内边距
    // 卡片宽 = 整组宽 + 左右内边距
    const cardW = groupW + innerPad * 2;
    // 卡片高 = 顶栏 + 侧边栏与列表区 + 分隔 + INVENTORY标签 + 背包行 + 出售 + 底部提示 + 底内边距
    const listOfCats = 7;
    const catBlockH = listOfCats * sideBarItemH + (listOfCats - 1) * sideBarGap;
    const listH = Math.max(catBlockH, 360); // 列表高度与侧边栏等高，整齐
    const contentTopToBottom = listH + 16 /*分隔间隔*/ + 24 /*INVENTORY标签*/ + slotSize + 20 /*出售行基线离背包底*/ + 32 /*出售行到底部提示间距*/;
    const cardH = headerH + innerPad + contentTopToBottom + innerPad;

    const cardX = cx - cardW / 2;
    const cardY = (H / 2) - cardH / 2;
    const cardRight = cardX + cardW;

    // 内容区起点：卡片内顶栏之下 + 内边距
    const contentTop = cardY + headerH + innerPad;
    const sideBarTopC = contentTop;
    const listTop = contentTop;
    const invY = listTop + listH + 16;
    const slotY = invY + 24;          // INVENTORY 标签行预留
    const sellY = slotY + slotSize + 20; // 出售行基线离背包底 20px
    const footerY = sellY + 32;        // 底部提示在出售行之下 32px，稳定不重叠

    // 容器卡片染色层（毛玻璃感的全屏模糊底由 Renderer 分支 _drawBlurBackgroundAlpha 在无变换层提供；
    // 这里 scale 变换层下只做染色/边框，不调 _drawBlurRegion 以免被局部变换导致模糊失真，与背包 drawInventory 同处理）
    drawGlassPanel(ctx, cardX, cardY, cardW, cardH, GLASS.radius);

    // === 顶栏：标题 + RP（都进卡片内，RP 放卡片右侧彻底避开右上小地图）===
    // 标题：顶栏内部，左半
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `bold 34px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('A R S E N A L', cardX + innerPad, cardY + headerH / 2);
    // RP：顶栏内部，卡片右侧（不贴屏幕右沿，避开小地图）
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold 22px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(`RP: ${GameState.rp}`, cardRight - innerPad, cardY + headerH / 2);
    // 顶栏与内容分隔线
    ctx.strokeStyle = GLASS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + innerPad, cardY + headerH);
    ctx.lineTo(cardRight - innerPad, cardY + headerH);
    ctx.stroke();

    // === 左侧分类侧边栏 ===
    CATEGORIES.forEach((cat, i) => {
        const ty = sideBarTopC + i * (sideBarItemH + sideBarGap);
        const isActive = i === GameState.arsenalCategory;

        // 毛玻璃底板（静态，不随选中滑动）
        drawGlassPanel(ctx, sideBarX, ty, sideBarW, sideBarItemH, GLASS.radiusSmall);

        // 文字
        ctx.fillStyle = isActive ? GLASS.textPrimary : GLASS.textDim;
        ctx.font = `${isActive ? '600 ' : ''}14px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cat.name, sideBarX + sideBarW / 2, ty + sideBarItemH / 2);
    });

    // === 分类高亮条焦点滑动（切换分类时从旧位置滑到新位置，easeOutBack 呼吸感）===
    const catTargetY = sideBarTopC + GameState.arsenalCategory * (sideBarItemH + sideBarGap);
    if (GameState.arsenalCatFocusIndex !== GameState.arsenalCategory) {
        if (GameState.arsenalCatFocusY != null) {
            // 从半路位置出发滑过去（天然支持打断：旧动画没播完就从当前显示位置接续）
            GameState.arsenalCatFocusFromY = GameState.arsenalCatFocusY;
        } else {
            // 首次出现：直接定身，不滑动
            GameState.arsenalCatFocusFromY = catTargetY;
            GameState.arsenalCatFocusY = catTargetY;
        }
        GameState.arsenalCatFocusAnim = 0;
        GameState.arsenalCatFocusIndex = GameState.arsenalCategory;
    }
    GameState.arsenalCatFocusAnim = Math.min(1, GameState.arsenalCatFocusAnim + dt / 0.22);
    const catT = easeOutBack(GameState.arsenalCatFocusAnim);
    GameState.arsenalCatFocusY = GameState.arsenalCatFocusFromY + (catTargetY - GameState.arsenalCatFocusFromY) * catT;

    // 高亮条画在滑动后的 Y（分类色左侧指示条 + 淡背景 + 描边 + 发光）
    const activeCat = CATEGORIES[GameState.arsenalCategory];
    const fy = GameState.arsenalCatFocusY;
    ctx.save();
    // 淡色选中底
    ctx.fillStyle = hexToRgba(activeCat.color, 0.16);
    ctx.beginPath();
    ctx.roundRect(sideBarX, fy, sideBarW, sideBarItemH, GLASS.radiusSmall);
    ctx.fill();
    // 左侧分类色指示条 + 发光
    ctx.shadowColor = activeCat.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = activeCat.color;
    ctx.beginPath();
    ctx.roundRect(sideBarX, fy, 3, sideBarItemH, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 选中描边
    ctx.strokeStyle = hexToRgba(activeCat.color, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(sideBarX, fy, sideBarW, sideBarItemH, GLASS.radiusSmall);
    ctx.stroke();
    ctx.restore();

    // === 右侧商品列表区 ===
    // 列表毛玻璃底板
    drawGlassPanel(ctx, listX, listTop, listW, listH, GLASS.radius);

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

    // === 商品列表选中项焦点滑动（W/S 切选时高亮从旧项滑到新项，easeOutBack 呼吸感；随滚动实时跟随）===
    const itemTargetY = listTop + 6 + GameState.arsenalSelectedIndex * (itemH + rowGap) - scroll;
    if (GameState.arsenalItemFocusIndex !== GameState.arsenalSelectedIndex) {
        if (GameState.arsenalItemFocusY != null) {
            // 从半路位置出发滑过去（天然支持打断：旧动画没播完就从当前显示位置接续）
            GameState.arsenalItemFocusFromY = GameState.arsenalItemFocusY;
        } else {
            // 首次出现：直接定身，不滑动
            GameState.arsenalItemFocusFromY = itemTargetY;
            GameState.arsenalItemFocusY = itemTargetY;
        }
        GameState.arsenalItemFocusAnim = 0;
        GameState.arsenalItemFocusIndex = GameState.arsenalSelectedIndex;
    }
    GameState.arsenalItemFocusAnim = Math.min(1, GameState.arsenalItemFocusAnim + dt / 0.22);
    const itemT = easeOutBack(GameState.arsenalItemFocusAnim);
    GameState.arsenalItemFocusY = GameState.arsenalItemFocusFromY + (itemTargetY - GameState.arsenalItemFocusFromY) * itemT;

    // 限制选中索引（防御）
    // （上面已限制）

    // 裁剪区域
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(listX, listTop, listW, listH, GLASS.radius);
    ctx.clip();

    items.forEach(([id, config], index) => {
        const iy = listTop + 6 + index * (itemH + rowGap) - scroll;
        const isSelected = index === GameState.arsenalSelectedIndex;

        if (iy + itemH < listTop || iy > listTop + listH) return;

        // 商品卡片毛玻璃底板
        drawGlassPanel(ctx, listX + 6, iy, listW - 12, itemH, GLASS.radiusSmall);

        if (isSelected) {
            // 选中高亮画在焦点滑动后的 y（与分类侧边栏、背包槽同语言，easeOutBack 呼吸感 + 支持打断）
            const fy = GameState.arsenalItemFocusY;
            ctx.save();
            ctx.fillStyle = catColor;
            ctx.shadowColor = catColor;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.roundRect(listX + 6, fy, 3, itemH, 2);
            ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = hexToRgba(catColor, 0.6);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(listX + 6, fy, listW - 12, itemH, GLASS.radiusSmall);
            ctx.stroke();
            ctx.restore();
        }

        // 武器贴图
        const imgAreaX = listX + 16;
        const shopImg = renderer.getWeaponImage(id);
        if (shopImg) {
            const maxImgH = 48;
            const maxImgW = 96;
            const imgScale = Math.min(maxImgH / shopImg.naturalHeight, maxImgW / shopImg.naturalWidth);
            const drawW = shopImg.naturalWidth * imgScale;
            const drawH = shopImg.naturalHeight * imgScale;
            ctx.drawImage(shopImg, imgAreaX + (maxImgW - drawW) / 2, iy + (itemH - drawH) / 2, drawW, drawH);
        }

        // 武器名称
        const textX = listX + 120;
        ctx.fillStyle = isSelected ? GLASS.textPrimary : GLASS.textSecondary;
        ctx.font = `600 17px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(config.name, textX, iy + 10);

        // 武器信息行
        ctx.fillStyle = GLASS.textDim;
        ctx.font = `13px ${FONT}`;
        let info = getTypeName(config.type);
        if (config.type === 'launcher') {
            info += ` · 堆叠${config.maxStack}`;
        } else if (config.type === 'grenade' || config.type === 'medical') {
            info += ` · 堆叠${config.magSize}`;
        } else if (config.magSize) {
            info += ` · 弹容${config.magSize}`;
        }
        ctx.fillText(info, textX, iy + 34);

        // 伤害信息
        if (config.damage) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = `11px ${FONT}`;
            ctx.fillText(`DMG: ${config.damage}`, textX, iy + 54);
        }

        // 价格（右侧）— 金额保留等宽
        const priceX = listX + listW - 18;
        const canAfford = GameState.rp >= config.buyPrice;
        ctx.fillStyle = canAfford ? '#FFD700' : '#ff5252';
        ctx.font = `bold 16px ${MONO}`;
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
        ctx.beginPath();
        ctx.roundRect(listX + listW - 6, scrollBarY, 3, scrollBarH, 1.5);
        ctx.fill();
    }

    // === 背包区域（与列表居中对齐） ===
    // 分隔线
    ctx.strokeStyle = GLASS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(listX, invY - 6); ctx.lineTo(listX + listW, invY - 6);
    ctx.stroke();

    // INVENTORY 标签
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('I N V E N T O R Y', rightAreaCenterX, invY + 4);

    // 背包格子
    for (let i = 0; i < 7; i++) {
        const sx = slotStartX + i * (slotSize + slotGap);
        const isSlotSel = i === GameState.arsenalSelectedSlot;
        const weapon = GameState.inventory[i];
        const isLootItem = weapon && weapon.isLoot;

        // 毛玻璃槽位底板（选中态不再画静态描边，改由下方焦点滑动框统一表现）
        drawGlassPanel(ctx, sx, slotY, slotSize, slotSize, GLASS.radiusSmall);

        // 战利品未选中时保留稀有度描边（选中态交给焦点框）
        if (!isSlotSel && isLootItem) {
            ctx.save();
            ctx.strokeStyle = hexToRgba(RARITY_COLORS[weapon.config.rarity] || '#ffffff', 0.53);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(sx, slotY, slotSize, slotSize, GLASS.radiusSmall);
            ctx.stroke();
            ctx.restore();
        }

        if (weapon) {
            const sImg = renderer.getWeaponImage(weapon.id);
            if (sImg) {
                const sH = 44;
                const sScale = sH / sImg.naturalHeight;
                const sW = sImg.naturalWidth * sScale;
                ctx.drawImage(sImg, sx + slotSize / 2 - sW / 2, slotY + 6, sW, sH);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `10px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(weapon.config.name, sx + slotSize / 2, slotY + slotSize - 4);

            // 堆叠数
            if (weapon.config.maxStack && weapon.config.maxStack > 1) {
                ctx.fillStyle = '#FFD700';
                ctx.font = `bold 12px ${MONO}`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText(`${weapon.stackCount}`, sx + slotSize - 4, slotY + 3);
            }
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.font = `13px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('-', sx + slotSize / 2, slotY + slotSize / 2);
        }

        // 快捷键编号
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = `10px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${i + 1}`, sx + 4, slotY + 3);
    }

    // === 1-7 背包槽焦点滑动框（切换选中槽时从旧槽滑到新槽，easeOutBack 呼吸感）===
    const slotTargetX = slotStartX + GameState.arsenalSelectedSlot * (slotSize + slotGap) + slotSize / 2;
    const slotTargetYPos = slotY + slotSize / 2;
    if (GameState.arsenalSlotFocusIndex !== GameState.arsenalSelectedSlot) {
        const hasFocus = (GameState.arsenalSlotFocusX != null && GameState.arsenalSlotFocusY != null);
        if (hasFocus) {
            GameState.arsenalSlotFocusFromX = GameState.arsenalSlotFocusX;
            GameState.arsenalSlotFocusFromY = GameState.arsenalSlotFocusY;
        } else {
            GameState.arsenalSlotFocusFromX = slotTargetX;
            GameState.arsenalSlotFocusFromY = slotTargetYPos;
            GameState.arsenalSlotFocusX = slotTargetX;
            GameState.arsenalSlotFocusY = slotTargetYPos;
        }
        GameState.arsenalSlotFocusAnim = 0;
        GameState.arsenalSlotFocusIndex = GameState.arsenalSelectedSlot;
    }
    GameState.arsenalSlotFocusAnim = Math.min(1, GameState.arsenalSlotFocusAnim + dt / 0.22);
    const slotT = easeOutBack(GameState.arsenalSlotFocusAnim);
    GameState.arsenalSlotFocusX = GameState.arsenalSlotFocusFromX + (slotTargetX - GameState.arsenalSlotFocusFromX) * slotT;
    GameState.arsenalSlotFocusY = GameState.arsenalSlotFocusFromY + (slotTargetYPos - GameState.arsenalSlotFocusFromY) * slotT;

    // 焦点框（发光描边 + 轻微脉动），整体随主面板淡入淡出
    const selWeaponForColor = GameState.inventory[GameState.arsenalSelectedSlot];
    const selIsLoot = selWeaponForColor && selWeaponForColor.isLoot;
    const focusColor = selIsLoot ? (RARITY_COLORS[selWeaponForColor.config.rarity] || catColor) : catColor;
    const pulse = Math.sin(performance.now() * 0.004) * 0.05 + 0.95;
    const fs = slotSize + 8;
    const fHalf = fs / 2;
    ctx.save();
    ctx.globalAlpha *= pulse;
    ctx.shadowColor = focusColor;
    ctx.shadowBlur = 12 + pulse * 4;
    ctx.strokeStyle = focusColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(GameState.arsenalSlotFocusX - fHalf, GameState.arsenalSlotFocusY - fHalf, fs, fs, GLASS.radiusSmall + 2);
    ctx.stroke();
    ctx.restore();

    // 出售提示
    const selWeapon = GameState.inventory[GameState.arsenalSelectedSlot];
    if (selWeapon && selWeapon.isLoot) {
        ctx.fillStyle = '#ff9800';
        ctx.font = `13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`[X] 出售 ${selWeapon.config.name} → +$${selWeapon.config.value}`, rightAreaCenterX, sellY);
    } else if (selWeapon && selWeapon.config.sellPrice > 0) {
        ctx.fillStyle = '#ff9800';
        ctx.font = `13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`[X] 出售 ${selWeapon.config.name} → +$${selWeapon.config.sellPrice}`, rightAreaCenterX, sellY);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = `12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('选中空槽或无法出售', rightAreaCenterX, sellY);
    }

    // === 底部操作提示 ===
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('↑/↓ 分类   W/S 选择   1-7 背包   B 购买   X 出售   E 关闭', cx, footerY);

    ctx.restore();
}

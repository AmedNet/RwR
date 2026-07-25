// src/rendering/WeaponHUD.js
import { GameState } from '../core/GameState.js';
import { RARITY_COLORS, RARITY_NAMES } from '../core/LootRegistry.js';
import { GLASS, drawGlassPanel, drawProgressBar } from './GlassUI.js';

const vehicleHUDImage = new Image();
vehicleHUDImage.src = 'src/pkg/vehicle/jeep/jeep_uhd.png';
let vehicleHUDImageLoaded = false;
vehicleHUDImage.onload = () => { vehicleHUDImageLoaded = true; };

const btrWeaponHUDImages = {
    cannon: new Image(),
    coax: new Image()
};
btrWeaponHUDImages.cannon.src = 'src/pkg/vehicle/btr80/apc_autocannon.png';
btrWeaponHUDImages.coax.src = 'src/pkg/vehicle/btr80/apc_mg.png';

// === 车辆 HUD ===
const VEHICLE_HUD_STYLE = {
    imageSize: 56,
    panelWidth: 200,
    panelHeight: 85,
    right: 20,
    bottom: 90
};

function drawVehicleHUD(ctx, renderer, vehicle, opts = {}) {
    const { panelOffsetX = 0 } = opts;
    const { imageSize, panelWidth, panelHeight, right, bottom } = VEHICLE_HUD_STYLE;
    const panelX = renderer.width - panelWidth - right + panelOffsetX;
    const panelY = renderer.height - panelHeight - bottom;

    // 绘制区域模糊背景（与面板同步偏移）
    if (renderer._drawBlurRegion) {
        renderer._drawBlurRegion(panelX, panelY, panelWidth, panelHeight, 16);
    }
    
    // 毛玻璃面板
    drawGlassPanel(ctx, panelX, panelY, panelWidth, panelHeight);
    
    const imageX = panelX + 14;
    const imageY = panelY + (panelHeight - imageSize) / 2;
    const hpRatio = Math.max(0, Math.min(1, vehicle.health / vehicle.maxHealth));
    const hpColor = hpRatio > 0.5 ? GLASS.hpHigh : hpRatio > 0.25 ? GLASS.hpMid : GLASS.hpLow;
    
    const isBTR = vehicle.id === 'btr80';
    const btrWeapon = vehicle.activeVehicleWeapon || 'cannon';
    const btrImage = btrWeaponHUDImages[btrWeapon];
    const showImage = isBTR ? btrImage.naturalWidth > 0 : vehicleHUDImageLoaded;
    
    // 载具图标
    if (showImage && isBTR) {
        ctx.drawImage(btrImage, imageX, imageY + 6, imageSize, imageSize - 12);
    } else if (showImage) {
        ctx.drawImage(vehicleHUDImage, imageX, imageY, imageSize, imageSize);
    }
    
    const infoX = showImage ? imageX + imageSize + 14 : imageX + 4;
    const barWidth = panelX + panelWidth - infoX - 14;
    
    // 载具名称
    const displayName = isBTR
        ? (btrWeapon === 'cannon' ? '2A72 30mm' : 'PKT 7.62')
        : vehicle.name;
    ctx.fillStyle = GLASS.textPrimary;
    ctx.font = '600 13px -apple-system, "SF Pro Display", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayName, infoX, panelY + 22);
    
    // HP 数值
    ctx.fillStyle = hpColor;
    ctx.font = '500 11px -apple-system, "SF Pro Display", sans-serif';
    ctx.fillText(`${Math.ceil(vehicle.health)} / ${vehicle.maxHealth}`, infoX, panelY + 40);
    
    // HP 进度条
    drawProgressBar(ctx, infoX, panelY + 52, barWidth, 5, hpRatio, hpColor);
    
    // BTR 弹药
    if (isBTR) {
        const ammo = btrWeapon === 'cannon' ? vehicle.cannonAmmo : vehicle.coaxAmmo;
        const maxAmmo = btrWeapon === 'cannon' ? 120 : 300;
        const reloadTimer = btrWeapon === 'cannon' ? vehicle.cannonReloadTimer : vehicle.coaxReloadTimer;
        const totalReload = btrWeapon === 'cannon' ? 1200 : 600;
        
        if (ammo <= 0 && reloadTimer > 0) {
            const reloadPct = Math.floor((1 - reloadTimer / totalReload) * 100);
            ctx.fillStyle = GLASS.ammoLow;
            ctx.font = '500 10px -apple-system, "SF Pro Display", sans-serif';
            ctx.fillText(`装填中 ${reloadPct}%`, infoX, panelY + 70);
            drawProgressBar(ctx, infoX, panelY + 78, barWidth, 3, reloadPct / 100, GLASS.ammoLow);
        } else {
            const ammoColor = ammo <= 10 ? GLASS.ammoCritical : ammo <= 30 ? GLASS.ammoLow : GLASS.ammoNormal;
            ctx.fillStyle = ammoColor;
            ctx.font = '500 10px -apple-system, "SF Pro Display", sans-serif';
            ctx.fillText(`弹药 ${ammo}/${maxAmmo}`, infoX, panelY + 70);
        }
    }
}

// === 主武器 HUD ===
// opts 过渡动画参数（背包开/关时 HUD 滑入/滑出 + 淡入/淡出）：
//   alpha         整体透明 0~1（满显=1）
//   panelOffsetX  右侧主武器面板/载具面板 横向位移（正值向右偏移）
//   bottomOffsetY 底部武器槽位栏 纵向位移（正值向下偏移）
// 主分支调用时不传，默认满显 + 零位移（现状不变）。
export function drawWeaponHUD(ctx, renderer, opts = {}) {
    const { alpha = 1, panelOffsetX = 0, bottomOffsetY = 0 } = opts;
    const _vOpts = { alpha, panelOffsetX, bottomOffsetY };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;

    const weapon = GameState.getActiveWeapon();
    const drivenVehicle = GameState.player?.vehicleSeat === 0
        ? GameState.player.mountedVehicle
        : null;

    if (drivenVehicle) {
        drawVehicleHUD(ctx, renderer, drivenVehicle, _vOpts);
    } else if (weapon) {
        const panelW = 200;
        const panelH = 85;
        const panelX = renderer.width - panelW - 20 + panelOffsetX;
        const panelY = renderer.height - panelH - 90;

        // 绘制区域模糊背景（与面板同步偏移）
        if (renderer._drawBlurRegion) {
            renderer._drawBlurRegion(panelX, panelY, panelW, panelH, 16);
        }
        
        // 毛玻璃面板
        drawGlassPanel(ctx, panelX, panelY, panelW, panelH);
        
        if (weapon.isLoot) {
            // === 战利品详情 ===
            const rarityColor = RARITY_COLORS[weapon.config.rarity] || '#888';
            
            // Emoji
            ctx.font = '32px -apple-system, "SF Pro Display", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(weapon.config.emoji, panelX + 36, panelY + panelH / 2);
            
            // 名称
            ctx.fillStyle = rarityColor;
            ctx.font = '600 12px -apple-system, "SF Pro Display", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(weapon.config.name, panelX + 64, panelY + 24);
            
            // 稀有度
            ctx.fillStyle = GLASS.textSecondary;
            ctx.font = '400 10px -apple-system, "SF Pro Display", sans-serif';
            ctx.fillText(RARITY_NAMES[weapon.config.rarity] || '', panelX + 64, panelY + 42);
            
            // 价值
            ctx.fillStyle = '#fbbf24';
            ctx.font = '600 13px -apple-system, "SF Pro Display", sans-serif';
            ctx.fillText(`$${weapon.config.value}`, panelX + 64, panelY + 62);
        } else {
            // === 武器详情 ===
            const wImg = renderer.getWeaponImage(weapon.id);
            if (wImg) {
                const thumbH = 44;
                const scale = thumbH / wImg.naturalHeight;
                const thumbW = wImg.naturalWidth * scale;
                ctx.drawImage(wImg, panelX + 14, panelY + panelH / 2 - thumbH / 2, thumbW, thumbH);
            }
            
            // 武器名称
            ctx.fillStyle = GLASS.textPrimary;
            ctx.font = '600 12px -apple-system, "SF Pro Display", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(weapon.config.name, panelX + 72, panelY + 24);
            
            if (weapon.config.type !== 'melee' && weapon.config.type !== 'medical' && weapon.config.type !== 'grenade') {
                if (weapon.isReloading) {
                    const progress = weapon.getReloadProgress();
                    ctx.fillStyle = GLASS.ammoLow;
                    ctx.font = '500 10px -apple-system, "SF Pro Display", sans-serif';
                    ctx.fillText(`换弹中 ${Math.floor(progress * 100)}%`, panelX + 72, panelY + 44);
                    drawProgressBar(ctx, panelX + 72, panelY + 56, 110, 5, progress, GLASS.ammoLow);
                } else {
                    const ammoColor = weapon.ammo <= 5 ? GLASS.ammoCritical : weapon.ammo <= 10 ? GLASS.ammoLow : GLASS.ammoNormal;
                    // 弹药数
                    ctx.fillStyle = ammoColor;
                    ctx.font = '700 18px -apple-system, "SF Pro Display", sans-serif';
                    ctx.fillText(`${weapon.ammo}`, panelX + 72, panelY + 48);
                    // 总弹药
                    ctx.fillStyle = GLASS.textSecondary;
                    ctx.font = '400 11px -apple-system, "SF Pro Display", sans-serif';
                    ctx.fillText(`/ ${weapon.config.magSize}`, panelX + 105, panelY + 48);
                }
            }
        }
    }
    
    // === 防弹衣耐久条 ===
    const player = GameState.player;
    if (player && player.armorDurability > 0 && !drivenVehicle) {
        const armorPanelW = 200;
        const armorPanelH = 28;
        const armorPanelX = renderer.width - armorPanelW - 20 + panelOffsetX;
        const armorPanelY = renderer.height - 85 - 90 - armorPanelH - 6;

        if (renderer._drawBlurRegion) {
            renderer._drawBlurRegion(armorPanelX, armorPanelY, armorPanelW, armorPanelH, 12);
        }
        drawGlassPanel(ctx, armorPanelX, armorPanelY, armorPanelW, armorPanelH, 10);

        const armorRatio = player.armorDurability / player.armorMaxDurability;
        const armorColor = armorRatio > 0.5 ? '#4FC3F7' : armorRatio > 0.25 ? '#29B6F6' : '#0288D1';

        ctx.fillStyle = armorColor;
        ctx.font = '500 10px -apple-system, "SF Pro Display", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🛡️ ${Math.ceil(player.armorDurability)}/${player.armorMaxDurability}`, armorPanelX + 10, armorPanelY + 10);

        drawProgressBar(ctx, armorPanelX + 10, armorPanelY + 19, armorPanelW - 20, 4, armorRatio, armorColor);
    }

    // 驾驶BTR时隐藏底部物品栏
    if (drivenVehicle && drivenVehicle.id === 'btr80') {
        ctx.restore();
        return;
    }
    
    // === 底部武器槽位 ===
    const slotCount = GameState.inventory.length;
    const gap = 8;
    // 格数多于 7 时按比例缩小，避免 9 格总宽（532px）在窄屏溢出
    const maxTotalW = renderer.width * 0.6;
    const slotSize = Math.min(52, Math.floor((maxTotalW - (slotCount - 1) * gap) / slotCount));
    const totalW = slotCount * slotSize + (slotCount - 1) * gap;
    const startX = (renderer.width - totalW) / 2;
    const startY = renderer.height - slotSize - 24 + bottomOffsetY;

    // 绘制区域模糊背景（与底部栏同步偏移）
    if (renderer._drawBlurRegion) {
        renderer._drawBlurRegion(startX - 12, startY - 10, totalW + 24, slotSize + 20, 14);
    }
    
    // 底部栏背景
    drawGlassPanel(ctx, startX - 12, startY - 10, totalW + 24, slotSize + 20, 14);
    
    for (let i = 0; i < slotCount; i++) {
        const x = startX + i * (slotSize + gap);
        const isActive = i === GameState.activeWeaponSlot;
        
        // 槽位背景
        ctx.fillStyle = isActive ? GLASS.slotActiveBg : GLASS.slotBg;
        ctx.beginPath();
        ctx.roundRect(x, startY, slotSize, slotSize, GLASS.radiusSmall);
        ctx.fill();
        
        // 槽位边框
        if (isActive) {
            ctx.strokeStyle = GLASS.slotActiveBorder;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        
        const slotWeapon = GameState.inventory[i];
        if (slotWeapon) {
            if (slotWeapon.isLoot) {
                const lootColor = RARITY_COLORS[slotWeapon.config.rarity] || '#666';
                ctx.font = '22px -apple-system, "SF Pro Display", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(slotWeapon.config.emoji, x + slotSize / 2, startY + slotSize / 2 - 2);
                // 价值
                ctx.fillStyle = '#fbbf24';
                ctx.font = '600 8px -apple-system, "SF Pro Display", sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`$${slotWeapon.config.value}`, x + slotSize - 4, startY + slotSize - 4);
            } else {
                const sImg = renderer.getWeaponImage(slotWeapon.id);
                if (sImg) {
                    const sH = 32;
                    const sScale = sH / sImg.naturalHeight;
                    const sW = sImg.naturalWidth * sScale;
                    ctx.drawImage(sImg, x + slotSize / 2 - sW / 2, startY + 7, sW, sH);
                }
                if (slotWeapon.config.type !== 'melee') {
                    const ammoColor = slotWeapon.ammo === 0 ? GLASS.ammoCritical : slotWeapon.ammo <= 5 ? GLASS.ammoLow : GLASS.textPrimary;
                    ctx.fillStyle = ammoColor;
                    ctx.font = '600 10px -apple-system, "SF Pro Display", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(`${slotWeapon.ammo}`, x + slotSize / 2, startY + slotSize - 5);
                }
            }
            // 快捷键编号
            ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.6)' : GLASS.textDim;
            ctx.font = '500 8px -apple-system, "SF Pro Display", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`${i + 1}`, x + 5, startY + 5);
        } else {
            // 空槽位
            ctx.fillStyle = GLASS.textDim;
            ctx.font = '400 11px -apple-system, "SF Pro Display", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${i + 1}`, x + slotSize / 2, startY + slotSize / 2);
        }
    }
    
    ctx.restore();
}

// src/rendering/WeaponHUD.js
import { GameState } from '../core/GameState.js';
import { RARITY_COLORS, RARITY_NAMES } from '../core/LootRegistry.js';

const vehicleHUDImage = new Image();
vehicleHUDImage.src = 'src/pkg/vehicle/jeep/jeep_uhd.png';
let vehicleHUDImageLoaded = false;
vehicleHUDImage.onload = () => { vehicleHUDImageLoaded = true; };

// 后续调整吉普 HUD 贴图大小时，只需修改 imageSize。
const VEHICLE_HUD_STYLE = {
    imageSize: 62,
    panelWidth: 200,
    panelHeight: 80,
    right: 15,
    bottom: 80
};

function drawVehicleHUD(ctx, renderer, vehicle) {
    const { imageSize, panelWidth, panelHeight, right, bottom } = VEHICLE_HUD_STYLE;
    const panelX = renderer.width - panelWidth - right;
    const panelY = renderer.height - panelHeight - bottom;
    const imageX = panelX + 8;
    const imageY = panelY + (panelHeight - imageSize) / 2;
    const hpRatio = Math.max(0, Math.min(1, vehicle.health / vehicle.maxHealth));
    const hpColor = hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.25 ? '#FF9800' : '#F44336';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (vehicleHUDImageLoaded) {
        ctx.drawImage(vehicleHUDImage, imageX, imageY, imageSize, imageSize);
    }

    const infoX = imageX + imageSize + 10;
    const barWidth = panelX + panelWidth - infoX - 10;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(vehicle.name, infoX, panelY + 24);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${Math.ceil(vehicle.health)}/${vehicle.maxHealth}`, infoX, panelY + 43);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(infoX, panelY + 55, barWidth, 9);
    ctx.fillStyle = hpColor;
    ctx.fillRect(infoX, panelY + 55, barWidth * hpRatio, 9);
}

export function drawWeaponHUD(ctx, renderer) {
    ctx.save();

    // 右下角当前物品详情（毛玻璃背景）
    const weapon = GameState.getActiveWeapon();
    const drivenVehicle = GameState.player?.vehicleSeat === 0
        ? GameState.player.mountedVehicle
        : null;
    if (drivenVehicle) {
        drawVehicleHUD(ctx, renderer, drivenVehicle);
    } else if (weapon) {
        const panelW = 200;
        const panelH = 80;
        const panelX = renderer.width - panelW - 15;
        const panelY = renderer.height - panelH - 80;

        // 毛玻璃背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 10);
        ctx.fill();
        const borderColor = weapon.isLoot ? (RARITY_COLORS[weapon.config.rarity] || 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.1)';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (weapon.isLoot) {
            // === 战利品详情 ===
            ctx.font = '36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(weapon.config.emoji, panelX + 35, panelY + panelH / 2);
            ctx.fillStyle = RARITY_COLORS[weapon.config.rarity] || '#fff';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(weapon.config.name, panelX + 65, panelY + 25);
            ctx.fillStyle = RARITY_COLORS[weapon.config.rarity] || '#999';
            ctx.font = '10px sans-serif';
            ctx.fillText(RARITY_NAMES[weapon.config.rarity] || '', panelX + 65, panelY + 42);
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(`$${weapon.config.value}`, panelX + 65, panelY + 60);
        } else {
            // === 武器详情（原有逻辑） ===
            const wImg = renderer.getWeaponImage(weapon.id);
            if (wImg) {
                const thumbH = 50;
                const scale = thumbH / wImg.naturalHeight;
                const thumbW = wImg.naturalWidth * scale;
                ctx.drawImage(wImg, panelX + 15, panelY + panelH / 2 - thumbH / 2, thumbW, thumbH);
            }
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(weapon.config.name, panelX + 75, panelY + 28);
            if (weapon.config.type !== 'melee' && weapon.config.type !== 'medical' && weapon.config.type !== 'grenade') {
                if (weapon.isReloading) {
                    const progress = weapon.getReloadProgress();
                    ctx.fillStyle = '#FFC107';
                    ctx.font = '12px sans-serif';
                    ctx.fillText(`换弹中 ${Math.floor(progress * 100)}%`, panelX + 75, panelY + 52);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(panelX + 75, panelY + 58, 110, 8);
                    ctx.fillStyle = '#FFC107';
                    ctx.fillRect(panelX + 75, panelY + 58, 110 * progress, 8);
                } else {
                    const ammoColor = weapon.ammo <= 5 ? '#ff5252' : (weapon.ammo <= 10 ? '#FFC107' : '#4CAF50');
                    ctx.fillStyle = ammoColor;
                    ctx.font = 'bold 16px sans-serif';
                    ctx.fillText(`弹药 ${weapon.ammo}/${weapon.config.magSize}`, panelX + 75, panelY + 52);
                }
            }
        }
    }

    // 底部武器槽位（毛玻璃风格）
    const slotCount = 7;
    const slotSize = 52;
    const gap = 8;
    const totalW = slotCount * slotSize + (slotCount - 1) * gap;
    const startX = (renderer.width - totalW) / 2;
    const startY = renderer.height - slotSize - 20;

    // 整体背景（毛玻璃）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(startX - 10, startY - 8, totalW + 20, slotSize + 16, 12);
    ctx.fill();

    for (let i = 0; i < slotCount; i++) {
        const x = startX + i * (slotSize + gap);
        const isActive = i === GameState.activeWeaponSlot;

        // 槽位背景
        ctx.fillStyle = isActive ? 'rgba(76, 175, 80, 0.7)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(x, startY, slotSize, slotSize, 6);
        ctx.fill();
        if (isActive) {
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        const slotWeapon = GameState.inventory[i];
        if (slotWeapon) {
            if (slotWeapon.isLoot) {
                // === 战利品槽位 ===
                const lootColor = RARITY_COLORS[slotWeapon.config.rarity] || '#666';
                if (isActive) {
                    ctx.strokeStyle = lootColor;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(slotWeapon.config.emoji, x + slotSize / 2, startY + slotSize / 2 - 2);
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`$${slotWeapon.config.value}`, x + slotSize - 3, startY + slotSize - 3);
            } else {
                // === 武器槽位（原有逻辑） ===
                const sImg = renderer.getWeaponImage(slotWeapon.id);
                if (sImg) {
                    const sH = 35;
                    const sScale = sH / sImg.naturalHeight;
                    const sW = sImg.naturalWidth * sScale;
                    ctx.drawImage(sImg, x + slotSize / 2 - sW / 2, startY + 6, sW, sH);
                }
                if (slotWeapon.config.type !== 'melee') {
                    ctx.fillStyle = slotWeapon.ammo === 0 ? '#ff5252' : 'rgba(255,255,255,0.7)';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(`${slotWeapon.ammo}`, x + slotSize / 2, startY + slotSize - 4);
                }
            }
            // 快捷键
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`${i + 1}`, x + 4, startY + 4);
        } else {
            // 空槽位
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${i + 1}`, x + slotSize / 2, startY + slotSize / 2);
        }
    }

    ctx.restore();
}

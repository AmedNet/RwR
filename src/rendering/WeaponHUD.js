// src/rendering/WeaponHUD.js
import { GameState } from '../core/GameState.js';

export function drawWeaponHUD(ctx, renderer) {
    ctx.save();

    // 右下角当前武器详情（毛玻璃背景）
    const weapon = GameState.getActiveWeapon();
    if (weapon) {
        const panelW = 200;
        const panelH = 80;
        const panelX = renderer.width - panelW - 15;
        const panelY = renderer.height - panelH - 80;

        // 毛玻璃背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 武器贴图缩略图
        const wImg = renderer.getWeaponImage(weapon.id);
        if (wImg) {
            const thumbH = 50;
            const scale = thumbH / wImg.naturalHeight;
            const thumbW = wImg.naturalWidth * scale;
            ctx.drawImage(wImg, panelX + 15, panelY + panelH / 2 - thumbH / 2, thumbW, thumbH);
        }

        // 武器名
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(weapon.config.name, panelX + 75, panelY + 28);

        // 弹药信息
        if (weapon.config.type !== 'melee') {
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

    // 底部武器槽位（毛玻璃风格）
    const slotCount = 4;
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
            // 武器缩略图
            const sImg = renderer.getWeaponImage(slotWeapon.id);
            if (sImg) {
                const sH = 35;
                const sScale = sH / sImg.naturalHeight;
                const sW = sImg.naturalWidth * sScale;
                ctx.drawImage(sImg, x + slotSize / 2 - sW / 2, startY + 6, sW, sH);
            }
            // 弹药数
            if (slotWeapon.config.type !== 'melee') {
                ctx.fillStyle = slotWeapon.ammo === 0 ? '#ff5252' : 'rgba(255,255,255,0.7)';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${slotWeapon.ammo}`, x + slotSize / 2, startY + slotSize - 4);
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
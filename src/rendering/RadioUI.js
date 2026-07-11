// src/rendering/RadioUI.js
// 电台界面 - 紧凑侧边栏设计
import { GameState } from '../core/GameState.js';
import { SupportSystem, SupportConfig } from '../core/SupportSystem.js';
import { getRankStars } from '../core/RankSystem.js';


// 预加载图片图标缓存
const iconImageCache = {};
const iconImageLoaded = {};
for (const [type, config] of Object.entries(SupportConfig)) {
    if (config.icon && config.icon.endsWith('.png')) {
        const img = new Image();
        img.src = config.icon;
        iconImageCache[type] = img;
        iconImageLoaded[type] = false;
        img.onload = () => { iconImageLoaded[type] = true; };
    }
}

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutQuint = t => 1 - Math.pow(1 - t, 5);

export function drawRadioUI(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;
    const time = Date.now();

    const animProgress = GameState.radioAnimProgress || 0;
    const eased = easeOutCubic(animProgress);

    if (eased <= 0) return;

    ctx.save();

    const available = SupportSystem.getPlayerAvailableSupport();
    const selectedIndex = Math.min(GameState.radioSelectedIndex || 0, 
                                  Math.max(0, SupportSystem.getPlayerAvailableSupport().length - 1));

    const panelW = 260;
    const panelX = 20;
    const panelTop = 60;
    const itemH = 56;
    const itemGap = 4;
    const headerH = 48;
    const footerH = 36;
    const maxVisibleItems = 4;
    const visibleListH = maxVisibleItems * (itemH + itemGap) - itemGap;
    const panelH = headerH + visibleListH + 16 + footerH;

    const slideX = -panelW * (1 - easeOutQuint(animProgress));

    ctx.globalAlpha = eased;

    ctx.fillStyle = 'rgba(8, 12, 18, 0.75)';
    ctx.beginPath();
    ctx.roundRect(panelX + slideX, panelTop, panelW, panelH, 6);
    ctx.fill();

    ctx.strokeStyle = 'rgba(100,181,246,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX + slideX, panelTop, panelW, panelH, 6);
    ctx.stroke();

    const px = panelX + slideX;

    ctx.fillStyle = 'rgba(100,181,246,0.06)';
    ctx.fillRect(px, panelTop, panelW, headerH);

    ctx.fillStyle = '#78909c';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SUPPORT', px + 14, panelTop + 18);

    const player = GameState.player;
    const stars = player ? getRankStars(player.rank) : 0;
    ctx.fillStyle = '#FFD740';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('\u2605'.repeat(stars), px + 14, panelTop + 36);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`$${GameState.rp}`, px + panelW - 14, panelTop + 18);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px "Courier New", monospace';
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    ctx.fillText(timeStr, px + panelW - 14, panelTop + 36);

    const listTop = panelTop + headerH + 8;
    
    // 自动滚动：确保选中项可见
    const scrollOffset = GameState.radioScrollOffset || 0;
    const selectedItemTop = selectedIndex * (itemH + itemGap);
    const selectedItemBottom = selectedItemTop + itemH;
    
    if (selectedItemTop < scrollOffset) {
        GameState.radioScrollOffset = selectedItemTop;
    } else if (selectedItemBottom > scrollOffset + visibleListH) {
        GameState.radioScrollOffset = selectedItemBottom - visibleListH;
    }
    
    const currentScrollOffset = GameState.radioScrollOffset;

    // 保存上下文并设置裁剪区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, listTop, panelW, visibleListH);
    ctx.clip();

    available.forEach((item, index) => {
        const cardDelay = 0.08 + index * 0.06;
        const cardProgress = easeOutCubic(Math.max(0, Math.min(1, (animProgress - cardDelay) * 4)));
        const cardSlide = (1 - cardProgress) * 20;

        if (cardProgress <= 0) return;

        const iy = listTop + index * (itemH + itemGap) + cardSlide - currentScrollOffset;
        
        // 只渲染可见区域内的项目
        if (iy + itemH < listTop || iy > listTop + visibleListH) return;
        
        const isSelected = index === selectedIndex;
        const { config, canCall, cooldownRemaining } = item;

        ctx.globalAlpha = cardProgress * eased;

        if (isSelected) {
            const pulse = Math.sin(time * 0.004) * 0.05 + 0.95;
            ctx.fillStyle = `rgba(100,181,246,${0.12 * pulse})`;
            ctx.beginPath();
            ctx.roundRect(px + 6, iy, panelW - 12, itemH, 4);
            ctx.fill();

            ctx.fillStyle = '#64B5F6';
            ctx.fillRect(px + 6, iy, 3, itemH);
        }

        // 渲染图标（支持 emoji 和图片）
        if (config.icon.endsWith('.png') && iconImageLoaded[item.type]) {
            const img = iconImageCache[item.type];
            const iconSize = 28;
            ctx.drawImage(img, px + 30 - iconSize / 2, iy + itemH / 2 - iconSize / 2, iconSize, iconSize);
        } else {
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.icon, px + 30, iy + itemH / 2);
        }

        const textX = px + 52;
        ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.7)';
        ctx.font = `${isSelected ? 'bold ' : ''}13px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(config.name, textX, iy + 10);

        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '10px sans-serif';
        ctx.fillText(config.description, textX, iy + 28);

        const rightX = px + panelW - 14;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const canAfford = GameState.rp >= config.rpCost;
        ctx.fillStyle = canAfford ? 'rgba(255,215,0,0.8)' : 'rgba(255,82,82,0.7)';
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillText(`$${config.rpCost}`, rightX, iy + 16);

        if (cooldownRemaining > 0) {
            const secs = Math.ceil(cooldownRemaining / 60);
            ctx.fillStyle = 'rgba(255,152,0,0.7)';
            ctx.font = '10px "Courier New", monospace';
            ctx.fillText(`${secs}s`, rightX, iy + 36);
        } else if (!canAfford) {
            ctx.fillStyle = 'rgba(255,82,82,0.5)';
            ctx.font = '9px sans-serif';
            ctx.fillText('RP\u4E0D\u8DB3', rightX, iy + 36);
        } else {
            const readyPulse = Math.sin(time * 0.005) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(102,187,106,${readyPulse})`;
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText('READY', rightX, iy + 36);
        }
    });

    // 恢复上下文（取消裁剪）
    ctx.restore();
    ctx.globalAlpha = eased;

    // 绘制滚动条指示器（如果有更多项目）
    if (available.length > maxVisibleItems) {
        const listH = available.length * (itemH + itemGap) - itemGap;
        const scrollbarX = px + panelW - 4;
        const scrollbarH = visibleListH;
        const thumbH = (maxVisibleItems / available.length) * scrollbarH;
        const thumbY = listTop + (currentScrollOffset / (listH - visibleListH)) * (scrollbarH - thumbH);
        
        // 滚动条背景
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(scrollbarX, listTop, 2, scrollbarH);
        
        // 滚动条滑块
        ctx.fillStyle = 'rgba(100,181,246,0.4)';
        ctx.fillRect(scrollbarX, thumbY, 2, thumbH);
    }

    const footerY = listTop + visibleListH + 12;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2191/\u2193 \u9009\u62E9  \u56DE\u8F66\u786E\u8BA4  \u957F\u6309G\u5173\u95ED', px + panelW / 2, footerY);

    if (GameState.radioTargetWorld) {
        const pos = renderer.toScreen(GameState.radioTargetWorld.x, GameState.radioTargetWorld.y);
        const pulse = Math.sin(time * 0.006) * 4 + 16;

        ctx.strokeStyle = 'rgba(100,181,246,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(100,181,246,0.15)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(100,181,246,0.6)';
        ctx.lineWidth = 1;
        const gap = 8;
        const len = 10;
        ctx.beginPath();
        ctx.moveTo(pos.x - pulse - gap, pos.y);
        ctx.lineTo(pos.x - pulse - gap - len, pos.y);
        ctx.moveTo(pos.x + pulse + gap, pos.y);
        ctx.lineTo(pos.x + pulse + gap + len, pos.y);
        ctx.moveTo(pos.x, pos.y - pulse - gap);
        ctx.lineTo(pos.x, pos.y - pulse - gap - len);
        ctx.moveTo(pos.x, pos.y + pulse + gap);
        ctx.lineTo(pos.x, pos.y + pulse + gap + len);
        ctx.stroke();

        const coordText = `(${Math.round(GameState.radioTargetWorld.x)}, ${Math.round(GameState.radioTargetWorld.y)})`;
        ctx.font = '10px "Courier New", monospace';
        const textW = ctx.measureText(coordText).width;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(pos.x + pulse + 10, pos.y - 12, textW + 8, 16);
        ctx.fillStyle = 'rgba(100,181,246,0.8)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(coordText, pos.x + pulse + 14, pos.y - 4);
    }

    if (available.length > 0 && available[selectedIndex]) {
        const sel = available[selectedIndex];
        const selY = footerY + 20;
        ctx.fillStyle = 'rgba(100,181,246,0.6)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${sel.config.icon.endsWith('.png') ? '' : sel.config.icon} ${sel.config.name} \u2014 \u70B9\u51FB\u786E\u8BA4\u547C\u53EB`,
            px + panelW / 2, selY
        );
    }

    ctx.restore();
}

export function updateRadioAnimation() {
    const animSpeed = 0.06;

    if (GameState.radioAnimating) {
        if (GameState.radioClosing) {
            GameState.radioAnimProgress -= animSpeed;
            if (GameState.radioAnimProgress <= 0) {
                GameState.radioAnimProgress = 0;
                GameState.radioAnimating = false;
                GameState.radioClosing = false;
                GameState.radioOpen = false;
            }
        } else {
            GameState.radioAnimProgress += animSpeed;
            if (GameState.radioAnimProgress >= 1) {
                GameState.radioAnimProgress = 1;
                GameState.radioAnimating = false;
            }
        }
    }
}

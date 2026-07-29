// src/rendering/InventoryUI.js
import { GameState } from '../core/GameState.js';
import { RARITY_COLORS, RARITY_NAMES } from '../core/LootRegistry.js';
import { GLASS, easeOutCubic, drawGlassPanel, drawProgressBar } from './GlassUI.js';
// Alias for compatibility
const drawGlassBar = drawProgressBar;
// 带过冲的 ease-out（焦点滑动末端轻溢出再回弹，呼吸感）
const easeOutBack = t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// 预加载背包“思考”提示图（打开背包时左下角弹出，关闭时随背包动画同步收回）
const inventoryThinkImg = new Image();
inventoryThinkImg.src = 'src/pkg/backpack/qthink.png';
let inventoryThinkLoaded = false;
inventoryThinkImg.onload = () => { inventoryThinkLoaded = true; };

export function drawInventory(ctx, renderer) {
    // === 动画更新（基于时间） ===
    const now = performance.now();
    if (!GameState.panels.inventory._lastTime) {
        GameState.panels.inventory._lastTime = now;
    }
    const deltaTime = (now - GameState.panels.inventory._lastTime) / 1000; // 秒
    GameState.panels.inventory._lastTime = now;
    // 限制 deltaTime，避免背包关闭期间 lastTime 未更新造成下一帧跳过整个动画
    const dt = Math.min(deltaTime, 0.05);
    
    // 动画速度：关闭比打开更快（约 230ms vs 280ms），关闭给“快速收回”的直觉
    const isClosingDir = GameState.panels.inventory.direction === 'closing';
    const ANIM_SPEED_PER_SEC = isClosingDir ? 4.4 : 3.6;
    
    if (GameState.panels.inventory.direction === 'opening') {
        GameState.panels.inventory.progress = Math.min(1, GameState.panels.inventory.progress + ANIM_SPEED_PER_SEC * dt);
        if (GameState.panels.inventory.progress >= 1) {
            GameState.panels.inventory.direction = null;
        }
    } else if (GameState.panels.inventory.direction === 'closing') {
        GameState.panels.inventory.progress = Math.max(0, GameState.panels.inventory.progress - ANIM_SPEED_PER_SEC * dt);
        if (GameState.panels.inventory.progress <= 0) {
            GameState.panels.inventory.open = false;
            GameState.panels.inventory.direction = null;
            GameState.inventorySelectedSlot = -1;
            // 重置焦点动画状态，避免下次打开从旧会话位置残留滑入
            GameState.focus.inventory.x = null;
            GameState.focus.inventory.y = null;
            GameState.focus.inventory.index = -1;
            GameState.focus.inventory.fromX = null;
            GameState.focus.inventory.fromY = null;
            GameState.focus.inventory.anim = 0;
            GameState.panels.inventory._lastTime = null;
            return;
        }
    }

    const rawP = GameState.panels.inventory.progress;
    // 倒带式回缩：打开与关闭共用同一条曲线 easeOutCubic(rawP)。
    // rawP 在关闭时由 1→0，p 随之由 1→0，即打开的精确倒放。
    const p = easeOutCubic(rawP);

    // === 完全透明背景 ===
    // 不填充任何背景，让游戏画面透出来
    // p=0 隐藏，p=1 显示；打开 p 0→1，关闭 p 1→0（同一曲线倒放）
    const scale = 0.92 + 0.08 * p;      // 0.92 ↔ 1
    const offsetY = (1 - p) * 24;       // 打开上浮落定 / 关闭下沉退场
    const alphaFactor = p;              // 淡入 / 淡出
    const cx = renderer.width / 2;
    const cy = renderer.height / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy + offsetY);
    ctx.globalAlpha = alphaFactor;

    // === 背包格子布局参数（提前定义，供面板高度计算）===
    const slotSize = 80;
    const slotGap = 16;
    const slotsPerRow = 4;
    const slotCount = GameState.inventory.length;
    const totalRows = Math.ceil(slotCount / slotsPerRow);

    // === 主面板（高度随物品栏行数动态增长：基准 2 行 = 520）===
    const panelW = 480;
    // 面板高度始终包住全部格子行 + 详情 + 底部提示（不单独裁剪，否则内容会溢出面板矩形）
    const panelH = 520 + (totalRows - 2) * (slotSize + slotGap);
    const panelX = cx - panelW / 2;
    const panelY = 50;

    drawGlassPanel(ctx, panelX, panelY, panelW, panelH, GLASS.radius);

    // === 标题 ===
    ctx.fillStyle = GLASS.textPrimary;
    ctx.font = '600 28px -apple-system, "SF Pro Display", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F392} 背包', cx, panelY + 40);

    // === 玩家信息 ===
    const player = GameState.player;
    let infoY = panelY + 85;

    if (player) {
        // 军衔
        ctx.fillStyle = GLASS.textSecondary;
        ctx.font = '500 14px -apple-system, "SF Pro Display", sans-serif';
        ctx.fillText(`军衔: ${player.getRankName()}`, cx, infoY);
        infoY += 28;

        // 血量条
        const barW = 240;
        const barH = 8;
        const barX = cx - barW / 2;
        const hpPct = player.health / player.maxHealth;
        const hpColor = hpPct > 0.6 ? '#4ade80' : hpPct > 0.3 ? '#fbbf24' : '#f87171';

        drawGlassBar(ctx, barX, infoY, barW, barH, hpPct, hpColor);

        ctx.fillStyle = GLASS.textPrimary;
        ctx.font = '600 12px -apple-system, "SF Pro Display", sans-serif';
        ctx.fillText(`${Math.floor(player.health)} / ${player.maxHealth}`, cx, infoY + 22);
        infoY += 42;
    }

    // RP 值
    ctx.fillStyle = '#fbbf24';
    ctx.font = '600 16px -apple-system, "SF Pro Display", sans-serif';
    ctx.fillText(`\u{1F4B0} ${GameState.rp} RP`, cx, infoY);
    infoY += 35;

    // === 背包格子 ===
    const gridW = slotsPerRow * slotSize + (slotsPerRow - 1) * slotGap;
    const gridX = cx - gridW / 2;
    const gridY = infoY;

    GameState.inventoryHitAreas = [];
    const slotCenters = []; // 每格中心坐标，供焦点框滑动使用

    for (let i = 0; i < slotCount; i++) {
        const row = Math.floor(i / slotsPerRow);
        const col = i % slotsPerRow;
        const x = gridX + col * (slotSize + slotGap);
        const y = gridY + row * (slotSize + slotGap);

        const item = GameState.inventory[i];
        const isLoot = item && item.isLoot;
        const isSelected = i === GameState.inventorySelectedSlot;

        // 格子延迟动画：与面板统一用 easeOutCubic，关闭时随 rawP 倒放
        const delay = i * 0.05;
        const slotP = Math.max(0, Math.min(1, (rawP - delay) / (1 - delay)));
        const slotScale = 0.8 + 0.2 * easeOutCubic(slotP);
        const slotAlpha = easeOutCubic(slotP);

        ctx.save();
        ctx.globalAlpha = slotAlpha * p;
        const scx = x + slotSize / 2;
        const scy = y + slotSize / 2;
        ctx.translate(scx, scy);
        ctx.scale(slotScale, slotScale);
        ctx.translate(-scx, -scy);

        // 格子背景
        if (isSelected) {
            ctx.fillStyle = GLASS.slotActiveBg;
        } else {
            ctx.fillStyle = GLASS.slotBg;
        }
        ctx.beginPath();
        ctx.roundRect(x, y, slotSize, slotSize, GLASS.radiusSmall);
        ctx.fill();

        // 边框（选中格的静态描边交给焦点框负责，这里只画非选中的普通/品级边框）
        if (isLoot) {
            ctx.strokeStyle = RARITY_COLORS[item.config.rarity] || '#666';
            ctx.lineWidth = isSelected ? 2 : 1;
        } else if (!isSelected) {
            ctx.strokeStyle = GLASS.border;
            ctx.lineWidth = 1;
        }
        ctx.stroke();

        if (item) {
            if (isLoot) {
                // 战利品
                ctx.font = '32px -apple-system, "SF Pro Display", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.config.emoji, x + slotSize / 2, y + slotSize / 2 - 4);

                ctx.fillStyle = RARITY_COLORS[item.config.rarity] || '#aaa';
                ctx.font = '500 9px -apple-system, "SF Pro Display", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(item.config.name, x + slotSize / 2, y + slotSize - 5);

                ctx.fillStyle = '#fbbf24';
                ctx.font = '600 10px -apple-system, "SF Pro Display", sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText(`$${item.config.value}`, x + slotSize - 5, y + 5);

                ctx.fillStyle = RARITY_COLORS[item.config.rarity] || '#888';
                ctx.font = '400 8px -apple-system, "SF Pro Display", sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(RARITY_NAMES[item.config.rarity] || '', x + 5, y + 5);
            } else {
                // 武器
                const invImg = renderer.getWeaponImage(item.id);
                if (invImg) {
                    const invH = 44;
                    const invScale = invH / invImg.naturalHeight;
                    const invW = invImg.naturalWidth * invScale;
                    ctx.drawImage(invImg, x + slotSize / 2 - invW / 2, y + slotSize / 2 - invH / 2 - 4, invW, invH);
                } else {
                    ctx.font = '32px -apple-system, "SF Pro Display", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(item.config.type === 'grenade' ? '\u{1F4A3}' : '\u{1F52B}', x + slotSize / 2, y + slotSize / 2);
                }

                ctx.fillStyle = GLASS.textSecondary;
                ctx.font = '400 10px -apple-system, "SF Pro Display", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(item.config.name, x + slotSize / 2, y + slotSize - 5);

                if (item.config.type !== 'melee') {
                    const ammoColor = item.ammo === 0 ? '#f87171' : 'rgba(255,255,255,0.65)';
                    ctx.fillStyle = ammoColor;
                    ctx.font = '600 10px -apple-system, "SF Pro Display", sans-serif';
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'top';
                    ctx.fillText(`${item.ammo}`, x + slotSize - 5, y + 5);
                }
            }
        } else {
            ctx.fillStyle = GLASS.textDim;
            ctx.font = '400 13px -apple-system, "SF Pro Display", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${i + 1}`, x + slotSize / 2, y + slotSize / 2);
        }

        ctx.restore();

        // 记录热区（不受动画变换影响）
        GameState.inventoryHitAreas.push({ x, y, w: slotSize, h: slotSize, index: i });
        slotCenters.push({ x: x + slotSize / 2, y: y + slotSize / 2, scale: slotScale });
    }

    // === 选中槽位焦点：切换时从旧格子滑到新格子（~120ms 定时长 easeOutCubic，落定后轻微脉动）===
    const selSlot = GameState.inventorySelectedSlot;
    if (selSlot >= 0 && selSlot < slotCenters.length) {
        const target = slotCenters[selSlot];
        // 检测选中索引变化：切换瞬间记录滑动起点
        if (GameState.focus.inventory.index !== selSlot) {
            const hasFocus = (GameState.focus.inventory.x !== null && GameState.focus.inventory.y !== null);
            if (hasFocus) {
                // 从旧焦点位置出发滑过去
                GameState.focus.inventory.fromX = GameState.focus.inventory.x;
                GameState.focus.inventory.fromY = GameState.focus.inventory.y;
            } else {
                // 第一次出现焦点：直接定身在新格子，不滑动（起点=终点）
                GameState.focus.inventory.fromX = target.x;
                GameState.focus.inventory.fromY = target.y;
                GameState.focus.inventory.x = target.x;
                GameState.focus.inventory.y = target.y;
            }
            GameState.focus.inventory.anim = 0;
            GameState.focus.inventory.index = selSlot;
        }
        // 推进滑动进度（~220ms 落定），easeOutBack 让末端轻过冲再回弹，呼吸感
        GameState.focus.inventory.anim = Math.min(1, GameState.focus.inventory.anim + dt / 0.22);
        const t = easeOutBack(GameState.focus.inventory.anim);
        GameState.focus.inventory.x = GameState.focus.inventory.fromX + (target.x - GameState.focus.inventory.fromX) * t;
        GameState.focus.inventory.y = GameState.focus.inventory.fromY + (target.y - GameState.focus.inventory.fromY) * t;

        // 画复合高亮（发光描边 + 底部流光线），整体随背包淡入淡出
        const pulse = Math.sin(performance.now() * 0.004) * 0.05 + 0.95; // 对齐 RadioUI 频率/幅度
        const fx = GameState.focus.inventory.x;
        const fy = GameState.focus.inventory.y;
        const fs = (slotSize + 6) * target.scale; // 焦点框略大于格子，跟弹入缩放
        const half = fs / 2;
        const pad = GLASS.radiusSmall + 1; // 流光线左右内缩，避开圆角
        ctx.save();
        ctx.globalAlpha = p * pulse;

        // 发光描边
        ctx.shadowColor = GLASS.slotActiveBorder;
        ctx.shadowBlur = 10 + pulse * 4;
        ctx.strokeStyle = GLASS.slotActiveBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(fx - half, fy - half, fs, fs, GLASS.radiusSmall + 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 底部流光线：贴焦点框底部内侧、两端淡出的横向高光
        const y0 = fy + half - 3;
        const x1 = fx - half + pad;
        const x2 = fx + half - pad;
        if (x2 > x1) {
            const grad = ctx.createLinearGradient(x1, 0, x2, 0);
            grad.addColorStop(0, 'rgba(100,180,255,0)');
            grad.addColorStop(0.5, GLASS.slotActiveBorder);
            grad.addColorStop(1, 'rgba(100,180,255,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y0);
            ctx.lineTo(x2, y0);
            ctx.stroke();
        }
        ctx.restore();
    }

    // === 选中物品详情 ===
    const slotsBottomY = gridY + totalRows * (slotSize + slotGap);
    const selected = GameState.inventory[GameState.inventorySelectedSlot];

    if (selected) {
        const detailY = slotsBottomY + 15;
        if (selected.isLoot) {
            ctx.fillStyle = GLASS.textSecondary;
            ctx.font = '400 12px -apple-system, "SF Pro Display", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`"${selected.config.description}"`, cx, detailY);
            ctx.fillStyle = '#fbbf24';
            ctx.font = '500 13px -apple-system, "SF Pro Display", sans-serif';
            ctx.fillText(`[D] 丢弃 ${selected.config.name}    [右键] 丢弃到脚下`, cx, detailY + 22);
        } else {
            ctx.fillStyle = '#fbbf24';
            ctx.font = '500 13px -apple-system, "SF Pro Display", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`[D] 丢弃 ${selected.config.name}`, cx, detailY + 10);
        }
    }

    // === 底部提示 ===
    ctx.fillStyle = GLASS.textDim;
    ctx.font = '400 12px -apple-system, "SF Pro Display", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('按 Q 关闭   点击格子选中   D 丢弃', cx, slotsBottomY + 55);

    ctx.restore();

    // === 左下角“思考”提示图：与 call/call_nohave 同款弹出动画，驱动源换为背包开/关曲线 rawP ===
    // rawP：背包开 0→1、关 1→0。打开跟着弹出（easeOutBack 呼吸感）、关闭同步收回。
    if (inventoryThinkLoaded && rawP > 0) {
        const popEase = easeOutBack(rawP);
        const alpha = Math.min(1, rawP * 1.6);

        const imgW = 150;
        const imgH = imgW * (inventoryThinkImg.height / inventoryThinkImg.width); // 等比（原图 1260x1680 竖图）
        const marginX = 24;
        const marginBottom = 24;

        const scale = 0.6 + popEase * 0.4;
        const slideY = (1 - rawP) * 50;

        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const baseX = marginX;
        const baseY = renderer.height - marginBottom - imgH;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(
            inventoryThinkImg,
            baseX - (drawW - imgW) / 2,
            baseY - (drawH - imgH) + slideY,
            drawW,
            drawH
        );
        ctx.restore();
    }
}

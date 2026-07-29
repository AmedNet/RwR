// src/rendering/RadioUI.js
// 电台界面 - 紧凑侧边栏设计（毛玻璃风格，对齐背包/军械库）
import { GameState } from '../core/GameState.js';
import { SupportSystem } from '../core/SupportSystem.js';
import { SupportConfig } from '../data/SupportConfig.js';
import { getRankStars } from '../core/RankSystem.js';
import { GLASS, easeOutCubic, drawGlassPanel } from './GlassUI.js';

// 毛玻璃统一字体（数字/终端信息保留等宽作军事终端味锚点）
const FONT = '-apple-system, "SF Pro Display", sans-serif';
const MONO = '"Courier New", monospace';

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

// 预加载呼叫弹出图片
const callPopupImg = new Image();
callPopupImg.src = 'src/pkg/radio/call/call.png';
let callPopupLoaded = false;
callPopupImg.onload = () => { callPopupLoaded = true; };

// 预加载“无权限打开电台”提示图片（军衔/RP 不足试图开电台时左下角弹出）
const callNoPermitImg = new Image();
callNoPermitImg.src = 'src/pkg/radio/call/call_nohave.png';
let callNoPermitLoaded = false;
callNoPermitImg.onload = () => { callNoPermitLoaded = true; };

const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
// 末端轻过冲再回弹，呼吸感（焦点滑动用，与背包/军械库本地复制体字面相同）
const easeOutBack = t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function drawRadioUI(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;
    const time = performance.now();

    const animProgress = GameState.panels.radio.progress || 0;
    const eased = easeOutCubic(animProgress);

    if (eased <= 0) return;

    // === 焦点滑动自驱 deltaTime（与背包/军械库同取法） ===
    if (GameState.focus.radioItem._lastTime == null) GameState.focus.radioItem._lastTime = time;
    const deltaTime = (time - GameState.focus.radioItem._lastTime) / 1000;
    GameState.focus.radioItem._lastTime = time;
    const dt = Math.min(deltaTime, 0.05);

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

    // 左滑入语义保留（位置/大小不变）
    const slideX = -panelW * (1 - easeOutQuint(animProgress));

    ctx.globalAlpha = eased;

    const px = panelX + slideX;

    // === 主面板：毛玻璃（染色+边框；全屏模糊背板由 Renderer 电台分支在无变换层提供） ===
    drawGlassPanel(ctx, px, panelTop, panelW, panelH, GLASS.radius);

    // === Header：SUPPORT 标签 + 军衔星 + RP + 时间 ===
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `bold 11px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SUPPORT', px + 14, panelTop + 18);

    const player = GameState.player;
    const stars = player ? getRankStars(player.rank) : 0;
    ctx.fillStyle = '#FFD740';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('★'.repeat(stars), px + 14, panelTop + 36);

    ctx.fillStyle = '#FFD700';
    ctx.font = `bold 12px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(`$${GameState.rp}`, px + panelW - 14, panelTop + 18);

    ctx.fillStyle = GLASS.textDim;
    ctx.font = `10px ${MONO}`;
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    ctx.fillText(timeStr, px + panelW - 14, panelTop + 36);

    // 顶栏与列表分隔线（仿军械库顶栏分隔线，替代原 header 填色带）
    ctx.strokeStyle = GLASS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 14, panelTop + headerH);
    ctx.lineTo(px + panelW - 14, panelTop + headerH);
    ctx.stroke();

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

    // 设置裁剪区域
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
        const { config, cooldownRemaining } = item;

        ctx.globalAlpha = cardProgress * eased;

        // 选中高亮画在焦点滑动后的 y（见循环后焦点推进），这里只画非选中项的内容
        if (isSelected) {
            const pulse = Math.sin(time * 0.004) * 0.05 + 0.95;
            const fy = GameState.focus.radioItem.y;
            // 淡蓝选中底（电台专属蓝，脉动呼吸)
            ctx.fillStyle = `rgba(100,181,246,${0.12 * pulse})`;
            ctx.beginPath();
            ctx.roundRect(px + 6, fy, panelW - 12, itemH, 4);
            ctx.fill();
            // 左侧 3px 电台蓝指示条 + 发光
            ctx.save();
            ctx.shadowColor = '#64B5F6';
            ctx.shadowBlur = 8 + pulse * 3;
            ctx.fillStyle = '#64B5F6';
            ctx.fillRect(px + 6, fy, 3, itemH);
            ctx.restore();
        }

        // 渲染图标（支持 emoji 和图片）
        if (config.icon.endsWith('.png') && iconImageLoaded[item.type]) {
            const img = iconImageCache[item.type];
            const iconSize = 28;
            ctx.drawImage(img, px + 30 - iconSize / 2, iy + itemH / 2 - iconSize / 2, iconSize, iconSize);
        } else {
            ctx.font = `22px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.icon, px + 30, iy + itemH / 2);
        }

        const textX = px + 52;
        ctx.fillStyle = isSelected ? GLASS.textPrimary : GLASS.textSecondary;
        ctx.font = `${isSelected ? 'bold ' : ''}13px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(config.name, textX, iy + 10);

        ctx.fillStyle = GLASS.textDim;
        ctx.font = `10px ${FONT}`;
        ctx.fillText(config.description, textX, iy + 28);

        const rightX = px + panelW - 14;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const canAfford = GameState.rp >= config.rpCost;
        ctx.fillStyle = canAfford ? '#FFD700' : '#ff5252';
        ctx.font = `bold 12px ${MONO}`;
        ctx.fillText(`$${config.rpCost}`, rightX, iy + 16);

        if (cooldownRemaining > 0) {
            const secs = Math.ceil(cooldownRemaining / 60);
            ctx.fillStyle = 'rgba(255,152,0,0.7)';
            ctx.font = `10px ${MONO}`;
            ctx.fillText(`${secs}s`, rightX, iy + 36);
        } else if (!canAfford) {
            ctx.fillStyle = 'rgba(255,82,82,0.5)';
            ctx.font = `9px ${FONT}`;
            ctx.fillText('RP不足', rightX, iy + 36);
        } else {
            const readyPulse = Math.sin(time * 0.005) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(102,187,106,${readyPulse})`;
            ctx.font = `bold 9px ${FONT}`;
            ctx.fillText('READY', rightX, iy + 36);
        }
    });

    // === 选中项焦点滑动：↑/↓ 切选时蓝高亮从旧项滑到新项（easeOutBack 末端轻过冲 + 随滚动实时跟随）===
    if (available.length > 0) {
        // 选中项当前 iy（含 cardSlide 与 scrollOffset，焦点随入场+滚动实时跟随选中项可见位置）
        const selCardDelay = 0.08 + selectedIndex * 0.06;
        const selCardProgress = easeOutCubic(Math.max(0, Math.min(1, (animProgress - selCardDelay) * 4)));
        const selCardSlide = (1 - selCardProgress) * 20;
        const itemTargetY = listTop + selectedIndex * (itemH + itemGap) + selCardSlide - currentScrollOffset;
        if (GameState.focus.radioItem.index !== selectedIndex) {
            if (GameState.focus.radioItem.y != null) {
                // 从半路位置出发滑过去（天然支持打断：旧动画没播完就从当前显示位置接续）
                GameState.focus.radioItem.fromY = GameState.focus.radioItem.y;
            } else {
                // 首次出现：直接定身，不滑动
                GameState.focus.radioItem.fromY = itemTargetY;
                GameState.focus.radioItem.y = itemTargetY;
            }
            GameState.focus.radioItem.anim = 0;
            GameState.focus.radioItem.index = selectedIndex;
        }
        GameState.focus.radioItem.anim = Math.min(1, GameState.focus.radioItem.anim + dt / 0.22);
        const t = easeOutBack(GameState.focus.radioItem.anim);
        GameState.focus.radioItem.y = GameState.focus.radioItem.fromY + (itemTargetY - GameState.focus.radioItem.fromY) * t;
    }

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
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(scrollbarX, listTop, 2, scrollbarH);

        // 滚动条滑块
        ctx.fillStyle = 'rgba(100,181,246,0.4)';
        ctx.fillRect(scrollbarX, thumbY, 2, thumbH);
    }

    const footerY = listTop + visibleListH + 12;
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `10px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↑/↓ 选择  回车确认  长按G关闭', px + panelW / 2, footerY);

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
        ctx.font = `10px ${MONO}`;
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
        ctx.font = `11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(
            `${sel.config.icon.endsWith('.png') ? '' : sel.config.icon} ${sel.config.name} — 点击确认呼叫`,
            px + panelW / 2, selY
        );
    }

    // === 左下角呼叫图片弹出动画 ===
    // 开启时从屏幕左下角弹出（缩放+上滑，easeOutBack 末端轻过冲呼吸感）
    // 关闭时反向收回，与电台面板共用 animProgress/eased
    if (callPopupLoaded) {
        // 相对面板延迟一点出现/消失，层次感更足
        const popDelay = 0.12;
        let popProgress;
        if (animProgress >= popDelay) {
            popProgress = Math.min(1, (animProgress - popDelay) / (1 - popDelay));
        } else {
            popProgress = 0;
        }
        if (popProgress > 0) {
            const popEase = easeOutBack(popProgress);
            const popAlpha = easeOutCubic(popProgress);

            const imgW = 150;
            const imgH = imgW * (callPopupImg.height / callPopupImg.width); // 等比（原图 1260x1680 竖图）
            const marginX = 24;
            const marginBottom = 24;

            // 缩放（0.6 -> 1，含过冲）以左下角为锚
            const scale = 0.6 + popEase * 0.4;
            // 从屏幕下方滑入（多落 60px），关闭时落回
            const slideY = (1 - popProgress) * 50;

            const drawW = imgW * scale;
            const drawH = imgH * scale;
            const baseX = marginX;
            const baseY = H - marginBottom - imgH;

            ctx.save();
            ctx.globalAlpha = eased * popAlpha;
            // 绘制坐标固定在左下角，缩放偏移让锚点落在左下
            ctx.drawImage(
                callPopupImg,
                baseX - (drawW - imgW) / 2,
                baseY - (drawH - imgH) + slideY,
                drawW,
                drawH
            );
            ctx.restore();
        }
    }

    ctx.restore();
}

export function updateRadioAnimation() {
    const now = performance.now();
    if (GameState.panels.radio._lastTime == null) GameState.panels.radio._lastTime = now;
    const deltaTime = (now - GameState.panels.radio._lastTime) / 1000;
    GameState.panels.radio._lastTime = now;
    const dt = Math.min(deltaTime, 0.05); // 防停顿后跳变

    const isClosingDir = GameState.panels.radio.direction === 'closing';
    const ANIM_SPEED_PER_SEC = isClosingDir ? 4.4 : 3.6; // 关 ~0.23s / 开 ~0.28s

    if (GameState.panels.radio.direction === 'opening') {
        GameState.panels.radio.progress = Math.min(1, GameState.panels.radio.progress + ANIM_SPEED_PER_SEC * dt);
        if (GameState.panels.radio.progress >= 1) GameState.panels.radio.direction = null;
    } else if (GameState.panels.radio.direction === 'closing') {
        GameState.panels.radio.progress = Math.max(0, GameState.panels.radio.progress - ANIM_SPEED_PER_SEC * dt);
        if (GameState.panels.radio.progress <= 0) {
            GameState.panels.radio.open = false;
            GameState.panels.radio.direction = null;
            GameState.panels.radio._lastTime = null;
            // 重置焦点滑动状态，避免下次开启从旧会话位置残留滑入（照背包 closing 收场）
            GameState.focus.radioItem.y = null;
            GameState.focus.radioItem.fromY = null;
            GameState.focus.radioItem.index = -1;
            GameState.focus.radioItem.anim = 0;
            GameState.focus.radioItem._lastTime = null;
        }
    }
}

// 无权限打开电台提示：左下角弹 call_nohave.png，弹出后保持约 2.2s 自动收回
const NO_PERMIT_HOLD_SECONDS = 2.2;
const NO_PERMIT_OPEN_SPEED = 4.0;  // ~0.25s 弹入
const NO_PERMIT_CLOSE_SPEED = 4.4; // ~0.23s 收回

export function updateRadioNoPermit() {
    if (!GameState.panels.radioNoPermit.open) return;

    const now = performance.now();
    if (GameState.panels.radioNoPermit._lastTime == null) GameState.panels.radioNoPermit._lastTime = now;
    const deltaTime = (now - GameState.panels.radioNoPermit._lastTime) / 1000;
    GameState.panels.radioNoPermit._lastTime = now;
    const dt = Math.min(deltaTime, 0.05);

    const dir = GameState.panels.radioNoPermit.direction;
    if (dir === 'opening') {
        GameState.panels.radioNoPermit.progress = Math.min(1, GameState.panels.radioNoPermit.progress + NO_PERMIT_OPEN_SPEED * dt);
        if (GameState.panels.radioNoPermit.progress >= 1) {
            GameState.panels.radioNoPermit.direction = null; // 进入保持阶段
        }
    } else if (dir === 'closing') {
        GameState.panels.radioNoPermit.progress = Math.max(0, GameState.panels.radioNoPermit.progress - NO_PERMIT_CLOSE_SPEED * dt);
        if (GameState.panels.radioNoPermit.progress <= 0) {
            // 完全收回，清场
            GameState.panels.radioNoPermit.open = false;
            GameState.panels.radioNoPermit.direction = null;
            GameState.panels.radioNoPermit.showTimer = 0;
            GameState.panels.radioNoPermit._lastTime = null;
            return;
        }
    } else {
        // 保持阶段：计时到点后启动收回
        GameState.panels.radioNoPermit.showTimer += dt;
        if (GameState.panels.radioNoPermit.showTimer >= NO_PERMIT_HOLD_SECONDS) {
            GameState.panels.radioNoPermit.direction = 'closing';
        }
    }
}

// 绘制无权限提示图（左下角弹出；与电台面板完全独立，电台此时并未打开）
export function drawRadioNoPermit(ctx, renderer) {
    if (!GameState.panels.radioNoPermit.open || !callNoPermitLoaded) return;
    const p = GameState.panels.radioNoPermit.progress;
    if (p <= 0) return;

    const H = renderer.height;

    // 弹入/弹出共用同一条进度曲线：opening 时 p 0→1，closing 时 p 1→0
    // easeOutBack 在 p 接近 1 时略过冲，呼吸感；收回时 p 减小自然回落
    const eased = easeOutBack(p);
    const alpha = Math.min(1, p * 1.6); // 快速显形，避免边弹边透

    const imgW = 150;
    const imgH = imgW * (callNoPermitImg.height / callNoPermitImg.width); // 等比（原图竖图）
    const marginX = 24;
    const marginBottom = 24;

    // 缩放 0.6→1（含过冲），锚点固定屏幕左下角
    const scale = 0.6 + eased * 0.4;
    const slideY = (1 - p) * 50; // 从下方滑入，收回时落回

    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const baseX = marginX;
    const baseY = H - marginBottom - imgH;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(
        callNoPermitImg,
        baseX - (drawW - imgW) / 2,
        baseY - (drawH - imgH) + slideY,
        drawW,
        drawH
    );
    ctx.restore();
}

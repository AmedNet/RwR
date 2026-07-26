// src/rendering/SettingsUI.js
// 设置面板 - 毛玻璃风格，对齐军械库/背包/电台（自驱 deltaTime 动画 + 热区写入 GameState）
// 左侧三分类 tab（图像/声音/控制，easeOutBack 滑动指示器）+ 右侧控件
import { GameState } from '../core/GameState.js';
import { GLASS, easeOutCubic, easeOutBack, drawGlassPanel } from './GlassUI.js';
import {
    Settings, WEATHER_LEVELS, BLOOD_LEVELS, LEVEL_LABELS,
    CROSSHAIR_STYLES, CROSSHAIR_COLORS, ACTION_LABELS, CONTROL_ORDER, keyLabel,
} from '../data/Settings.js';

const FONT = '-apple-system, "SF Pro Display", sans-serif';
const MONO = '"Courier New", monospace';

const TABS = [
    { name: '图像', color: '#4CAF50' },
    { name: '声音', color: '#2196F3' },
    { name: '控制', color: '#FF9800' },
];

// 设置面板动画推进（自驱 deltaTime，倒带式，镜像 RadioUI.updateRadioAnimation）
export function updateSettingsAnimation() {
    const now = performance.now();
    if (GameState._settingsAnimLastTime == null) GameState._settingsAnimLastTime = now;
    const dt = Math.min((now - GameState._settingsAnimLastTime) / 1000, 0.05);
    GameState._settingsAnimLastTime = now;

    const speed = GameState.settingsAnimDirection === 'closing' ? 4.4 : 3.6;
    if (GameState.settingsAnimDirection === 'opening') {
        GameState.settingsAnimProgress = Math.min(1, GameState.settingsAnimProgress + speed * dt);
        if (GameState.settingsAnimProgress >= 1) GameState.settingsAnimDirection = null;
    } else if (GameState.settingsAnimDirection === 'closing') {
        GameState.settingsAnimProgress = Math.max(0, GameState.settingsAnimProgress - speed * dt);
        if (GameState.settingsAnimProgress <= 0) {
            GameState.settingsOpen = false;
            GameState.settingsAnimDirection = null;
            GameState._settingsAnimLastTime = null;
            GameState.keybindCapturing = null;
        }
    }
}

// ─── 控件绘制辅助（每个都把热区 push 进 GameState.settingsHitAreas） ───

// 开关 toggle：圆角 pill，on/off 换底色
function drawToggle(ctx, areas, label, id, value, x, y, w) {
    const rowH = 40;
    ctx.fillStyle = GLASS.textSecondary;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + rowH / 2);

    const pillW = 52, pillH = 26;
    const px = x + w - pillW;
    const py = y + rowH / 2 - pillH / 2;
    ctx.fillStyle = value ? 'rgba(74,222,128,0.85)' : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, pillH / 2);
    ctx.fill();
    // 滑块圆钮
    const knobR = pillH / 2 - 3;
    const knobX = value ? px + pillW - pillH / 2 : px + pillH / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(knobX, py + pillH / 2, knobR, 0, Math.PI * 2);
    ctx.fill();

    areas.push({ type: 'toggle', id, x: px, y: py, w: pillW, h: pillH });
    return y + rowH;
}

// 分段 segment：多档按钮组
function drawSegment(ctx, areas, label, id, levels, current, labelMap, x, y, w) {
    const rowH = 40;
    ctx.fillStyle = GLASS.textSecondary;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + rowH / 2);

    const segCount = levels.length;
    const segGap = 6;
    const segTotalW = w * 0.55;
    const segW = (segTotalW - segGap * (segCount - 1)) / segCount;
    const segH = 28;
    const startX = x + w - segTotalW;
    const segY = y + rowH / 2 - segH / 2;

    levels.forEach((lv, i) => {
        const sx = startX + i * (segW + segGap);
        const active = lv === current;
        ctx.fillStyle = active ? 'rgba(100,180,255,0.28)' : 'rgba(20,30,45,0.6)';
        ctx.beginPath();
        ctx.roundRect(sx, segY, segW, segH, 6);
        ctx.fill();
        ctx.strokeStyle = active ? GLASS.slotActiveBorder : GLASS.border;
        ctx.lineWidth = active ? 1.5 : 1;
        ctx.stroke();
        ctx.fillStyle = active ? GLASS.textPrimary : GLASS.textDim;
        ctx.font = `${active ? '600 ' : ''}12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelMap ? labelMap[lv] : lv, sx + segW / 2, segY + segH / 2);
        areas.push({ type: 'segment', id, value: lv, x: sx, y: segY, w: segW, h: segH });
    });
    return y + rowH;
}

// 滑块 slider：轨道 + 手柄（热区含 trackX/trackW 供拖动换算）
function drawSlider(ctx, areas, label, id, value, x, y, w) {
    const rowH = 44;
    ctx.fillStyle = GLASS.textSecondary;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + rowH / 2 - 8);
    // 百分比数值
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(value * 100) + '%', x + w, y + rowH / 2 - 8);

    const trackX = x;
    const trackW = w;
    const trackH = 6;
    const trackY = y + rowH / 2 + 8;
    // 轨道底
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(trackX, trackY, trackW, trackH, trackH / 2);
    ctx.fill();
    // 已填充
    ctx.fillStyle = 'rgba(100,180,255,0.8)';
    ctx.beginPath();
    ctx.roundRect(trackX, trackY, trackW * value, trackH, trackH / 2);
    ctx.fill();
    // 手柄
    const handleX = trackX + trackW * value;
    const handleR = 9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(handleX, trackY + trackH / 2, handleR, 0, Math.PI * 2);
    ctx.fill();

    // 热区：整条轨道区域（含手柄命中范围），供 mousedown/mousemove 拖动
    areas.push({ type: 'slider', id, x: trackX, y: trackY - 12, w: trackW, h: trackH + 24, trackX, trackW });
    return y + rowH;
}

// 颜色选择：预设色块
function drawColorPicker(ctx, areas, label, id, current, x, y, w) {
    const rowH = 44;
    ctx.fillStyle = GLASS.textSecondary;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + rowH / 2);

    const swatchSize = 26, gap = 8;
    const totalW = CROSSHAIR_COLORS.length * (swatchSize + gap) - gap;
    let sx = x + w - totalW;
    const sy = y + rowH / 2 - swatchSize / 2;
    for (const c of CROSSHAIR_COLORS) {
        const active = c.value === current;
        if (c.swatch) {
            ctx.fillStyle = c.swatch;
            ctx.beginPath();
            ctx.roundRect(sx, sy, swatchSize, swatchSize, 6);
            ctx.fill();
        } else {
            // 「默认」色块：斜纹示意（跟随武器色）
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.roundRect(sx, sy, swatchSize, swatchSize, 6);
            ctx.fill();
            ctx.strokeStyle = GLASS.textDim;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx + 5, sy + swatchSize - 5);
            ctx.lineTo(sx + swatchSize - 5, sy + 5);
            ctx.stroke();
        }
        if (active) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(sx - 2, sy - 2, swatchSize + 4, swatchSize + 4, 8);
            ctx.stroke();
        }
        ctx.strokeStyle = GLASS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(sx, sy, swatchSize, swatchSize, 6);
        ctx.stroke();
        areas.push({ type: 'color', id, value: c.value, x: sx, y: sy, w: swatchSize, h: swatchSize });
        sx += swatchSize + gap;
    }
    return y + rowH;
}

// 键位行：动作名 + 当前键 chip（点击进捕获态）
function drawKeybindRow(ctx, areas, action, x, y, w, capturing) {
    const rowH = 32;
    ctx.fillStyle = GLASS.textSecondary;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(ACTION_LABELS[action], x, y + rowH / 2);

    const chipW = 96, chipH = 28;
    const chipX = x + w - chipW;
    const chipY = y + rowH / 2 - chipH / 2;
    const isCapturing = capturing === action;
    const pulse = isCapturing ? (Math.sin(performance.now() * 0.006) * 0.15 + 0.85) : 1;

    ctx.fillStyle = isCapturing ? `rgba(255,152,0,${0.28 * pulse})` : 'rgba(20,30,45,0.6)';
    ctx.beginPath();
    ctx.roundRect(chipX, chipY, chipW, chipH, 6);
    ctx.fill();
    ctx.strokeStyle = isCapturing ? '#FF9800' : GLASS.border;
    ctx.lineWidth = isCapturing ? 1.5 : 1;
    ctx.stroke();

    ctx.fillStyle = isCapturing ? '#FF9800' : GLASS.textPrimary;
    ctx.font = `${isCapturing ? '600 ' : ''}13px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isCapturing ? '按下新键…' : keyLabel(Settings.controls[action]), chipX + chipW / 2, chipY + chipH / 2);

    areas.push({ type: 'keybind', id: action, x: chipX, y: chipY, w: chipW, h: chipH });
    return y + rowH;
}

// ─── 主绘制 ───
export function drawSettings(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;

    const rawP = GameState.settingsAnimProgress || 0;
    const eased = easeOutCubic(rawP);
    if (eased <= 0) { GameState.settingsHitAreas = []; return; }

    // 焦点滑动自驱 deltaTime（tab 指示器用）
    const time = performance.now();
    if (GameState._settingsTabFocusLastTime == null) GameState._settingsTabFocusLastTime = time;
    const dt = Math.min((time - GameState._settingsTabFocusLastTime) / 1000, 0.05);
    GameState._settingsTabFocusLastTime = time;

    // 缩放 + 上浮 + 淡入
    const scaleP = GameState.settingsAnimDirection === 'opening' ? easeOutBack(rawP) : rawP;
    const scale = 0.94 + 0.06 * scaleP;
    const offsetY = (1 - scaleP) * 20;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -H / 2 + offsetY);
    ctx.globalAlpha = eased;

    // 布局
    const sideBarW = 130, sideBarItemH = 46, sideBarGap = 8, groupGap = 14;
    const contentW = 460;
    const groupW = sideBarW + groupGap + contentW;
    const groupX = W / 2 - groupW / 2;
    const sideBarX = groupX;
    const contentX = groupX + sideBarW + groupGap;

    const headerH = 56, innerPad = 20;
    const cardW = groupW + innerPad * 2;
    // 卡片高度：取「容纳最高页（控制页 12 键位行）」与「视口留白」的较小值，防小屏出界
    const cardH = Math.min(620, H - 32);
    const cardX = W / 2 - cardW / 2;
    const cardY = H / 2 - cardH / 2;

    drawGlassPanel(ctx, cardX, cardY, cardW, cardH, GLASS.radius);

    // 顶栏标题
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `bold 28px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('S E T T I N G S', cardX + innerPad, cardY + headerH / 2);
    ctx.strokeStyle = GLASS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + innerPad, cardY + headerH);
    ctx.lineTo(cardX + cardW - innerPad, cardY + headerH);
    ctx.stroke();

    const contentTop = cardY + headerH + innerPad;

    // 热区数组（每次重绘清空重建）
    const areas = [];

    // === 左侧分类 tab ===
    TABS.forEach((tab, i) => {
        const ty = contentTop + i * (sideBarItemH + sideBarGap);
        const isActive = i === GameState.settingsTab;
        drawGlassPanel(ctx, sideBarX, ty, sideBarW, sideBarItemH, GLASS.radiusSmall);
        ctx.fillStyle = isActive ? GLASS.textPrimary : GLASS.textDim;
        ctx.font = `${isActive ? '600 ' : ''}15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tab.name, sideBarX + sideBarW / 2, ty + sideBarItemH / 2);
        areas.push({ type: 'tab', id: i, x: sideBarX, y: ty, w: sideBarW, h: sideBarItemH });
    });

    // tab 高亮条焦点滑动（easeOutBack，镜像 ArsenalUI 分类高亮）
    const tabTargetY = contentTop + GameState.settingsTab * (sideBarItemH + sideBarGap);
    if (GameState.settingsTabFocusIndex !== GameState.settingsTab) {
        if (GameState.settingsTabFocusY != null) {
            GameState.settingsTabFocusFromY = GameState.settingsTabFocusY;
        } else {
            GameState.settingsTabFocusFromY = tabTargetY;
            GameState.settingsTabFocusY = tabTargetY;
        }
        GameState.settingsTabFocusAnim = 0;
        GameState.settingsTabFocusIndex = GameState.settingsTab;
    }
    GameState.settingsTabFocusAnim = Math.min(1, GameState.settingsTabFocusAnim + dt / 0.22);
    const tabT = easeOutBack(GameState.settingsTabFocusAnim);
    GameState.settingsTabFocusY = GameState.settingsTabFocusFromY + (tabTargetY - GameState.settingsTabFocusFromY) * tabT;

    const activeTab = TABS[GameState.settingsTab];
    const fy = GameState.settingsTabFocusY;
    ctx.save();
    ctx.fillStyle = activeTab.color + '29'; // ~16% alpha
    ctx.beginPath();
    ctx.roundRect(sideBarX, fy, sideBarW, sideBarItemH, GLASS.radiusSmall);
    ctx.fill();
    ctx.shadowColor = activeTab.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = activeTab.color;
    ctx.beginPath();
    ctx.roundRect(sideBarX, fy, 3, sideBarItemH, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = activeTab.color + 'b3';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(sideBarX, fy, sideBarW, sideBarItemH, GLASS.radiusSmall);
    ctx.stroke();
    ctx.restore();

    // === 右侧内容区 ===
    drawGlassPanel(ctx, contentX, contentTop, contentW, cardH - headerH - innerPad * 2, GLASS.radius);
    const cx = contentX + 24;
    const cw = contentW - 48;
    let cy = contentTop + 20;
    const rowGap = 12;

    if (GameState.settingsTab === 0) {
        // ─── 图像 ───
        cy = drawToggle(ctx, areas, 'Bloom 辉光', 'bloom', Settings.graphics.bloom, cx, cy, cw) + rowGap;
        cy = drawSegment(ctx, areas, '天气粒子密度', 'weatherDensity', WEATHER_LEVELS, Settings.graphics.weatherDensity, LEVEL_LABELS, cx, cy, cw) + rowGap;
        cy = drawSegment(ctx, areas, '血迹密度', 'bloodLevel', BLOOD_LEVELS, Settings.graphics.bloodLevel, LEVEL_LABELS, cx, cy, cw) + rowGap;
        cy = drawToggle(ctx, areas, '画面抖动', 'shake', Settings.graphics.shake, cx, cy, cw) + rowGap;
        cy = drawSegment(ctx, areas, '准星样式', 'crosshairStyle', CROSSHAIR_STYLES.map(s => s.id), Settings.graphics.crosshairStyle, Object.fromEntries(CROSSHAIR_STYLES.map(s => [s.id, s.label])), cx, cy, cw) + rowGap;
        cy = drawColorPicker(ctx, areas, '准星颜色', 'crosshairColor', Settings.graphics.crosshairColor, cx, cy, cw) + rowGap;
        cy = drawToggle(ctx, areas, '小地图', 'minimap', Settings.graphics.minimap, cx, cy, cw) + rowGap;
        cy = drawToggle(ctx, areas, '伤害数字', 'damageNumbers', Settings.graphics.damageNumbers, cx, cy, cw);
    } else if (GameState.settingsTab === 1) {
        // ─── 声音 ───
        cy = drawSlider(ctx, areas, '主音量', 'master', Settings.audio.master, cx, cy, cw) + rowGap;
        cy = drawSlider(ctx, areas, '环境音', 'ambient', Settings.audio.ambient, cx, cy, cw) + rowGap;
        cy = drawSlider(ctx, areas, '枪械 / 爆炸', 'sfx', Settings.audio.sfx, cx, cy, cw) + rowGap;
        cy = drawSlider(ctx, areas, 'UI 音效', 'ui', Settings.audio.ui, cx, cy, cw) + rowGap;
        cy = drawToggle(ctx, areas, '失焦时静音', 'muteOnBlur', Settings.audio.muteOnBlur, cx, cy, cw);
    } else {
        // ─── 控制 ───
        for (const action of CONTROL_ORDER) {
            cy = drawKeybindRow(ctx, areas, action, cx, cy, cw, GameState.keybindCapturing) + 4;
        }
        // 恢复默认按钮
        cy += rowGap;
        const btnW = 140, btnH = 38;
        const btnX = cx + cw - btnW;
        const hover = GameState.mouse.x >= btnX && GameState.mouse.x <= btnX + btnW &&
                      GameState.mouse.y >= cy && GameState.mouse.y <= cy + btnH;
        ctx.fillStyle = hover ? 'rgba(255,152,0,0.2)' : 'rgba(20,30,45,0.6)';
        ctx.beginPath();
        ctx.roundRect(btnX, cy, btnW, btnH, GLASS.radiusSmall);
        ctx.fill();
        ctx.strokeStyle = hover ? '#FF9800' : GLASS.border;
        ctx.lineWidth = hover ? 1.5 : 1;
        ctx.stroke();
        ctx.fillStyle = hover ? GLASS.textPrimary : GLASS.textSecondary;
        ctx.font = `${hover ? '600 ' : ''}14px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('恢复默认', btnX + btnW / 2, cy + btnH / 2);
        areas.push({ type: 'button', id: 'resetControls', x: btnX, y: cy, w: btnW, h: btnH });
    }

    // 左下角「ESC 返回」提示（所有 tab 常驻；设置面板统一由 ESC 关闭——游戏内退回暂停菜单，主菜单内关闭设置）
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ESC 返回', sideBarX + sideBarW / 2, cardY + cardH - innerPad - sideBarItemH / 2);

    GameState.settingsHitAreas = areas;
    ctx.restore();
}

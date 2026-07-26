// src/rendering/MainMenuUI.js
// 主菜单流程的三个阶段界面（loading / presskey / menu），纯 Canvas 绘制。
// 复用 GlassUI 设计系统（GLASS 调色板 + drawGlassPanel + drawProgressBar + easeOut*），
// 按钮画法镜像 PauseMenuUI.js:74-101，热区写入 GameState.mainMenuHitAreas 供 MainMenuHandler 命中。
import { GameState } from '../core/GameState.js';
import { GLASS, easeOutCubic, easeOutBack, drawGlassPanel, drawProgressBar } from './GlassUI.js';
import { getModePreviewImage } from '../core/AssetLoader.js';

const FONT = '-apple-system, "SF Pro Display", sans-serif';
const MONO = '"Courier New", monospace';

// 深色底（loading / presskey 阶段全屏铺底，与 body 背景同族）
const DARK_BG = '#0d1017';

// 模式预览图（悬停某模式时右侧弹出）由 AssetLoader 统一持有解码后的 Image 对象，
// 经 getModePreviewImage() 复用（不再各自 new Image，避免重复请求/解码）。

// ─── 主菜单出现动画（单向淡入 0→1，无中途反向；进入 menu 时由 main.js 归零） ───
export function updateMenuAnimation() {
    const now = performance.now();
    if (GameState._mainMenuAnimLastTime == null) GameState._mainMenuAnimLastTime = now;
    const dt = Math.min((now - GameState._mainMenuAnimLastTime) / 1000, 0.05);
    GameState._mainMenuAnimLastTime = now;

    if (GameState.mainMenuAnimProgress < 1) {
        GameState.mainMenuAnimProgress = Math.min(1, GameState.mainMenuAnimProgress + 3.2 * dt); // ~0.31s
    }
}

// ─── 阶段一：加载界面（标题 + 进度条 + 旋转加载动画） ───
export function drawLoadingScreen(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;

    ctx.fillStyle = DARK_BG;
    ctx.fillRect(0, 0, W, H);

    // 标题
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `bold 46px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R w R', W / 2, H / 2 - 70);

    // 加载失败：显示错误信息并停止进度条/转圈（runLoading 捕获异常时写入 loadError，避免永久转圈）
    if (GameState.loadError) {
        ctx.fillStyle = '#ff6b6b';
        ctx.font = `14px ${FONT}`;
        ctx.fillText('加载失败', W / 2, H / 2 + 10);
        ctx.fillStyle = GLASS.textDim;
        ctx.font = `12px ${MONO}`;
        ctx.fillText(String(GameState.loadError), W / 2, H / 2 + 34);
        return;
    }

    // 进度条（读 GameState.loadProgress，由 AssetLoader 回调写入）
    const ratio = Math.max(0, Math.min(1, GameState.loadProgress || 0));
    const barW = Math.min(420, W * 0.6);
    const barH = 8;
    const barX = W / 2 - barW / 2;
    const barY = H / 2 + 6;
    drawProgressBar(ctx, barX, barY, barW, barH, ratio, GLASS.slotActiveBorder);

    // 百分比
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${MONO}`;
    ctx.fillText(`${Math.round(ratio * 100)}%`, W / 2, barY + 26);

    // 旋转加载动画
    const t = performance.now() / 1000;
    ctx.save();
    ctx.translate(W / 2, H / 2 + 70);
    ctx.rotate(t * 2.4);
    ctx.strokeStyle = GLASS.slotActiveBorder;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 1.4);
    ctx.stroke();
    ctx.restore();
}

// ─── 阶段二：按任意键界面（深色全屏 + 底部呼吸小字） ───
export function drawPressKeyScreen(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;

    ctx.fillStyle = DARK_BG;
    ctx.fillRect(0, 0, W, H);

    // 中央标题（淡）
    ctx.fillStyle = 'rgba(224, 224, 224, 0.85)';
    ctx.font = `bold 46px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R w R', W / 2, H / 2 - 20);

    // 底部呼吸小字（透明度正弦呼吸 0.35~0.65）；warming 阶段改显示「正在生成战场…」
    const t = performance.now() / 1000;
    const alpha = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.2));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctx.font = `14px ${FONT}`;
    ctx.fillText(GameState.phase === 'warming' ? '正在生成战场…' : '按任意按键开始游戏', W / 2, H - 60);
}

// ─── 阶段三：主菜单（玻璃面板 + 五按钮，叠在活战斗上，轻微压暗不模糊） ───
export function drawMainMenu(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;

    const rawP = GameState.mainMenuAnimProgress || 0;
    const eased = easeOutCubic(rawP);
    if (eased <= 0) { GameState.mainMenuHitAreas = []; return; }

    // 轻微压暗全屏（不模糊，背景战斗仍清晰可见）
    ctx.save();
    ctx.globalAlpha = eased;
    ctx.fillStyle = 'rgba(8, 11, 18, 0.38)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 面板缩放 + 上浮 + 淡入（easeOutBack 末端回弹）
    const scaleP = easeOutBack(rawP);
    const scale = 0.94 + 0.06 * scaleP;
    const offsetY = (1 - scaleP) * 22;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -H / 2 + offsetY);
    ctx.globalAlpha = eased;

    // 按钮定义（quick/campaign 未开放，disabled 灰显且点了无反应）
    const buttons = [
        { id: 'battle',   label: '战地模式' },
        { id: 'quick',    label: '快速开始', disabled: true },
        { id: 'campaign', label: '战役模式', disabled: true },
        { id: 'settings', label: '设  置' },
        { id: 'quit',     label: '退出游戏' },
    ];

    // 面板尺寸（按按钮数量自适应高度）
    const panelW = 340;
    const btnW = 240, btnH = 50, btnGap = 14;
    const headerH = 116;
    const bottomPad = 34;
    const panelH = headerH + buttons.length * btnH + (buttons.length - 1) * btnGap + bottomPad;
    const px = W / 2 - panelW / 2;
    const py = Math.max(16, H / 2 - panelH / 2);

    drawGlassPanel(ctx, px, py, panelW, panelH, GLASS.radius);

    // 标题
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `bold 34px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R w R', W / 2, py + 50);
    ctx.fillStyle = GLASS.textDim;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('M A I N   M E N U', W / 2, py + 80);

    // 分隔线
    ctx.strokeStyle = GLASS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 24, py + headerH - 12);
    ctx.lineTo(px + panelW - 24, py + headerH - 12);
    ctx.stroke();

    // 按钮（热区写入 GameState.mainMenuHitAreas，供 MainMenuHandler 命中检测）
    GameState.mainMenuHitAreas = [];
    const btnX = W / 2 - btnW / 2;
    const mouse = GameState.mouse;
    let by = py + headerH;
    let hoveredModeId = null; // 当前悬停且有预览图的模式 id（供右侧预览卡片）
    for (const btn of buttons) {
        // 几何 hover 对所有按钮生效（含灰色未开放模式，使其有高亮动效）；文字色仍按 disabled 区分
        const hover =
            mouse.x >= btnX && mouse.x <= btnX + btnW &&
            mouse.y >= by && mouse.y <= by + btnH;
        if (hover && getModePreviewImage(btn.id)) hoveredModeId = btn.id;
        // hover 高亮底
        ctx.fillStyle = hover ? 'rgba(100,180,255,0.16)' : 'rgba(20,30,45,0.6)';
        ctx.beginPath();
        ctx.roundRect(btnX, by, btnW, btnH, GLASS.radiusSmall);
        ctx.fill();
        ctx.strokeStyle = hover ? GLASS.slotActiveBorder : GLASS.border;
        ctx.lineWidth = hover ? 1.5 : 1;
        ctx.stroke();
        // 文字（disabled 更暗）
        ctx.fillStyle = btn.disabled ? GLASS.textDim : (hover ? GLASS.textPrimary : GLASS.textSecondary);
        ctx.font = `${hover ? '600 ' : ''}16px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, W / 2, by + btnH / 2);

        GameState.mainMenuHitAreas.push({ id: btn.id, x: btnX, y: by, w: btnW, h: btnH, disabled: !!btn.disabled });
        by += btnH + btnGap;
    }

    // 右侧模式预览卡片（悬停弹出，倒带式开/关动画）
    drawModePreview(ctx, hoveredModeId, px, py, panelW, panelH, W, H, eased);

    ctx.restore();
}

// ─── 右侧模式预览卡片（悬停某模式时从面板右缘弹出） ───
// 状态机镜像 updateSettingsAnimation 的倒带逻辑：换目标重新弹，移开渐出保留旧图。
function drawModePreview(ctx, hoveredModeId, px, py, panelW, panelH, W, H, eased) {
    // 状态机推进（自驱 deltaTime，首帧 dt=0）
    const now = performance.now();
    if (GameState._menuPreviewLastTime == null) GameState._menuPreviewLastTime = now;
    const dt = Math.min((now - GameState._menuPreviewLastTime) / 1000, 0.05);
    GameState._menuPreviewLastTime = now;

    if (hoveredModeId && hoveredModeId !== GameState.menuPreviewId) {
        // 换图：重新弹出
        GameState.menuPreviewId = hoveredModeId;
        GameState.menuPreviewAnim = 0;
        GameState.menuPreviewDirection = 'opening';
    } else if (hoveredModeId && hoveredModeId === GameState.menuPreviewId) {
        GameState.menuPreviewDirection = 'opening';
    } else if (!hoveredModeId && GameState.menuPreviewId) {
        GameState.menuPreviewDirection = 'closing';
    }

    const speed = 6; // ~0.17s 弹出
    if (GameState.menuPreviewDirection === 'opening') {
        GameState.menuPreviewAnim = Math.min(1, GameState.menuPreviewAnim + speed * dt);
        if (GameState.menuPreviewAnim >= 1) GameState.menuPreviewDirection = null;
    } else if (GameState.menuPreviewDirection === 'closing') {
        GameState.menuPreviewAnim = Math.max(0, GameState.menuPreviewAnim - speed * dt);
        if (GameState.menuPreviewAnim <= 0) {
            GameState.menuPreviewId = null;
            GameState.menuPreviewDirection = null;
        }
    }

    const id = GameState.menuPreviewId;
    const anim = GameState.menuPreviewAnim;
    const img = id ? getModePreviewImage(id) : null;
    if (!img || anim <= 0 || !img.complete || !img.naturalWidth) return;

    // 几何：面板右缘外，竖直与面板居中；aspect 自校正；超右边界则按可用宽 shrink
    const aspect = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 4 / 3;
    const gap = 22;
    let cardH = Math.min(panelH * 0.82, H * 0.62);
    let cardW = cardH * aspect;
    const cardX = px + panelW + gap;
    const maxRight = W - 16;
    if (cardX + cardW > maxRight) {
        cardW = Math.max(0, maxRight - cardX);
        cardH = cardW / aspect;
    }
    if (cardW <= 0 || cardH <= 0) return;
    const cardY = py + panelH / 2 - cardH / 2;

    // 动画：easeOutCubic 控 alpha + 左→右滑入，easeOutBack 控 scale（锚点=卡片左缘中点，从面板边缘向外长出）
    const appear = easeOutCubic(anim);
    const scale = 0.9 + 0.1 * easeOutBack(anim);
    const slideX = (1 - appear) * -16;

    ctx.save();
    ctx.globalAlpha = eased * appear;
    const anchorX = cardX;
    const anchorY = cardY + cardH / 2;
    ctx.translate(anchorX + slideX, anchorY);
    ctx.scale(scale, scale);
    ctx.translate(-anchorX, -anchorY);

    // 卡背（取 drawGlassPanel 的柔和阴影；其 bg/边框会被图片盖住）
    drawGlassPanel(ctx, cardX, cardY, cardW, cardH, GLASS.radiusSmall);

    // 图片 + 液态玻璃质感（圆角裁剪区内：铺图 → 顶部反光/底部微暗渐变）
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, GLASS.radiusSmall);
    ctx.clip();
    ctx.drawImage(img, cardX, cardY, cardW, cardH);
    const sheen = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    sheen.addColorStop(0, 'rgba(255,255,255,0.20)');   // 顶部反光
    sheen.addColorStop(0.4, 'rgba(255,255,255,0.03)');
    sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.15)');         // 底部微暗，增加玻璃厚度感
    ctx.fillStyle = sheen;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.restore();

    // 玻璃边框渐变（镜像 drawGlassPanel 描边）+ 顶部高光线
    const border = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    border.addColorStop(0, GLASS.borderHighlight);
    border.addColorStop(0.5, GLASS.border);
    border.addColorStop(1, 'rgba(255,255,255,0.12)');
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, GLASS.radiusSmall);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + GLASS.radiusSmall, cardY + 0.5);
    ctx.lineTo(cardX + cardW - GLASS.radiusSmall, cardY + 0.5);
    ctx.stroke();

    ctx.restore();
}

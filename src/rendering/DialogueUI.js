// src/rendering/DialogueUI.js
// 全屏对话演出层（开局简报等 galgame 式对话）— 毛玻璃风格，对齐暂停菜单/电台。
// 三段式镜像 PauseMenuUI.js：updateDialogueAnimation（倒带式 deltaTime）+ drawDialogue（全屏绘制）。
// 打字机进度由 DialogueSystem.update 在本文件 update 里推进（世界冻结期唯一每帧 tick 的地方）。
//
// 布局：只显示当前说话者立绘，站在对话框上沿之上；对话框在其下方并稍向对侧让位。
import { GameState } from '../core/GameState.js';
import { DialogueSystem } from '../utils/DialogueSystem.js';
import { GLASS, easeOutCubic, drawGlassPanel } from './GlassUI.js';

const FONT = '-apple-system, "SF Pro Display", "PingFang SC", sans-serif';
const MONO = '"Courier New", monospace';

// ─── 立绘预加载（模块顶层，镜像 RadioUI.js 的 new Image + loaded 标志范式） ───
const commanderImg = new Image();
commanderImg.src = 'src/pkg/character/blue/Commander/Commander.png';
let commanderLoaded = false;
commanderImg.onload = () => { commanderLoaded = true; };

const receivedImg = new Image();
receivedImg.src = 'src/pkg/character/blue/a/Received.png';
let receivedLoaded = false;
receivedImg.onload = () => { receivedLoaded = true; };

// hex '#rrggbb' → 'rgba(r,g,b,a)'
function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ─── 说话者切换过渡（切换时立绘从该侧滑入淡入） ───
let _lastSpeaker = null;
let _switchTime = 0; // 上次切换的 performance.now()

// 绘制单张立绘：以底部中心为锚点，等比缩放到目标高度 h。
// 说话时只做"呼吸式"上下浮动：慢速、非匀速的垂直位移，脚底基本踩实。
function drawPortrait(ctx, img, loaded, cx, feetY, h, alpha, talking, t) {
    if (!loaded || alpha <= 0) return;
    const w = h * (img.width / img.height); // 等比（原图 1260x1680 竖图）

    // 说话起伏：纯正弦上下动（去掉谐波 → 速度/加速度连续，丝滑不卡顿）。
    // 静默时完全不动（offY=0），只有说话才动。频率 ~1.1Hz，慢速呼吸感。
    const offY = talking ? Math.sin(t * 7.0) * 11 : 0;

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(cx, feetY + offY);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
}

// ─── 对话动画推进（倒带式 deltaTime，镜像 PauseMenuUI.updatePauseAnimation） ───
export function updateDialogueAnimation() {
    // 打字机推进（世界冻结期仍每帧 tick，因为本函数在 Renderer.render 顶部无条件调用）
    DialogueSystem.update();

    const now = performance.now();
    if (GameState._dialogueAnimLastTime == null) GameState._dialogueAnimLastTime = now;
    const dt = Math.min((now - GameState._dialogueAnimLastTime) / 1000, 0.05);
    GameState._dialogueAnimLastTime = now;

    const speed = GameState.dialogueAnimDirection === 'closing' ? 4.4 : 3.6; // 关 ~0.23s / 开 ~0.28s
    if (GameState.dialogueAnimDirection === 'opening') {
        GameState.dialogueAnimProgress = Math.min(1, GameState.dialogueAnimProgress + speed * dt);
        if (GameState.dialogueAnimProgress >= 1) GameState.dialogueAnimDirection = null;
    } else if (GameState.dialogueAnimDirection === 'closing') {
        GameState.dialogueAnimProgress = Math.max(0, GameState.dialogueAnimProgress - speed * dt);
        if (GameState.dialogueAnimProgress <= 0) {
            GameState.dialogueOpen = false;           // 关闭动画播完才真正解冻世界
            GameState.dialogueAnimDirection = null;
            GameState._dialogueAnimLastTime = null;
        }
    }
}

// ─── 全屏对话绘制 ───
export function drawDialogue(ctx, renderer) {
    const W = renderer.width;
    const H = renderer.height;

    const rawP = GameState.dialogueAnimProgress || 0;
    const eased = easeOutCubic(rawP);
    if (eased <= 0) { GameState.dialogueHitAreas = []; return; }

    const line = DialogueSystem.getCurrentLine();
    const t = performance.now() / 1000;
    const speaker = line ? line.speaker : 'commander';
    const typing = DialogueSystem.isTyping();

    // 说话者切换过渡：换人时立绘从该侧滑入（~250ms）
    if (speaker !== _lastSpeaker) {
        _lastSpeaker = speaker;
        _switchTime = performance.now();
    }
    const switchEase = easeOutCubic(Math.min(1, (performance.now() - _switchTime) / 250));

    // === 底部对话框（人物贴图下方，稍向对话方对侧让位） ===
    const boxH = H * 0.26;
    const boxY = H - boxH - 22;
    const nudge = W * 0.10;                 // 让位距离（稍微）
    const boxW = W - 48 - nudge;
    // 指挥官立绘在左 → 对话框右移让位；Received 立绘在右 → 对话框靠左让位
    const boxX = speaker === 'commander' ? 24 + nudge : 24;

    // === 当前说话者立绘（只显示一张，站在对话框上沿之上） ===
    const img = speaker === 'commander' ? commanderImg : receivedImg;
    const loaded = speaker === 'commander' ? commanderLoaded : receivedLoaded;
    const pCx = speaker === 'commander' ? W * 0.30 : W * 0.70;
    const feetY = boxY;                     // 脚踩对话框上沿
    const pH = feetY - H * 0.07;            // 头顶留白
    // 切换时从该侧滑入
    const fromSide = speaker === 'commander' ? -1 : 1;
    const slideX = (1 - switchEase) * fromSide * 70;
    drawPortrait(ctx, img, loaded, pCx + slideX, feetY, pH, eased * switchEase, typing, t);

    // === 对话框 ===
    ctx.save();
    ctx.globalAlpha = eased;
    drawGlassPanel(ctx, boxX, boxY, boxW, boxH, GLASS.radius);

    // 说话者颜色细点缀条（顶部，替代姓名牌，仅以色示意，不显示名字）
    if (line) {
        ctx.fillStyle = hexToRgba(line.color, 0.85);
        ctx.beginPath();
        ctx.roundRect(boxX + 24, boxY + 10, 42, 4, 2);
        ctx.fill();
    }

    // --- 文字区（打字机 + measureText 自动换行，镜像 BubbleRenderer） ---
    const visible = DialogueSystem.getVisibleText();
    const fontSize = 20;
    const lineHeight = fontSize * 1.55;
    const padX = 34;
    const padTop = 30;
    const textX = boxX + padX;
    const textMaxW = boxW - padX * 2;

    ctx.font = `500 ${fontSize}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = GLASS.textPrimary;

    const chars = visible.split('');
    const textLines = [];
    let cur = '';
    for (const ch of chars) {
        const test = cur + ch;
        if (ctx.measureText(test).width > textMaxW) {
            textLines.push(cur);
            cur = ch;
        } else {
            cur = test;
        }
    }
    if (cur) textLines.push(cur);

    for (let i = 0; i < textLines.length; i++) {
        ctx.fillText(textLines[i], textX, boxY + padTop + i * lineHeight);
    }
    ctx.shadowBlur = 0;

    // 打字中末尾闪烁光标
    if (typing && textLines.length > 0) {
        if (Math.floor(t * 2.5) % 2 === 0) {
            const last = textLines[textLines.length - 1];
            const lw = ctx.measureText(last).width;
            ctx.fillText('▌', textX + lw + 2, boxY + padTop + (textLines.length - 1) * lineHeight);
        }
    }

    // 播完提示（脉冲淡入淡出）
    if (!typing && line) {
        const hint = DialogueSystem.isLastLine() ? '点击结束 ▸' : '点击继续 ▸';
        const pulse = 0.5 + 0.5 * Math.sin(t * 4);
        ctx.globalAlpha = eased * (0.45 + 0.4 * pulse);
        ctx.fillStyle = GLASS.textSecondary;
        ctx.font = `13px ${MONO}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(hint, boxX + boxW - 24, boxY + boxH - 14);
    }

    ctx.restore();

    // 热区：全屏（galgame 惯例，点击任意处推进；与 GameState 注释、InputManager 无条件吞点击行为一致）
    GameState.dialogueHitAreas = [{ id: 'advance', x: 0, y: 0, w: W, h: H }];
}

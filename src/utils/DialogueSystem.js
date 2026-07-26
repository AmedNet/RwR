// src/utils/DialogueSystem.js
// 通用对话演出状态机（开局简报等 galgame 式全屏对话）。
// 模块单例，镜像 AIMonologueSystem 的模块级状态模式。
// 职责：台词队列、当前句索引、打字机进度、推进/秒完/关闭。
// 开合动画进度（dialogueAnimProgress/Direction）由 DialogueUI.updateDialogueAnimation 推进。
import { GameState } from '../core/GameState.js';

const TYPING_INTERVAL = 35; // 每字毫秒数（打字机速度，~28 字/秒）

// ─── 模块级状态 ───
let active = false;
let lines = [];          // [{speaker,name,color,text}]
let currentIndex = 0;    // 当前句索引
let charIndex = 0;       // 当前句已显示字符数（可为小数，绘制时取整）
let _lastTypeTime = null; // 打字机 deltaTime 基准（performance.now）

export const DialogueSystem = {
    // 开始一段对话
    start(newLines) {
        if (!newLines || newLines.length === 0) return;
        lines = newLines;
        currentIndex = 0;
        charIndex = 0;
        _lastTypeTime = null;
        active = true;
        // 打开对话层：世界冻结由 main.js 的 (paused || dialogueOpen) 门控
        GameState.dialogueOpen = true;
        GameState.dialogueAnimProgress = 0;
        GameState.dialogueAnimDirection = 'opening';
        GameState._dialogueAnimLastTime = null;
    },

    // 每帧推进打字机（由 DialogueUI.updateDialogueAnimation 调用）
    update() {
        if (!active) return;
        const line = lines[currentIndex];
        if (!line || charIndex >= line.text.length) return; // 本句已打完

        const now = performance.now();
        if (_lastTypeTime == null) _lastTypeTime = now;
        const elapsed = now - _lastTypeTime;
        _lastTypeTime = now;

        // 按经过时间累加字符数（低帧率时一帧补多字，保持匀速）
        charIndex = Math.min(line.text.length, charIndex + elapsed / TYPING_INTERVAL);
    },

    // 推进：打字中→秒完本句；已打完→下一句；末句→关闭
    advance() {
        if (!active) return;
        const line = lines[currentIndex];
        if (!line) { this.close(); return; }

        if (charIndex < line.text.length) {
            charIndex = line.text.length; // 点击立即播完当前文字动画
            return;
        }
        if (currentIndex < lines.length - 1) {
            currentIndex++;
            charIndex = 0;
            _lastTypeTime = null;
        } else {
            this.close();
        }
    },

    // 关闭对话（播放关闭动画，动画播完后由 DialogueUI 复位 dialogueOpen）
    close() {
        active = false;
        GameState.dialogueAnimDirection = 'closing';
    },

    // ─── 查询接口（供 DialogueUI 绘制） ───
    isActive() { return active; },
    getCurrentLine() { return lines[currentIndex] || null; },
    getVisibleText() {
        const line = lines[currentIndex];
        return line ? line.text.slice(0, Math.floor(charIndex)) : '';
    },
    isTyping() {
        const line = lines[currentIndex];
        return !!line && charIndex < line.text.length;
    },
    isLastLine() { return currentIndex >= lines.length - 1; },
};

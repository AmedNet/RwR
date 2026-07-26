// src/input/handlers/DialogueHandler.js
// 对话演出层的按键/点击处理（空格/回车/点击推进，吞噬其余键）。镜像 PauseHandler.js。
import { GameState } from '../../core/GameState.js';
import { DialogueSystem } from '../../utils/DialogueSystem.js';
import { playUISound } from '../../utils/SoundManager.js';
import { toCanvasCoords } from '../canvasCoords.js';

// ─── 对话 keydown（空格/回车推进，吞噬其余键，忽略 autorepeat 防连跳） ───
export function handleDialogueKeydown(e, key) {
    if (!e.repeat && (key === ' ' || key === 'enter')) {
        DialogueSystem.advance();
        playUISound('click');
    }
    e.preventDefault();
    return true;
}

// ─── 对话 mousedown（点击对话框热区推进） ───
export function handleDialogueMousedown(e, canvas) {
    const { x, y } = toCanvasCoords(e, canvas);
    for (const area of GameState.dialogueHitAreas) {
        if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
            DialogueSystem.advance();
            playUISound('click');
            e.preventDefault();
            return true;
        }
    }
    return false;
}

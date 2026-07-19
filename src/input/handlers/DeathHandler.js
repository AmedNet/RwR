// src/input/handlers/DeathHandler.js
// 死亡状态下的按键与点击处理（复活选择）
import { GameState } from '../../core/GameState.js';

export function handleDeathKeydown(e, key) {
    // 关闭残留菜单
    if (GameState.arsenalOpen) {
        GameState.arsenalOpen = false;
        GameState.arsenalAnimDirection = null;
        GameState.arsenalAnimProgress = 0;
    }
    if (GameState.radioOpen) {
        GameState.radioOpen = false;
        GameState.radioAnimDirection = null;
        GameState.radioAnimProgress = 0;
        GameState.radioTargetWorld = null;
    }
    // 延迟期 + 弹出期不响应复活选择（等动画放完）
    if (GameState.gameOverDelay < 1 || GameState.gameOverAppearAnim < 1) {
        e.preventDefault();
        return true;
    }
    const num = parseInt(e.key);
    if (num >= 1 && num <= 6) {
        const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
        if (playerPoints[num - 1]) {
            window.dispatchEvent(new CustomEvent('respawnPlayer', { detail: { pointIndex: num - 1 } }));
            e.preventDefault();
            return true;
        }
    }
    if (key === 'r') {
        window.dispatchEvent(new CustomEvent('respawnPlayer'));
        e.preventDefault();
        return true;
    }
    return true; // 死亡状态吞噬所有按键
}

export function handleDeathMousedown(e) {
    if (GameState.respawnHitAreas && GameState.gameOverAppearAnim >= 1) {
        const rect = e.target.getBoundingClientRect();
        const scaleX2 = e.target.clientWidth / rect.width;
        const scaleY2 = e.target.clientHeight / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX2;
        const clickY = (e.clientY - rect.top) * scaleY2;
        for (const area of GameState.respawnHitAreas) {
            if (Math.hypot(clickX - area.x, clickY - area.y) < area.r) {
                window.dispatchEvent(new CustomEvent('respawnPlayer', { detail: { pointIndex: area.index } }));
                e.preventDefault();
                return true;
            }
        }
    }
    return false;
}

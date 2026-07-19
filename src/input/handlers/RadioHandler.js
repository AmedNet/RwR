// src/input/handlers/RadioHandler.js
// 电台界面的按键与点击处理
import { GameState } from '../../core/GameState.js';
import { Renderer } from '../../rendering/Renderer.js';
import { playUISound, playRadioClose } from '../../utils/SoundManager.js';
import { SupportSystem } from '../../core/SupportSystem.js';

// ─── keydown 处理（电台打开时） ───

export function handleRadioKeydown(e, key) {
    if (key === 'escape') {
        GameState.toggleRadio();
        playRadioClose();
        e.preventDefault();
        return true;
    }
    if (key === 'arrowup') {
        const available = SupportSystem.getPlayerAvailableSupport();
        if (available.length > 0) {
            GameState.radioSelectedIndex = (GameState.radioSelectedIndex - 1 + available.length) % available.length;
        }
        e.preventDefault();
        return true;
    }
    if (key === 'arrowdown') {
        const available = SupportSystem.getPlayerAvailableSupport();
        if (available.length > 0) {
            GameState.radioSelectedIndex = (GameState.radioSelectedIndex + 1) % available.length;
        }
        e.preventDefault();
        return true;
    }
    if (key === 'enter') {
        const available = SupportSystem.getPlayerAvailableSupport();
        const sel = available[GameState.radioSelectedIndex];
        if (sel && sel.canCall && GameState.radioTargetWorld) {
            SupportSystem.callSupport(sel.type, GameState.radioTargetWorld.x, GameState.radioTargetWorld.y);
            GameState.toggleRadio();
            playRadioClose();
        }
        e.preventDefault();
        return true;
    }
    if (key === 'g') {
        if (!GameState.radioGKeyPressed) {
            GameState.radioGKeyPressed = true;
            GameState.radioGKeyTimer = 0;
            GameState.radioGKeyConsumed = false;
        }
        e.preventDefault();
        return true;
    }
    return true; // 电台打开时吞噬所有按键
}

// ─── mousedown 处理（电台界面点击） ───

export function handleRadioMousedown(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;
    const scaleX = logicalWidth / rect.width;
    const scaleY = logicalHeight / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Tab 切换
    if (Renderer.debugTabs) {
        for (const tab of Renderer.debugTabs) {
            if (clickX >= tab.x && clickX <= tab.x + tab.w &&
                clickY >= tab.y && clickY <= tab.y + tab.h) {
                GameState.debugTab = tab.id;
                playUISound('click');
                e.preventDefault();
                return true;
            }
        }
    }

    const cam = GameState.camera;
    const zoom = cam.zoom || 1;
    const offsetX = cam.offsetX || 0;
    const offsetY = cam.offsetY || 0;
    const canvasW = canvas.clientWidth || 800;
    const canvasH = canvas.clientHeight || 600;
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const worldX = (clickX - cx * (1 - zoom) + offsetX) / zoom + cam.x;
    const worldY = (clickY - cy * (1 - zoom) + offsetY) / zoom + cam.y;

    const panelW = 260;
    const panelX = 20;
    const panelTop = 60;
    const headerH = 48;
    const itemH = 56;
    const itemGap = 4;
    const listTop = panelTop + headerH + 8;
    const available = SupportSystem.getPlayerAvailableSupport();
    let hitCard = false;
    for (let i = 0; i < available.length; i++) {
        const scrollOffset = GameState.radioScrollOffset || 0;
        const iy = listTop + i * (itemH + itemGap) - scrollOffset;
        if (clickX >= panelX + 6 && clickX <= panelX + panelW - 6 &&
            clickY >= iy && clickY <= iy + itemH) {
            hitCard = true;
            GameState.radioSelectedIndex = i;
            if (available[i].canCall && GameState.radioTargetWorld) {
                SupportSystem.callSupport(available[i].type, GameState.radioTargetWorld.x, GameState.radioTargetWorld.y);
                GameState.toggleRadio();
                playRadioClose();
            }
            break;
        }
    }
    if (!hitCard) {
        GameState.radioTargetWorld = { x: worldX, y: worldY };
    }
    e.preventDefault();
    return true;
}

// ─── contextmenu 处理（右键关闭电台） ───

export function handleRadioContextmenu(e) {
    GameState.toggleRadio();
    playRadioClose();
}
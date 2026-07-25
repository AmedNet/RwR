// src/input/handlers/MouseHandler.js
// 鼠标移动/释放/失焦 + 正常射击处理
import { GameState } from '../../core/GameState.js';
import { Renderer } from '../../rendering/Renderer.js';
import { AmbientSoundManager } from '../../utils/AmbientSoundManager.js';
import { DayNightSystem } from '../../core/DayNightSystem.js';
import { setSeatModifier } from './GameplayHandler.js';
import { applySliderValue } from './PauseHandler.js';

// ─── mousemove ───

export function handleMousemove(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / rect.width;
    const scaleY = canvas.clientHeight / rect.height;
    GameState.mouse.x = (e.clientX - rect.left) * scaleX;
    GameState.mouse.y = (e.clientY - rect.top) * scaleY;

    if (GameState.ambientSliderDragging && Renderer.ambientSlider) {
        const ambSlider = Renderer.ambientSlider;
        const clickX = (e.clientX - rect.left) * scaleX;
        const ratio = (clickX - ambSlider.x) / ambSlider.w;
        AmbientSoundManager.setMasterVolume(Math.max(0, Math.min(1, ratio)));
    }
    if (GameState.debugSliderDragging && Renderer.debugSlider) {
        const slider = Renderer.debugSlider;
        const clickX2 = (e.clientX - rect.left) * scaleX;
        const ratio2 = (clickX2 - slider.x) / slider.w;
        DayNightSystem.setTime(Math.max(0, Math.min(1, ratio2)));
    }
    // 设置面板音量滑块拖动
    if (GameState.settingsSliderDragging && GameState.settingsSliderDragArea) {
        const clickX3 = (e.clientX - rect.left) * scaleX;
        applySliderValue(GameState.settingsSliderDragArea, clickX3);
    }
}

// ─── mousedown (正常射击，在非菜单/非电台/非debug时) ───

export function handleNormalMousedown(e) {
    if (GameState.player && !GameState.player.mountedVehicle) {
        const weapon = GameState.getActiveWeapon();
        if (weapon && weapon.config.type === 'grenade') {
            GameState.player.throwGrenade();
        } else {
            GameState.player.shoot();
        }
    }
    e.preventDefault();
}

// ─── mouseup ───

export function handleMouseup(e) {
    if (e.button === 0) {
        GameState.mouse.down = false;
        GameState.ambientSliderDragging = false;
        GameState.debugSliderDragging = false;
        GameState.settingsSliderDragging = null;
        GameState.settingsSliderDragArea = null;
    }
    if (e.button === 2) GameState.mouse.rightDown = false;
}

// ─── blur ───

export function handleBlur() {
    GameState.mouse.down = false;
    GameState.mouse.rightDown = false;
    setSeatModifier(false);
}

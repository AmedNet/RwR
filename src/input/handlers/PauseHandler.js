// src/input/handlers/PauseHandler.js
// 暂停菜单 + 设置面板的按键/点击处理（命中检测、toggle/segment/slider/keybind/按钮）
import { GameState } from '../../core/GameState.js';
import { playUISound } from '../../utils/SoundManager.js';
import {
    Settings, applyGraphics, applyAudio,
    isForbiddenBindKey, conflictingAction, resetControls,
} from '../../data/Settings.js';
import { toCanvasCoords } from '../canvasCoords.js';

// ─── 暂停菜单 keydown（ESC 恢复游戏，吞噬其余键） ───
export function handlePauseKeydown(e, key) {
    if (key === 'escape') {
        GameState.togglePause();
        playUISound('click');
    }
    e.preventDefault();
    return true;
}

// ─── 暂停菜单 mousedown（设置 / 退出到主菜单） ───
export function handlePauseMousedown(e, canvas) {
    const { x, y } = toCanvasCoords(e, canvas);
    for (const area of GameState.pauseHitAreas) {
        if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
            if (area.id === 'settings') {
                GameState.toggleSettings();
                playUISound('click');
            } else if (area.id === 'quit') {
                console.log('🚪 退出到主菜单（预留，暂未实现）');
                playUISound('click');
            }
            e.preventDefault();
            return true;
        }
    }
    return false;
}

// ─── 设置面板 keydown（键位捕获 / ESC 退回暂停菜单 / 吞噬其余键） ───
export function handleSettingsKeydown(e, key) {
    // 键位捕获态：下一个键写入 Settings.controls
    if (GameState.keybindCapturing) {
        const action = GameState.keybindCapturing;
        GameState.keybindCapturing = null;
        if (isForbiddenBindKey(key)) {
            playUISound('error');
            console.log('⚠️ 不能绑定到数字键或 ESC');
        } else {
            const conflict = conflictingAction(key, action);
            if (conflict) {
                playUISound('error');
                console.log(`⚠️ 该键已绑定到其它动作`);
            } else {
                Settings.controls[action] = key;
                playUISound('click');
                console.log(`⌨️ ${action} → ${key}`);
            }
        }
        e.preventDefault();
        return true;
    }
    if (key === 'escape') {
        GameState.toggleSettings();
        playUISound('click');
        e.preventDefault();
        return true;
    }
    // 设置面板打开时吞噬其余键
    e.preventDefault();
    return true;
}

// ─── 设置面板 mousedown（tab/toggle/segment/slider/color/keybind/button） ───
export function handleSettingsMousedown(e, canvas) {
    const { x, y } = toCanvasCoords(e, canvas);
    for (const area of GameState.settingsHitAreas) {
        if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
            switch (area.type) {
                case 'tab':
                    GameState.settingsTab = area.id;
                    playUISound('click');
                    break;
                case 'toggle':
                    handleToggle(area.id);
                    break;
                case 'segment':
                    handleSegment(area.id, area.value);
                    break;
                case 'slider':
                    GameState.settingsSliderDragging = area.id;
                    GameState.settingsSliderDragArea = area;
                    applySliderValue(area, x);
                    break;
                case 'color':
                    Settings.graphics.crosshairColor = area.value;
                    playUISound('click');
                    break;
                case 'keybind':
                    GameState.keybindCapturing = area.id;
                    playUISound('click');
                    break;
                case 'button':
                    if (area.id === 'resetControls') {
                        resetControls();
                        playUISound('click');
                        console.log('⌨️ 键位已恢复默认');
                    }
                    break;
            }
            e.preventDefault();
            return true;
        }
    }
    return false;
}

// ─── toggle 开关处理 ───
function handleToggle(id) {
    switch (id) {
        case 'bloom':
            Settings.graphics.bloom = !Settings.graphics.bloom;
            applyGraphics();
            break;
        case 'shake':
            Settings.graphics.shake = !Settings.graphics.shake;
            break;
        case 'minimap':
            Settings.graphics.minimap = !Settings.graphics.minimap;
            break;
        case 'damageNumbers':
            Settings.graphics.damageNumbers = !Settings.graphics.damageNumbers;
            break;
    }
    playUISound('click');
}

// ─── segment 分段处理 ───
function handleSegment(id, value) {
    switch (id) {
        case 'weatherDensity':
            Settings.graphics.weatherDensity = value;
            break;
        case 'bloodLevel':
            Settings.graphics.bloodLevel = value;
            break;
        case 'crosshairStyle':
            Settings.graphics.crosshairStyle = value;
            break;
    }
    playUISound('click');
}

// ─── slider 拖动换算（mousedown 起始 + mousemove 持续调用） ───
export function applySliderValue(area, clickX) {
    const ratio = Math.max(0, Math.min(1, (clickX - area.trackX) / area.trackW));
    switch (area.id) {
        case 'master':  Settings.audio.master = ratio;  break;
        case 'ambient': Settings.audio.ambient = ratio; break;
        case 'sfx':     Settings.audio.sfx = ratio;     break;
        case 'ui':      Settings.audio.ui = ratio;      break;
    }
    applyAudio();
}

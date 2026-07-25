// src/data/Settings.js
// 设置数据模型（当前会话生效，不持久化）+ 应用到运行系统的 apply 函数。
// 设计：特效/音频参数挂在模块级可变单例上，渲染/更新循环每帧实时读取，
// 因此「读」类设置（抖动/伤害数字/血迹/天气密度/准星/小地图）由各系统直接 import Settings 懒读；
// 「推」类设置（Bloom 强度、四路音量）由 apply 函数在初始化与每次改动时写入对应单例。

import { PostProcess } from '../rendering/PostProcess.js';
import { setMasterVolume, setSfxVolume, setUIVolume } from '../utils/SoundManager.js';
import { AmbientSoundManager } from '../utils/AmbientSoundManager.js';

// ─── 档位映射表 ───

// 天气粒子密度档位 → 密度倍率（作用于 WeatherSystem._updateParticles 的 targetDensity）
export const WEATHER_DENSITY_SCALE = { off: 0, low: 0.4, mid: 1.0, high: 1.5 };
export const WEATHER_LEVELS = ['off', 'low', 'mid', 'high'];

// 血迹档位 → { 喷溅数量倍率, 永久血迹上限 }（off 倍率 0 = 入口 guard 直接不生成）
export const BLOOD_CONFIG = {
    off:  { scale: 0,   cap: 0 },
    low:  { scale: 0.3, cap: 100 },
    mid:  { scale: 1.0, cap: 300 },
    high: { scale: 1.5, cap: 600 },
};
export const BLOOD_LEVELS = ['off', 'low', 'mid', 'high'];

// 准星样式
export const CROSSHAIR_STYLES = [
    { id: 0, label: '经典十字' },
    { id: 1, label: '仅中心点' },
    { id: 2, label: '圆环' },
];

// 准星预设颜色（null = 按武器默认色）；值为 'R,G,B' 字符串，与 CrosshairRenderer 内部格式一致
export const CROSSHAIR_COLORS = [
    { value: null,          label: '默认', swatch: null },
    { value: '255,255,255', label: '白',   swatch: '#ffffff' },
    { value: '80,255,80',   label: '绿',   swatch: '#50ff50' },
    { value: '255,80,80',   label: '红',   swatch: '#ff5050' },
    { value: '80,180,255',  label: '蓝',   swatch: '#50b4ff' },
    { value: '255,220,60',  label: '黄',   swatch: '#ffdc3c' },
];

// 档位中文标签（天气/血迹共用 off/low/mid/high）
export const LEVEL_LABELS = { off: '关', low: '低', mid: '中', high: '高' };

// ─── 设置主体 ───

export const Settings = {
    graphics: {
        bloom: true,             // Bloom 辉光开关（关=强度 0，保留其余后处理，勿用 setEnabled）
        weatherDensity: 'mid',   // 天气粒子密度档位 off/low/mid/high
        bloodLevel: 'mid',       // 血迹档位 off/low/mid/high（mid=原始1.0x喷溅+300上限，默认与现状视觉一致）
        shake: true,             // 画面抖动开关
        crosshairStyle: 0,       // 准星样式（见 CROSSHAIR_STYLES）
        crosshairColor: null,    // 准星颜色覆盖，null=按武器默认色，否则 'R,G,B'
        minimap: true,           // 小地图开关
        damageNumbers: true,     // 伤害数字开关
    },
    // ⚠️ 契约：此处默认值必须与 SoundManager.initAudio() 的硬编码增益一致（首次加载 applyAudio 前的回退值）。
    // sfx 0.5×master 1.0 = 0.5（=原 masterGain）；ambient 0.3×1.0 = 0.3（=原直连）；ui 0.5×1.0 = 0.5
    audio: { master: 1.0, ambient: 0.3, sfx: 0.5, ui: 0.5 },
    controls: {
        moveUp: 'w', moveLeft: 'a', moveDown: 's', moveRight: 'd',
        shoot: ' ', reload: 'r', interact: 'f', inventory: 'q',
        arsenal: 'e', grenade: 'g', horn: 'h', suicide: 'k',
    },
};

// 默认键位（供「恢复默认」）
export const DEFAULT_CONTROLS = { ...Settings.controls };

// ─── apply：把「推」类设置写入运行系统（初始化 + 每次改动调用） ───

export function applyGraphics() {
    // Bloom：开=0.22 / 关=0（禁用 setEnabled，会整屏黑）
    PostProcess.setParam('bloomIntensity', Settings.graphics.bloom ? 0.22 : 0);
}

export function applyAudio() {
    setMasterVolume(Settings.audio.master);
    setSfxVolume(Settings.audio.sfx);
    setUIVolume(Settings.audio.ui);
    AmbientSoundManager.setMasterVolume(Settings.audio.ambient);
}

// ─── 键位辅助 ───

// 语义移动方向：GameState.keys 固定用 w/a/s/d 表示上/左/下/右（Player.js 读者零改动），
// 写入层把物理键翻译成语义键。返回 'w'/'a'/'s'/'d' 或 null（非移动键）。
export function semanticMoveKey(physicalKey) {
    const c = Settings.controls;
    if (physicalKey === c.moveUp) return 'w';
    if (physicalKey === c.moveLeft) return 'a';
    if (physicalKey === c.moveDown) return 's';
    if (physicalKey === c.moveRight) return 'd';
    return null;
}

// 重绑定禁止用的键：数字键（切枪/Debug/复活）、ESC（暂停）、c（硬编码座位修饰键），避免冲突
export function isForbiddenBindKey(key) {
    if (key === 'escape' || key === 'c') return true;
    return /^[0-9]$/.test(key);
}

// 冲突检测：返回该键已绑定的其它动作名，若无冲突返回 null。ignoreAction 为当前正在改的动作。
export function conflictingAction(key, ignoreAction) {
    for (const [action, bound] of Object.entries(Settings.controls)) {
        if (action !== ignoreAction && bound === key) return action;
    }
    return null;
}

export function resetControls() {
    Object.assign(Settings.controls, DEFAULT_CONTROLS);
}

// 动作 → 中文名（控制页显示）
export const ACTION_LABELS = {
    moveUp: '向上移动', moveLeft: '向左移动', moveDown: '向下移动', moveRight: '向右移动',
    shoot: '射击', reload: '换弹', interact: '拾取/上下车', inventory: '背包',
    arsenal: '军械库', grenade: '手雷/电台', horn: '喇叭', suicide: '自杀',
};

// 控制页动作显示顺序
export const CONTROL_ORDER = [
    'moveUp', 'moveLeft', 'moveDown', 'moveRight',
    'shoot', 'reload', 'interact', 'inventory', 'arsenal', 'grenade', 'horn', 'suicide',
];

// 物理键 → 显示文本
export function keyLabel(key) {
    if (key === ' ') return '空格';
    if (key === 'arrowup') return '↑';
    if (key === 'arrowdown') return '↓';
    if (key === 'arrowleft') return '←';
    if (key === 'arrowright') return '→';
    if (key === 'escape') return 'ESC';
    if (key === 'shift') return 'Shift';
    if (key === 'control') return 'Ctrl';
    if (key.length === 1) return key.toUpperCase();
    return key;
}

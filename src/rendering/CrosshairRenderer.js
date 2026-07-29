// src/rendering/CrosshairRenderer.js
// 动态准星：跟随鼠标，响应散布/后坐力/移动状态
import { GameState } from '../core/GameState.js';
import { Settings } from '../data/Settings.js';

// 准星视觉状态（平滑插值用）
let _visualGap = 6;
let _targetGap = 6;
let _dotPulse = 0;
let _hitMarkerTimer = 0;      // 命中标记动画计时器（帧）
let _fireKickTimer = 0;       // 射击后坐力动画计时器（帧）
let _fireKickStrength = 0;    // 本次射击后坐力强度
let _switchScale = 1;         // 武器切换缩放 0→1
let _killTimes = [];           // 最近击杀时间戳（用于连杀光晕）

// 武器类型 → 基础参数
const CROSSHAIR_PRESETS = {
    pistol:   { baseGap: 5,  armLen: 8,  thickness: 1.5, color: '255,255,255', dotRadius: 1.5 },
    rifle:    { baseGap: 6,  armLen: 10, thickness: 1.5, color: '255,255,255', dotRadius: 1.5 },
    smg:      { baseGap: 4,  armLen: 7,  thickness: 1.5, color: '255,255,255', dotRadius: 1.2 },
    sniper:   { baseGap: 3,  armLen: 12, thickness: 1.2, color: '255,200,200', dotRadius: 1.0 },
    shotgun:  { baseGap: 8,  armLen: 6,  thickness: 2.0, color: '255,220,180', dotRadius: 2.0 },
    launcher: { baseGap: 10, armLen: 8,  thickness: 2.0, color: '255,160,100', dotRadius: 2.0 },
    melee:    { baseGap: 3,  armLen: 5,  thickness: 1.5, color: '200,255,200', dotRadius: 1.5 },
    default:  { baseGap: 6,  armLen: 8,  thickness: 1.5, color: '255,255,255', dotRadius: 1.5 },
};

function getPreset(type) {
    return CROSSHAIR_PRESETS[type] || CROSSHAIR_PRESETS.default;
}

function isMoving() {
    const k = GameState.keys;
    return k.w || k.a || k.s || k.d;
}

// 触发命中标记（从 CollisionSystem 调用）
export function triggerHitMarker() {
    _hitMarkerTimer = 12;  // 12帧动画
}

// 触发射击后坐力动画（从 Player.shoot 调用）
export function triggerFireKick(strength = 1) {
    _fireKickTimer = 8;
    _fireKickStrength = Math.min(strength, 3);
}

// 触发击杀记录（从 CollisionSystem 调用，用于连杀光晕）
export function triggerKill() {
    _killTimes.push(performance.now());
}

// 准星是否应显示（玩家存活、非菜单/死亡、持有可射击武器）
// Renderer 的光标可见性与此共用同一判定，避免「系统光标与准星同时消失」的真空态
export function isCrosshairActive() {
    const { player } = GameState;
    if (!player || !player.alive || player.dying) return false;
    if (GameState.gameOver || GameState.inventoryOpen || GameState.arsenalOpen ||
        GameState.radioOpen || GameState.debugOpen ||
        GameState.paused || GameState.settingsOpen || GameState.battleReport) return false;
    const weapon = GameState.getActiveWeapon();
    if (!weapon || weapon.isLoot) return false;
    // 医疗包不显示射击准星
    if (weapon.config.type === 'medical') return false;
    return true;
}

export function drawCrosshair(ctx) {
    if (!isCrosshairActive()) return;

    const { player } = GameState;
    const weapon = GameState.getActiveWeapon();
    const preset = getPreset(weapon.config.type);
    const mx = GameState.mouse.x;
    const my = GameState.mouse.y;

    // 更新动画计时器
    if (_hitMarkerTimer > 0) _hitMarkerTimer--;
    if (_fireKickTimer > 0) _fireKickTimer--;

    // ─── 武器切换缩放过渡 ───
    if (player.isSwitching) {
        _switchScale = Math.max(0, _switchScale - 0.12);
    } else {
        _switchScale = Math.min(1, _switchScale + 0.1);
    }

    // ─── 连杀光晕（3秒内击杀计数） ───
    const now = performance.now();
    _killTimes = _killTimes.filter(t => now - t < 3000);
    const killStreak = _killTimes.length;

    // 计算目标 gap：基础 + 散布 + 后坐力 + 移动惩罚
    const spreadContrib = (weapon.currentSpread || 0) * 80;
    const recoilContrib = (weapon.currentRecoil || 0) * 40;
    const moveContrib = isMoving() ? 4 : 0;

    // ─── 换弹收缩 ───
    let reloadContract = 0;
    let reloadDim = 1;
    if (weapon.isReloading) {
        const p = weapon.getReloadProgress();
        reloadContract = Math.sin(p * Math.PI) * 4;
        reloadDim = 0.45;
    }

    // ─── 空弹匣快闪 ───
    let emptyFlash = 1;
    if (weapon.ammo === 0 && !weapon.isReloading && weapon.config.magSize > 0) {
        emptyFlash = 0.3 + 0.7 * Math.abs(Math.sin(_dotPulse * 4));
    }

    // ─── 低血量抖动 ───
    let shakeX = 0, shakeY = 0;
    if (player.health < player.maxHealth * 0.25) {
        const intensity = (1 - player.health / (player.maxHealth * 0.25)) * 2.5;
        shakeX = (Math.random() - 0.5) * intensity;
        shakeY = (Math.random() - 0.5) * intensity;
    }

    _targetGap = preset.baseGap + spreadContrib + recoilContrib + moveContrib;
    _targetGap = Math.min(_targetGap, 40);

    // 平滑插值
    const lerpSpeed = 0.15;
    _visualGap += (_targetGap - _visualGap) * lerpSpeed;

    // 中心点呼吸脉冲
    _dotPulse += 0.04;
    if (_dotPulse > Math.PI * 2) _dotPulse -= Math.PI * 2;
    const dotBreath = 1 + Math.sin(_dotPulse) * 0.15;

    // 绘制
    ctx.save();
    ctx.translate(mx + shakeX, my + shakeY);

    // 射击后坐力：准星整体向上轻微弹跳
    if (_fireKickTimer > 0) {
        const kickProgress = _fireKickTimer / 8;
        const kickOffset = Math.sin(kickProgress * Math.PI) * _fireKickStrength * 2;
        ctx.translate(0, -kickOffset);
    }

    // 武器切换缩放
    if (_switchScale < 0.99) {
        ctx.scale(_switchScale, _switchScale);
    }

    const { armLen, thickness, color, dotRadius } = preset;
    const gap = Math.max(0, _visualGap - reloadContract);

    // 弹药比例 → 颜色从基础色渐变为红色（无弹药武器跳过）
    let finalColor = color;
    const magSize = weapon.config.magSize;
    if (magSize > 0) {
        const ammoRatio = weapon.ammo / magSize;
        const parts = color.split(',').map(Number);
        const lowR = 255, lowG = 60, lowB = 60;
        const r = Math.round(lowR + (parts[0] - lowR) * ammoRatio);
        const g = Math.round(lowG + (parts[1] - lowG) * ammoRatio);
        const b = Math.round(lowB + (parts[2] - lowB) * ammoRatio);
        finalColor = `${r},${g},${b}`;
    }

    // 设置：准星颜色覆盖（null=按武器默认/弹药渐变，否则用预设 'R,G,B'）
    if (Settings.graphics.crosshairColor) finalColor = Settings.graphics.crosshairColor;

    // 综合透明度 = 换弹变暗 × 空弹匣闪烁
    const masterAlpha = reloadDim * emptyFlash;

    // ─── 连杀光晕（3+ 击杀） ───
    if (killStreak >= 3) {
        const glowIntensity = Math.min((killStreak - 2) * 0.15, 0.6);
        const glowRadius = 20 + killStreak * 2;
        const grad = ctx.createRadialGradient(0, 0, gap * 0.5, 0, 0, glowRadius);
        grad.addColorStop(0, `rgba(255,200,50,${glowIntensity * masterAlpha})`);
        grad.addColorStop(1, 'rgba(255,200,50,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    // 外发光
    ctx.shadowColor = `rgba(${finalColor},${0.4 * masterAlpha})`;
    ctx.shadowBlur = 4;

    ctx.strokeStyle = `rgba(${finalColor},${0.9 * masterAlpha})`;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';

    // 准星主体（设置样式：0=经典十字 / 1=仅中心点 / 2=圆环；中心点三种样式都保留）
    const crosshairStyle = Settings.graphics.crosshairStyle;
    if (crosshairStyle === 2) {
        // 圆环
        ctx.beginPath();
        ctx.arc(0, 0, gap + armLen * 0.5, 0, Math.PI * 2);
        ctx.stroke();
    } else if (crosshairStyle === 0) {
        // 经典十字：四臂
        ctx.beginPath();
        ctx.moveTo(0, -gap);
        ctx.lineTo(0, -gap - armLen);
        ctx.moveTo(0, gap);
        ctx.lineTo(0, gap + armLen);
        ctx.moveTo(-gap, 0);
        ctx.lineTo(-gap - armLen, 0);
        ctx.moveTo(gap, 0);
        ctx.lineTo(gap + armLen, 0);
        ctx.stroke();
    }
    // 样式 1（仅中心点）：不画臂/环，只保留下方中心点

    // 中心点
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(${finalColor},${0.85 * masterAlpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, dotRadius * dotBreath, 0, Math.PI * 2);
    ctx.fill();

    // 命中标记：X形闪烁
    if (_hitMarkerTimer > 0) {
        const hitAlpha = _hitMarkerTimer / 12;
        const hitScale = 1 + (1 - hitAlpha) * 0.5;
        ctx.strokeStyle = `rgba(255,80,80,${hitAlpha})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        const hitSize = 6 * hitScale;
        const hitOffset = gap + armLen * 0.5;
        ctx.beginPath();
        ctx.moveTo(-hitOffset - hitSize, -hitOffset - hitSize);
        ctx.lineTo(-hitOffset + hitSize, -hitOffset + hitSize);
        ctx.moveTo(hitOffset + hitSize, -hitOffset - hitSize);
        ctx.lineTo(hitOffset - hitSize, -hitOffset + hitSize);
        ctx.moveTo(-hitOffset - hitSize, hitOffset + hitSize);
        ctx.lineTo(-hitOffset + hitSize, hitOffset - hitSize);
        ctx.moveTo(hitOffset + hitSize, hitOffset + hitSize);
        ctx.lineTo(hitOffset - hitSize, hitOffset - hitSize);
        ctx.stroke();
    }

    ctx.restore();
}

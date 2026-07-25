// src/rendering/HelmetRenderer.js
// 防弹衣头盔渲染 — 供 Player（正常/死亡动画）与载具乘员共用。
// 标准参数以 Player 正常渲染为准（offsetY = -0.6r，无镜像）；
// 载具乘员因身体绘制坐标不同，通过 opts 覆盖偏移与镜像。

const HELMET_SCALE = 2.9;

/**
 * 绘制防弹衣头盔贴图
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} entity - 含 armorDurability / armorHelmetImg / armorHelmetImgLoaded / armorHelmetRotation 的实体
 * @param {number} radius - 实体半径
 * @param {Object} [opts]
 * @param {number} [opts.offsetY] - 头盔相对实体中心的 Y 偏移（默认 -radius*0.6，即 Player 标准）
 * @param {boolean} [opts.mirror] - 是否水平镜像（朝左时传 true）
 */
export function drawHelmet(ctx, entity, radius, { offsetY = -radius * 0.6, mirror = false } = {}) {
    if (!(entity.armorDurability > 0 && entity.armorHelmetImg && entity.armorHelmetImgLoaded)) return;
    const drawSize = radius * HELMET_SCALE;
    ctx.save();
    ctx.translate(0, offsetY);
    if (mirror) ctx.scale(-1, 1);
    ctx.rotate(entity.armorHelmetRotation || 0);
    ctx.drawImage(entity.armorHelmetImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    ctx.restore();
}

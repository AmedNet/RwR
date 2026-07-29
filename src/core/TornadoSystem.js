// src/core/TornadoSystem.js
// 独立龙卷风系统：状态管理、形态系统、路径移动、EF等级、渲染
import { GameState } from './GameState.js';

// ─── 形态定义 ───
const TORNADO_FORMS = {
  rope: {
    name: '绳索状',
    funnelRatio: 0.15,    // 漏斗半径/基础半径
    wideRatio: 0.6,       // 外围半径/基础半径
    wallRatio: 0.4,
    debrisIntensity: 0.5,
    rainMultiplier: 0.6,
    color: 'rgba(140,130,115,',
    minEF: 2.5,
    maxEF: 3.5,
    weight: 3
  },
  funnel: {
    name: '漏斗状',
    funnelRatio: 0.35,
    wideRatio: 1.0,
    wallRatio: 0.75,
    debrisIntensity: 0.8,
    rainMultiplier: 1.0,
    color: 'rgba(100,90,75,',
    minEF: 3.0,
    maxEF: 4.2,
    weight: 4
  },
  stovepipe: {
    name: '烟囱状',
    funnelRatio: 0.55,
    wideRatio: 1.1,
    wallRatio: 0.9,
    debrisIntensity: 1.0,
    rainMultiplier: 1.2,
    color: 'rgba(80,75,65,',
    minEF: 3.5,
    maxEF: 4.5,
    weight: 3
  },
  wedge: {
    name: '楔状',
    funnelRatio: 0.8,
    wideRatio: 1.6,
    wallRatio: 1.3,
    debrisIntensity: 1.5,
    rainMultiplier: 1.5,
    color: 'rgba(60,55,50,',
    minEF: 4.0,
    maxEF: 5.5,
    weight: 2
  },
  multivortex: {
    name: '多涡旋',
    funnelRatio: 0.5,
    wideRatio: 1.4,
    wallRatio: 1.1,
    debrisIntensity: 1.8,
    rainMultiplier: 1.3,
    color: 'rgba(70,65,55,',
    minEF: 4.2,
    maxEF: 5.5,
    weight: 1,
    subVortices: 3
  }
};

export const TornadoSystem = {
  // ─── 状态 ───
  center: null,
  angle: 0,
  scale: 1.0,
  scaleTarget: 1.0,
  scaleTimer: 0,
  ef: 3.0,
  efTarget: 3.0,
  efTimer: 0,
  form: 'funnel',
  formTarget: 'funnel',
  formTransition: 1.0,
  formChangeTimer: 0,
  path: null,
  pathT: 0,
  pathSpeed: 0.0001,
  frameCount: 0,
  active: false,

  // ─── 初始化 ───
  init() {
    const world = GameState.world;
    this.center = {
      x: world.width * 0.3 + Math.random() * world.width * 0.4,
      y: world.height * 0.3 + Math.random() * world.height * 0.4
    };
    this.angle = 0;
    this.scale = 1.0;
    this.scaleTarget = 1.0;
    this.scaleTimer = 0;
    this.ef = 3.0;
    this.efTarget = 3.0;
    this.efTimer = 0;
    this.formTransition = 1.0;
    this.formChangeTimer = 0;
    this.path = null;
    this.pathT = 0;
    this.active = true;
    this._updateForm();
    this._generatePath();
  },

  // ─── 停用龙卷风 ───
  deactivate() {
    this.active = false;
    this.center = null;
  },

  // ─── 根据 EF 等级选择形态 ───
  _updateForm() {
    const candidates = [];
    for (const [key, def] of Object.entries(TORNADO_FORMS)) {
      if (this.ef >= def.minEF && this.ef <= def.maxEF) {
        candidates.push({ key, weight: def.weight });
      }
    }
    if (candidates.length === 0) {
      this.formTarget = 'funnel';
      return;
    }
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * totalWeight;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) {
        if (this.formTarget !== c.key) {
          this.formTarget = c.key;
          this.formTransition = 0;
        }
        return;
      }
    }
    this.formTarget = candidates[0].key;
  },

  // ─── 获取当前形态定义（支持过渡混合） ───
  _getFormDef() {
    return TORNADO_FORMS[this.form] || TORNADO_FORMS.funnel;
  },

  _getTargetFormDef() {
    return TORNADO_FORMS[this.formTarget] || TORNADO_FORMS.funnel;
  },

  // ─── 混合形态参数（过渡期间） ───
  _getBlendedParam(param) {
    const current = this._getFormDef()[param];
    const target = this._getTargetFormDef()[param];
    return current + (target - current) * this.formTransition;
  },

  // ─── 生成 Catmull-Rom 路径 ───
  _generatePath() {
    const world = GameState.world;
    const margin = Math.min(2000, Math.floor(world.width / 6), Math.floor(world.height / 6));
    const minX = margin, maxX = world.width - margin;
    const minY = margin, maxY = world.height - margin;
    const numPoints = 4 + Math.floor(Math.random() * 3);
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY)
      });
    }
    this.path = points;
    this.pathT = 0;
  },

  _getSplinePoint(t) {
    const points = this.path;
    if (!points || points.length < 2) return null;
    const n = points.length;
    const segCount = n - 1;
    const rawSeg = t * segCount;
    const seg = Math.min(Math.floor(rawSeg), segCount - 1);
    const localT = rawSeg - seg;
    const p0 = points[Math.max(0, seg - 1)];
    const p1 = points[seg];
    const p2 = points[Math.min(n - 1, seg + 1)];
    const p3 = points[Math.min(n - 1, seg + 2)];
    const t2 = localT * localT;
    const t3 = t2 * localT;
    return {
      x: 0.5 * (2*p1.x + (-p0.x+p2.x)*localT + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
      y: 0.5 * (2*p1.y + (-p0.y+p2.y)*localT + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
    };
  },

  // ─── 每帧更新 ───
  update() {
    if (!this.center) return;
    this.frameCount++;
    this.angle += 0.01;

    // 大小脉动
    this.scaleTimer++;
    if (this.scaleTimer >= 180) {
      this.scaleTarget = 0.7 + Math.random() * 0.6;
      this.scaleTimer = 0;
    }
    this.scale += (this.scaleTarget - this.scale) * 0.02;

    // EF 等级缓慢变化
    this.efTimer++;
    if (this.efTimer >= 600 + Math.random() * 600) {
      const change = (Math.random() - 0.5) * 1.5;
      this.efTarget = Math.max(3.0, Math.min(5.0, this.ef + change));
      this.efTimer = 0;
      // EF 变化时可能触发形态变化
      this._updateForm();
    }
    this.ef += (this.efTarget - this.ef) * 0.005;

    // 形态过渡
    if (this.formTransition < 1.0) {
      this.formTransition += 0.002; // ~8秒完成形态过渡
      if (this.formTransition >= 1.0) {
        this.formTransition = 1.0;
        this.form = this.formTarget;
      }
    }

    // 路径移动
    if (this.path) {
      this.pathT += this.pathSpeed;
      if (this.pathT >= 1) {
        this._generatePath();
        this.pathT = 0;
      }
      const targetPos = this._getSplinePoint(this.pathT);
      if (targetPos) {
        const jitterX = (Math.random() - 0.5) * 2.0;
        const jitterY = (Math.random() - 0.5) * 2.0;
        this.center.x += (targetPos.x - this.center.x) * 0.02 + jitterX;
        this.center.y += (targetPos.y - this.center.y) * 0.02 + jitterY;
      }
    }

    // 边界钳制（margin 自适应世界尺寸）
    const world = GameState.world;
    const margin = Math.min(2000, Math.floor(world.width / 6), Math.floor(world.height / 6));
    this.center.x = Math.max(margin, Math.min(world.width - margin, this.center.x));
    this.center.y = Math.max(margin, Math.min(world.height - margin, this.center.y));
  },

  // ─── 获取当前尘云数量（由 WeatherSystem 提供） ───
  getDustCloudCount(weatherSystem) {
    return weatherSystem._dustCloudCount || 0;
  },

  // ─── 生成龙卷风粒子（由 WeatherSystem 调用） ───
  generateParticles(weatherSystem) {
    if (!this.center) return;
    const formDef = this._getFormDef();
    const efFactor = 1.0 + (this.ef - 3.0) * 0.5;

    // 碎屑粒子
    if (this.frameCount % 2 === 0 && this.getDustCloudCount(weatherSystem) < 28) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 95;
      weatherSystem.particles.push({
        type: 'dustCloud',
        x: this.center.x + Math.cos(angle) * dist,
        y: this.center.y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * (0.45 + Math.random() * 0.3),
        vy: Math.sin(angle) * (0.45 + Math.random() * 0.3) - 0.25,
        life: 70 + Math.floor(Math.random() * 40),
        maxLife: 110,
        size: 10 + Math.random() * 8,
        affectedByWind: false
      });
    }

    // 旋转碎屑
    if (this.frameCount % 4 === 0) {
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 180;
        weatherSystem.particles.push({
          type: 'dustCloud',
          x: this.center.x + Math.cos(angle) * dist,
          y: this.center.y + Math.sin(angle) * dist,
          vx: Math.cos(angle + Math.PI / 2) * (0.15 + Math.random() * 0.1),
          vy: Math.sin(angle + Math.PI / 2) * (0.15 + Math.random() * 0.1),
          life: 40 + Math.floor(Math.random() * 20),
          maxLife: 70,
          size: 6 + Math.random() * 4,
          affectedByWind: false
        });
      }
    }

    // 龙卷风降雨
    const rainRadius = 1200 * (this.scale || 1.0) * 2 * efFactor * formDef.rainMultiplier;
    const rainCount = Math.floor(15 * efFactor * formDef.rainMultiplier);
    for (let i = 0; i < rainCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * rainRadius;
      weatherSystem.particles.push({
        type: 'tornadoRain',
        x: this.center.x + Math.cos(angle) * dist,
        y: this.center.y + Math.sin(angle) * dist - rainRadius * 0.5,
        vx: 0.5,
        vy: 10 + Math.random() * 4,
        life: 60 + Math.floor(Math.random() * 30),
        maxLife: 90,
        size: 1.2 + Math.random() * 0.5,
        affectedByWind: false,
        tornadoCenterX: this.center.x,
        tornadoCenterY: this.center.y,
        rainRadius: rainRadius
      });
    }
  },

  // ─── 更新碎屑粒子轨道 ───
  updateParticles(particles) {
    if (!this.center) return;
    for (const p of particles) {
      if (p.type === 'debris') {
        p.orbitAngle += p.orbitSpeed;
        p.orbitDist *= 0.998;
        if (p.orbitDist < 10) p.orbitDist = 50 + Math.random() * 150;
        p.x = this.center.x + p.orbitDist * Math.cos(p.orbitAngle);
        p.y = this.center.y + p.orbitDist * Math.sin(p.orbitAngle);
      } else if (p.type === 'dustCloud') {
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        const dx = p.x - this.center.x;
        const dy = p.y - this.center.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 260) {
          p.x = this.center.x + (Math.random() - 0.5) * 90;
          p.y = this.center.y + (Math.random() - 0.5) * 90;
        }
      }
    }
  },

  // ─── Gameplay 接口 ───
  getForce(entityX, entityY) {
    if (!this.center) return { x: 0, y: 0 };
    const dx = this.center.x - entityX;
    const dy = this.center.y - entityY;
    const dist = Math.hypot(dx, dy);
    const efFactor = 1.0 + (this.ef - 3.0) * 0.5;
    const range = 3000 * efFactor;
    if (dist > range || dist < 5) return { x: 0, y: 0 };
    const strength = 3.5 * efFactor * (1 - dist / range);
    const angle = Math.atan2(dy, dx);
    return {
      x: Math.cos(angle) * strength * 0.6 - Math.sin(angle) * strength * 0.8,
      y: Math.sin(angle) * strength * 0.6 + Math.cos(angle) * strength * 0.8
    };
  },

  getDamage(entityX, entityY) {
    if (!this.center) return 0;
    const dx = this.center.x - entityX;
    const dy = this.center.y - entityY;
    const dist = Math.hypot(dx, dy);
    const efFactor = 1.0 + (this.ef - 3.0) * 0.5;
    const funnelR = 450 * this.scale * efFactor;
    if (dist < funnelR * 0.6) {
      return 0.8 * efFactor * (1 - dist / (funnelR * 0.6));
    }
    if (dist < funnelR * 1.2) {
      return 0.3 * efFactor * (1 - (dist - funnelR * 0.6) / (funnelR * 0.6));
    }
    return 0;
  },

  getScale() { return this.scale || 1.0; },
  getEF() { return this.ef || 3.0; },
  getForm() { return this.form; },
  getFormName() { return (this._getFormDef().name) || ''; },

  // ═══════════════════════════════════════════════════════════
  // ─── 渲染 ───
  // ═══════════════════════════════════════════════════════════
  draw(ctx, toScreen, weatherSystem) {
    if (!this.center) return;
    const tc = this.center;
    const tPos = toScreen(tc.x, tc.y);
    const zoom = GameState.camera.zoom || 1;
    const scale = this.scale;
    const efFactor = 1.0 + (this.ef - 3.0) * 0.5;
    const formDef = this._getFormDef();
    const time = this.frameCount * 0.05;

    const baseRadius = 280 * zoom * scale;
    const funnelRadius = baseRadius * this._getBlendedParam('funnelRatio') * efFactor;
    const wideRadius = baseRadius * this._getBlendedParam('wideRatio') * efFactor;
    const wallRadius = baseRadius * this._getBlendedParam('wallRatio') * efFactor;
    const supercellRadius = 1200 * zoom * scale * efFactor;

    ctx.save();

    // ═══ 超级单体云体 ═══
    this._drawSupercell(ctx, tPos, wallRadius, supercellRadius, zoom, scale, time);

    // ═══ 浓雾/低云 ═══
    this._drawFog(ctx, tPos, funnelRadius, wideRadius);

    // ═══ 强降雨 ═══
    this._drawRain(ctx, tPos, wideRadius, zoom, time, formDef);

    // ═══ 外围风场环 ═══
    this._drawWindRings(ctx, tPos, wideRadius, zoom, time);

    // ═══ 雨带 ═══
    this._drawRainBands(ctx, tPos, wallRadius, funnelRadius, zoom, time);

    // ═══ 云墙中气旋 ═══
    this._drawMesocyclone(ctx, tPos, funnelRadius, wallRadius, zoom, time);

    // ═══ 吸入粒子 ═══
    this._drawSuctionParticles(ctx, tPos, funnelRadius, time);

    // ═══ 根据形态绘制不同的漏斗结构 ═══
    this._drawFunnelByForm(ctx, tPos, funnelRadius, wideRadius, wallRadius, zoom, time, formDef);

    // ═══ 底部碎屑云团 ═══
    this._drawDebrisClouds(ctx, tPos, funnelRadius, time, formDef);

    // ═══ 多涡旋子涡（如果是多涡旋形态） ═══
    if (this.form === 'multivortex' || (this.formTransition < 1.0 && this.formTarget === 'multivortex')) {
      const subCount = formDef.subVortices || 3;
      const blendAlpha = this.form === 'multivortex' ? 1.0 : this.formTransition;
      this._drawSubVortices(ctx, tPos, wideRadius, funnelRadius, zoom, time, subCount, blendAlpha);
    }

    ctx.restore();
  },

  // ─── 超级单体 ───
  _drawSupercell(ctx, tPos, wallR, superR, zoom, scale, time) {
    const grad = ctx.createRadialGradient(tPos.x, tPos.y, wallR * 0.8, tPos.x, tPos.y, superR);
    grad.addColorStop(0, 'rgba(35,38,45,0.6)');
    grad.addColorStop(0.3, 'rgba(45,48,55,0.45)');
    grad.addColorStop(0.6, 'rgba(55,58,65,0.3)');
    grad.addColorStop(0.85, 'rgba(70,73,80,0.15)');
    grad.addColorStop(1, 'rgba(90,93,100,0)');
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(tPos.x, tPos.y, superR, 0, Math.PI * 2);
    ctx.fill();

    // 螺旋臂
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = 'rgba(60,63,70,0.5)';
    ctx.lineWidth = 8 * zoom * scale;
    for (let arm = 0; arm < 6; arm++) {
      ctx.beginPath();
      const baseAngle = time * 0.3 + arm * Math.PI / 3;
      for (let s = 0; s < 50; s++) {
        const t2 = s / 50;
        const r = wallR * 0.6 + t2 * (superR - wallR * 0.6);
        const a = baseAngle + t2 * Math.PI * 2.5;
        const px = tPos.x + Math.cos(a) * r;
        const py = tPos.y + Math.sin(a) * r * 0.7;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 内部湍流弧线（12次迭代）
    for (let i = 0; i < 12; i++) {
      const seed = i * 1337 + this.frameCount;
      const hashA = ((seed * 2654435761) >>> 0) % 10000 / 10000;
      const hashB = ((seed * 40503) >>> 0) % 10000 / 10000;
      const startAngle = hashA * Math.PI * 2;
      const arcLen = 0.3 + hashB * 0.8;
      const rInner = wallR * (0.4 + hashA * 0.4);
      const rOuter = wallR * 0.6 + hashB * (superR - wallR * 0.6) * 0.5;
      ctx.globalAlpha = 0.12 + hashA * 0.08;
      ctx.strokeStyle = `rgba(50,55,65,${0.3 + hashB * 0.2})`;
      ctx.lineWidth = (3 + hashA * 4) * zoom * scale;
      ctx.beginPath();
      for (let s = 0; s <= 20; s++) {
        const t2 = s / 20;
        const r = rInner + t2 * (rOuter - rInner);
        const a = startAngle + t2 * arcLen + time * 0.15 * (i % 2 === 0 ? 1 : -1);
        const px = tPos.x + Math.cos(a) * r;
        const py = tPos.y + Math.sin(a) * r * 0.7;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  },

  // ─── 浓雾 ───
  _drawFog(ctx, tPos, funnelR, wideR) {
    const grad = ctx.createRadialGradient(tPos.x, tPos.y, funnelR * 0.5, tPos.x, tPos.y, wideR * 1.5);
    grad.addColorStop(0, 'rgba(80,85,95,0.4)');
    grad.addColorStop(0.4, 'rgba(100,105,115,0.25)');
    grad.addColorStop(0.7, 'rgba(120,125,135,0.12)');
    grad.addColorStop(1, 'rgba(140,145,155,0)');
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(tPos.x, tPos.y, wideR * 1.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // ─── 强降雨 ───
  _drawRain(ctx, tPos, wideR, zoom, time, formDef) {
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = 'rgba(160,180,200,0.75)';
    ctx.lineWidth = 1.8 * zoom;
    ctx.lineCap = 'round';
    const rainRange = wideR * 2.0;
    const rainW = rainRange * 2;
    const rainH = rainRange * 2;
    const count = Math.floor(120 * formDef.rainMultiplier);
    for (let i = 0; i < count; i++) {
      const seed = i * 7919 + this.frameCount * 3;
      const hashX = ((seed * 2654435761) >>> 0) % 10000 / 10000;
      const hashY = ((seed * 40503) >>> 0) % 10000 / 10000;
      const rx = tPos.x + (hashX - 0.5) * rainW;
      const baseY = tPos.y - rainH * 0.5;
      const fallSpeed = 8 + (i % 5) * 2;
      const yOffset = (this.frameCount * fallSpeed + hashY * rainH * 3) % (rainH * 1.2);
      const ry = baseY + yOffset;
      const rainLen = 18 + (i % 7) * 3;
      const windOffset = 4 + Math.sin(time + i * 0.1) * 1.5;
      const distFromCenter = Math.hypot(rx - tPos.x, ry - tPos.y);
      const alpha = Math.max(0.3, 0.8 - distFromCenter / rainRange);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + windOffset, ry + rainLen);
      ctx.stroke();
    }
  },

  // ─── 风场环 ───
  _drawWindRings(ctx, tPos, wideR, zoom, time) {
    for (let i = 0; i < 35; i++) {
      const angle = time + i * 0.32;
      const r = wideR + Math.sin(time * 0.8 + i * 0.7) * 15 * zoom;
      const alpha = 0.35 + Math.sin(time + i) * 0.1;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(180,195,210,0.5)';
      ctx.lineWidth = 2.5 * zoom;
      ctx.beginPath();
      const arcLen = 0.22 + (i % 3) * 0.06;
      ctx.arc(tPos.x, tPos.y, r, angle, angle + arcLen);
      ctx.stroke();
    }
  },

  // ─── 雨带 ───
  _drawRainBands(ctx, tPos, wallR, funnelR, zoom, time) {
    for (let band = 0; band < 3; band++) {
      ctx.globalAlpha = 0.5 - band * 0.1;
      ctx.strokeStyle = `rgba(160,175,195,${0.55 - band * 0.12})`;
      ctx.lineWidth = (1.8 - band * 0.3) * zoom;
      ctx.lineCap = 'round';
      for (let i = 0; i < 35; i++) {
        const angle = time * (0.8 + band * 0.15) + i * 0.52 + band * 1.2;
        const r = wallR * (0.7 + band * 0.2) + (i % 4) * 5 * zoom;
        const x1 = tPos.x + Math.cos(angle) * r;
        const y1 = tPos.y + Math.sin(angle) * r * 0.6;
        const x2 = tPos.x + Math.cos(angle + 0.18) * (r - 30 * zoom);
        const y2 = tPos.y + Math.sin(angle + 0.18) * (r - 30 * zoom) * 0.6 + 14 * zoom;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  },

  // ─── 中气旋 ───
  _drawMesocyclone(ctx, tPos, funnelR, wallR, zoom, time) {
    const grad = ctx.createRadialGradient(tPos.x, tPos.y, funnelR * 0.3, tPos.x, tPos.y, wallR * 1.2);
    grad.addColorStop(0, 'rgba(50,55,65,0)');
    grad.addColorStop(0.3, 'rgba(60,65,75,0.12)');
    grad.addColorStop(0.55, 'rgba(80,85,95,0.35)');
    grad.addColorStop(0.75, 'rgba(100,105,115,0.25)');
    grad.addColorStop(1, 'rgba(120,125,135,0)');
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(tPos.x, tPos.y, wallR * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = 'rgba(90,95,105,0.4)';
    ctx.lineWidth = 3 * zoom;
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      const baseAngle = time * 0.6 + arm * Math.PI * 0.5;
      for (let s = 0; s < 30; s++) {
        const t2 = s / 30;
        const r = funnelR * 0.4 + t2 * wallR * 0.9;
        const a = baseAngle + t2 * Math.PI * 1.5;
        const px = tPos.x + Math.cos(a) * r;
        const py = tPos.y + Math.sin(a) * r * 0.65;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  },

  // ─── 吸入粒子 ───
  _drawSuctionParticles(ctx, tPos, funnelR, time) {
    for (let i = 0; i < 40; i++) {
      const angle = time * 1.2 + i * 0.26;
      const dist = funnelR * (1.6 - (this.frameCount * 0.012 + i * 0.04) % 1.6);
      const px = tPos.x + Math.cos(angle) * dist;
      const py = tPos.y + Math.sin(angle) * dist * 0.7;
      const alpha = 0.7 - (dist / (funnelR * 1.6)) * 0.35;
      ctx.globalAlpha = Math.max(0.1, alpha);
      const sz = 2 + (1 - dist / (funnelR * 1.6)) * 3;
      ctx.fillStyle = `rgba(130,115,90,${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // ─── 根据形态绘制漏斗 ───
  _drawFunnelByForm(ctx, tPos, funnelR, wideR, wallR, zoom, time, formDef) {
    const form = this.form;

    if (form === 'rope') {
      this._drawRopeFunnel(ctx, tPos, funnelR, wallR, zoom, time);
    } else if (form === 'wedge') {
      this._drawWedgeFunnel(ctx, tPos, funnelR, wideR, wallR, zoom, time);
    } else if (form === 'stovepipe') {
      this._drawStovepipeFunnel(ctx, tPos, funnelR, wallR, zoom, time);
    } else {
      // funnel / multivortex — 经典漏斗
      this._drawClassicFunnel(ctx, tPos, funnelR, wallR, zoom, time);
    }

    // 地表扰动碎屑
    for (let i = 0; i < 35; i++) {
      const angle = time * 0.8 + i * 0.32;
      const ring = wideR * (0.6 + (i % 5) * 0.1);
      const px = tPos.x + Math.cos(angle) * ring;
      const py = tPos.y + Math.sin(angle) * ring * 0.65;
      ctx.globalAlpha = 0.35 + Math.sin(time + i * 1.3) * 0.1;
      ctx.fillStyle = 'rgba(120,100,75,0.4)';
      ctx.beginPath();
      ctx.arc(px, py, 1.5 + (i % 3) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // ─── 经典漏斗 ───
  _drawClassicFunnel(ctx, tPos, funnelR, wallR, zoom, time) {
    // 外圈
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = 'rgba(40,35,30,0.85)';
    ctx.lineWidth = 14 * zoom;
    ctx.beginPath();
    ctx.arc(tPos.x, tPos.y, funnelR * 1.05, 0, Math.PI * 2);
    ctx.stroke();
    // 中圈
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = 'rgba(55,48,40,0.9)';
    ctx.lineWidth = 9 * zoom;
    ctx.beginPath();
    ctx.arc(tPos.x, tPos.y, funnelR * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    // 内圈
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(15,12,8,0.92)';
    ctx.beginPath();
    ctx.arc(tPos.x, tPos.y, funnelR * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // 旋转线条
    for (let i = 0; i < 28; i++) {
      const angle = (i / 16) * Math.PI * 2 + time * 1.3;
      const alpha = 0.3 + Math.sin(time * 2 + i) * 0.1;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(100,90,75,0.6)';
      ctx.lineWidth = 2 * zoom;
      const r1 = funnelR * 0.3;
      const r2 = funnelR * 1.3;
      ctx.beginPath();
      ctx.moveTo(tPos.x + Math.cos(angle) * r1, tPos.y + Math.sin(angle) * r1 * 0.75);
      ctx.lineTo(tPos.x + Math.cos(angle + 0.35) * r2, tPos.y + Math.sin(angle + 0.35) * r2 * 0.75);
      ctx.stroke();
    }
  },

  // ─── 绳索状：细长、扭曲 ───
  _drawRopeFunnel(ctx, tPos, funnelR, wallR, zoom, time) {
    const ropeR = funnelR * 0.4;
    // 细长的绳索主体 — 用多条扭曲的线
    for (let strand = 0; strand < 5; strand++) {
      ctx.globalAlpha = 0.5 + strand * 0.08;
      ctx.strokeStyle = `rgba(120,110,95,${0.6 + strand * 0.05})`;
      ctx.lineWidth = (2 + strand * 0.5) * zoom;
      ctx.beginPath();
      const phaseOff = strand * Math.PI * 0.4;
      for (let s = 0; s < 40; s++) {
        const t2 = s / 40;
        const yOff = (t2 - 0.5) * wallR * 2.5;
        const wobble = Math.sin(t2 * Math.PI * 4 + time * 2 + phaseOff) * ropeR * (0.5 + t2 * 0.5);
        const px = tPos.x + wobble;
        const py = tPos.y + yOff;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // 中心暗核
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'rgba(20,18,15,0.8)';
    ctx.beginPath();
    ctx.arc(tPos.x, tPos.y, ropeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // ─── 楔状：宽扁、压迫感强 ───
  _drawWedgeFunnel(ctx, tPos, funnelR, wideR, wallR, zoom, time) {
    // 楔状：水平方向拉宽
    const hStretch = 1.8;
    // 外部暗色宽椭圆
    ctx.globalAlpha = 0.75;
    const wedgeGrad = ctx.createRadialGradient(tPos.x, tPos.y, funnelR * 0.3, tPos.x, tPos.y, wideR);
    wedgeGrad.addColorStop(0, 'rgba(25,22,18,0.9)');
    wedgeGrad.addColorStop(0.3, 'rgba(45,40,35,0.7)');
    wedgeGrad.addColorStop(0.6, 'rgba(65,58,50,0.4)');
    wedgeGrad.addColorStop(1, 'rgba(85,78,70,0)');
    ctx.fillStyle = wedgeGrad;
    ctx.beginPath();
    ctx.ellipse(tPos.x, tPos.y, wideR * hStretch, wideR * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 内部旋转纹理
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = 'rgba(50,45,38,0.6)';
    ctx.lineWidth = 4 * zoom;
    for (let arm = 0; arm < 8; arm++) {
      ctx.beginPath();
      const baseAngle = time * 0.5 + arm * Math.PI / 4;
      for (let s = 0; s < 30; s++) {
        const t2 = s / 30;
        const r = funnelR * 0.3 + t2 * (wideR * hStretch - funnelR * 0.3);
        const a = baseAngle + t2 * Math.PI * 1.2;
        const px = tPos.x + Math.cos(a) * r;
        const py = tPos.y + Math.sin(a) * r * 0.4;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // 中心核
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'rgba(15,12,8,0.85)';
    ctx.beginPath();
    ctx.ellipse(tPos.x, tPos.y, funnelR * 0.8 * hStretch, funnelR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // ─── 烟囱状：均匀圆柱 ───
  _drawStovepipeFunnel(ctx, tPos, funnelR, wallR, zoom, time) {
    const pipeR = funnelR * 0.9;
    // 圆柱主体 — 用矩形渐变模拟
    ctx.globalAlpha = 0.7;
    const pipeGrad = ctx.createLinearGradient(tPos.x - pipeR, tPos.y, tPos.x + pipeR, tPos.y);
    pipeGrad.addColorStop(0, 'rgba(60,55,48,0.3)');
    pipeGrad.addColorStop(0.3, 'rgba(35,30,25,0.8)');
    pipeGrad.addColorStop(0.5, 'rgba(20,18,15,0.9)');
    pipeGrad.addColorStop(0.7, 'rgba(35,30,25,0.8)');
    pipeGrad.addColorStop(1, 'rgba(60,55,48,0.3)');
    ctx.fillStyle = pipeGrad;
    const pipeH = wallR * 2.5;
    ctx.fillRect(tPos.x - pipeR, tPos.y - pipeH / 2, pipeR * 2, pipeH);
    // 旋转环
    for (let i = 0; i < 12; i++) {
      const yOff = (i / 12 - 0.5) * pipeH;
      const ringAlpha = 0.3 + Math.sin(time * 2 + i * 0.8) * 0.15;
      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = 'rgba(80,72,60,0.6)';
      ctx.lineWidth = 2 * zoom;
      ctx.beginPath();
      ctx.ellipse(tPos.x, tPos.y + yOff, pipeR * (1 + Math.sin(time + i) * 0.05), pipeR * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 顶部和底部暗核
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'rgba(15,12,8,0.85)';
    ctx.beginPath();
    ctx.ellipse(tPos.x, tPos.y, pipeR * 0.6, pipeR * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // ─── 多涡旋子涡 ───
  _drawSubVortices(ctx, tPos, wideR, funnelR, zoom, time, count, blendAlpha) {
    ctx.globalAlpha = 0.5 * blendAlpha;
    for (let v = 0; v < count; v++) {
      const orbitAngle = time * 0.4 + v * (Math.PI * 2 / count);
      const orbitR = wideR * 0.6;
      const vx = tPos.x + Math.cos(orbitAngle) * orbitR;
      const vy = tPos.y + Math.sin(orbitAngle) * orbitR * 0.6;
      const subR = funnelR * 0.35;
      // 子涡漏斗
      const subGrad = ctx.createRadialGradient(vx, vy, 0, vx, vy, subR);
      subGrad.addColorStop(0, 'rgba(20,18,15,0.8)');
      subGrad.addColorStop(0.4, 'rgba(50,45,38,0.5)');
      subGrad.addColorStop(1, 'rgba(80,75,65,0)');
      ctx.fillStyle = subGrad;
      ctx.beginPath();
      ctx.arc(vx, vy, subR, 0, Math.PI * 2);
      ctx.fill();
      // 子涡旋转线
      ctx.strokeStyle = 'rgba(90,80,65,0.5)';
      ctx.lineWidth = 1.5 * zoom;
      for (let line = 0; line < 6; line++) {
        const a = time * 2 + line * Math.PI / 3 + v;
        ctx.beginPath();
        ctx.moveTo(vx + Math.cos(a) * subR * 0.2, vy + Math.sin(a) * subR * 0.2);
        ctx.lineTo(vx + Math.cos(a + 0.5) * subR * 0.9, vy + Math.sin(a + 0.5) * subR * 0.9);
        ctx.stroke();
      }
    }
  },

  // ─── 底部碎屑云 ───
  _drawDebrisClouds(ctx, tPos, funnelR, time, formDef) {
    const intensity = formDef.debrisIntensity;
    const mainCount = Math.floor(8 * intensity);
    const spreadCount = Math.floor(6 * intensity);
    // 主碎屑云
    for (let i = 0; i < mainCount; i++) {
      const angle = time * 0.6 + i * Math.PI / 4;
      const dist = funnelR * (0.9 + Math.sin(time * 0.5 + i) * 0.2);
      const cx = tPos.x + Math.cos(angle) * dist;
      const cy = tPos.y + Math.sin(angle) * dist * 0.7;
      const cloudR = funnelR * (0.35 + Math.sin(time + i * 1.2) * 0.08);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cloudR);
      grad.addColorStop(0, 'rgba(110,90,65,0.5)');
      grad.addColorStop(0.4, 'rgba(130,110,80,0.35)');
      grad.addColorStop(0.7, 'rgba(150,130,100,0.18)');
      grad.addColorStop(1, 'rgba(170,150,120,0)');
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cloudR, 0, Math.PI * 2);
      ctx.fill();
    }
    // 扩散碎屑云
    for (let i = 0; i < spreadCount; i++) {
      const angle = time * 0.4 + i * Math.PI / 3 + 0.5;
      const dist = funnelR * (1.3 + i * 0.15);
      const cx = tPos.x + Math.cos(angle) * dist;
      const cy = tPos.y + Math.sin(angle) * dist * 0.65;
      const cloudR = funnelR * (0.25 + Math.sin(time * 0.8 + i) * 0.05);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cloudR);
      grad.addColorStop(0, 'rgba(120,100,75,0.35)');
      grad.addColorStop(0.5, 'rgba(140,120,90,0.2)');
      grad.addColorStop(1, 'rgba(160,140,110,0)');
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cloudR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

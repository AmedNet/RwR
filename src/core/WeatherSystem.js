// src/core/WeatherSystem.js
// 天气系统核心协调器：状态管理、过渡逻辑、gameplay 接口
import { GameState } from './GameState.js';
import { WEATHER_DEFS, lerp, lerpAngle, weightedRandom } from './WeatherDefs.js';
import { WeatherRenderer } from './WeatherRenderer.js';
import { EffectsManager } from '../utils/EffectsManager.js';

export const WeatherSystem = {
  // 状态
  current: 'sunny',
  previous: 'sunny',
  transitioning: false,
  transitionProgress: 0,
  transitionDuration: 600, // 10秒
  weatherTimer: 0,
  frameCount: 0,

  // 云影
  clouds: [],

  // 天气粒子
  particles: [],

  // 闪电分支数据
  lightningBranches: [],

  // 风力
  windAngle: Math.random() * Math.PI * 2,
  windStrength: 0,
  targetWindAngle: 0,
  targetWindStrength: 0,
  windChangeTimer: 0,

  // 闪电
  lightningTimer: 0,
  lightningFlash: 0,
  lightningDelay: 0,
  lightningPending: false,
  distantFlash: 0,

  // 龙卷风
  tornadoCenter: null,
  tornadoAngle: 0,

  // ─── 初始化 ───
  init() {
    const entries = Object.entries(WEATHER_DEFS);
    const items = entries.map(([key, def]) => ({ type: key, weight: def.weight }));
    const chosen = weightedRandom(items, 'weight');
    this.current = chosen.type;
    this.previous = chosen.type;
    this.transitioning = false;
    this.transitionProgress = 1;

    const def = WEATHER_DEFS[this.current];
    if (def.wind) {
            // 如果 wind.angle 是 null，随机生成风向
            const baseAngle = def.wind.angle !== null ? def.wind.angle : Math.random() * Math.PI * 2;
            this.windAngle = baseAngle + (Math.random() - 0.5) * 0.5;
      this.windStrength = def.wind.strength;
      this.targetWindAngle = this.windAngle;
      this.targetWindStrength = this.windStrength;
    } else {
      this.windAngle = 0;
      this.windStrength = 0;
      this.targetWindAngle = 0;
      this.targetWindStrength = 0;
    }

    this.weatherTimer = 3600 + Math.floor(Math.random() * 14400);
    this._initClouds();

    if (this.current === 'tornado') {
      this._initTornadoCenter();
    }

    GameState.weather = this.current;
    console.log(`🌤️ 初始天气: ${def.icon} ${def.name}`);
  },

  // ─── 生成云团 ───
  _initClouds() {
    this.clouds = [];
    const world = GameState.config.world;
    // 增加云的数量，覆盖更大范围，避免云影太少太明显
    const cloudCount = Math.max(15, Math.floor(world.width * world.height / 300000));
    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push(this._createCloud(world));
    }
  },

  _createCloud(world) {
    const w = 300 + Math.random() * 500;
    const h = 200 + Math.random() * 300;
    return {
      x: Math.random() * (world.width + w) - w / 2,
      y: Math.random() * (world.height + h) - h / 2,
      w, h,
      vx: (Math.random() - 0.5) * 1.0,
      vy: (Math.random() - 0.5) * 0.5,
      alpha: 0.08 + Math.random() * 0.14
    };
  },

  // ─── 龙卷风中心初始化 ───
  _initTornadoCenter() {
    const world = GameState.config.world;
    this.tornadoCenter = {
      x: world.width * 0.3 + Math.random() * world.width * 0.4,
      y: world.height * 0.3 + Math.random() * world.height * 0.4
    };
    this.tornadoAngle = 0;
    this.tornadoScale = 1.0;
    this.tornadoScaleTarget = 1.0;
    this.tornadoScaleTimer = 0;
    // 贝塞尔曲线路径
    this.tornadoPath = null;
    this.tornadoPathT = 0;
    this.tornadoPathSpeed = 0.00001;
    this._generateTornadoPath();
  },

  // ─── 每帧更新 ───
  update() {
    this.frameCount++;

    if (this.transitioning) {
      this.transitionProgress += 1 / this.transitionDuration;
      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1;
        this.transitioning = false;
        this.previous = this.current;
      }
    }

    if (!this.transitioning) {
      this.weatherTimer--;
      if (this.weatherTimer <= 0) {
        this._pickNextWeather();
      }
    }

    this._updateWind();
    this._updateClouds();
    this._updateParticles();
    this._updateLightning();

    if (this.current === 'tornado' || (this.transitioning && (this.current === 'tornado' || this.previous === 'tornado'))) {
      this._updateTornado();
    }
  },

  // ─── 选择下一个天气 ───
  _pickNextWeather() {
    const def = WEATHER_DEFS[this.current];
    if (!def.transitions || def.transitions.length === 0) return;

    const next = weightedRandom(def.transitions, 'weight');
    this.previous = this.current;
    this.current = next.type;
    this.transitioning = true;
    this.transitionProgress = 0;

    const nextDef = WEATHER_DEFS[this.current];
    if (nextDef.wind) {
            // 如果 wind.angle 是 null，随机生成风向
            const baseAngle = nextDef.wind.angle !== null ? nextDef.wind.angle : Math.random() * Math.PI * 2;
            this.targetWindAngle = baseAngle + (Math.random() - 0.5) * 0.5;
      this.targetWindStrength = nextDef.wind.strength;
    } else {
      this.targetWindStrength = 0;
    }

    this.weatherTimer = 3600 + Math.floor(Math.random() * 14400);

    if (this.current === 'tornado') {
      this._initTornadoCenter();
    }

    GameState.weather = this.current;
    console.log(`🌤️ 天气变化: ${WEATHER_DEFS[this.previous].icon} ${WEATHER_DEFS[this.previous].name} → ${nextDef.icon} ${nextDef.name}`);
  },

  // ─── 风力更新 ───
  _updateWind() {
    this.windStrength = lerp(this.windStrength, this.targetWindStrength, 0.01);

    this.windChangeTimer++;
    // 风向更频繁抖动，暴风/沙尘暴变化幅度更大
    if (this.windChangeTimer >= 480) { // 8秒变化一次
      this.windChangeTimer = 0;
      const currDef = WEATHER_DEFS[this.current];
      const changeRange = (currDef.wind && currDef.wind.strength > 0.5) ? Math.PI * 0.35 : 0.25;
      this.targetWindAngle += (Math.random() - 0.5) * changeRange;
    }
    this.windAngle = lerpAngle(this.windAngle, this.targetWindAngle, 0.005);
  },

  // ─── 云影更新 ───
  _updateClouds() {
    const world = GameState.config.world;
    for (const cloud of this.clouds) {
      cloud.x += cloud.vx;
      cloud.y += cloud.vy;

      if (cloud.x > world.width + cloud.w) cloud.x = -cloud.w;
      if (cloud.x < -cloud.w) cloud.x = world.width + cloud.w;
      if (cloud.y > world.height + cloud.h) cloud.y = -cloud.h;
      if (cloud.y < -cloud.h) cloud.y = world.height + cloud.h;
    }
  },

  // ─── 粒子更新 ───
  _updateParticles() {
    const prevDef = WEATHER_DEFS[this.previous];
    const currDef = WEATHER_DEFS[this.current];
    const t = this.transitionProgress;

    const prevDensity = prevDef.particleDensity || 0;
    const currDensity = currDef.particleDensity || 0;
    const targetDensity = this.transitioning ? lerp(prevDensity, currDensity, t) : currDensity;

    // 使用实际视口尺寸
    const viewW = GameState.viewport.width || 1200;
    const viewH = GameState.viewport.height || 900;
    const cam = GameState.camera;

    // 血月浮尘粒子
    const isBloodMoon = this.current === 'bloodMoon' || (this.transitioning && (this.current === 'bloodMoon' || this.previous === 'bloodMoon'));
    if (isBloodMoon && this.particles.filter(p => p.type === 'ember').length < 40) {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          type: 'ember',
          x: cam.x + Math.random() * viewW,
          y: cam.y + viewH + 10,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -0.5 - Math.random() * 1.5,
          life: 120 + Math.floor(Math.random() * 80),
          maxLife: 200,
          size: 1 + Math.random() * 2.5,
          affectedByWind: true,
          windFactor: 0.01
        });
      }
    }

    // 天气粒子（雨/雪/风/沙等）：全部使用世界坐标
    if (targetDensity > 0) {
      const pType = this.transitioning && t > 0.5 ? currDef.particleType : (this.transitioning ? prevDef.particleType : currDef.particleType);
      if (pType) {
        const maxParticles = Math.ceil(targetDensity * 50);
        if (this.particles.length < maxParticles) {
          const spawnCount = Math.ceil(targetDensity * 1.5);
          for (let i = 0; i < spawnCount; i++) {
            if (pType) this._spawnParticle(pType, viewW, viewH, cam);
          }
        }
      }
    }

    // 雨滴溅射效果：在地面随机位置生成splash粒子
    if (targetDensity > 0) {
      const isRain = currDef.particleType === 'rain' || currDef.particleType === 'acid';
      const wasRain = prevDef.particleType === 'rain' || prevDef.particleType === 'acid';
      if (isRain || wasRain) {
        const splashCount = Math.ceil(targetDensity * 0.8);
        for (let i = 0; i < splashCount; i++) {
          const sx = cam.x + Math.random() * viewW;
          const sy = cam.y + Math.random() * viewH;
          const isAcid = currDef.particleType === 'acid';
          this.particles.push({
            type: 'splash',
            x: sx,
            y: sy,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 8 + Math.floor(Math.random() * 8),
            maxLife: 16,
            size: 1.5 + Math.random() * 2,
            color: isAcid ? 'rgba(80,255,80,0.6)' : 'rgba(180,210,255,0.5)',
            affectedByWind: false
          });
        }
      }
      
      // 冰雹落地溅射效果：更大的冲击力，白色碎裂效果
      const isHail = currDef.particleType === 'hail';
      const wasHail = prevDef.particleType === 'hail';
      if (isHail || wasHail) {
        const hailSplashCount = Math.ceil(targetDensity * 0.4);
        for (let i = 0; i < hailSplashCount; i++) {
          const sx = cam.x + Math.random() * viewW;
          const sy = cam.y + Math.random() * viewH;
          // 冰雹溅射：多个小碎片向四周弹开
          const fragmentCount = 3 + Math.floor(Math.random() * 3);
          for (let j = 0; j < fragmentCount; j++) {
            const angle = (j / fragmentCount) * Math.PI * 2 + Math.random() * 0.5;
            const speed = 1.5 + Math.random() * 2;
            this.particles.push({
              type: 'hailSplash',
              x: sx,
              y: sy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 10 + Math.floor(Math.random() * 8),
              maxLife: 18,
              size: 1 + Math.random() * 1.5,
              affectedByWind: false
            });
          }
          // 中心冲击波
          this.particles.push({
            type: 'hailImpact',
            x: sx,
            y: sy,
            vx: 0,
            vy: 0,
            life: 6,
            maxLife: 6,
            size: 3 + Math.random() * 2,
            affectedByWind: false
          });
        }
      }
            // 酸雨蒸汽效果：落地时产生绿色蒸汽
            const isAcidRain = currDef.particleType === 'acid';
            const wasAcidRain = prevDef.particleType === 'acid';
            if ((isAcidRain || wasAcidRain) && this.particles.filter(p => p.type === 'steam').length < 30) {
                const steamCount = Math.ceil(targetDensity * 0.3);
                for (let i = 0; i < steamCount; i++) {
                    const sx = cam.x + Math.random() * viewW;
                    const sy = cam.y + Math.random() * viewH;
                    this.particles.push({
                        type: 'steam',
                        x: sx,
                        y: sy,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: -0.8 - Math.random() * 0.5,
                        life: 40 + Math.floor(Math.random() * 20),
                        maxLife: 60,
                        size: 3 + Math.random() * 3,
                        affectedByWind: true,
                        windFactor: 0.01
                    });
                }
            }

    }

    const windX = Math.cos(this.windAngle) * this.windStrength;
    const windY = Math.sin(this.windAngle) * this.windStrength;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.affectedByWind) {
        p.vx += windX * p.windFactor;
        p.vy += windY * p.windFactor;
      }

      if (p.type === 'snow') {
        p.vx += Math.sin(p.phase + this.frameCount * 0.02) * 0.06;
      }

      // 雨滴/酸雨：限制水平速度，防止风积累导致抖动
      if (p.type === 'rain' || p.type === 'acid') {
        const maxVx = windX * 1.5;
        if (Math.abs(p.vx) > Math.abs(maxVx) + 2) {
          p.vx = Math.sign(p.vx) * (Math.abs(maxVx) + 2);
        }
        // 保持垂直速度稳定
        if (p.vy < 6) p.vy = 6 + Math.random() * 2;
      }

      // 按 life 或边界移除
      const margin = 100;
      if (p.life <= 0 ||
          p.x < cam.x - margin || p.x > cam.x + viewW + margin ||
          p.y < cam.y - margin || p.y > cam.y + viewH + margin) {
        this.particles.splice(i, 1);
      }
    }

  },

  // ─── 生成非雨粒子（雪/风/沙/冰雹/碎片） ───
  _spawnParticle(type, viewW, viewH, cam) {
    const windX = Math.cos(this.windAngle) * this.windStrength;
    const windY = Math.sin(this.windAngle) * this.windStrength;
    const cw = viewW || 1200;
    const ch = viewH || 900;
    const cx = cam ? cam.x : 0;
    const cy = cam ? cam.y : 0;

    switch (type) {
      case 'rain':
      case 'acid': {
        const isAcid = type === 'acid';
        // 雨滴：快速垂直下落，风只造成轻微倾斜
        this.particles.push({
          type: type,
          x: cx + Math.random() * (cw + 200) - 100,
          y: cy - 50 - Math.random() * 100,
          vx: windX * 0.5,
          vy: 8 + Math.random() * 4,
          life: 80 + Math.floor(Math.random() * 40),
          maxLife: 120,
          size: 1.0 + Math.random() * 0.6,
          affectedByWind: true,
          windFactor: 0.008,
          isAcid: isAcid
        });
        break;
      }
      case 'snow':
            this.particles.push({
                type: 'snow',
                x: cx + Math.random() * (cw + 400) - 200,
                y: cy - 100 - Math.random() * 300, // 更大的垂直分布范围
          vx: windX * 0.15 + (Math.random() - 0.5) * 0.3,
          vy: 0.8 + Math.random() * 1.2, // 更慢更稳定的下落速度
          life: 300 + Math.floor(Math.random() * 150), // 更长的生命周期
          maxLife: 450,
          size: 2.5 + Math.random() * 3,
          phase: Math.random() * Math.PI * 2,
          affectedByWind: true,
          windFactor: 0.03
        });
        break;
      case 'wind':
        // 暴风：世界坐标粒子，沿风向流动
        const windMargin = 300;
        const windSpawnX = cx - windMargin + Math.random() * (cw + windMargin * 2);
        const windSpawnY = cy - windMargin + Math.random() * (ch + windMargin * 2);
        
        this.particles.push({
          type: 'wind',
          x: windSpawnX,
          y: windSpawnY,
          vx: windX * 3.0 + (Math.random() - 0.5) * 0.5,
          vy: windY * 3.0 + (Math.random() - 0.5) * 0.5,
          life: 150 + Math.floor(Math.random() * 100),
          maxLife: 250,
          length: 50 + Math.random() * 80,
          thickness: 0.6 + Math.random() * 1.0,
          alpha: 0.12 + Math.random() * 0.2,
          affectedByWind: true,
          windFactor: 0.04
        });
        break;
      case 'sand':
        this.particles.push({
          type: 'sand',
          x: cx + Math.random() * cw,
          y: cy + Math.random() * ch,
          vx: windX * 1.5 + (Math.random() - 0.5) * 1.5,
          vy: windY * 1.5 + (Math.random() - 0.5) * 1.5,
          life: 80 + Math.floor(Math.random() * 40),
          maxLife: 120,
          size: 2 + Math.random() * 2.5,
          affectedByWind: false
        });
        break;
      case 'hail':
        this.particles.push({
          type: 'hail',
          x: cx + Math.random() * (cw + 200) - 100,
          y: cy - 10 - Math.random() * 30,
          vx: windX * 0.2 + (Math.random() - 0.5) * 0.5,
          vy: 8 + Math.random() * 5,
          life: 100 + Math.floor(Math.random() * 40),
          maxLife: 140,
          size: 1.2 + Math.random() * 0.8,
          affectedByWind: true,
          windFactor: 0.03
        });
        break;
      case 'debris':
        if (this.tornadoCenter) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 50 + Math.random() * 200;
          this.particles.push({
            type: 'debris',
            x: this.tornadoCenter.x + Math.cos(angle) * dist,
            y: this.tornadoCenter.y + Math.sin(angle) * dist,
            vx: 0, vy: 0,
            life: 120 + Math.floor(Math.random() * 60),
            maxLife: 180,
            size: 3 + Math.random() * 5,
            orbitAngle: angle,
            orbitDist: dist,
            orbitSpeed: 0.03 + Math.random() * 0.04,
            affectedByWind: false
          });
        }
        break;
    }
  },

  // ─── 闪电更新 ───
  _updateLightning() {
    const currDef = WEATHER_DEFS[this.current];
    const prevDef = WEATHER_DEFS[this.previous];
    const hasLightning = currDef.lightning || (this.transitioning && prevDef.lightning);

    if (hasLightning) {
      this.lightningTimer--;
      
      // 处理延迟闪电
      if (this.lightningPending) {
        this.lightningDelay--;
        if (this.lightningDelay <= 0) {
          this.lightningFlash = 14;
          this._generateLightningBranches();
          this._triggerLightningShake();
          this.lightningPending = false;
        }
      }
      
      if (this.lightningTimer <= 0) {
        this.distantFlash = 8; // 远处闪光
        this.lightningPending = true;
        this.lightningDelay = 30 + Math.floor(Math.random() * 60); // 0.5-1.5秒延迟
        this.lightningTimer = 1800 + Math.floor(Math.random() * 1800); // 30-60秒，极其罕见
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash--;
      if (this.lightningFlash <= 3) {
        this.lightningBranches = [];
      }
    }
    
    // 远处闪光衰减
    if (this.distantFlash > 0) {
      this.distantFlash -= 0.5;
    }
  },

  // ─── 闪电屏幕抖动 ───
  _triggerLightningShake() {
    EffectsManager.triggerShake(12, 18);
  },

  _generateLightningBranches() {
    this.lightningBranches = [];
    const viewW = GameState.viewport.width || 1200;
    const viewH = GameState.viewport.height || 900;
    const numBolts = 2 + Math.floor(Math.random() * 3);

    for (let b = 0; b < numBolts; b++) {
      const startX = Math.random() * viewW;
      const startY = -20;
      const endX = startX + (Math.random() - 0.5) * viewW * 0.4;
      const endY = viewH * (0.3 + Math.random() * 0.5);
      const segments = [];
      this._branchLightning(segments, startX, startY, endX, endY, 0, 4);
      this.lightningBranches.push(segments);
    }
  },

  _branchLightning(segments, x1, y1, x2, y2, depth, maxDepth) {
    if (depth > maxDepth) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);

    if (depth >= maxDepth || dist < 30) {
      segments.push({ x: x1, y: y1 });
      segments.push({ x: x2, y: y2 });
      return;
    }

    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * dist * 0.3;
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * dist * 0.3;

    this._branchLightning(segments, x1, y1, mx, my, depth + 1, maxDepth);
    this._branchLightning(segments, mx, my, x2, y2, depth + 1, maxDepth);

    if (depth < 2 && Math.random() < 0.4) {
      const branchEndX = mx + (Math.random() - 0.5) * dist * 0.5;
      const branchEndY = my + Math.random() * dist * 0.4;
      this._branchLightning(segments, mx, my, branchEndX, branchEndY, maxDepth, maxDepth);
    }
  },

  // ─── 生成贝塞尔曲线路径 ───
  _generateTornadoPath() {
    const world = GameState.config.world;
    const margin = 400;
    // 生成 4-6 个控制点
    const numPoints = 4 + Math.floor(Math.random() * 3);
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: margin + Math.random() * (world.width - margin * 2),
        y: margin + Math.random() * (world.height - margin * 2)
      });
    }
    this.tornadoPath = points;
    this.tornadoPathT = 0;
  },

  // ─── 计算贝塞尔曲线上的点 ───
  _getBezierPoint(t) {
    const points = this.tornadoPath;
    if (!points || points.length < 2) return null;
    
    // 使用多段贝塞尔曲线连接控制点
    const n = points.length;
    const totalSegments = n;
    const segment = Math.floor(t * totalSegments) % totalSegments;
    const localT = (t * totalSegments) % 1;
    
    // 获取当前段的 4 个控制点（循环使用）
    const p0 = points[segment % n];
    const p1 = points[(segment + 1) % n];
    const p2 = points[(segment + 2) % n];
    const p3 = points[(segment + 3) % n];
    
    // 三次贝塞尔曲线
    const mt = 1 - localT;
    const x = mt*mt*mt*p0.x + 3*mt*mt*localT*p1.x + 3*mt*localT*localT*p2.x + localT*localT*localT*p3.x;
    const y = mt*mt*mt*p0.y + 3*mt*mt*localT*p1.y + 3*mt*localT*localT*p2.y + localT*localT*localT*p3.y;
    
    return { x, y };
  },

  // ─── 龙卷风更新 ───
  _updateTornado() {
    if (!this.tornadoCenter) return;
    this.tornadoAngle += 0.01;
    
    // 动态大小变化
    this.tornadoScaleTimer++;
    if (this.tornadoScaleTimer >= 180) { // 每3秒变化一次
      this.tornadoScaleTarget = 0.7 + Math.random() * 0.6; // 0.7-1.3倍
      this.tornadoScaleTimer = 0;
    }
    this.tornadoScale += (this.tornadoScaleTarget - this.tornadoScale) * 0.02;

    // 贝塞尔曲线路径移动
    if (this.tornadoPath) {
      this.tornadoPathT += this.tornadoPathSpeed;
      // 到达终点后生成新路径
      if (this.tornadoPathT >= 1) {
        this._generateTornadoPath();
        this.tornadoPathT = 0;
      }
      
      const targetPos = this._getBezierPoint(this.tornadoPathT);
      if (targetPos) {
        // 添加随机扰动
        const jitterX = (Math.random() - 0.5) * 0.5;
        const jitterY = (Math.random() - 0.5) * 0.5;
        
        // 平滑移动到目标位置
        this.tornadoCenter.x += (targetPos.x - this.tornadoCenter.x) * 0.008 + jitterX;
        this.tornadoCenter.y += (targetPos.y - this.tornadoCenter.y) * 0.008 + jitterY;
      }
    }

    const world = GameState.config.world;
    this.tornadoCenter.x = Math.max(200, Math.min(world.width - 200, this.tornadoCenter.x));
    this.tornadoCenter.y = Math.max(200, Math.min(world.height - 200, this.tornadoCenter.y));

    for (const p of this.particles) {
      if (p.type === 'debris') {
        p.orbitAngle += p.orbitSpeed;
        p.orbitDist *= 0.998;
        if (p.orbitDist < 10) p.orbitDist = 50 + Math.random() * 150;
        p.x = this.tornadoCenter.x + p.orbitDist * Math.cos(p.orbitAngle);
        p.y = this.tornadoCenter.y + p.orbitDist * Math.sin(p.orbitAngle);
      } else if (p.type === 'dustCloud') {
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        const dx = p.x - this.tornadoCenter.x;
        const dy = p.y - this.tornadoCenter.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 260) {
          p.x = this.tornadoCenter.x + (Math.random() - 0.5) * 90;
          p.y = this.tornadoCenter.y + (Math.random() - 0.5) * 90;
        }
      }
    }

    // 龙卷风周边的碎屑和尘土云
    if (this.frameCount % 2 === 0 && this.particles.filter(p => p.type === 'dustCloud').length < 28) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 95;
      this.particles.push({
        type: 'dustCloud',
        x: this.tornadoCenter.x + Math.cos(angle) * dist,
        y: this.tornadoCenter.y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * (0.45 + Math.random() * 0.3),
        vy: Math.sin(angle) * (0.45 + Math.random() * 0.3) - 0.25,
        life: 70 + Math.floor(Math.random() * 40),
        maxLife: 110,
        size: 10 + Math.random() * 8,
        affectedByWind: false
      });
    }

    if (this.frameCount % 4 === 0) {
      const swirlCount = 2;
      for (let i = 0; i < swirlCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 180;
        this.particles.push({
          type: 'dustCloud',
          x: this.tornadoCenter.x + Math.cos(angle) * dist,
          y: this.tornadoCenter.y + Math.sin(angle) * dist,
          vx: Math.cos(angle + Math.PI / 2) * (0.15 + Math.random() * 0.1),
          vy: Math.sin(angle + Math.PI / 2) * (0.15 + Math.random() * 0.1),
          life: 40 + Math.floor(Math.random() * 20),
          maxLife: 70,
          size: 6 + Math.random() * 4,
          affectedByWind: false
        });
      }
    }

    // ═══ 龙卷风周围强降雨粒子 ═══
    // 每帧生成多个雨滴，在龙卷风周围的圆形区域内
    const rainRadius = 650 * (this.tornadoScale || 1.0) * 2; // 降雨范围
    const rainCount = 8; // 每帧生成的雨滴数量
    
    for (let i = 0; i < rainCount; i++) {
      // 在圆形区域内随机位置
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * rainRadius;
      const rx = this.tornadoCenter.x + Math.cos(angle) * dist;
      const ry = this.tornadoCenter.y + Math.sin(angle) * dist - rainRadius * 0.5; // 从上方生成
      
      this.particles.push({
        type: 'tornadoRain',
        x: rx,
        y: ry,
        vx: 0.5, // 轻微风向偏移
        vy: 10 + Math.random() * 4, // 垂直下落速度
        life: 60 + Math.floor(Math.random() * 30),
        maxLife: 90,
        size: 1.2 + Math.random() * 0.5,
        affectedByWind: false,
        tornadoCenterX: this.tornadoCenter.x, // 记录生成时的龙卷风中心
        tornadoCenterY: this.tornadoCenter.y,
        rainRadius: rainRadius // 记录降雨范围
      });
    }

  },

  // ─── Gameplay 查询接口 ───
  getSpeedMultiplier() {
    const prevDef = WEATHER_DEFS[this.previous];
    const currDef = WEATHER_DEFS[this.current];
    const t = this.transitionProgress;
    return this.transitioning ? lerp(prevDef.speedMult, currDef.speedMult, t) : currDef.speedMult;
  },

  getAccuracyMultiplier() {
    const prevDef = WEATHER_DEFS[this.previous];
    const currDef = WEATHER_DEFS[this.current];
    const t = this.transitionProgress;
    return this.transitioning ? lerp(prevDef.accuracyMult, currDef.accuracyMult, t) : currDef.accuracyMult;
  },

  getAwarenessMultiplier() {
    const prevDef = WEATHER_DEFS[this.previous];
    const currDef = WEATHER_DEFS[this.current];
    const t = this.transitionProgress;
    return this.transitioning ? lerp(prevDef.awarenessMult, currDef.awarenessMult, t) : currDef.awarenessMult;
  },

  getWindForce() {
    return {
      x: Math.cos(this.windAngle) * this.windStrength,
      y: Math.sin(this.windAngle) * this.windStrength
    };
  },

  getTornadoForce(entityX, entityY) {
    if (this.current !== 'tornado' || !this.tornadoCenter) return { x: 0, y: 0 };
    const dx = this.tornadoCenter.x - entityX;
    const dy = this.tornadoCenter.y - entityY;
    const dist = Math.hypot(dx, dy);
    const range = 1800;
    if (dist > range || dist < 5) return { x: 0, y: 0 };

    const strength = 2.2 * (1 - dist / range);
    const angle = Math.atan2(dy, dx);
    const radialX = Math.cos(angle) * strength * 0.6;
    const radialY = Math.sin(angle) * strength * 0.6;
    const tangentialX = -Math.sin(angle) * strength * 0.8;
    const tangentialY = Math.cos(angle) * strength * 0.8;
    return { x: radialX + tangentialX, y: radialY + tangentialY };
  },

  
  getTornadoDamage(entityX, entityY) {
    if (this.current !== 'tornado' || !this.tornadoCenter) return 0;
    const dx = this.tornadoCenter.x - entityX;
    const dy = this.tornadoCenter.y - entityY;
    const dist = Math.hypot(dx, dy);
    const funnelR = 280 * this.tornadoScale;
    
    // 在漏斗内受到持续伤害（每秒30血）
    if (dist < funnelR * 0.6) {
      return 0.5 * (1 - dist / (funnelR * 0.6)); // 越靠近中心伤害越高
    }
    // 在漏斗外围也会受到碎屑伤害（每秒9血）
    if (dist < funnelR * 1.2) {
      return 0.15 * (1 - (dist - funnelR * 0.6) / (funnelR * 0.6));
    }
    return 0;
  },

  getTornadoScale() {
    return this.tornadoScale || 1.0;
  },

  getFogRadius() {
    const prevDef = WEATHER_DEFS[this.previous];
    const currDef = WEATHER_DEFS[this.current];
    const t = this.transitionProgress;
    return this.transitioning ? lerp(prevDef.fogRadius, currDef.fogRadius, t) : currDef.fogRadius;
  },

  setWeather(type) {
    if (!WEATHER_DEFS[type]) return;
    this.previous = this.current;
    this.current = type;
    this.transitioning = true;
    this.transitionProgress = 0;

    const def = WEATHER_DEFS[type];
    if (def.wind) {
            // 如果 wind.angle 是 null，随机生成风向
            const baseAngle = def.wind.angle !== null ? def.wind.angle : Math.random() * Math.PI * 2;
            this.targetWindAngle = baseAngle + (Math.random() - 0.5) * 0.5;
      this.targetWindStrength = def.wind.strength;
    } else {
      this.targetWindStrength = 0;
    }

    if (type === 'tornado') this._initTornadoCenter();
    GameState.weather = type;
    console.log(`🐛 Debug 切换天气: ${def.icon} ${def.name}`);
  },

  getWeatherDef() {
    return WEATHER_DEFS[this.current];
  },

  getAllWeatherTypes() {
    return Object.entries(WEATHER_DEFS).map(([key, def]) => ({ key, ...def }));
  },

  // ─── 渲染委托 ───
  drawCloudShadows(ctx, camera) {
    WeatherRenderer.drawCloudShadows(this, ctx, camera);
  },

  drawParticles(ctx) {
    WeatherRenderer.drawParticles(this, ctx);
  },

  drawOverlay(ctx, renderer) {
    WeatherRenderer.drawOverlay(this, ctx, renderer);
  },

  drawLightning(ctx, renderer) {
    WeatherRenderer.drawLightning(this, ctx, renderer);
  },
  drawWeatherEdgeEffects(ctx, renderer) {
    WeatherRenderer.drawWeatherEdgeEffects(this, ctx, renderer);
  }
};
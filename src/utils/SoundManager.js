// src/utils/SoundManager.js
// 音效管理器 - 使用 Web Audio API 程序化合成音效

let actx = null;
let masterGain = null;
let audioUnlocked = false;
let listenerProvider = null;

// 初始化 AudioContext（立即创建，而不是延迟创建）
function initAudio() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = actx.createGain();
    masterGain.gain.value = 0.5; // 默认音量 50%
    masterGain.connect(actx.destination);
    
    // 在第一次用户交互时解锁 AudioContext
    const unlockHandler = () => {
      if (actx && actx.state === 'suspended') {
        actx.resume().then(() => {
          audioUnlocked = true;
          console.log('🔊 AudioContext unlocked');
        });
      } else if (actx) {
        audioUnlocked = true;
      }
    };
    
    // 监听多种用户交互事件
    document.addEventListener('keydown', unlockHandler, { capture: true });
    document.addEventListener('mousedown', unlockHandler, { capture: true });
    document.addEventListener('touchstart', unlockHandler, { capture: true });
    
    console.log('🔊 AudioContext initialized, state:', actx.state);
  } catch (e) {
    console.error('🔊 Failed to create AudioContext:', e);
  }
}

// 立即初始化
initAudio();

function getCtx() {
  if (!actx) initAudio();
  if (actx && actx.state === 'suspended') {
    actx.resume();
  }
  return actx;
}

export function setVolume(vol) {
  if (masterGain) masterGain.gain.value = vol;
}

export function getAudioContext() {
  return getCtx();
}

export function setListenerProvider(provider) {
  listenerProvider = provider;
}

function getListenerDistance(sourceOrDistance = 0) {
  if (typeof sourceOrDistance === 'number') return Math.max(0, sourceOrDistance);
  if (sourceOrDistance && typeof sourceOrDistance.x === 'number' && typeof sourceOrDistance.y === 'number') {
    const player = listenerProvider ? listenerProvider() : null;
    if (player) return Math.hypot(sourceOrDistance.x - player.x, sourceOrDistance.y - player.y);
  }
  return 0;
}

function getDistanceVolume(sourceOrDistance = 0, maxDist = 1000, curve = 1.5) {
  const distance = getListenerDistance(sourceOrDistance);
  if (distance >= maxDist) return 0;
  return Math.pow(1 - distance / maxDist, curve);
}

// 辅助：创建带随机音调偏移的 BufferSource（0.92~1.08），让重复音效更自然
function createSrc(c, buffer) {
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  return src;
}

// 辅助音频合成底层（保持你优雅的噪声生成）
function mkNoise(c, d, t) {
  const sr = c.sampleRate, l = sr * d, b = c.createBuffer(1, l, sr), ch = b.getChannelData(0);
  if (t === 'white') {
    for (let i = 0; i < l; i++) ch[i] = Math.random() * 2 - 1;
  } else if (t === 'brown') {
    let p = 0;
    for (let i = 0; i < l; i++) {
      const w = Math.random() * 2 - 1;
      ch[i] = (p + 0.02 * w) / 1.02; p = ch[i]; ch[i] *= 3.5;
    }
  } else if (t === 'pink') {
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < l; i++) {
      const w = Math.random() * 2 - 1;
      b0 = .99886*b0 + w*.0555179; b1 = .99332*b1 + w*.0750759; b2 = .969*b2 + w*.153852;
      b3 = .8665*b3 + w*.3104856; b4 = .55*b4 + w*.5329522; b5 = -.7616*b5 - w*.016898;
      ch[i] = (b0+b1+b2+b3+b4+b5+b6+w*.5362) * .11; b6 = w * .115926;
    }
  }
  return b;
}

// 内部封装：快捷生成一声清脆卡榫金属响
function playClickRaw(c, time, freq, duration, gainVal) {
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = 'square'; osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(gainVal, time); g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(g).connect(masterGain); osc.start(time); osc.stop(time + duration);
}

// 内部封装：快捷生成一声金属长回响（解除枪声/换弹的电子单薄感）
function playRingRaw(c, time, freq, duration, gainVal, type = 'triangle') {
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(gainVal, time); g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(g).connect(masterGain); osc.start(time); osc.stop(time + duration);
}

// 内部封装：生成带有金属颗粒杂音的刮擦摩擦声
function playScrapeRaw(c, time, duration, freq, gainVal) {
  const nb = mkNoise(c, duration, 'white'), ns = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
  ns.buffer = nb; nf.type = 'bandpass'; nf.frequency.setValueAtTime(freq, time);
  ng.gain.setValueAtTime(gainVal, time); ng.gain.exponentialRampToValueAtTime(0.001, time + duration);
  ns.connect(nf).connect(ng).connect(masterGain); ns.start(time); ns.stop(time + duration);
}

// 播放枪声 (重构：完美集成 M82 与 AT4 火箭筒，加强瞬态打击感与枪管共鸣尾音)
export function playShoot(type, source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 1200, 1.5);
  if (vol <= 0) return;
  
  // 枪声的核心物理参数字典
  const C = {
    pistol:   { nD: 0.10, nF: 2600, nQ: 1.5, tF: 220, tD: 0.03, tV: 0.4, nV: 0.7, lF: 110, lV: 0.4,  ring: false },
    smg:      { nD: 0.08, nF: 3000, nQ: 2.0, tF: 260, tD: 0.02, tV: 0.3, nV: 0.6, lF: 130, lV: 0.3,  ring: false },
    rifle:    { nD: 0.12, nF: 2200, nQ: 1.8, tF: 200, tD: 0.03, tV: 0.65, nV: 0.9, lF: 70,  lV: 0.65, ring: true,  rF: 620,  rD: 0.15 },
    shotgun:  { nD: 0.22, nF: 1000, nQ: 0.8, tF: 100, tD: 0.08, tV: 0.6, nV: 0.9, lF: 55,  lV: 0.6,  ring: true,  rF: 450,  rD: 0.18 },
    sniper:   { nD: 0.25, nF: 1300, nQ: 1.0, tF: 120, tD: 0.08, tV: 0.7, nV: 0.9, lF: 45,  lV: 0.7,  ring: true,  rF: 900,  rD: 0.25 }, // AWP
    m82:      { nD: 0.35, nF: 900,  nQ: 0.7, tF: 80,  tD: 0.12, tV: 0.8, nV: 1.0, lF: 35,  lV: 0.9,  ring: true,  rF: 520,  rD: 0.40 }, // M82反器材加猛
    launcher: { nD: 0.40, nF: 500,  nQ: 0.5, tF: 60,  tD: 0.15, tV: 0.7, nV: 0.9, lF: 40,  lV: 0.8,  ring: true,  rF: 220,  rD: 0.30 }  // AT4火箭筒破空声
  };
  const x = C[type] || C.rifle;

  // 1. 噪声层（粉红/白噪声混合，提供子弹爆燃产生的炸裂感）
  const noiseType = (type === 'm82' || type === 'launcher') ? 'brown' : 'white';
  const nb = mkNoise(c, x.nD, noiseType), ns = createSrc(c, nb);
  const nf = c.createBiquadFilter();
  nf.type = 'bandpass'; nf.frequency.value = x.nF; nf.Q.value = x.nQ;
  const ng = c.createGain();
  ng.gain.setValueAtTime(x.nV * vol, n);
  ng.gain.exponentialRampToValueAtTime(0.001, n + x.nD);
  ns.connect(nf); nf.connect(ng); ng.connect(masterGain);
  ns.start(n); ns.stop(n + x.nD);

  // 2. 低频冲击层（"轰"的一声枪托顶肩与胸腔共鸣声）
  const lo = c.createOscillator(), lg = c.createGain();
  lo.type = 'sine'; lo.frequency.setValueAtTime(x.lF, n);
  lo.frequency.exponentialRampToValueAtTime(20, n + x.nD * 1.6);
  lg.gain.setValueAtTime(x.lV * vol, n);
  lg.gain.exponentialRampToValueAtTime(0.001, n + x.nD * 1.6);
  lo.connect(lg); lg.connect(masterGain);
  lo.start(n); lo.stop(n + x.nD * 1.6);

  // 3. 瞬态音调层（高频方波，负责提供子弹破膛时的坚硬感与穿透力）
  const to = c.createOscillator(), tg = c.createGain();
  to.type = 'square'; to.frequency.setValueAtTime(x.tF, n);
  to.frequency.exponentialRampToValueAtTime(30, n + x.tD);
  tg.gain.setValueAtTime(x.tV * vol, n);
  tg.gain.exponentialRampToValueAtTime(0.001, n + x.tD);
  to.connect(tg); tg.connect(masterGain);
  to.start(n); to.stop(n + x.tD + 0.01);

  // 4. 高频碎裂层（子弹撞击空气的清脆声痕）
  if (type !== 'launcher') {
    const cb = mkNoise(c, 0.025, 'white'), cs = createSrc(c, cb);
    const cf = c.createBiquadFilter(), cg = c.createGain();
    cf.type = 'highpass'; cf.frequency.value = 5500;
    cg.gain.setValueAtTime(x.nV * 0.4 * vol, n); cg.gain.exponentialRampToValueAtTime(0.001, n + 0.025);
    cs.connect(cf); cf.connect(cg); cg.connect(masterGain);
    cs.start(n); cs.stop(n + 0.025);
  }

  // 5. 独家优化：枪管/钢铁机匣余振尾音（解决纯程序合成“断音”生硬感的核心）
  if (x.ring) {
    playRingRaw(c, n + 0.01, x.rF, x.rD, x.tV * 0.4 * vol, 'triangle');
    playRingRaw(c, n + 0.01, x.rF * 1.45, x.rD * 0.7, x.tV * 0.2 * vol, 'sine');
  }
}

// 播放换弹音效 (重构：抛弃无规律的for循环，改为严格的时间轴机械动作序列编排！)
export function playReload(type, source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 700, 1.4);
  if (vol <= 0) return;
  
  // 每种枪械的换弹战术节点时间轴（单位：秒）
  // t1: 卸下弹匣, t2: 摸索新弹匣摩擦, t3: 插入新弹匣主撞击, t4: 拉机柄/枪栓复位上膛
  const Timeline = {
    pistol:   { t1: 0.05, t2: 0.18, t3: 0.32, t4: 0.50 },
    smg:      { t1: 0.06, t2: 0.22, t3: 0.42, t4: 0.60 },
    rifle:    { t1: 0.08, t2: 0.28, t3: 0.52, t4: 0.78 },
    shotgun:  { t1: 0.10, t2: 0.30, t3: 0.55, t4: 0.80 }, // 霰弹枪逐发装填
    sniper:   { t1: 0.10, t2: 0.32, t3: 0.60, t4: 0.90 }, // AWP 缓慢而沉重
    m82:      { t1: 0.12, t2: 0.38, t3: 0.72, t4: 1.10 }, // M82 特大号钢铁机匣
    launcher: { t1: 0.15, t2: 0.45, t3: 0.85, t4: 1.25 }  // AT4 塞入火箭弹并合上机匣
  };
  
  const t = Timeline[type] || Timeline.rifle;

  // ===== 步骤 1：卡榫释放，旧弹匣脱离离体 =====
  playClickRaw(c, n, 2600, 0.012, 0.4 * vol);
  playScrapeRaw(c, n + t.t1, 0.05, 1800, 0.35 * vol); // 脱离摩擦
  
  // ===== 步骤 2：掏出新弹匣，战术背心装备布料擦碰 =====
  playScrapeRaw(c, n + t.t2, 0.10, 900, 0.15 * vol);

  // ===== 步骤 3：新弹匣撞入井口（全枪受力，沉闷双重撞击+咬合） =====
  const t_ins = n + t.t3;
  const oscSine = c.createOscillator(), gSine = c.createGain(); // 沉闷撞击主音
  oscSine.type = 'sine'; oscSine.frequency.setValueAtTime(130, t_ins);
  gSine.gain.setValueAtTime(0.8 * vol, t_ins); gSine.gain.exponentialRampToValueAtTime(0.001, t_ins + 0.08);
  oscSine.connect(gSine).connect(masterGain); oscSine.start(t_ins); oscSine.stop(t_ins + 0.08);
  
  // 补一声枪身内部的低频回响空腔
  const oscSine2 = c.createOscillator(), gSine2 = c.createGain();
  oscSine2.type = 'sine'; oscSine2.frequency.setValueAtTime(65, t_ins);
  gSine2.gain.setValueAtTime(0.5 * vol, t_ins); gSine2.gain.exponentialRampToValueAtTime(0.001, t_ins + 0.14);
  oscSine2.connect(gSine2).connect(masterGain); oscSine2.start(t_ins); oscSine2.stop(t_ins + 0.14);

  playClickRaw(c, t_ins, 1400, 0.015, 0.4 * vol); // 咬合脆响
  playScrapeRaw(c, t_ins, 0.04, 2800, 0.35 * vol); // 撞击瞬间金属小碎渣音

  // ===== 步骤 4：枪栓暴虐拉动并推弹复位（拉栓-闭锁双声） =====
  const t_bolt = n + t.t4;
  playScrapeRaw(c, t_bolt, 0.10, 2200, 0.45 * vol); // 枪栓后退并回弹的急促摩擦声
  
  // 枪栓闭锁一瞬间的钢铁颤音（解决“差点意思”的终极法宝：非整数倍双三角波共振）
  const t_lock = t_bolt + 0.08;
  const oscSine3 = c.createOscillator(), gSine3 = c.createGain();
  oscSine3.type = 'sine'; oscSine3.frequency.setValueAtTime(150, t_lock);
  gSine3.gain.setValueAtTime(0.8 * vol, t_lock); gSine3.gain.exponentialRampToValueAtTime(0.001, t_lock + 0.05);
  oscSine3.connect(gSine3).connect(masterGain); oscSine3.start(t_lock); oscSine3.stop(t_lock + 0.05);

  playRingRaw(c, t_lock, 680, 0.25, 0.35 * vol, 'triangle'); // 机匣低频回响
  playRingRaw(c, t_lock, 1120, 0.18, 0.20 * vol, 'triangle'); // 弹簧高频余震
  playClickRaw(c, t_lock + 0.005, 3500, 0.008, 0.45 * vol);  // 卡榫死死闭锁
}

// 播放近战音效 (保持你优雅的扫频，略微微调包络让划空感更顺畅)
export function playMelee(source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 500, 1.5);
  if (vol <= 0) return;
  const nb = mkNoise(c, .15, 'pink'), ns = createSrc(c, nb);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(800, n);
  f.frequency.exponentialRampToValueAtTime(4200, n + .07);
  f.frequency.exponentialRampToValueAtTime(500, n + .15);
  f.Q.value = 2.5;
  const g = c.createGain();
  g.gain.setValueAtTime(.001, n);
  g.gain.linearRampToValueAtTime(.6 * vol, n + .04);
  g.gain.exponentialRampToValueAtTime(.001, n + .15);
  ns.connect(f); f.connect(g); g.connect(masterGain);
  ns.start(n); ns.stop(n + .15);

  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(2800, n + .05);
  o.frequency.exponentialRampToValueAtTime(1200, n + .12);
  const og = c.createGain();
  og.gain.setValueAtTime(.001, n);
  og.gain.linearRampToValueAtTime(.25 * vol, n + .06);
  og.gain.exponentialRampToValueAtTime(.001, n + .12);
  o.connect(og); og.connect(masterGain);
  o.start(n); o.stop(n + .13);
}

// 播放爆炸音效 (保持原本出色的爆破分层)
export function playExplosion(source = 0, isReaper = false) {
  const c = getCtx(), n = c.currentTime;
  const maxDist = isReaper ? 3000 : 1500;
  const vol = getDistanceVolume(source, maxDist, 1.2);
  if (vol <= 0) return;
  
  // 基础音量增强
  const baseVol = isReaper ? 2.0 : 1.5;
  
  // Layer 1: 棕色噪声（低频爆炸主体）
  const nb = mkNoise(c, isReaper ? 1.5 : 1.0, 'brown'), ns = createSrc(c, nb);
  const lf = c.createBiquadFilter();
  lf.type = 'lowpass';
  lf.frequency.setValueAtTime(isReaper ? 600 : 450, n);
  lf.frequency.exponentialRampToValueAtTime(40, n + (isReaper ? 1.5 : 1.0));
  const lg = c.createGain();
  lg.gain.setValueAtTime(baseVol * vol, n);
  lg.gain.exponentialRampToValueAtTime(.001, n + (isReaper ? 1.5 : 1.0));
  ns.connect(lf); lf.connect(lg); lg.connect(masterGain);
  ns.start(n); ns.stop(n + (isReaper ? 1.5 : 1.0));

  // Layer 2: 正弦波（低频震荡，增强冲击感）
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(isReaper ? 50 : 65, n);
  o.frequency.exponentialRampToValueAtTime(10, n + (isReaper ? 1.2 : 0.8));
  const og = c.createGain();
  og.gain.setValueAtTime((isReaper ? 1.5 : 1.2) * vol, n);
  og.gain.exponentialRampToValueAtTime(.001, n + (isReaper ? 1.2 : 0.8));
  o.connect(og); og.connect(masterGain);
  o.start(n); o.stop(n + (isReaper ? 1.2 : 0.8));

  // Layer 3: 白色噪声（高频碎片声）
  const db = mkNoise(c, isReaper ? 0.6 : 0.4, 'white'), ds = c.createBufferSource();
  ds.buffer = db;
  const hf = c.createBiquadFilter();
  hf.type = 'highpass'; hf.frequency.value = isReaper ? 2000 : 2800;
  const dg = c.createGain();
  dg.gain.setValueAtTime((isReaper ? 0.7 : 0.5) * vol, n);
  dg.gain.exponentialRampToValueAtTime(.001, n + (isReaper ? 0.6 : 0.4));
  ds.connect(hf); hf.connect(dg); dg.connect(masterGain);
  ds.start(n); ds.stop(n + (isReaper ? 0.6 : 0.4));
  
  // Layer 4: 次声波震荡（死神支援专属，增强震撼感）
  if (isReaper) {
    const sub = c.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(25, n);
    sub.frequency.exponentialRampToValueAtTime(8, n + 2.0);
    const subG = c.createGain();
    subG.gain.setValueAtTime(1.0 * vol, n);
    subG.gain.exponentialRampToValueAtTime(.001, n + 2.0);
    sub.connect(subG); subG.connect(masterGain);
    sub.start(n); sub.stop(n + 2.0);
  }
}

// 播放空仓咔嗒声
export function playEmpty(source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 500, 1.5);
  if (vol <= 0) return;
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(1400, n);
  o.frequency.exponentialRampToValueAtTime(450, n + .035);
  const og = c.createGain();
  og.gain.setValueAtTime(.25 * vol, n);
  og.gain.exponentialRampToValueAtTime(.001, n + .035);
  o.connect(og); og.connect(masterGain);
  o.start(n); o.stop(n + .04);

  const nb = mkNoise(c, .015, 'white'), ns = c.createBufferSource();
  ns.buffer = nb;
  const f = c.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 4500;
  const g = c.createGain();
  g.gain.setValueAtTime(.15 * vol, n);
  g.gain.exponentialRampToValueAtTime(.001, n + .015);
  ns.connect(f); f.connect(g); g.connect(masterGain);
  ns.start(n); ns.stop(n + .015);
}

// 播放受伤音效
export function playHurt(source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 1000, 1.5);
  if (vol <= 0) return;

  const impOsc = c.createOscillator();
  impOsc.type = 'sawtooth'; impOsc.frequency.setValueAtTime(750, n);
  impOsc.frequency.exponentialRampToValueAtTime(90, n + 0.09);
  const impGain = c.createGain();
  impGain.gain.setValueAtTime(0.45 * vol, n);
  impGain.gain.exponentialRampToValueAtTime(0.001, n + 0.09);
  impOsc.connect(impGain); impGain.connect(masterGain);
  impOsc.start(n); impOsc.stop(n + 0.09);

  const nb = mkNoise(c, 0.14, 'brown'), ns = c.createBufferSource();
  ns.buffer = nb;
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(550, n);
  f.frequency.exponentialRampToValueAtTime(90, n + 0.14);
  const g = c.createGain();
  g.gain.setValueAtTime(0.55 * vol, n);
  g.gain.exponentialRampToValueAtTime(0.001, n + 0.14);
  ns.connect(f); f.connect(g); g.connect(masterGain);
  ns.start(n); ns.stop(n + 0.14);
}

// 播放死亡音效
export function playDie(source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 1000, 1.5);
  if (vol <= 0) return;

  const o = c.createOscillator();
  o.type = 'triangle'; o.frequency.setValueAtTime(280, n);
  o.frequency.exponentialRampToValueAtTime(45, n + 0.9);
  const og = c.createGain();
  og.gain.setValueAtTime(0.35 * vol, n);
  og.gain.exponentialRampToValueAtTime(0.001, n + 0.9);
  o.connect(og); og.connect(masterGain);
  o.start(n); o.stop(n + 0.9);

  const nb = mkNoise(c, 0.45, 'brown'), ns = c.createBufferSource();
  ns.buffer = nb;
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(180, n);
  const g = c.createGain();
  g.gain.setValueAtTime(0.45 * vol, n);
  g.gain.exponentialRampToValueAtTime(0.001, n + 0.45);
  ns.connect(f); f.connect(g); g.connect(masterGain);
  ns.start(n); ns.stop(n + 0.45);
}

// 播放拾取音效
export function playPickup(source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 450, 1.5);
  if (vol <= 0) return;
  const o = c.createOscillator();
  o.type = 'sine'; o.frequency.setValueAtTime(1100, n);
  o.frequency.exponentialRampToValueAtTime(1700, n + .09);
  const og = c.createGain();
  og.gain.setValueAtTime(.25 * vol, n);
  og.gain.exponentialRampToValueAtTime(.001, n + .09);
  o.connect(og); og.connect(masterGain);
  o.start(n); o.stop(n + .09);

  const nb = mkNoise(c, 0.12, 'white'), ns = c.createBufferSource();
  ns.buffer = nb;
  const f = c.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 2200;
  const g = c.createGain();
  g.gain.setValueAtTime(.15 * vol, n);
  g.gain.exponentialRampToValueAtTime(.001, n + .12);
  ns.connect(f); f.connect(g); g.connect(masterGain);
  ns.start(n); ns.stop(n + .12);
}

// 播放切换武器音效
export function playWeaponSwitch(type = 'pistol', source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 450, 1.5);
  if (vol <= 0) return;
  const C = {
    melee: { f1: 900, f2: 1700, v: .12 },
    grenade: { f1: 650, f2: 1200, v: .13 },
    medical: { f1: 780, f2: 1050, v: .10 },
    launcher: { f1: 260, f2: 620, v: .18 },
    shotgun: { f1: 420, f2: 900, v: .16 },
    sniper: { f1: 360, f2: 820, v: .15 },
    rifle: { f1: 520, f2: 1300, v: .14 },
    smg: { f1: 760, f2: 1500, v: .12 },
    pistol: { f1: 950, f2: 1800, v: .11 }
  };
  const x = C[type] || C.pistol;

  const nb = mkNoise(c, .06, 'white'), ns = createSrc(c, nb);
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.setValueAtTime(x.f1, n); f.Q.value = 2.2;
  const g = c.createGain();
  g.gain.setValueAtTime(x.v * vol, n);
  g.gain.exponentialRampToValueAtTime(.001, n + .06);
  ns.connect(f); f.connect(g); g.connect(masterGain);
  ns.start(n); ns.stop(n + .06);

  playClickRaw(c, n + .035, x.f2, .018, x.v * 1.3 * vol);
}

// 播放投掷音效
export function playThrow(source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 500, 1.5);
  if (vol <= 0) return;
  const nb = mkNoise(c, .16, 'pink'), ns = createSrc(c, nb);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(450, n);
  f.frequency.exponentialRampToValueAtTime(1700, n + .08);
  const g = c.createGain();
  g.gain.setValueAtTime(.001, n);
  g.gain.linearRampToValueAtTime(.22 * vol, n + .035);
  g.gain.exponentialRampToValueAtTime(.001, n + .16);
  ns.connect(f); f.connect(g); g.connect(masterGain);
  ns.start(n); ns.stop(n + .16);
}

// 播放UI音效
export function playUISound(type = 'click') {
  const c = getCtx(), n = c.currentTime;
  const C = {
    click: { f: 750, d: .04, v: .08 },
    hover: { f: 550, d: .025, v: .04 },
    error: { f: 280, d: .09, v: .18 }
  };
  const x = C[type] || C.click;
  const o = c.createOscillator();
  o.type = 'square'; o.frequency.setValueAtTime(x.f, n);
  o.frequency.exponentialRampToValueAtTime(x.f * 0.5, n + x.d);
  const og = c.createGain();
  og.gain.setValueAtTime(x.v, n);
  og.gain.exponentialRampToValueAtTime(.001, n + x.d);
  o.connect(og); og.connect(masterGain);
  o.start(n); o.stop(n + x.d);
}

// 播放弹壳落地弹跳音效
export function playShellEject(type = 'pistol', source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 800, 1.5);
  if (vol <= 0) return;

  // 根据武器类型调整基频：大弹壳低频，小弹壳高频
  const freqMap = { shotgun: 700, sniper: 800, rifle: 1200, launcher: 900, smg: 1600, pistol: 1800 };
  const baseFreq = freqMap[type] || 1800;
  const bounces = 4;
  const bounceDelays = [0.0, 0.12, 0.22, 0.30, 0.36];

  for (let i = 0; i < bounces; i++) {
    const t = n + bounceDelays[i];
    const vm = Math.pow(0.55, i) * vol;
    const rp = baseFreq * (1 + (Math.random() * 0.15 - 0.075)) * (1 - i * 0.05);

    // 1. 弹壳撞击地面主体音
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(rp, t);
    gain.gain.setValueAtTime(0.25 * vm, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035 * vm);
    osc.connect(gain).connect(masterGain);
    osc.start(t); osc.stop(t + 0.04);

    // 2. 空心管道金属泛音
    const oscH = c.createOscillator(), gainH = c.createGain();
    oscH.type = 'sine'; oscH.frequency.setValueAtTime(rp * 1.43, t);
    gainH.gain.setValueAtTime(0.12 * vm, t);
    gainH.gain.exponentialRampToValueAtTime(0.001, t + 0.02 * vm);
    oscH.connect(gainH).connect(masterGain);
    oscH.start(t); oscH.stop(t + 0.03);

    // 3. 擦地碎音（前两下）
    if (i < 2) {
      const nb = mkNoise(c, 0.015, 'white'), ns = c.createBufferSource();
      ns.buffer = nb;
      const flt = c.createBiquadFilter();
      flt.type = 'highpass'; flt.frequency.setValueAtTime(5000, t);
      const gn = c.createGain();
      gn.gain.setValueAtTime(0.08 * vm, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
      ns.connect(flt).connect(gn).connect(masterGain);
      ns.start(t); ns.stop(t + 0.015);
    }
  }
}

// 命中音效 - 子弹击中肉体的声音
export function playBulletHit(source) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source);
  if (vol <= 0) return;

  // 第一层 - 低频噪声模拟肉体冲击
  const dur = 0.08;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.4;
    data[i] += Math.sin(2 * Math.PI * 80 * (i / c.sampleRate)) * Math.exp(-t * 20) * 0.3;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  const gain = c.createGain();
  gain.gain.value = 0.35 * vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(n);

  // 第二层 - 高频"啪"声
  const dur2 = 0.04;
  const buf2 = c.createBuffer(1, c.sampleRate * dur2, c.sampleRate);
  const data2 = buf2.getChannelData(0);
  for (let i = 0; i < data2.length; i++) {
    const t = i / data2.length;
    data2[i] = (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.2;
  }
  const src2 = c.createBufferSource();
  src2.buffer = buf2;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2000;
  const gain2 = c.createGain();
  gain2.gain.value = 0.2 * vol;
  src2.connect(hp);
  hp.connect(gain2);
  gain2.connect(masterGain);
  src2.start(n);
}

// 播放弹壳单次落地撞击音效（每次弹跳触发一次）
export function playShellLand(type = 'pistol', bounceIndex = 0, source = 0) {
  const c = getCtx(), n = c.currentTime;
  const vol = getDistanceVolume(source, 800, 1.5);
  if (vol <= 0) return;

  const freqMap = { shotgun: 700, sniper: 800, rifle: 1200, launcher: 900, smg: 1600, pistol: 1800 };
  const baseFreq = freqMap[type] || 1800;

  // 弹跳次数越多音量越小、音调越低
  const decay = Math.pow(0.5, bounceIndex);
  const freqShift = 1 - bounceIndex * 0.08;
  const rp = baseFreq * freqShift * (1 + (Math.random() * 0.12 - 0.06));
  const vm = decay * vol;

  // 1. 主体金属撞击音（三角波短促衰减）— 音量降低
  const osc = c.createOscillator(), gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(rp, n);
  osc.frequency.exponentialRampToValueAtTime(rp * 0.6, n + 0.04);
  gain.gain.setValueAtTime(0.08 * vm, n);
  gain.gain.exponentialRampToValueAtTime(0.001, n + 0.04);
  osc.connect(gain).connect(masterGain);
  osc.start(n); osc.stop(n + 0.05);

  // 2. 高频泛音（空心黄铜管共鸣）— 音量降低
  const oscH = c.createOscillator(), gainH = c.createGain();
  oscH.type = 'sine';
  oscH.frequency.setValueAtTime(rp * 1.47, n);
  gainH.gain.setValueAtTime(0.04 * vm, n);
  gainH.gain.exponentialRampToValueAtTime(0.001, n + 0.025);
  oscH.connect(gainH).connect(masterGain);
  oscH.start(n); oscH.stop(n + 0.03);

  // 3. 擦地噪声（仅前两次弹跳）— 音量降低
  if (bounceIndex < 2) {
    const nb = mkNoise(c, 0.018, 'white'), ns = createSrc(c, nb);
    const flt = c.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 4800;
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.025 * vm, n);
    gn.gain.exponentialRampToValueAtTime(0.001, n + 0.018);
    ns.connect(flt).connect(gn).connect(masterGain);
    ns.start(n); ns.stop(n + 0.02);
  }
}

// 电台打开音效 — PTT beep + 电流噪声 + 信号爆裂
export function playRadioOpen() {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    // PTT 按下 beep
    const osc1 = c.createOscillator(), g1 = c.createGain();
    osc1.type = 'square'; osc1.frequency.value = 2100;
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(0.18, t + 0.005);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc1.connect(g1).connect(masterGain);
    osc1.start(t); osc1.stop(t + 0.08);
    // 电流噪声
    const sr = c.sampleRate, dur = 0.45, len = sr * dur;
    const buf = c.createBuffer(1, len, sr), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * 0.25;
    const ns = c.createBufferSource(); ns.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.5;
    const ng = c.createGain(); ng.gain.value = 0.6;
    ns.connect(bp).connect(ng).connect(masterGain);
    ns.start(t + 0.08);
    // 信号爆裂
    for (let i = 0; i < 10; i++) {
        const osc = c.createOscillator(), g = c.createGain();
        osc.type = 'square'; osc.frequency.value = 800 + Math.random() * 2500;
        const st = t + 0.12 + i * 0.008;
        g.gain.setValueAtTime(0.08, st);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.005);
        osc.connect(g).connect(masterGain);
        osc.start(st); osc.stop(st + 0.005);
    }
    // 中间停顿噪声
    const buf2 = c.createBuffer(1, sr * 0.12, sr), ch2 = buf2.getChannelData(0);
    for (let i = 0; i < ch2.length; i++) ch2[i] = (Math.random() * 2 - 1) * 0.25;
    const ns2 = c.createBufferSource(); ns2.buffer = buf2;
    const bp2 = c.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 2600; bp2.Q.value = 1.5;
    const ng2 = c.createGain(); ng2.gain.value = 0.6;
    ns2.connect(bp2).connect(ng2).connect(masterGain);
    ns2.start(t + 0.65);
}

// 电台关闭音效 — 短促低沉 beep
export function playRadioClose() {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = 'square'; osc.frequency.value = 1400;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g).connect(masterGain);
    osc.start(t); osc.stop(t + 0.12);
}

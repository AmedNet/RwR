// src/core/WeatherDefs.js
// 纯数据：18 种天气定义 + 辅助函数

export const WEATHER_DEFS = {
  sunny: {
    name: '晴天', icon: '☀️', weight: 20,
    transitions: [{ type: 'cloudy', weight: 1 }],
    speedMult: 1.0, accuracyMult: 1.0, awarenessMult: 1.0,
    wind: null,
    overlayColor: '0,0,0', overlayAlpha: 0,
    particleType: null, particleDensity: 0,
    cloudShadows: false, cloudDensity: 0, cloudAlpha: 0.0,
    fogRadius: 0, lightning: false
  },
  cloudy: {
    name: '多云', icon: '⛅', weight: 15,
    transitions: [
      { type: 'sunny', weight: 3 },
      { type: 'overcast', weight: 2 },
      { type: 'lightRain', weight: 2 }
    ],
    speedMult: 1.0, accuracyMult: 1.0, awarenessMult: 1.0,
    wind: null,
    overlayColor: '0,0,0', overlayAlpha: 0.05,
    particleType: null, particleDensity: 0,
    cloudShadows: true, cloudDensity: 4, cloudAlpha: 0.12,
    fogRadius: 0, lightning: false
  },
  overcast: {
    name: '阴天', icon: '☁️', weight: 10,
    transitions: [
      { type: 'cloudy', weight: 3 },
      { type: 'rain', weight: 3 },
      { type: 'fog', weight: 2 },
      { type: 'thunderstorm', weight: 1 }
    ],
    speedMult: 1.0, accuracyMult: 1.0, awarenessMult: 0.95,
    wind: null,
    overlayColor: '0,0,30', overlayAlpha: 0.13,
    particleType: null, particleDensity: 0,
    cloudShadows: true, cloudDensity: 6, cloudAlpha: 0.18,
    fogRadius: 0, lightning: false
  },
  lightRain: {
    name: '小雨', icon: '🌦️', weight: 8,
    transitions: [
      { type: 'cloudy', weight: 2 },
      { type: 'rain', weight: 3 },
      { type: 'mistyRain', weight: 1 }
    ],
    speedMult: 0.95, accuracyMult: 1.05, awarenessMult: 0.9,
    wind: null,
    overlayColor: '0,0,40', overlayAlpha: 0.1,
    particleType: 'rain', particleDensity: 5,
    cloudShadows: true, cloudDensity: 5, cloudAlpha: 0.14,
    fogRadius: 0, lightning: false
  },
  rain: {
    name: '中雨', icon: '🌧️', weight: 6,
    transitions: [
      { type: 'lightRain', weight: 2 },
      { type: 'heavyRain', weight: 2 },
      { type: 'overcast', weight: 2 },
      { type: 'mistyRain', weight: 1 }
    ],
    speedMult: 0.9, accuracyMult: 1.1, awarenessMult: 0.85,
    wind: null,
    overlayColor: '0,0,40', overlayAlpha: 0.16,
    particleType: 'rain', particleDensity: 10,
    cloudShadows: true, cloudDensity: 7, cloudAlpha: 0.2,
    fogRadius: 0, lightning: false
  },
  heavyRain: {
    name: '大雨', icon: '🌧️', weight: 3,
    transitions: [
      { type: 'rain', weight: 3 },
      { type: 'thunderstorm', weight: 2 },
      { type: 'overcast', weight: 1 }
    ],
    speedMult: 0.8, accuracyMult: 1.2, awarenessMult: 0.75,
    wind: null,
    overlayColor: '0,0,40', overlayAlpha: 0.24,
    particleType: 'rain', particleDensity: 20,
    cloudShadows: true, cloudDensity: 8, cloudAlpha: 0.24,
    fogRadius: 0, lightning: false
  },
  fog: {
    name: '雾天', icon: '🌫️', weight: 5,
    transitions: [
      { type: 'overcast', weight: 3 },
      { type: 'mistyRain', weight: 2 },
      { type: 'cloudy', weight: 2 }
    ],
    speedMult: 1.0, accuracyMult: 1.0, awarenessMult: 0.5,
    wind: null,
    overlayColor: '180,180,180', overlayAlpha: 0.08,
    particleType: null, particleDensity: 0,
    cloudShadows: false, cloudDensity: 0, cloudAlpha: 0.0,
    fogRadius: 525, lightning: false
  },
  mistyRain: {
    name: '雾雨', icon: '🌫️', weight: 3,
    transitions: [
      { type: 'fog', weight: 2 },
      { type: 'rain', weight: 2 },
      { type: 'cloudy', weight: 1 }
    ],
    speedMult: 0.9, accuracyMult: 1.1, awarenessMult: 0.6,
    wind: null,
    overlayColor: '100,100,120', overlayAlpha: 0.13,
    particleType: 'rain', particleDensity: 3,
    cloudShadows: false, cloudDensity: 0, cloudAlpha: 0.0,
    fogRadius: 420, lightning: false
  },
  snow: {
    name: '小雪', icon: '❄️', weight: 4,
    transitions: [
      { type: 'cloudy', weight: 3 },
      { type: 'blizzard', weight: 1 },
      { type: 'overcast', weight: 2 }
    ],
    speedMult: 0.9, accuracyMult: 1.0, awarenessMult: 0.9,
    wind: null,
    overlayColor: '200,200,220', overlayAlpha: 0.06,
    particleType: 'snow', particleDensity: 10,
    cloudShadows: true, cloudDensity: 5, cloudAlpha: 0.12,
    fogRadius: 0, lightning: false
  },
  blizzard: {
    name: '暴风雪', icon: '🌨️', weight: 2,
    transitions: [
      { type: 'snow', weight: 2 },
      { type: 'windStorm', weight: 1 }
    ],
    speedMult: 0.7, accuracyMult: 1.3, awarenessMult: 0.5,
    wind: { angle: null, strength: 0.4 },
    overlayColor: '200,200,230', overlayAlpha: 0.19,
    particleType: 'snow', particleDensity: 25,
    cloudShadows: true, cloudDensity: 8, cloudAlpha: 0.2,
    fogRadius: 300, lightning: false
  },
   windStorm: {
       name: '暴风', icon: '💨', weight: 3,
       transitions: [
           { type: 'sandstorm', weight: 2 },
           { type: 'blizzard', weight: 1 },
           { type: 'cloudy', weight: 2 }
       ],
       speedMult: 0.85, accuracyMult: 1.15, awarenessMult: 0.85,
       wind: { angle: null, strength: 0.7 },
    overlayColor: '100,100,80', overlayAlpha: 0.1,
    particleType: 'wind', particleDensity: 22,
    cloudShadows: true, cloudDensity: 6, cloudAlpha: 0.16,
    fogRadius: 0, lightning: false
  },
   sandstorm: {
       name: '沙尘暴', icon: '🏜️', weight: 2,
       transitions: [
           { type: 'windStorm', weight: 3 },
           { type: 'cloudy', weight: 1 }
       ],
       speedMult: 0.75, accuracyMult: 1.25, awarenessMult: 0.55,
       wind: { angle: null, strength: 0.8 },
    overlayColor: '160,130,60', overlayAlpha: 0.29,
    particleType: 'sand', particleDensity: 31,
    cloudShadows: false, cloudDensity: 0, cloudAlpha: 0.0,
    fogRadius: 270, lightning: false
  },
  thunderstorm: {
    name: '暴风雨', icon: '⛈️', weight: 3,
    transitions: [
      { type: 'heavyRain', weight: 3 },
      { type: 'rain', weight: 2 },
      { type: 'overcast', weight: 1 }
    ],
    speedMult: 0.8, accuracyMult: 1.2, awarenessMult: 0.75,
    wind: null,
    overlayColor: '0,0,30', overlayAlpha: 0.29,
    particleType: 'rain', particleDensity: 24,
    cloudShadows: true, cloudDensity: 9, cloudAlpha: 0.28,
    fogRadius: 0, lightning: true
  },
  hail: {
    name: '冰雹', icon: '🧊', weight: 2,
    transitions: [
      { type: 'thunderstorm', weight: 2 },
      { type: 'rain', weight: 2 }
    ],
    speedMult: 0.85, accuracyMult: 1.15, awarenessMult: 0.8,
    wind: null,
    overlayColor: '0,0,40', overlayAlpha: 0.16,
    particleType: 'hail', particleDensity: 6,
    cloudShadows: true, cloudDensity: 7, cloudAlpha: 0.2,
    fogRadius: 0, lightning: false
  },
  acidRain: {
    name: '酸雨', icon: '☣️', weight: 1,
    transitions: [
      { type: 'rain', weight: 2 },
      { type: 'overcast', weight: 1 }
    ],
    speedMult: 0.9, accuracyMult: 1.1, awarenessMult: 0.85,
    wind: null,
    overlayColor: '0,80,0', overlayAlpha: 0.13,
    particleType: 'acid', particleDensity: 10,
    cloudShadows: true, cloudDensity: 5, cloudAlpha: 0.14,
    fogRadius: 0, lightning: false
  },
  bloodMoon: {
    name: '血月', icon: '🌑', weight: 0.5,
    transitions: [
      { type: 'eclipse', weight: 1 },
      { type: 'sunny', weight: 2 }
    ],
    speedMult: 1.0, accuracyMult: 0.95, awarenessMult: 1.1,
    wind: null,
    overlayColor: '120,0,0', overlayAlpha: 0.19,
    particleType: null, particleDensity: 0,
    cloudShadows: false, cloudDensity: 0, cloudAlpha: 0.0,
    fogRadius: 0, lightning: false
  },
  eclipse: {
    name: '日食', icon: '🌒', weight: 0.5,
    transitions: [
      { type: 'bloodMoon', weight: 1 },
      { type: 'cloudy', weight: 2 }
    ],
    speedMult: 1.0, accuracyMult: 1.0, awarenessMult: 0.6,
    wind: null,
    overlayColor: '0,0,0', overlayAlpha: 0.4,
    particleType: null, particleDensity: 0,
    cloudShadows: false, cloudDensity: 0, cloudAlpha: 0.0,
    fogRadius: 0, lightning: false
  },
  tornado: {
    name: '龙卷风', icon: '🌪️', weight: 0.3,
    transitions: [
      { type: 'windStorm', weight: 2 },
      { type: 'heavyRain', weight: 1 }
    ],
    speedMult: 0.7, accuracyMult: 1.3, awarenessMult: 0.7,
    wind: { angle: 0, strength: 1.2 },
    overlayColor: '40,40,40', overlayAlpha: 0.16,
    particleType: 'debris', particleDensity: 34,
    cloudShadows: true, cloudDensity: 6, cloudAlpha: 0.2,
    fogRadius: 800, lightning: false
  }
};

// ─── 辅助函数 ───
export function lerp(a, b, t) { return a + (b - a) * t; }

export function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function weightedRandom(items, weightKey) {
  const total = items.reduce((s, i) => s + (i[weightKey] || i.weight || 0), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= (item[weightKey] || item.weight || 0);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

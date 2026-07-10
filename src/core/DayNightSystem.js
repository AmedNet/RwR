// src/core/DayNightSystem.js
// 昼夜循环系统：环境色调变化 + 动态光源管理

// 时间段定义（timeOfDay: 0.0=午夜, 0.25=日出, 0.5=正午, 0.75=日落）
const TIME_PHASES = [
    { start: 0.0,  end: 0.2,  r: 5,   g: 8,   b: 25,  alpha: 0.65 }, // 深夜（更暗）
    { start: 0.2,  end: 0.3,  r: 80,  g: 40,  b: 15,  alpha: 0.28 }, // 黎明（更暖更明显）
    { start: 0.3,  end: 0.7,  r: 0,   g: 0,   b: 0,   alpha: 0.0  }, // 白天（无叠加）
    { start: 0.7,  end: 0.8,  r: 70,  g: 25,  b: 10,  alpha: 0.32 }, // 黄昏（更暖更明显）
    { start: 0.8,  end: 1.0,  r: 5,   g: 8,   b: 25,  alpha: 0.65 }  // 夜晚（更暗）
];

// 一个完整昼夜周期的帧数（60fps × 1200秒 = 72000帧 = 20分钟）
const CYCLE_DURATION = 72000;

// 光源最大数量
const MAX_LIGHT_SOURCES = 32;

export const DayNightSystem = {
    timeOfDay: 0.5, // 0.0-1.0，默认从正午开始
    paused: false,
    lightSources: [],

    init() {
        this.timeOfDay = 0.5;
        this.paused = false;
        this.lightSources = [];
        console.log('🌅 昼夜循环系统初始化完成');
    },

    update() {
        if (!this.paused) {
            this.timeOfDay += 1 / CYCLE_DURATION;
            if (this.timeOfDay >= 1.0) {
                this.timeOfDay -= 1.0;
            }
        }

        // 更新光源
        for (let i = this.lightSources.length - 1; i >= 0; i--) {
            const light = this.lightSources[i];
            light.life--;
            if (light.life <= 0) {
                this.lightSources.splice(i, 1);
            }
        }
    },

    // 添加动态光源
    addLight(x, y, radius, color, duration) {
        // 仅在暗度 > 0.05 时添加
        if (this.getAmbientDarkness() < 0.05) return;

        // 限制光源数量
        if (this.lightSources.length >= MAX_LIGHT_SOURCES) {
            this.lightSources.shift();
        }

        this.lightSources.push({
            x, y,
            radius,
            color, // 格式: "255,200,80"
            life: duration,
            maxLife: duration
        });
    },

    // 获取当前环境暗度（0-1）
    getAmbientDarkness() {
        const tint = this.getTint();
        return tint.a;
    },

    // 获取当前色调
    getTint() {
        const t = this.timeOfDay;

        // 找到当前时间段
        for (const phase of TIME_PHASES) {
            if (t >= phase.start && t < phase.end) {
                // 计算在该时间段内的进度
                const progress = (t - phase.start) / (phase.end - phase.start);

                // 查找相邻时间段进行插值
                const currentIndex = TIME_PHASES.indexOf(phase);
                const nextIndex = (currentIndex + 1) % TIME_PHASES.length;
                const nextPhase = TIME_PHASES[nextIndex];

                // 平滑插值（使用 smoothstep）
                const smoothT = progress * progress * (3 - 2 * progress);

                return {
                    r: Math.round(phase.r + (nextPhase.r - phase.r) * smoothT),
                    g: Math.round(phase.g + (nextPhase.g - phase.g) * smoothT),
                    b: Math.round(phase.b + (nextPhase.b - phase.b) * smoothT),
                    a: phase.alpha + (nextPhase.alpha - phase.alpha) * smoothT
                };
            }
        }

        return { r: 0, g: 0, b: 0, a: 0 };
    },

    // 设置时间（用于 Debug 滑块）
    setTime(time) {
        this.timeOfDay = Math.max(0, Math.min(1, time));
    },

    // 获取格式化时间字符串（如 "18:30"）
    getTimeString() {
        const hours = Math.floor(this.timeOfDay * 24);
        const minutes = Math.floor((this.timeOfDay * 24 - hours) * 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    },

    // 切换暂停状态
    togglePause() {
        this.paused = !this.paused;
    }
};

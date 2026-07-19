// src/core/EventBus.js
const events = {};

export const EventBus = {
    on(event, callback) {
        if (!events[event]) events[event] = [];
        events[event].push(callback);
    },
    off(event, callback) {
        if (events[event]) {
            events[event] = events[event].filter(cb => cb !== callback);
        }
    },
    emit(event, data) {
        if (events[event]) {
            events[event].forEach(cb => cb(data));
        }
    },
    // 一次性监听：触发一次后自动注销。剧情触发器依赖此接口挂"到达某坐标后触发对话"等一次性事件
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        this.on(event, wrapper);
    }
};
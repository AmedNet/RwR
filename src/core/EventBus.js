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
    }
};
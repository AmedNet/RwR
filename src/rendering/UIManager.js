// src/rendering/UIManager.js
export const UIManager = {
    rankEl: document.getElementById('rankDisplay'),
    killEl: document.getElementById('killDisplay'),
    healthEl: document.getElementById('healthDisplay'),

    updateAll(state) {
        if (!state.player) return;
        this.rankEl.textContent = state.player.getRankName();
        this.killEl.textContent = state.kills;
        this.healthEl.textContent = Math.max(0, Math.floor(state.player.health));
    }
};
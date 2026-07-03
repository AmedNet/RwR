// src/rendering/UIManager.js
export const UIManager = {
    killEl: document.getElementById('killDisplay'),
    rpEl: document.getElementById('rpDisplay'),

    updateAll(state) {
        if (!state.player) return;
        this.killEl.textContent = state.kills;
        this.rpEl.textContent = state.rp;
    }
};

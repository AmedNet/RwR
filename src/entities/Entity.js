// src/entities/Entity.js
export class Entity {
    constructor(x, y, config) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.radius = config.radius || 15;
        this.health = config.health || 100;
        this.maxHealth = this.health;
        this.speed = config.speed || 2;
        this.alive = true;
        this.statusEffects = [];
    }

    savePrevPosition() {
        this.prevX = this.x;
        this.prevY = this.y;
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
        return this.alive;
    }

    addStatusEffect(effect) {
        const existing = this.statusEffects.find(e => e.name === effect.name);
        if (existing) {
            existing.remaining = Math.max(existing.remaining, effect.duration);
        } else {
            this.statusEffects.push(effect);
        }
    }

    hasStatusEffect(name) {
        return this.statusEffects.some(e => e.name === name);
    }

    getStatusEffect(name) {
        return this.statusEffects.find(e => e.name === name);
    }

    updateStatusEffects() {
        for (let i = this.statusEffects.length - 1; i >= 0; i--) {
            this.statusEffects[i].update(this);
            if (this.statusEffects[i].isExpired()) {
                this.statusEffects.splice(i, 1);
            }
        }
    }

    getSpeedMultiplier() {
        let multiplier = 1;
        for (const effect of this.statusEffects) {
            multiplier *= effect.getSpeedMultiplier();
        }
        return multiplier;
    }

    drawStatusEffects(ctx) {
        for (const effect of this.statusEffects) {
            effect.draw(ctx, this);
        }
    }

    // 子类重写
    update() {}
    draw(ctx) {}
}

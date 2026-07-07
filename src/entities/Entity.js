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

    // 子类重写
    update() {}
    draw(ctx) {}
}
// src/entities/LootPickup.js
// 地面掉落的战利品实体
import { LootRegistry, RARITY_COLORS } from '../core/LootRegistry.js';

export class LootPickup {
    constructor(x, y, lootId) {
        this.x = x;
        this.y = y;
        this.lootId = lootId;        // LootRegistry 中的 key
        this.config = LootRegistry[lootId];
        this.lifetime = 1200 + Math.random() * 1200; // 帧数：20-40秒（60fps）
        this.pickupRadius = 35;      // 拾取范围
        this.bobTimer = Math.random() * Math.PI * 2; // 浮动动画
        this.alive = true;
    }

    update() {
        this.lifetime--;
        this.bobTimer += 0.05;
        if (this.lifetime <= 0) {
            this.alive = false;
        }
    }

    // 检查是否即将消失（最后5秒闪烁）
    isBlinking() {
        return this.lifetime < 300;
    }

    // 检查实体是否在拾取范围内
    canPickup(entity) {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < this.pickupRadius + (entity.radius || 15);
    }

    draw(ctx) {
        if (!this.alive) return;

        // 闪烁效果（即将消失时）
        if (this.isBlinking() && Math.floor(this.lifetime / 10) % 2 === 0) {
            return;
        }

        // 浮动效果
        const bobOffset = Math.sin(this.bobTimer) * 3;
        ctx.save();
        ctx.translate(0, bobOffset);

        // 绘制稀有度颜色光晕
        const rarityColor = RARITY_COLORS[this.config.rarity] || '#FFD700';
        const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
        gradient.addColorStop(0, rarityColor + '66');
        gradient.addColorStop(1, rarityColor + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();

        // 绘制背景方块
        ctx.fillStyle = '#222';
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeStyle = rarityColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);

        // 绘制 emoji
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.config.emoji, 0, 0);

        // 显示物品名称
        ctx.fillStyle = rarityColor;
        ctx.font = '9px sans-serif';
        ctx.fillText(this.config.name, 0, 20);

        ctx.restore();
    }
}

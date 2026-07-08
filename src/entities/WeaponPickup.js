// src/entities/WeaponPickup.js
// 地面掉落的武器实体

export class WeaponPickup {
    constructor(x, y, weapon) {
        this.x = x;
        this.y = y;
        this.weapon = weapon;        // Weapon 实例
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

        // 绘制光晕
        const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();

        // 绘制武器图标（简化为方块+文字）
        ctx.fillStyle = '#333';
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);

        // 武器类型标识
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const typeIcons = {
            'melee': '🔪',
            'pistol': '🔫',
            'rifle': '🔫',
            'smg': '🔫',
            'shotgun': '🔫',
            'sniper': '🎯',
            'launcher': '🚀',
            'grenade': '💣',
            'medical': '💊'
        };

        const icon = typeIcons[this.weapon.config.type] || '🔫';
        ctx.fillText(icon, 0, 0);

        // 显示武器名称
        ctx.fillStyle = '#FFD700';
        ctx.font = '9px sans-serif';
        ctx.fillText(this.weapon.config.name, 0, 20);

        ctx.restore();
    }
}
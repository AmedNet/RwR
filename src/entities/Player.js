// src/entities/Player.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Bullet } from './Bullet.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { Weapon } from '../core/Weapon.js';

export class Player extends Entity {
    constructor(x, y, config) {
        super(x, y, {
            health: config.health,
            speed: config.speed,
            radius: config.radius
        });
        this.rank = 0;
        this.rankNames = ['列兵', '下士', '中士', '上士'];
        this.shootCooldown = 0;
        this.config = config;
        // 武器贴图缓存
        this.weaponImage = null;
        this.weaponImageLoaded = false;
        // 切换动画
        this.switchAnimTimer = 0;
        this.switchAnimDuration = 15; // 0.25秒
        this.isSwitching = false;
        this.switchFromSlot = -1;
        // 预加载武器贴图
        this.loadWeaponImage('beretta92');
        this.loadWeaponImage('knife');
    }

    loadWeaponImage(weaponId) {
        const img = new Image();
        img.src = WeaponRegistry[weaponId].imagePath;
        if (weaponId === 'beretta92') {
            this.berettaImage = img;
            img.onload = () => this.berettaImageLoaded = true;
        } else if (weaponId === 'knife') {
            this.knifeImage = img;
            img.onload = () => this.knifeImageLoaded = true;
        }
    }

    getRankName() {
        return this.rankNames[Math.min(this.rank, this.rankNames.length - 1)];
    }

    addRank() {
        if (this.rank < this.rankNames.length - 1) {
            this.rank++;
            this.health = Math.min(this.health + 20, this.maxHealth);
            EventBus.emit('player_rank_up', { rank: this.rank, health: this.health });
        }
    }

    addKill() {
        GameState.kills++;
        EventBus.emit('player_kill', { kills: GameState.kills });
        if (GameState.kills % GameState.config.rankUpKills === 0) {
            this.addRank();
        }
    }

    // 获取当前武器（包含匕首 fallback）
    getCurrentWeapon() {
        // 检查背包是否有武器
        for (let i = 0; i < 4; i++) {
            if (GameState.inventory[i]) {
                return GameState.inventory[GameState.activeWeaponSlot] || GameState.inventory[i];
            }
        }
        // 全空 → 使用匕首
        return new Weapon('knife');
    }

    // 切换武器
    switchWeapon(slot) {
        if (slot < 0 || slot > 3) return;
        if (slot === GameState.activeWeaponSlot) return;
        // 检查目标位置是否有武器
        if (!GameState.inventory[slot]) return;
        // 如果正在换弹，取消换弹
        const current = GameState.getActiveWeapon();
        if (current) current.isReloading = false;
        // 启动切换动画
        this.isSwitching = true;
        this.switchAnimTimer = this.switchAnimDuration;
        this.switchFromSlot = GameState.activeWeaponSlot;
        GameState.activeWeaponSlot = slot;
    }

    // 开始换弹
    reload() {
        const weapon = GameState.getActiveWeapon();
        if (weapon) weapon.startReload();
    }

    // 检查是否可以使用匕首
    hasOnlyKnife() {
        return !GameState.inventory.some(slot => slot !== null);
    }

    // 近战攻击：对最近的敌人造成伤害
    meleeAttack() {
        const knifeConfig = WeaponRegistry.knife;
        let nearestEnemy = null;
        let nearestDist = knifeConfig.range;
        for (const enemy of GameState.enemies) {
            if (!enemy.alive) continue;
            const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearestEnemy = enemy;
            }
        }
        if (nearestEnemy) {
            nearestEnemy.takeDamage(knifeConfig.damage);
            // 击退效果
            const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
            nearestEnemy.x += Math.cos(angle) * 30;
            nearestEnemy.y += Math.sin(angle) * 30;
            if (!nearestEnemy.alive) {
                GameState.enemies = GameState.enemies.filter(e => e.alive);
                if (GameState.player && GameState.player.alive) {
                    this.addKill();
                    GameState.rp += 10;
                }
            }
        }
    }

    update() {
        if (GameState.gameOver) return;

        // 更新切换动画
        if (this.isSwitching) {
            this.switchAnimTimer--;
            if (this.switchAnimTimer <= 0) {
                this.isSwitching = false;
            }
            return; // 切换期间不能移动/射击
        }

        // 更新当前武器的换弹状态
        const weapon = GameState.getActiveWeapon();
        if (weapon) weapon.updateReload();

        // 移动
        const keys = GameState.keys;
        let dx = 0, dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
        if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            dx = dx / len;
            dy = dy / len;
            let speedFactor = 1;
            if (GameState.map) {
                speedFactor = GameState.map.getSpeedFactor(this.x, this.y);
            }
            const finalSpeed = this.speed * speedFactor;
            let newX = this.x + dx * finalSpeed;
            let newY = this.y + dy * finalSpeed;
            if (GameState.map && !GameState.map.isWalkable(newX, newY, this.radius)) {
                if (GameState.map.isWalkable(newX, this.y, this.radius)) {
                    this.x = newX;
                } else if (GameState.map.isWalkable(this.x, newY, this.radius)) {
                    this.y = newY;
                }
            } else {
                this.x = newX;
                this.y = newY;
            }
        }

        // 边界限制
        const world = GameState.config.world;
        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        if (this.shootCooldown > 0) this.shootCooldown--;
    }

    shoot() {
        if (GameState.gameOver || this.shootCooldown > 0) return;
        if (this.isSwitching) return;

        const weapon = GameState.getActiveWeapon();
        if (!weapon || !weapon.canShoot()) return;

        const mouse = GameState.mouse;
        const screenX = this.x - GameState.camera.x;
        const screenY = this.y - GameState.camera.y;
        const angle = Math.atan2(mouse.y - screenY, mouse.x - screenX);

        if (weapon.config.type === 'melee') {
            // 近战攻击
            this.meleeAttack();
            this.shootCooldown = weapon.config.shootDelay;
            weapon.consumeAmmo();
            return;
        }

        // 远程射击
        const speed = weapon.config.bulletSpeed;
        const bullet = new Bullet(
            this.x + Math.cos(angle) * this.radius,
            this.y + Math.sin(angle) * this.radius,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            false,
            weapon.config.damage,
            true
        );
        GameState.bullets.push(bullet);
        weapon.consumeAmmo();
        this.shootCooldown = weapon.config.shootDelay;
    }

    draw(ctx) {
        ctx.save();

        const screenX = this.x - GameState.camera.x;
        const screenY = this.y - GameState.camera.y;
        const angle = Math.atan2(GameState.mouse.y - screenY, GameState.mouse.x - screenX);

        // 身体
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = GameState.config.colors.player;
        ctx.fill();
        ctx.strokeStyle = GameState.config.colors.playerStroke;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 武器贴图
        const weapon = this.getCurrentWeapon();
        const weaponImage = weapon.id === 'knife' ? this.knifeImage : this.berettaImage;
        const weaponLoaded = weapon.id === 'knife' ? this.knifeImageLoaded : this.berettaImageLoaded;

        if (weaponImage && weaponLoaded) {
            ctx.save();
            // 判断是否朝左
            const facingLeft = Math.cos(angle) < 0;
            
            // 放大贴图，计算等比缩放
            const targetHeight =50;
            const scale = targetHeight / weaponImage.naturalHeight;
            const drawW = weaponImage.naturalWidth * scale;
            const drawH = targetHeight;
            
            // 先移到角色边缘（枪的一侧）
            ctx.translate(facingLeft ? -2 : 2, 0);
            
            if (facingLeft) {
                // 朝左：旋转后翻转，让枪管指向鼠标方向
                ctx.scale(1, -1);  // 先翻转
                ctx.rotate(-angle); // 再旋转 → 旋转方向也被翻转了，枪口指向自己
            } else {
                // 朝右：直接旋转
                ctx.rotate(angle);
            }
            
            // 切换动画
            let yOffset = 0;
            if (this.isSwitching && this.switchFromSlot >= 0) {
                const progress = this.switchAnimTimer / this.switchAnimDuration;
                yOffset = Math.sin(progress * Math.PI) * 20;
            }
            // 绘制：让枪管向前延伸（+X方向），握把靠近角色
            ctx.drawImage(weaponImage, -drawW * 0.15, -drawH / 2 + yOffset, drawW, drawH);
            ctx.restore();
        } else {
            // 贴图未加载时用默认枪管
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 6;
            ctx.stroke();
        }

        // 军衔星
        ctx.fillStyle = '#FFD700';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★'.repeat(Math.min(this.rank + 1, 4)), 0, -28);
        ctx.restore();
    }
}
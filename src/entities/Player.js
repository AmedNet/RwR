// src/entities/Player.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Bullet } from './Bullet.js';
import { Grenade } from './Grenade.js';
import { WeaponRegistry, FireMode } from '../core/WeaponRegistry.js';
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
        this.switchAnimTimer = 0;
        this.switchAnimDuration = 15;
        this.isSwitching = false;
        this.switchFromSlot = -1;
        // 射击模式相关
        this.burstCount = 0;        // 三连射剩余发数
        this.burstTimer = 0;        // 三连射间隔计时器
        this.lastMouseDown = false; // 上一帧鼠标状态（用于检测按下边沿）
        // 通用武器贴图字典
        this.weaponImages = {};
        this.weaponImagesLoaded = {};
        this.reloadImages = {};
        this.reloadImagesLoaded = {};
        this.loadWeaponImage('beretta92');
        this.loadWeaponImage('knife');
        this.loadWeaponImage('m67');
        this.loadWeaponImage('ak47');
    }

    loadWeaponImage(weaponId) {
        const config = WeaponRegistry[weaponId];
        if (!config) return;
        // 加载普通贴图
        const img = new Image();
        img.src = config.imagePath;
        this.weaponImages[weaponId] = img;
        this.weaponImagesLoaded[weaponId] = false;
        img.onload = () => { this.weaponImagesLoaded[weaponId] = true; };
        // 加载换弹贴图（如果有）
        if (config.reloadImagePath) {
            const reloadImg = new Image();
            reloadImg.src = config.reloadImagePath;
            this.reloadImages[weaponId] = reloadImg;
            this.reloadImagesLoaded[weaponId] = false;
            reloadImg.onload = () => { this.reloadImagesLoaded[weaponId] = true; };
        }
    }

    // 通用获取武器贴图方法
    getWeaponImage(weaponId, isReloading = false) {
        if (isReloading && this.reloadImagesLoaded[weaponId]) {
            return this.reloadImages[weaponId];
        }
        if (this.weaponImagesLoaded[weaponId]) {
            return this.weaponImages[weaponId];
        }
        return null;
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
        if (GameState.kills % GameState.config.rankUpKills === 0) this.addRank();
    }

    getCurrentWeapon() {
        const weapon = GameState.inventory[GameState.activeWeaponSlot];
        return weapon || new Weapon('knife');
    }

    switchWeapon(slot) {
        if (slot < 0 || slot > 3 || slot === GameState.activeWeaponSlot || !GameState.inventory[slot]) return;
        const current = GameState.getActiveWeapon();
        if (current) current.isReloading = false;
        this.isSwitching = true;
        this.switchAnimTimer = this.switchAnimDuration;
        this.switchFromSlot = GameState.activeWeaponSlot;
        GameState.activeWeaponSlot = slot;
    }

    reload() {
        const weapon = GameState.getActiveWeapon();
        if (weapon) weapon.startReload();
    }

    throwGrenade() {
        // 从任意槽位查找手雷
        let grenadeSlot = -1;
        for (let i = 0; i < 4; i++) {
            const w = GameState.inventory[i];
            if (w && w.id === 'm67' && w.ammo > 0) { grenadeSlot = i; break; }
        }
        if (grenadeSlot < 0) return;
        const weapon = GameState.inventory[grenadeSlot];

        const config = weapon.config;
        const mouse = GameState.mouse;
        const screenX = this.x - GameState.camera.x;
        const screenY = this.y - GameState.camera.y;
        const targetX = this.x + (mouse.x - screenX);
        const targetY = this.y + (mouse.y - screenY);

        const grenade = new Grenade(this.x, this.y, targetX, targetY, config);
        GameState.grenades.push(grenade);

        weapon.ammo--;
        if (weapon.ammo <= 0) GameState.inventory[grenadeSlot] = null;
    }

    hasOnlyKnife() {
        return !GameState.inventory.some(slot => slot !== null);
    }

    meleeAttack() {
        const knifeConfig = WeaponRegistry.knife;
        let nearestEnemy = null, nearestDist = knifeConfig.range;
        for (const enemy of GameState.enemies) {
            if (!enemy.alive) continue;
            const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (d < nearestDist) { nearestDist = d; nearestEnemy = enemy; }
        }
        if (nearestEnemy) {
            nearestEnemy.takeDamage(knifeConfig.damage);
            const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
            nearestEnemy.x += Math.cos(angle) * 30;
            nearestEnemy.y += Math.sin(angle) * 30;
            if (!nearestEnemy.alive) {
                GameState.enemies = GameState.enemies.filter(e => e.alive);
                if (GameState.player && GameState.player.alive) { this.addKill(); GameState.rp += 10; }
            }
        }
    }

    update() {
        if (GameState.gameOver) return;
        if (this.isSwitching) {
            this.switchAnimTimer--;
            if (this.switchAnimTimer <= 0) this.isSwitching = false;
            return;
        }
        const weapon = GameState.getActiveWeapon();
        if (weapon) weapon.updateReload();

        const keys = GameState.keys;
        let dx = 0, dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
        if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            dx /= len; dy /= len;
            const speedFactor = GameState.map ? GameState.map.getSpeedFactor(this.x, this.y) : 1;
            const finalSpeed = this.speed * speedFactor;
            const newX = this.x + dx * finalSpeed;
            const newY = this.y + dy * finalSpeed;
            if (GameState.map && !GameState.map.isWalkable(newX, newY, this.radius)) {
                if (GameState.map.isWalkable(newX, this.y, this.radius)) this.x = newX;
                else if (GameState.map.isWalkable(this.x, newY, this.radius)) this.y = newY;
            } else { this.x = newX; this.y = newY; }
        }
        const world = GameState.config.world;
        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));
        if (this.shootCooldown > 0) this.shootCooldown--;

        // 处理三连射
        if (this.burstCount > 0) {
            this.burstTimer--;
            if (this.burstTimer <= 0) {
                this.shoot();
                this.burstCount--;
                this.burstTimer = 4; // 三连射每发间隔4帧
            }
        }

        // 根据射击模式处理鼠标输入
        if (weapon) {
            const fireMode = weapon.config.fireMode || FireMode.SEMI;
            const mouseDown = GameState.mouse.down;
            const mouseJustPressed = mouseDown && !this.lastMouseDown;

            switch (fireMode) {
                case FireMode.AUTO:
                    // 全自动：长按连发
                    if (mouseDown) {
                        this.shoot();
                    }
                    break;
                case FireMode.BURST:
                    // 三连射：按一次打3发
                    if (mouseJustPressed && this.burstCount === 0) {
                        this.burstCount = 3;
                        this.burstTimer = 0;
                        this.shoot(); // 立即打第一发
                        this.burstCount--;
                    }
                    break;
                case FireMode.SEMI:
                default:
                    // 半自动：只在按下瞬间射击
                    if (mouseJustPressed) {
                        this.shoot();
                    }
                    break;
            }
            this.lastMouseDown = mouseDown;
        }
    }

    shoot() {
        if (GameState.gameOver || this.shootCooldown > 0 || this.isSwitching) return;
        const weapon = GameState.getActiveWeapon();
        if (!weapon || !weapon.canShoot()) return;

        // 手雷类型武器不能射击，只能用G键投掷
        if (weapon.config.type === 'grenade') return;

        const mouse = GameState.mouse;
        const screenX = this.x - GameState.camera.x;
        const screenY = this.y - GameState.camera.y;
        const angle = Math.atan2(mouse.y - screenY, mouse.x - screenX);

        if (weapon.config.type === 'melee') {
            this.meleeAttack();
            this.shootCooldown = weapon.config.shootDelay;
            weapon.consumeAmmo();
            return;
        }

        const speed = weapon.config.bulletSpeed;
        GameState.bullets.push(new Bullet(
            this.x + Math.cos(angle) * this.radius,
            this.y + Math.sin(angle) * this.radius,
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            false, weapon.config.damage, true
        ));
        weapon.consumeAmmo();
        this.shootCooldown = weapon.config.shootDelay;
    }

    draw(ctx) {
        ctx.save();
        const screenX = this.x - GameState.camera.x;
        const screenY = this.y - GameState.camera.y;
        const angle = Math.atan2(GameState.mouse.y - screenY, GameState.mouse.x - screenX);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = GameState.config.colors.player;
        ctx.fill();
        ctx.strokeStyle = GameState.config.colors.playerStroke;
        ctx.lineWidth = 3;
        ctx.stroke();

        const weapon = this.getCurrentWeapon();
        const weaponImage = this.getWeaponImage(weapon.id, weapon.isReloading);
        const weaponLoaded = weaponImage !== null;

        if (weaponImage && weaponLoaded) {
            ctx.save();
            const facingLeft = Math.cos(angle) < 0;
            const targetHeight =50;
            const scale = targetHeight / weaponImage.naturalHeight;
            const drawW = weaponImage.naturalWidth * scale;
            const drawH = targetHeight;

            ctx.translate(facingLeft ? -2 : 2, 0);
            if (facingLeft) {
                ctx.scale(1, -1); // 先旋转到鼠标方向，再水平翻转
                ctx.rotate(-angle);
            } else {
                ctx.rotate(angle);
            }

            let yOffset = 0;
            if (this.isSwitching && this.switchFromSlot >= 0) {
                yOffset = Math.sin((this.switchAnimTimer / this.switchAnimDuration) * Math.PI) * 20;
            }
            ctx.drawImage(weaponImage, -drawW * 0.15, -drawH / 2 + yOffset, drawW, drawH);
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
            ctx.strokeStyle = '#333'; ctx.lineWidth = 6; ctx.stroke();
        }

        ctx.fillStyle = '#FFD700';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★'.repeat(Math.min(this.rank + 1, 4)), 0, -28);
        ctx.restore();
    }
}
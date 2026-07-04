// src/entities/Player.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Bullet } from './Bullet.js';
import { Grenade } from './Grenade.js';
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
        this.switchAnimTimer = 0;
        this.switchAnimDuration = 15;
        this.isSwitching = false;
        this.switchFromSlot = -1;
        this.loadWeaponImage('beretta92');
        this.loadWeaponImage('knife');
        this.loadWeaponImage('m67');
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
        } else if (weaponId === 'm67') {
            this.m67Image = img;
            img.onload = () => this.m67ImageLoaded = true;
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
        let weaponImage, weaponLoaded;
        if (weapon.id === 'knife') {
            weaponImage = this.knifeImage;
            weaponLoaded = this.knifeImageLoaded;
        } else if (weapon.id === 'm67') {
            weaponImage = this.m67Image;
            weaponLoaded = this.m67ImageLoaded;
        } else {
            weaponImage = this.berettaImage;
            weaponLoaded = this.berettaImageLoaded;
        }

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
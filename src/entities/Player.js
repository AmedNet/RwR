// src/entities/Player.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Bullet } from './Bullet.js';
import { Grenade } from './Grenade.js';
import { WeaponRegistry, FireMode } from '../core/WeaponRegistry.js';
import { Weapon } from '../core/Weapon.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import * as SoundManager from '../utils/SoundManager.js';

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
        this.loadWeaponImage('m4a1');
        this.loadWeaponImage('cat'); // 医疗包
        this.loadWeaponImage('sa28'); // 霰弹枪
        this.loadWeaponImage('awp'); // 狙击枪
        this.loadWeaponImage('m82'); // 反器材狙击枪
        this.loadWeaponImage('at4'); // 火箭筒
        this.loadWeaponImage('hkmp5'); // 冲锋枪
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
        return GameState.inventory[GameState.activeWeaponSlot];
    }

    switchWeapon(slot) {
        if (slot < 0 || slot > 6 || slot === GameState.activeWeaponSlot || !GameState.inventory[slot]) return;
        const current = GameState.getActiveWeapon();
        if (current) {
            current.isReloading = false;
            current.clearJustEmptied(); // 切换武器时清除打空标记
        }
        this.isSwitching = true;
        this.switchAnimTimer = this.switchAnimDuration;
        this.switchFromSlot = GameState.activeWeaponSlot;
        GameState.activeWeaponSlot = slot;
        
        // 切换到非狙击枪时，立即重置瞄准状态
        const newWeapon = GameState.inventory[slot];
        if (newWeapon && !newWeapon.config.scope) {
            GameState.scopeState.idleTimer = 0;
            GameState.scopeState.isScoped = false;
            GameState.camera.targetZoom = 1;
            GameState.camera.targetOffsetX = 0;
            GameState.camera.targetOffsetY = 0;
        }
    }

    reload() {
        const weapon = GameState.getActiveWeapon();
        if (weapon) {
            // startReload 返回 true 表示换弹成功开始
            const reloadStarted = weapon.startReload();
            if (reloadStarted) {
                // 只有真正开始换弹时才播放音效
                const weaponType = weapon.config.type;
                if (['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'launcher'].includes(weaponType)) {
                    SoundManager.playReload(weaponType);
                }
            }
        }
    }

    throwGrenade() {
        // 从任意槽位查找手雷
        let grenadeSlot = -1;
        for (let i = 0; i < GameState.inventory.length; i++) {
            const w = GameState.inventory[i];
            if (w && w.id === 'm67' && w.ammo > 0) { grenadeSlot = i; break; }
        }
        if (grenadeSlot < 0) return;
        const weapon = GameState.inventory[grenadeSlot];

        const config = weapon.config;
        const mouse = GameState.mouse;
        const cam = GameState.camera;
        const zoom = cam.zoom || 1;
        const offsetX = cam.offsetX || 0;
        const offsetY = cam.offsetY || 0;
        const canvas = document.getElementById('gameCanvas');
        const logicalW = canvas ? canvas.clientWidth : 800;
        const logicalH = canvas ? canvas.clientHeight : 600;
        const cx = logicalW / 2;
        const cy = logicalH / 2;
        
        // 使用与 Renderer.toScreen() 相同的转换公式
        const screenX = (this.x - cam.x) * zoom + cx * (1 - zoom) - offsetX;
        const screenY = (this.y - cam.y) * zoom + cy * (1 - zoom) - offsetY;
        
        // 反向计算世界坐标：从屏幕坐标还原目标位置
        const targetWorldX = (mouse.x - cx * (1 - zoom) + offsetX) / zoom + cam.x;
        const targetWorldY = (mouse.y - cy * (1 - zoom) + offsetY) / zoom + cam.y;

        const grenade = new Grenade(this.x, this.y, targetWorldX, targetWorldY, config);
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
            nearestEnemy.takeDamage(knifeConfig.damage, this.x, this.y);
            const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
            nearestEnemy.x += Math.cos(angle) * 30;
            nearestEnemy.y += Math.sin(angle) * 30;
            if (!nearestEnemy.alive) {
                GameState.enemies = GameState.enemies.filter(e => e.alive);
                if (GameState.player && GameState.player.alive) { this.addKill(); GameState.rp += 10; }
            }
        }
        // 播放近战音效
        SoundManager.playMelee();
    }

    update() {
        if (GameState.gameOver) return;
        if (this.isSwitching) {
            this.switchAnimTimer--;
            if (this.switchAnimTimer <= 0) this.isSwitching = false;
            return;
        }
        const weapon = GameState.getActiveWeapon();
        if (weapon) {
            weapon.updateReload();
            weapon.updateRecoilAndSpread(); // 每帧恢复后坐力和散布
        }

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
            // 持有火箭筒时减速（类似沙地）
            const heldWeapon = GameState.getActiveWeapon();
            const launcherSlowdown = (heldWeapon && heldWeapon.config.type === 'launcher') ? 0.5 : 1;
            const finalSpeed = this.speed * speedFactor * launcherSlowdown;
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

        // 开镜逻辑（狙击枪）- 只使用offset偏移，不使用zoom放大
        const isMoving = dx !== 0 || dy !== 0;
        if (weapon && weapon.config.scope) {
            if (!isMoving) {
                GameState.scopeState.idleTimer++;
                if (GameState.scopeState.idleTimer >= weapon.config.scope.activateDelay) {
                    GameState.scopeState.isScoped = true;
                }
            } else {
                // 移动时立即退出瞄准状态
                GameState.scopeState.idleTimer = 0;
                GameState.scopeState.isScoped = false;
            }
            
            // 只在isScoped状态下计算offset
            if (GameState.scopeState.isScoped) {
                const mouse = GameState.mouse;
                const canvas = document.getElementById('gameCanvas');
                const screenCX = (canvas ? canvas.clientWidth : 800) / 2;
                const screenCY = (canvas ? canvas.clientHeight : 600) / 2;
                const mdx = mouse.x - screenCX;
                const mdy = mouse.y - screenCY;
                const mdist = Math.hypot(mdx, mdy);
                if (mdist > 0) {
                    // 从武器配置读取偏移参数
                    const maxOffset = weapon.config.scope.maxOffset || 200;
                    const sensitivity = weapon.config.scope.offsetSensitivity || 300;
                    const factor = Math.min(mdist / sensitivity, 1);
                    GameState.camera.targetOffsetX = (mdx / mdist) * maxOffset * factor;
                    GameState.camera.targetOffsetY = (mdy / mdist) * maxOffset * factor;
                }
            } else {
                // 未开镜时重置偏移
                GameState.camera.targetOffsetX = 0;
                GameState.camera.targetOffsetY = 0;
            }
        } else {
            // 没有瞄准镜的武器，重置所有状态
            GameState.scopeState.idleTimer = 0;
            GameState.scopeState.isScoped = false;
            GameState.camera.targetOffsetX = 0;
            GameState.camera.targetOffsetY = 0;
        }
        // zoom始终为1（不使用缩放）
        GameState.camera.zoom = 1;
        GameState.camera.targetZoom = 1;
        // 平滑过渡偏移
        GameState.camera.offsetX += (GameState.camera.targetOffsetX - GameState.camera.offsetX) * 0.1;
        GameState.camera.offsetY += (GameState.camera.targetOffsetY - GameState.camera.offsetY) * 0.1;

        // 处理三连射
        if (this.burstCount > 0) {
            this.burstTimer--;
            if (this.burstTimer <= 0) {
                this.shootCooldown = 0;  // 临时清除冷却，让 burst 射击通过
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
        // UI界面打开时禁止开火
        if (GameState.arsenalOpen || GameState.inventoryOpen || GameState.debugOpen) return;
        const weapon = GameState.getActiveWeapon();
        if (!weapon || !weapon.canShoot()) return;

        // 手雷类型武器不能射击，只能用G键投掷
        if (weapon.config.type === 'grenade') return;

        // 医疗包：治疗自己（优先）或队友
        if (weapon.config.type === 'medical') {
            this.useMedical(weapon);
            return;
        }

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

        // 应用后坐力和散布到射击角度
        const angleOffset = weapon.getShotAngleOffset();
        const baseAngle = angle + angleOffset;

        const speed = weapon.config.bulletSpeed;
        const knockback = weapon.config.knockback || 0;

        // 霰弹枪：一次发射多颗弹丸
        if (weapon.config.type === 'shotgun') {
            const pellets = weapon.config.pellets || 8;
            const spreadAngle = weapon.config.spreadAngle || 0.35;
            const pelletRadius = (GameState.config.bullet.radius) * 0.6; // 霰弹枪弹丸更小
            const maxRange = weapon.config.range || 250;

            for (let i = 0; i < pellets; i++) {
                // 在锥角内均匀随机分布
                const pelletAngle = baseAngle + (Math.random() - 0.5) * spreadAngle;
                const spawnX = this.x + Math.cos(pelletAngle) * this.radius;
                const spawnY = this.y + Math.sin(pelletAngle) * this.radius;
                GameState.bullets.push(new Bullet(
                    spawnX, spawnY,
                    Math.cos(pelletAngle) * speed,
                    Math.sin(pelletAngle) * speed,
                    false, weapon.config.damage, true,
                    knockback, pelletRadius, maxRange
                ));
            }
        } else {
            // 获取穿透配置（狙击枪用）
            const penetration = weapon.config.penetration || null;
            // 获取爆炸配置（M82/AT4用）
            const explosion = (weapon.config.explosionRadius && weapon.config.explosionDamage) 
                ? { radius: weapon.config.explosionRadius, damage: weapon.config.explosionDamage }
                : null;
            // 获取拖尾配置（AT4用）
            const hasTrail = weapon.config.hasTrail === true;
            // 获取子弹大小倍率（默认0.6，火箭筒等除外）
            const bulletRadiusMult = weapon.config.bulletRadiusMultiplier !== undefined
                ? weapon.config.bulletRadiusMultiplier
                : 0.6;
            const bulletRadius = GameState.config.bullet.radius * bulletRadiusMult;
            GameState.bullets.push(new Bullet(
                this.x + Math.cos(baseAngle) * this.radius,
                this.y + Math.sin(baseAngle) * this.radius,
                Math.cos(baseAngle) * speed, Math.sin(baseAngle) * speed,
                false, weapon.config.damage, true,
                knockback, bulletRadius, null, penetration, explosion, hasTrail
            ));
        }
        // 播放枪声音效
        const weaponType = weapon.config.type;
        if (['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'launcher'].includes(weaponType)) {
            SoundManager.playShoot(weaponType);
        }

        weapon.consumeAmmo();
        weapon.applyRecoilAndSpread(); // 射击后增加后坐力和散布
        this.shootCooldown = weapon.config.shootDelay;

        // 检查是否打空，播放空仓音效
        if (weapon.ammo === 0 && weapon.config.type !== 'melee') {
            SoundManager.playEmpty();
        }

        // 抛壳效果 + 抛壳音效（排除不抛壳的武器类型）
        const noShellTypes = ['melee', 'grenade', 'medical', 'launcher'];
        if (!noShellTypes.includes(weapon.config.type)) {
            const shellType = weapon.config.shellType || weapon.config.type;
            EffectsManager.spawnShellCasing(this.x, this.y, shellType);
            SoundManager.playShellEject(shellType, 0);
        }

        // 火箭筒等一次性堆叠武器：射击后消耗堆叠，用完销毁
        if (weapon.config.type === 'launcher') {
            weapon.consumeStack();
            if (weapon.stackCount <= 0) {
                // 用完销毁，类似医疗包
                GameState.inventory[GameState.activeWeaponSlot] = null;
                this.autoSwitchToNextWeapon();
            } else {
                // 还有堆叠，自动装填下一发
                weapon.startReload();
            }
        }
    }

    // 使用医疗包
    useMedical(weapon) {
        if (!weapon || weapon.config.type !== 'medical') return;
        
        const healAmount = weapon.config.healAmount || 30;
        const currentSlot = GameState.activeWeaponSlot;
        
        // 优先治疗自己（只要自己不满血）
        if (this.health < this.maxHealth) {
            this.health = Math.min(this.health + healAmount, this.maxHealth);
            console.log(`💊 使用医疗包，恢复 ${healAmount} 血量`);
            EffectsManager.spawnHealEffect(this.x, this.y, healAmount);
            weapon.consumeAmmo(); // 消耗医疗包
            
            // 如果医疗包用完，清空槽位并切换武器
            if (weapon.ammo <= 0) {
                GameState.inventory[currentSlot] = null;
                this.autoSwitchToNextWeapon();
            }
            
            this.shootCooldown = 20;
            return;
        }
        
        // 自己满血时，检测面前是否有队友可以治疗
        const mouse = GameState.mouse;
        const screenX = this.x - GameState.camera.x;
        const screenY = this.y - GameState.camera.y;
        const angle = Math.atan2(mouse.y - screenY, mouse.x - screenX);
        
        // 检测鼠标方向上的队友（距离 < 100）
        let nearestTeammate = null;
        let nearestDist = 100; // 最大治疗距离
        
        for (const teammate of GameState.teammates) {
            if (!teammate.alive) continue;
            const dx = teammate.x - this.x;
            const dy = teammate.y - this.y;
            const dist = Math.hypot(dx, dy);
            
            // 检查是否在鼠标方向附近（角度差 < 30度）
            const angleToTeammate = Math.atan2(dy, dx);
            let angleDiff = Math.abs(angleToTeammate - angle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            
            if (dist < nearestDist && angleDiff < Math.PI / 6) { // 30度 = PI/6
                nearestDist = dist;
                nearestTeammate = teammate;
            }
        }
        
        if (nearestTeammate && nearestTeammate.health < nearestTeammate.maxHealth) {
            nearestTeammate.health = Math.min(nearestTeammate.health + healAmount, nearestTeammate.maxHealth);
            console.log(`💊 为队友 ${nearestTeammate.id || '队友'} 恢复 ${healAmount} 血量`);
            EffectsManager.spawnHealEffect(nearestTeammate.x, nearestTeammate.y, healAmount);
            weapon.consumeAmmo(); // 消耗医疗包
            
            // 如果医疗包用完，清空槽位并切换武器
            if (weapon.ammo <= 0) {
                GameState.inventory[currentSlot] = null;
                this.autoSwitchToNextWeapon();
            }
            
            this.shootCooldown = 20;
        } else {
            console.log('💊 血量已满，面前无需要治疗的队友');
        }
    }
    
    // 自动切换到下一个可用武器
    autoSwitchToNextWeapon() {
        for (let i = 0; i < GameState.inventory.length; i++) {
            if (GameState.inventory[i]) {
                GameState.activeWeaponSlot = i;
                return;
            }
        }
        // 如果没有武器，切换到空槽位（会使用匕首）
        GameState.activeWeaponSlot = 0;
    }

    // 重写父类的 takeDamage 方法以播放音效
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            GameState.gameOver = true;
            EventBus.emit('game_over', { reason: 'player_died' });
            SoundManager.playDie();
        } else {
            SoundManager.playHurt();
        }
        EventBus.emit('player_hurt', { health: this.health });
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
        if (!weapon) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
            ctx.strokeStyle = '#333'; ctx.lineWidth = 6; ctx.stroke();
            ctx.fillStyle = '#FFD700';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('★'.repeat(Math.min(this.rank + 1, 4)), 0, -28);
            ctx.restore();
            return;
        }
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
            // 后坐力视觉偏移：武器向后退 + 枪口逆时针旋转上抬
            const recoilBack = weapon.currentRecoil ? weapon.currentRecoil * 33 : 0; // 向后（削减45%）
            const recoilRotate = weapon.currentRecoil ? weapon.currentRecoil * 0.3 : 0; // 逆时针旋转
            ctx.rotate(-recoilRotate); // 枪口上抬（逆时针）
            ctx.drawImage(weaponImage, -drawW * 0.15 - recoilBack, -drawH / 2 + yOffset, drawW, drawH);
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
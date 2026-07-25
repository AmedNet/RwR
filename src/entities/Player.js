// src/entities/Player.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { Bullet } from './Bullet.js';
import { Grenade } from './Grenade.js';
import { GrenadeBullet } from './GrenadeBullet.js';
import { WeaponRegistry, FireMode } from '../core/WeaponRegistry.js';
import { Weapon } from '../core/Weapon.js';
import { WeaponPickup } from './WeaponPickup.js';
import { EffectsManager, ParticleType } from '../utils/EffectsManager.js';
import * as SoundManager from '../utils/SoundManager.js';
import { SlowEffect, STATUS_EFFECT_CONFIG } from '../utils/StatusEffects.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { Rarity } from '../core/LootRegistry.js';
import { LootPickup } from './LootPickup.js';
import { getHelmetVariantImagePath, rollHelmetVariant, HelmetTier } from '../core/HelmetSystem.js';
import { drawHelmet } from '../rendering/HelmetRenderer.js';
import { triggerFireKick } from '../rendering/CrosshairRenderer.js';
export class Player extends Entity {
    // 类常量
    static SWITCH_ANIM_DURATION = 15;
    static BURST_INTERVAL = 4;           // 三连射每发间隔帧数
    static MEDICAL_HEAL_COOLDOWN = 20;   // 医疗包使用冷却帧数
    static MEDICAL_RANGE = 100;          // 治疗队友最大距离
    static MEDICAL_ANGLE_THRESHOLD = Math.PI / 6; // 治疗队友角度阈值（30度）
    static LAUNCHER_SLOWDOWN = 0.5;      // 持火箭筒时速度倍率
    static CAMERA_SMOOTH = 0.1;          // 镜头偏移平滑系数
    static WEAPON_DRAW_HEIGHT = 50;      // 武器贴图绘制高度
    static MELEE_KNOCKBACK = 30;         // 近战击退距离
    static WEAPON_IMAGE_OFFSET_X = 0.3;  // 武器贴图 x 偏移比例（相对绘制宽度）
    static WEAPON_IMAGE_OFFSET_Y = 0.55; // 武器贴图 y 偏移比例（相对绘制高度）
    static MUZZLE_IN_IMAGE_X = 0.2;     // 枪口在贴图内 x 位置比例
    static MUZZLE_IN_IMAGE_Y = 0.50;    // 枪口在贴图内 y 位置比例
    static WEAPON_PIVOT_LEFT = -3;      // 武器旋转轴心 x（朝左）
    static WEAPON_PIVOT_RIGHT = 5;      // 武器旋转轴心 x（朝右）
    static WEAPON_PIVOT_Y = 20;         // 武器旋转轴心 y
    static DEATH_ANIM_DURATION = 30;    // 死亡动画持续帧数

   constructor(x, y, config) {
       super(x, y, {
           health: config.health,
           speed: config.speed,
           radius: config.radius
       });
       this.rank = 0;
       this.isPlayer = true;
       this.rankNames = ['列兵', '下士', '中士', '上士'];
       this.shootCooldown = 0;
       this.config = config;
       this.switchAnimTimer = 0;
       this.switchAnimDuration = Player.SWITCH_ANIM_DURATION;
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
       this.loadWeaponImage('xm320'); // 榴弹发射器
       this.loadWeaponImage('hkmp5'); // 冲锋枪

        // 角色贴图（身体抖动3帧 + 眨眼3帧）
        this.bodyFrames = [];
        this.bodyFramesLoaded = [];
        for (let i = 0; i < 3; i++) {
            const img = new Image();
            img.src = `src/pkg/character/blue/a/0${i + 1}.png`;
            this.bodyFrames.push(img);
            this.bodyFramesLoaded.push(false);
            img.onload = () => { this.bodyFramesLoaded[i] = true; };
        }
        this.eyesFrames = [];
        this.eyesFramesLoaded = [];
        for (let i = 0; i < 3; i++) {
            const img = new Image();
            img.src = `src/pkg/character/blue/a/e${i + 1}.png`;
            this.eyesFrames.push(img);
            this.eyesFramesLoaded.push(false);
            img.onload = () => { this.eyesFramesLoaded[i] = true; };
        }
        // 受伤眼睛贴图
        this.hurtEyeImg = new Image();
        this.hurtEyeImg.src = 'src/pkg/character/blue/a/e_hurt.png';
        this.hurtEyeLoaded = false;
        this.hurtEyeImg.onload = () => { this.hurtEyeLoaded = true; };
        this.hurtTimer = 0; // 受伤表情持续帧数
        // 动画状态
        this.bodyFrame = 0;
        this.bodyFrameTimer = 0;
        this.blinkFrame = 0;
        this.blinkTimer = 0;
        this.blinkCooldown = 180; // 约3秒
        this.isBlinking = false;
        // 走路形变动画
        this.walkPhase = 0;          // 步行周期相位 (0 ~ 2π)
        this.walkSpeed = 0;          // 平滑后的移动速度（用于控制形变幅度）
        this.isWalking = false;      // 是否在移动
        // 死亡动画
        this.dying = false;           // 是否正在播放死亡动画
        this.deathTimer = 0;          // 死亡动画倒计时帧数
        this.deathDir = 0;            // 死亡动画方向 (1=右, -1=左)
        // 防弹衣系统
        this.armorDurability = 0;      // 当前耐久（0=无防弹衣）
        this.armorMaxDurability = 100; // 最大耐久
        this.armorHelmetImg = null;    // 头盔贴图 Image 对象
        this.armorHelmetImgLoaded = false;
        this.armorHelmetRotation = 0.1; // 头盔旋转角度（弧度），正值=顺时针微调约 5.7°
        this.armorEquipFlash = 0;      // 装备闪光计时器（帧数，>0 时渲染蓝色光晕）
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

    /** 计算枪口世界坐标（用于火焰效果） */
    getMuzzlePosition(angle) {
        const weapon = GameState.getActiveWeapon();
        if (!weapon) return { x: this.x, y: this.y };
        const weaponImage = this.getWeaponImage(weapon.id, weapon.isReloading);
        if (!weaponImage) return { x: this.x, y: this.y };

        const targetHeight = Player.WEAPON_DRAW_HEIGHT;
        const scale = targetHeight / weaponImage.naturalHeight;
        const drawW = weaponImage.naturalWidth * scale;
        const drawH = targetHeight;

        // 贴图绘制起点（相对于旋转轴心，在旋转前的坐标系中）
        const imageOffsetX = -drawW * Player.WEAPON_IMAGE_OFFSET_X;
        const imageOffsetY = -drawH * Player.WEAPON_IMAGE_OFFSET_Y;

        // 枪口在贴图内的相对位置
        const muzzleInImageX = drawW * Player.MUZZLE_IN_IMAGE_X;
        const muzzleInImageY = drawH * Player.MUZZLE_IN_IMAGE_Y;

        // 枪口相对于旋转轴心的偏移（旋转前坐标系）
        const localX = imageOffsetX + muzzleInImageX;
        const localY = imageOffsetY + muzzleInImageY;

        // 旋转轴心的世界偏移（与 translate 参数对应）
        const facingLeft = Math.cos(angle) < 0;
        const pivotOffsetX = facingLeft ? Player.WEAPON_PIVOT_LEFT : Player.WEAPON_PIVOT_RIGHT;
        const pivotOffsetY = Player.WEAPON_PIVOT_Y;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        if (facingLeft) {
            // draw() 里先 rotate(-angle) 再 scale(1,-1)
            // 合成矩阵：[[cos, sin], [sin, -cos]]
            const worldX = this.x + pivotOffsetX + localX * cosA + localY * sinA;
            const worldY = this.y + pivotOffsetY + localX * sinA - localY * cosA;
            return { x: worldX, y: worldY };
        } else {
            // 标准旋转矩阵：[[cos, -sin], [sin, cos]]
            const worldX = this.x + pivotOffsetX + localX * cosA - localY * sinA;
            const worldY = this.y + pivotOffsetY + localX * sinA + localY * cosA;
            return { x: worldX, y: worldY };
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
        return GameState.inventory[GameState.activeWeaponSlot];
    }

    switchWeapon(slot) {
        if (slot < 0 || slot >= GameState.inventory.length || slot === GameState.activeWeaponSlot || !GameState.inventory[slot]) return false;
        const current = GameState.getActiveWeapon();
        if (current && !current.isLoot) {
            current.isReloading = false;
            current.clearJustEmptied(); // 切换武器时清除打空标记
        }
        this.isSwitching = true;
        this.switchAnimTimer = this.switchAnimDuration;
        this.switchFromSlot = GameState.activeWeaponSlot;
        GameState.activeWeaponSlot = slot;
        const newItem = GameState.inventory[slot];
        if (!newItem.isLoot) {
            SoundManager.playWeaponSwitch(newItem.config.type, this);
        }

        // 切换到非狙击枪时，立即重置瞄准状态
        if (newItem && !newItem.isLoot && !newItem.config.scope) {
            GameState.scopeState.idleTimer = 0;
            GameState.scopeState.isScoped = false;
            GameState.camera.targetZoom = 1;
            GameState.camera.targetOffsetX = 0;
            GameState.camera.targetOffsetY = 0;
        }
        return true;
    }

    reload() {
        if (this.mountedVehicle && this.vehicleSeat === 0) return;
        const weapon = GameState.getActiveWeapon();
        if (weapon && !weapon.isLoot) {
            // startReload 返回 true 表示换弹成功开始
            const reloadStarted = weapon.startReload();
            if (reloadStarted) {
                // 只有真正开始换弹时才播放音效
                const weaponType = weapon.config.type;
                if (['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'launcher'].includes(weaponType)) {
                    SoundManager.playReload(weaponType, this);
                }
            }
        }
    }

    throwGrenade() {
        if (this.mountedVehicle &&
            (this.vehicleSeat === 0 || !this.mountedVehicle.passengerCanFire)) return;
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
        SoundManager.playThrow(this);

        weapon.ammo--;
        if (weapon.ammo <= 0) {
            GameState.inventory[grenadeSlot] = null;
            // 若扔掉的是当前手持武器，自动切回其他可用武器（否则会卡在空槽位拿棍）
            if (grenadeSlot === GameState.activeWeaponSlot) {
                this.autoSwitchToNextWeapon();
            }
        }
    }

    hasOnlyKnife() {
        return !GameState.inventory.some(slot => slot !== null);
    }

    meleeAttack() {
        const knifeConfig = WeaponRegistry.knife;
        let nearestEnemy = null, nearestDist = knifeConfig.range;
        for (const enemy of GameState.enemies) {
            if (!enemy.alive || enemy.mountedVehicle) continue;
            const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (d < nearestDist) { nearestDist = d; nearestEnemy = enemy; }
        }
        if (nearestEnemy) {
            nearestEnemy.takeDamage(knifeConfig.damage, this.x, this.y);
            const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
            nearestEnemy.x += Math.cos(angle) * Player.MELEE_KNOCKBACK;
            nearestEnemy.y += Math.sin(angle) * Player.MELEE_KNOCKBACK;
            if (!nearestEnemy.alive) {
                GameState.enemies = GameState.enemies.filter(e => e.alive);
                if (GameState.player && GameState.player.alive) { this.addKill(); GameState.rp += 10; }
            }
        }
        // 播放近战音效
        SoundManager.playMelee(this);
    }

   update() {
       // 死亡动画播放期间，仍然推进动画计时
       if (this.dying) {
           this.deathTimer--;
           if (this.deathTimer <= 0) {
               // 一次性死亡逻辑：用 alive 守卫确保掉落/死亡只执行一次（修复掉落物循环生成）。
               // 不重置 dying —— 尸体倒下淡出后仍需留在原地渲染，重置 dying 会让尸体从死亡界面消失。
               if (this.alive) {
                   // 倒地瞬间：碎裂消散粒子 + 烟雾
                   EffectsManager.spawnParticles(this.x, this.y, ParticleType.EXPLOSION, 15);
                   EffectsManager.spawnParticles(this.x, this.y, ParticleType.SMOKE, 8);
                   this.alive = false;
                   this._dropItemsOnDeath();
                   if (!GameState.gameOver) {
                       GameState.triggerDeath();
                       EventBus.emit('game_over', { reason: 'player_died' });
                   }
               }
           }
           return;
       }
       if (GameState.gameOver) return;
       this.updateStatusEffects();
       this.savePrevPosition();
       if (this.isSwitching) {
           this.switchAnimTimer--;
           if (this.switchAnimTimer <= 0) this.isSwitching = false;
           return;
       }
       const weapon = GameState.getActiveWeapon();
       if (weapon && !weapon.isLoot) {
           weapon.updateReload();
           weapon.updateRecoilAndSpread();
       }
       const isMoving = this._updateMovement();
       this._updateAiming(weapon, isMoving);
       this._updateFiring(weapon);

        // 走路形变动画更新
        const dx = this.x - this.prevX;
        const dy = this.y - this.prevY;
        const moveSpeed = Math.sqrt(dx * dx + dy * dy);
        this.isWalking = moveSpeed > 0.3;
        const targetSpeed = this.isWalking ? Math.min(moveSpeed, 4) : 0;
        // 非对称插值：加速快、减速慢，停下时有自然过渡
        this.walkSpeed += (targetSpeed - this.walkSpeed) * (targetSpeed > this.walkSpeed ? 0.15 : 0.08);
        if (this.walkSpeed < 0.02) this.walkSpeed = 0;
        // 有残余速度时继续推进相位，停下后自然滑入静止姿态
        if (this.walkSpeed > 0.02) {
            this.walkPhase += this.walkSpeed * 0.08;
            if (this.walkPhase > Math.PI * 2) this.walkPhase -= Math.PI * 2;
        }

        // 受伤表情计时器递减
        if (this.hurtTimer > 0) this.hurtTimer--;

        // 防弹衣装备闪光递减
        if (this.armorEquipFlash > 0) this.armorEquipFlash--;

        // 身体抖动动画：每8帧切换一次
        this.bodyFrameTimer++;
        if (this.bodyFrameTimer >= 30) {
            this.bodyFrame = (this.bodyFrame + 1) % 3;
            this.bodyFrameTimer = 0;
        }

        // 眨眼动画
        if (!this.isBlinking) {
            this.blinkTimer++;
            if (this.blinkTimer >= this.blinkCooldown) {
                this.isBlinking = true;
                this.blinkFrame = 0;
                this.blinkTimer = 0;
            }
        } else {
            this.blinkTimer++;
            if (this.blinkTimer >= 4) {
                this.blinkFrame++;
                this.blinkTimer = 0;
                if (this.blinkFrame > 2) {
                    this.isBlinking = false;
                    this.blinkFrame = 0;
                    this.blinkCooldown = 120 + Math.random() * 180;
                }
            }
        }
   }

    /** 处理移动逻辑，返回是否正在移动 */
    _updateMovement() {
        // 上车状态：移动载具而非玩家自身
        if (this.mountedVehicle) {
            const v = this.mountedVehicle;
            if (!v.alive) {
                this.mountedVehicle = null;
                this.radius = this.config.radius;
            } else {
                if (this.vehicleSeat !== 0) {
                    this.x = v.x;
                    this.y = v.y;
                    // 非驾驶座也要减少射击冷却
                    if (this.shootCooldown > 0) this.shootCooldown--;
                    return false;
                }
                const keys = GameState.keys;
                const throttle = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
                const steering = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
                const speedFactor = GameState.map ? GameState.map.getSpeedFactor(v.x, v.y) : 1;
                const weatherSpeed = WeatherSystem.getSpeedMultiplier();
                v.updatePhysics(throttle, steering, speedFactor * weatherSpeed);
                const newX = v.x + v.velocityX;
                const newY = v.y + v.velocityY;
                if (!GameState.map || GameState.map.isWalkable(newX, newY, v.radius)) {
                    v.x = newX;
                    v.y = newY;
                } else {
                    v.hitObstacle();
                }
                this.x = v.x;
                this.y = v.y;
                if (this.shootCooldown > 0) this.shootCooldown--;
                return throttle !== 0 || steering !== 0 || Math.abs(v.currentSpeed) > 0.05;
            }
        }
        const keys = GameState.keys;
        let dx = 0, dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
        const currentWeather = WeatherSystem.current;
        const isSnow = currentWeather === 'snow' || currentWeather === 'blizzard';
        // 初始化滑移速度（惰性）
        if (this.slipVX === undefined) { this.slipVX = 0; this.slipVY = 0; }

        if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len; dy /= len;
            const speedFactor = GameState.map ? GameState.map.getSpeedFactor(this.x, this.y) : 1;
            const heldWeapon = GameState.getActiveWeapon();
            const launcherSlowdown = (heldWeapon && heldWeapon.config.type === 'launcher' && !heldWeapon.config.noSlowdown) ? Player.LAUNCHER_SLOWDOWN : 1;
            const weatherSpeed = WeatherSystem.getSpeedMultiplier();
            const slipFactor = isSnow ? 0.82 : 1.0;
            const finalSpeed = this.speed * speedFactor * launcherSlowdown * this.getSpeedMultiplier() * weatherSpeed * slipFactor;
            const moveX = dx * finalSpeed;
            const moveY = dy * finalSpeed;
            const newX = this.x + moveX;
            const newY = this.y + moveY;
            if (GameState.map && !GameState.map.isWalkable(newX, newY, this.radius)) {
                if (GameState.map.isWalkable(newX, this.y, this.radius)) this.x = newX;
                else if (GameState.map.isWalkable(this.x, newY, this.radius)) this.y = newY;
            } else {
                this.x = newX;
                this.y = newY;
            }
            // 雪地：积累滑移速度（输入方向逐渐渗透）
            if (isSnow) {
                this.slipVX = this.slipVX * 0.82 + moveX * 0.18;
                this.slipVY = this.slipVY * 0.82 + moveY * 0.18;
            }
        } else if (isSnow) {
            // 松手后滑移速度衰减（惯性残留）
            this.slipVX *= 0.93;
            this.slipVY *= 0.93;
        }

        // 应用滑移速度（雪地才有值，其他天气为0）
        if (isSnow && (Math.abs(this.slipVX) > 0.01 || Math.abs(this.slipVY) > 0.01)) {
            const newX2 = this.x + this.slipVX;
            const newY2 = this.y + this.slipVY;
            if (!GameState.map || GameState.map.isWalkable(newX2, newY2, this.radius)) {
                this.x = newX2;
                this.y = newY2;
            } else {
                this.slipVX *= 0.5;
                this.slipVY *= 0.5;
            }
        }

        // 天气风力影响
        const windForce = WeatherSystem.getWindForce();
        const tornadoForce = WeatherSystem.getTornadoForce(this.x, this.y);

        // 龙卷风伤害 - 累积机制，每0.5秒触发一次
        const tornadoDmg = WeatherSystem.getTornadoDamage(this.x, this.y);
        if (tornadoDmg > 0 && this.alive) {
            this.tornadoDamageAccumulator += tornadoDmg;
            this.tornadoDamageTimer++;

            // 每30帧（0.5秒）触发一次伤害
            if (this.tornadoDamageTimer >= 30) {
                this.takeDamage(this.tornadoDamageAccumulator);
                this.tornadoDamageAccumulator = 0;
                this.tornadoDamageTimer = 0;
            }
        } else {
            // 不在龙卷风范围内时重置累积器
            this.tornadoDamageAccumulator = 0;
            this.tornadoDamageTimer = 0;
        }
        const windScale = currentWeather === 'windStorm' || currentWeather === 'sandstorm' ? 0.12 : 0.3;
        this.x += windForce.x * windScale + tornadoForce.x;
        this.y += windForce.y * windScale + tornadoForce.y;
        const world = GameState.config.world;
        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));
        if (this.shootCooldown > 0) this.shootCooldown--;
        return dx !== 0 || dy !== 0;
    }

    /** 处理瞄准镜/开镜逻辑 */
    _updateAiming(weapon, isMoving) {
        if (weapon && !weapon.isLoot && weapon.config.scope) {
            if (!isMoving) {
                GameState.scopeState.idleTimer++;
                if (GameState.scopeState.idleTimer >= weapon.config.scope.activateDelay) {
                    GameState.scopeState.isScoped = true;
                }
            } else {
                GameState.scopeState.idleTimer = 0;
                GameState.scopeState.isScoped = false;
            }
            if (GameState.scopeState.isScoped) {
                const mouse = GameState.mouse;
                const canvas = document.getElementById('gameCanvas');
                const screenCX = (canvas ? canvas.clientWidth : 800) / 2;
                const screenCY = (canvas ? canvas.clientHeight : 600) / 2;
                const mdx = mouse.x - screenCX;
                const mdy = mouse.y - screenCY;
                const mdist = Math.hypot(mdx, mdy);
                if (mdist > 0) {
                    const maxOffset = weapon.config.scope.maxOffset || 200;
                    const sensitivity = weapon.config.scope.offsetSensitivity || 300;
                    const factor = Math.min(mdist / sensitivity, 1);
                    GameState.camera.targetOffsetX = (mdx / mdist) * maxOffset * factor;
                    GameState.camera.targetOffsetY = (mdy / mdist) * maxOffset * factor;
                }
            } else {
                GameState.camera.targetOffsetX = 0;
                GameState.camera.targetOffsetY = 0;
            }
        } else {
            GameState.scopeState.idleTimer = 0;
            GameState.scopeState.isScoped = false;
            GameState.camera.targetOffsetX = 0;
            GameState.camera.targetOffsetY = 0;
        }
        GameState.camera.zoom = 1;
        GameState.camera.targetZoom = 1;
        GameState.camera.offsetX += (GameState.camera.targetOffsetX - GameState.camera.offsetX) * Player.CAMERA_SMOOTH;
        GameState.camera.offsetY += (GameState.camera.targetOffsetY - GameState.camera.offsetY) * Player.CAMERA_SMOOTH;
    }

    /** 处理射击模式输入（三连射/全自动/半自动） */
    _updateFiring(weapon) {
        if (this.mountedVehicle) {
            if (this.vehicleSeat === 0 && this.mountedVehicle.weaponConfig) {
                this.mountedVehicle.updateWeapons();
                this.lastMouseDown = GameState.mouse.down;
                return;
            }
            if (!this.mountedVehicle.passengerCanFire) {
                this.lastMouseDown = GameState.mouse.down;
                return;
            }
        }
        if (this.burstCount > 0) {
            this.burstTimer--;
            if (this.burstTimer <= 0) {
                this.shootCooldown = 0;
                this.shoot();
                this.burstCount--;
                this.burstTimer = Player.BURST_INTERVAL;
            }
        }
        if (!weapon || weapon.isLoot) return;
        const fireMode = weapon.config.fireMode || FireMode.SEMI;
        const mouseDown = GameState.mouse.down;
        const mouseJustPressed = mouseDown && !this.lastMouseDown;
        switch (fireMode) {
            case FireMode.AUTO:
                if (mouseDown) this.shoot();
                break;
            case FireMode.BURST:
                if (mouseJustPressed && this.burstCount === 0) {
                    this.burstCount = 3;
                    this.burstTimer = 0;
                    this.shoot();
                    this.burstCount--;
                }
                break;
            case FireMode.SEMI:
            default:
                if (mouseJustPressed) this.shoot();
                break;
        }
        this.lastMouseDown = mouseDown;
    }

    shoot() {
        if (GameState.gameOver || this.shootCooldown > 0 || this.isSwitching) return;
        if (this.mountedVehicle &&
            (this.vehicleSeat === 0 || !this.mountedVehicle.passengerCanFire)) return;
        // 记录射击位置（非驾驶座时使用座位世界坐标）
        let shootX = this.x;
        let shootY = this.y;
        if (this.mountedVehicle && this.vehicleSeat > 0) {
            const seatPos = this.mountedVehicle.getSeatWorldPosition(this.vehicleSeat);
            shootX = seatPos.x;
            shootY = seatPos.y;
        }
        // UI界面打开时禁止开火
        if (GameState.arsenalOpen || GameState.inventoryOpen || GameState.debugOpen || GameState.radioOpen) return;
        const weapon = GameState.getActiveWeapon();
        if (!weapon || weapon.isLoot || !weapon.canShoot()) return;

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
        const weatherAccuracy = WeatherSystem.getAccuracyMultiplier();
        const baseAngle = angle + angleOffset * weatherAccuracy;

        const speed = weapon.config.bulletSpeed;
        const knockback = weapon.config.knockback || 0;

        // 霰弹枪：一次发射多颗弹丸
        if (weapon.config.type === 'shotgun') {
            const pellets = weapon.config.pellets || 8;
            const spreadAngle = weapon.config.spreadAngle || 0.35;
            const pelletRadius = (GameState.config.bullet.radius) * 0.6; // 霰弹枪弹丸更小
            const maxRange = weapon.config.range || 250;
            const muzzlePos = this.getMuzzlePosition(baseAngle);

            for (let i = 0; i < pellets; i++) {
                // 在锥角内均匀随机分布；额外 5px 偏移防止弹丸在枪口内重叠
                const pelletAngle = baseAngle + (Math.random() - 0.5) * spreadAngle;
                const spawnX = muzzlePos.x + Math.cos(pelletAngle) * 5;
                const spawnY = muzzlePos.y + Math.sin(pelletAngle) * 5;
                GameState.bullets.push(new Bullet(
                    spawnX, spawnY,
                    Math.cos(pelletAngle) * speed,
                    Math.sin(pelletAngle) * speed,
                    false, weapon.config.damage, true,
                    knockback, pelletRadius, maxRange,
                    null, null, false,
                    weapon.config.bulletColor, weapon.config.bulletGlow,
                    this, weapon.config.type
                ));
            }
        } else if (weapon.config.arcRange) {
            // 抛物线武器（XM320榴弹发射器）：计算鼠标世界坐标作为目标点
            const mouse = GameState.mouse;
            const cam = GameState.camera;
            const offsetX = cam.offsetX || 0;
            const offsetY = cam.offsetY || 0;
            const logicalW = GameState.viewport.width;
            const logicalH = GameState.viewport.height;
            const cx = logicalW / 2;
            const cy = logicalH / 2;
            const worldX = (mouse.x - cx * (1 - cam.zoom) + offsetX) / cam.zoom + cam.x;
            const worldY = (mouse.y - cy * (1 - cam.zoom) + offsetY) / cam.zoom + cam.y;
            const muzzlePos = this.getMuzzlePosition(baseAngle);
            GameState.bullets.push(new GrenadeBullet(
                muzzlePos.x, muzzlePos.y,
                worldX, worldY,
                weapon.config,
                this
            ));
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
            const muzzlePos = this.getMuzzlePosition(baseAngle);
            GameState.bullets.push(new Bullet(
                muzzlePos.x,
                muzzlePos.y,
                Math.cos(baseAngle) * speed, Math.sin(baseAngle) * speed,
                false, weapon.config.damage, true,
                knockback, bulletRadius, null, penetration, explosion, hasTrail,
                weapon.config.bulletColor, weapon.config.bulletGlow,
                this, weapon.config.type
            ));
        }
       // 播放枪声音效 + 枪口火焰
       const weaponType = weapon.config.type;
       if (['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'launcher'].includes(weaponType)) {
           SoundManager.playShoot(weaponType, this);
            const muzzlePos = this.getMuzzlePosition(baseAngle);
            EffectsManager.spawnMuzzleFlash(muzzlePos.x, muzzlePos.y, baseAngle, weaponType);
           // 火箭筒：额外生成后焰喷射效果
           if (weaponType === 'launcher' && weapon.config.hasBackblast !== false) {
                EffectsManager.spawnBackblast(muzzlePos.x, muzzlePos.y, baseAngle);
           }
       }

        weapon.consumeAmmo();
        weapon.applyRecoilAndSpread(); // 射击后增加后坐力和散布
        triggerFireKick(weapon.config.recoil ? weapon.config.recoil.maxAngle * 10 : 1);
        this.shootCooldown = weapon.config.shootDelay;

        // 检查是否打空，播放空仓音效
        if (weapon.ammo === 0 && weapon.config.type !== 'melee') {
            SoundManager.playEmpty(this);
        }

        // 抛壳效果 + 抛壳音效（排除不抛壳的武器类型）
        const noShellTypes = ['melee', 'grenade', 'medical', 'launcher'];
        if (!noShellTypes.includes(weapon.config.type)) {
            const shellType = weapon.config.shellType || weapon.config.type;
            EffectsManager.spawnShellCasing(this.x, this.y, shellType);
            SoundManager.playShellEject(shellType, this);
        }

        // 火箭筒等一次性堆叠武器：射击后消耗堆叠，用完销毁
        if (weapon.config.type === 'launcher' && weapon.config.maxStack) {
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

            this.shootCooldown = Player.MEDICAL_HEAL_COOLDOWN;
            return;
        }

        // 自己满血时，检测面前是否有队友可以治疗
        const mouse = GameState.mouse;
        const screenX = this.x - GameState.camera.x;
        const screenY = this.y - GameState.camera.y;
        const angle = Math.atan2(mouse.y - screenY, mouse.x - screenX);

        // 检测鼠标方向上的队友（距离 < 100）
        let nearestTeammate = null;
        let nearestDist = Player.MEDICAL_RANGE;

        for (const teammate of GameState.teammates) {
            if (!teammate.alive) continue;
            const dx = teammate.x - this.x;
            const dy = teammate.y - this.y;
            const dist = Math.hypot(dx, dy);

            // 检查是否在鼠标方向附近（角度差 < 30度）
            const angleToTeammate = Math.atan2(dy, dx);
            let angleDiff = Math.abs(angleToTeammate - angle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

            if (dist < nearestDist && angleDiff < Player.MEDICAL_ANGLE_THRESHOLD) {
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

            this.shootCooldown = Player.MEDICAL_HEAL_COOLDOWN;
        } else {
            console.log('💊 血量已满，面前无需要治疗的队友');
        }
    }

    // 自动切换到下一个可用武器
    autoSwitchToNextWeapon() {
        for (let i = 0; i < GameState.inventory.length; i++) {
            if (GameState.inventory[i]) {
                this.switchWeapon(i);
                return;
            }
        }
        // 如果没有武器，切换到空槽位（会使用匕首）
        GameState.activeWeaponSlot = 0;
    }

    // 重写父类的 takeDamage 方法以播放音效
    takeDamage(amount, hitX, hitY, vx = 0, vy = 0) {
        if (!this.alive || this.dying) return;
        this.health -= amount;
        // 血液飞溅：绑定到伤害
        if (amount > 0) {
            const px = (hitX !== undefined && hitX !== null) ? hitX : this.x;
            const py = (hitY !== undefined && hitY !== null) ? hitY : this.y;
            EffectsManager.spawnBloodSplatter(px, py, vx, vy, amount);
        }
        // 受到伤害时添加缓慢效果（使用配置常量）
        const slowDuration = STATUS_EFFECT_CONFIG.SLOW.DEFAULT_DURATION;
        this.addStatusEffect(new SlowEffect(slowDuration));
        if (this.health <= 0) {
            this.health = 0;
            // 触发死亡动画（不立刻 alive=false）
            this.dying = true;
            this.deathTimer = Player.DEATH_ANIM_DURATION;
            this.deathDir = Math.cos(Math.atan2(
                GameState.mouse.y - (this.y - GameState.camera.y),
                GameState.mouse.x - (this.x - GameState.camera.x)
            )) < 0 ? -1 : 1;

            if (this.mountedVehicle) {
                this.mountedVehicle.unmount(this);
            }

            SoundManager.playDie();
        } else {
            SoundManager.playHurt();
            // 受伤表情持续30帧（约0.5秒），仅存活时设置
            this.hurtTimer = 30;
        }
        EventBus.emit('player_hurt', { health: this.health });
    }

    // 激活防弹衣（购买时调用）
    activateArmor() {
        const armorConfig = WeaponRegistry.armor;
        this.armorDurability = armorConfig.armorDurability;
        this.armorMaxDurability = armorConfig.armorDurability;
        // 随机选头盔外观（4张贴图中任选）
        const tier = Math.random() < 0.5 ? HelmetTier.STEEL : HelmetTier.TITANIUM;
        const variant = rollHelmetVariant(tier); // 自适应各等级变体数量
        const imgPath = getHelmetVariantImagePath(tier, variant);
        this.armorHelmetImg = new Image();
        this.armorHelmetImg.src = imgPath;
        this.armorHelmetImgLoaded = false;
        this.armorHelmetImg.onload = () => { this.armorHelmetImgLoaded = true; };
        this.armorEquipFlash = 30; // 闪光持续 30 帧（约0.5秒）
    }

    // 绘制防弹衣装备闪光（购买瞬间的蓝色光晕；baseAlpha 叠加死亡淡出等外层透明度）
    _drawArmorEquipFlash(ctx, baseAlpha = 1) {
        if (this.armorEquipFlash <= 0) return;
        const flashAlpha = this.armorEquipFlash / 30;
        ctx.save();
        ctx.globalAlpha = baseAlpha * flashAlpha * 0.4;
        ctx.fillStyle = '#4FC3F7';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 死亡时掉落所有武器和稀有战利品
    _dropItemsOnDeath() {
        const droppedWeapons = new Set();
        for (let i = 0; i < GameState.inventory.length; i++) {
            const item = GameState.inventory[i];
            if (!item) continue;
            if (item.isLoot) {
                if (item.config.rarity === Rarity.RARE || item.config.rarity === Rarity.LEGENDARY) {
                    const offsetX = (Math.random() - 0.5) * 60;
                    const offsetY = (Math.random() - 0.5) * 60;
                    GameState.lootPickups.push(new LootPickup(this.x + offsetX, this.y + offsetY, item.lootId));
                    GameState.inventory[i] = null;
                }
            } else {
                if (item.id !== 'beretta92' && !droppedWeapons.has(item.id)) {
                    const offsetX = (Math.random() - 0.5) * 60;
                    const offsetY = (Math.random() - 0.5) * 60;
                    GameState.weaponPickups.push(new WeaponPickup(this.x + offsetX, this.y + offsetY, item));
                    droppedWeapons.add(item.id);
                }
            }
        }
    }

   draw(ctx) {
       ctx.save();
       const screenX = this.x - GameState.camera.x;
       const screenY = this.y - GameState.camera.y;
       const angle = Math.atan2(GameState.mouse.y - screenY, GameState.mouse.x - screenX);

        // === 死亡动画：MC风格 — 先倒下，再淡出 ===
        if (this.dying) {
            const progress = 1 - this.deathTimer / Player.DEATH_ANIM_DURATION; // 0→1
            // 两阶段分离：前60%倒下，后40%淡出
            const fallProgress = Math.min(progress / 0.6, 1);
            const fadeProgress = progress > 0.6 ? (progress - 0.6) / 0.4 : 0;
            const alpha = 1 - fadeProgress;
            // 重力加速曲线（开始慢、越倒越快）
            const eased = fallProgress * fallProgress;
            const fallAngle = eased * (Math.PI / 2) * this.deathDir;
            const pivotY = this.radius * 2; // 脚底

            ctx.save();
            ctx.globalAlpha = alpha;
            // 以脚底为轴心旋转倒下
            ctx.translate(0, pivotY);
            ctx.rotate(fallAngle);
            ctx.translate(0, -pivotY);

            // 身体贴图
            const bodyImg = this.bodyFrames[this.bodyFrame];
            if (bodyImg && this.bodyFramesLoaded[this.bodyFrame]) {
                const size = this.radius * 4;
                ctx.drawImage(bodyImg, -size / 2, -size / 2, size, size);
            }
            // 眼睛贴图（死亡时用受伤表情）
            const eyeImg = this.hurtEyeLoaded ? this.hurtEyeImg : this.eyesFrames[this.blinkFrame];
            const eyeLoaded = this.hurtEyeLoaded || this.eyesFramesLoaded[this.blinkFrame];
            if (eyeImg && eyeLoaded) {
                const eyeSize = this.radius * 4;
                ctx.drawImage(eyeImg, -eyeSize / 2, -eyeSize / 2, eyeSize, eyeSize);
            }
            // 防弹衣头盔（死亡动画中也要渲染）
            drawHelmet(ctx, this, this.radius);
            // 武器（在同一个变换下，随身体一起倒下，不做任何独立旋转）
            const weapon = this.getCurrentWeapon();
            if (weapon) {
                const weaponImage = this.getWeaponImage(weapon.id);
                if (weaponImage) {
                    const targetHeight = Player.WEAPON_DRAW_HEIGHT;
                    const ws = targetHeight / weaponImage.naturalHeight;
                    const drawW = weaponImage.naturalWidth * ws;
                    const drawH = targetHeight;
                    ctx.drawImage(
                        weaponImage,
                        Player.WEAPON_PIVOT_RIGHT - drawW * Player.WEAPON_IMAGE_OFFSET_X,
                        Player.WEAPON_PIVOT_Y - drawH * Player.WEAPON_IMAGE_OFFSET_Y,
                        drawW, drawH
                    );
                }
            }
            // 装备闪光效果（随死亡淡出同步衰减）
            this._drawArmorEquipFlash(ctx, alpha);
            ctx.restore();
            ctx.restore();
            return;
        }
        // === 死亡动画结束 ===

        const facingLeft = Math.cos(angle) < 0;

        // 绘制身体+眼睛（朝左时整体水平镜像）
        ctx.save();
        if (facingLeft) {
            ctx.scale(-1, 1);
        }
        // 走路形变：弹跳 + 摇摆 + 挤压拉伸
        const t = this.walkSpeed > 0.1 ? Math.min(this.walkSpeed / 3, 1) : 0;
        if (t > 0) {
            const phase = this.walkPhase;
            // 弹跳只向上：(1-cos)/2 保证 >= 0，踩地瞬间最低、腾空最高
            const bounce = (1 - Math.cos(phase * 2)) * 1.2 * t;
            const sway = Math.sin(phase) * (2.5 * Math.PI / 180) * t;
            // 挤压拉伸随步伐振荡：踩地压扁、腾空拉长
            const squashWave = Math.sin(phase * 2);
            const squashX = 1 + 0.05 * t * squashWave;
            const squashY = 1 - 0.04 * t * squashWave;
            ctx.translate(0, -bounce);
            ctx.rotate(sway);
            ctx.scale(squashX, squashY);
        }
        const bodyImg = this.bodyFrames[this.bodyFrame];
        if (bodyImg && this.bodyFramesLoaded[this.bodyFrame]) {
            const size = this.radius * 4;
            ctx.drawImage(bodyImg, -size / 2, -size / 2, size, size);
        }
        const isHurt = this.hurtTimer > 0 && this.hurtEyeLoaded;
        const eyeImg = isHurt ? this.hurtEyeImg : this.eyesFrames[this.blinkFrame];
        const eyeLoaded = isHurt ? this.hurtEyeLoaded : this.eyesFramesLoaded[this.blinkFrame];
        if (eyeImg && eyeLoaded) {
            const eyeScreenOffsetX = Math.cos(angle) * 1;
            const eyeOffsetX = facingLeft ? -eyeScreenOffsetX : eyeScreenOffsetX;
            const eyeOffsetY = Math.sin(angle) * 1;
            const eyeSize = this.radius * 4;
            ctx.drawImage(eyeImg, -eyeSize / 2 + eyeOffsetX, -eyeSize / 2 + eyeOffsetY, eyeSize, eyeSize);
        }
        // 防弹衣头盔渲染
        drawHelmet(ctx, this, this.radius);
        // 装备闪光效果
        this._drawArmorEquipFlash(ctx);
        ctx.restore();

       const weapon = this.getCurrentWeapon();
        if (!weapon) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('★'.repeat(Math.min(this.rank + 1, 4)), 0, -(this.radius * 1.6) - 6);
            ctx.restore();
            return;
        }
        const weaponImage = this.getWeaponImage(weapon.id, weapon.isReloading);
        const weaponLoaded = weaponImage !== null;

        if (weaponImage && weaponLoaded) {
            ctx.save();
            const facingLeft = Math.cos(angle) < 0;
            const targetHeight = Player.WEAPON_DRAW_HEIGHT;
            const scale = targetHeight / weaponImage.naturalHeight;
            const drawW = weaponImage.naturalWidth * scale;
            const drawH = targetHeight;

           ctx.translate(facingLeft ? Player.WEAPON_PIVOT_LEFT : Player.WEAPON_PIVOT_RIGHT, Player.WEAPON_PIVOT_Y);
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
            ctx.drawImage(weaponImage, -drawW * Player.WEAPON_IMAGE_OFFSET_X - recoilBack, -drawH * Player.WEAPON_IMAGE_OFFSET_Y + yOffset, drawW, drawH);
            ctx.restore();
        }

        ctx.fillStyle = '#FFD700';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★'.repeat(Math.min(this.rank + 1, 4)), 0, -(this.radius * 1.6) - 6);
        this.drawStatusEffects(ctx);
        ctx.restore();
    }
}

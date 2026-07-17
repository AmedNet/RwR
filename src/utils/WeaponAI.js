// src/utils/WeaponAI.js
// AI 武器选择逻辑共享模块
import { WeaponRegistry } from '../core/WeaponRegistry.js';

// 武器价值评估（用于拾取决策）
export const WEAPON_VALUE = Object.fromEntries(
  Object.entries(WeaponRegistry).map(([id, config]) => [id, config.aiValue ?? config.aiWeight ?? 0])
);

/**
 * 评估武器选择 - 根据距离和战场情况选择最佳武器
 * @param {Object} entity - AI实体（Enemy或Teammate）
 * @param {number} closestDist - 到最近敌人的距离
 * @param {Object} closestTarget - 最近的目标
 * @returns {number} 应该激活的武器槽位
 */
export function evaluateWeaponChoice(entity, closestDist, closestTarget) {
  // 敌方目标位于装甲载具内时，优先使用手里的火箭筒。
  const targetVehicle = closestTarget?.mountedVehicle;
  if (targetVehicle?.alive && targetVehicle.type === 'armored') {
    const launcherSlot = entity.findAccessorySlot('launcher');
    if (launcherSlot >= 0 && entity.weapons[launcherSlot]?.canShoot()) {
      entity.activeWeaponSlot = launcherSlot;
      return launcherSlot;
    }
  }

  // 优先级1：距离 < 80 → 军刀
  if (!closestTarget?.mountedVehicle && closestDist < 80 &&
      entity.weapons[0] && entity.weapons[0].config.type === 'melee') {
    entity.activeWeaponSlot = 0;
    return 0;
  }

  // 优先级2：距离 < 200 且有手雷，范围内有≥2个敌人 → 手雷
  if (closestDist < 200) {
    const grenadeSlot = entity.findAccessorySlot('grenade');
    if (grenadeSlot >= 0 && entity.countNearbyEnemies(closestTarget, 200) >= 2) {
      entity.activeWeaponSlot = grenadeSlot;
      return grenadeSlot;
    }
  }

  // 优先级3：有火箭筒且范围内有≥2个敌人 → 火箭筒
  if (closestDist < 400) {
    const launcherSlot = entity.findAccessorySlot('launcher');
    if (launcherSlot >= 0 && entity.weapons[launcherSlot] && entity.weapons[launcherSlot].canShoot()) {
      if (entity.countNearbyEnemies(closestTarget, 150) >= 2) {
        entity.activeWeaponSlot = launcherSlot;
        return launcherSlot;
      }
    }
  }

  // 优先级4：医疗包（血量低时使用）
  if (entity.health < entity.maxHealth * 0.4) {
    const medicalSlot = entity.findAccessorySlot('medical');
    if (medicalSlot >= 0 && entity.weapons[medicalSlot] && entity.weapons[medicalSlot].canShoot()) {
      entity.activeWeaponSlot = medicalSlot;
      return medicalSlot;
    }
  }

  // 默认：根据距离选择枪械
  if (closestDist < 150) {
    const slot = findBestWeaponByType(entity, ['pistol', 'smg']);
    if (slot >= 0) {
      entity.activeWeaponSlot = slot;
      return slot;
    }
  } else if (closestDist < 350) {
    const slot = findBestWeaponByType(entity, ['rifle', 'smg']);
    if (slot >= 0) {
      entity.activeWeaponSlot = slot;
      return slot;
    }
  } else {
    const slot = findBestWeaponByType(entity, ['sniper', 'rifle']);
    if (slot >= 0) {
      entity.activeWeaponSlot = slot;
      return slot;
    }
  }

  return entity.activeWeaponSlot;
}

/**
 * 根据武器类型查找最佳武器槽位
 */
function findBestWeaponByType(entity, types) {
  let bestSlot = -1;
  let bestValue = 0;

  for (let i = 0; i < entity.weapons.length; i++) {
    const weapon = entity.weapons[i];
    if (weapon && types.includes(weapon.config.type) && weapon.canShoot()) {
      const value = WEAPON_VALUE[weapon.config.id] || 0;
      if (value > bestValue) {
        bestValue = value;
        bestSlot = i;
      }
    }
  }

  return bestSlot;
}

/**
 * 评估是否应该切换武器
 */
export function shouldSwitchWeapon(entity, closestDist, closestTarget) {
  const currentWeapon = entity.getActiveWeapon();
  if (!currentWeapon) return true;

  if (!currentWeapon.canShoot()) return true;

  if (closestDist < 80 && currentWeapon.config.type !== 'melee') return true;
  if (closestDist > 300 && currentWeapon.config.type === 'melee') return true;

  return false;
}

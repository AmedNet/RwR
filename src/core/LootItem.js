// src/core/LootItem.js
// 背包中的战利品包装类
import { LootRegistry } from './LootRegistry.js';

export class LootItem {
    constructor(lootId) {
        this.lootId = lootId;
        this.config = LootRegistry[lootId];
        this.isLoot = true;  // 标记为战利品，用于UI区分
        this.isWeapon = false;
    }

    // 获取出售价格
    getValue() {
        return this.config.value;
    }

    // 获取显示名称
    getName() {
        return this.config.name;
    }

    // 获取emoji
    getEmoji() {
        return this.config.emoji;
    }

    clone() {
        return new LootItem(this.lootId);
    }
}

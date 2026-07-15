// src/entities/Teammate.js
import { CombatAI } from './CombatAI.js';
import { rollRandomRank, AIRank } from '../core/RankSystem.js';
import { rollRandomClass } from '../core/ClassSystem.js';

export class Teammate extends CombatAI {
    constructor(x, y, config) {
        super(
            x,
            y,
            {
                health: config.health || 60,
                speed: config.speed || 2.5,
                radius: config.radius || 15
            },
            {
                faction: 'player',
                bulletIsEnemy: false,
                color: '#42A5F5',
                damage: config.damage || 15,
                shootDelay: config.shootDelay || 25,
                bulletSpeed: config.bulletSpeed || 6
            }
        );
        this.config = config;
        this.setRank(rollRandomRank());
        const rankBonus = this.rank * 0.05;
        this.setClass(rollRandomClass(rankBonus));
        this.setHelmet(this.rank);
    }

}

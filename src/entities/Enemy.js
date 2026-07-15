// src/entities/Enemy.js
import { GameState } from '../core/GameState.js';
import { CombatAI } from './CombatAI.js';
import { rollRandomRank } from '../core/RankSystem.js';
import { rollRandomClass } from '../core/ClassSystem.js';

export class Enemy extends CombatAI {
    constructor(x, y, config) {
        const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
        const colors = GameState.config.colors;
        const hue = colors.enemyHueMin + Math.random() * (colors.enemyHueMax - colors.enemyHueMin);
        super(
            x,
            y,
            { health: config.health, speed, radius: config.radius },
            {
                faction: 'enemy',
                bulletIsEnemy: true,
                color: `hsl(${hue}, 70%, 50%)`,
                damage: config.damage,
                shootDelay: config.shootDelayMin + Math.floor(Math.random() * (config.shootDelayMax - config.shootDelayMin)),
                bulletSpeed: config.bulletSpeed || 4.5
            }
        );
        this.config = config;
        this.setRank(rollRandomRank());
        const rankBonus = this.rank * 0.05;
        this.setClass(rollRandomClass(rankBonus));
        this.setHelmet(this.rank);
    }
}

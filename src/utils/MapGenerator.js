// src/utils/MapGenerator.js
import { Terrain } from '../core/Map.js';

export const MapGenerator = {
    generateRandomMap(map) {
        // 1. 先铺设草地
        for (let r = 0; r < map.rows; r++) {
            for (let c = 0; c < map.cols; c++) {
                map.setTile(c, r, Terrain.GRASS);
            }
        }

        // 2. 放置房屋簇 (Cluster)
        const clusterCount = 12;
        for (let i = 0; i < clusterCount; i++) {
            let baseCol = Math.floor(Math.random() * map.cols);
            let baseRow = Math.floor(Math.random() * map.rows);
            // 放置 3-6 个房子
            const count = 3 + Math.floor(Math.random() * 4);
            for (let j = 0; j < count; j++) {
                const col = Math.max(0, Math.min(map.cols - 1, baseCol + Math.floor(Math.random() * 7) - 3));
                const row = Math.max(0, Math.min(map.rows - 1, baseRow + Math.floor(Math.random() * 7) - 3));
                map.setTile(col, row, Terrain.HOUSE);
            }
        }

        // 3. 放置河流 (带状)
        for (let i = 0; i < 2; i++) {
            const row = 10 + Math.floor(Math.random() * (map.rows - 20));
            const width = 3 + Math.floor(Math.random() * 4);
            for (let r = row; r < row + width && r < map.rows; r++) {
                for (let c = 0; c < map.cols; c++) {
                    if (Math.random() > 0.3) { // 增加间歇性
                        map.setTile(c, r, Terrain.RIVER);
                    }
                }
            }
        }
    }
};

// src/systems/MapEditor.js
import { GameState } from '../core/GameState.js';
import { Terrain } from '../core/Map.js';

export const MapEditor = {
    active: false,
    selectedType: Terrain.GRASS,
    hoverCol: -1,
    hoverRow: -1,

    toggle() {
        this.active = !this.active;
        if (this.active) {
            console.log('🛠️ 进入编辑模式，点击格子切换地形，按 1-4 选择类型，S 保存，L 加载');
        } else {
            console.log('退出编辑模式');
        }
    },

    handleKey(e) {
        if (!this.active) return;
        const key = e.key;
        if (key >= '1' && key <= '4') {
            this.selectedType = parseInt(key) - 1;
            console.log(`选择地形: ${Terrain[this.selectedType] || '未知'}`);
            e.preventDefault();
        }
        if (key === 's' || key === 'S') {
            this.saveMap();
            e.preventDefault();
        }
        if (key === 'l' || key === 'L') {
            this.loadMap();
            e.preventDefault();
        }
    },

    handleMouseMove(e) {
        if (!this.active) return;
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        const map = GameState.map;
        if (!map) return;
        const { col, row } = map.worldToTile(
            mouseX + GameState.camera.x,
            mouseY + GameState.camera.y
        );
        this.hoverCol = col;
        this.hoverRow = row;
        // 画布更新由主循环处理
    },

    handleClick(e) {
        if (!this.active) return;
        const map = GameState.map;
        if (!map) return;
        const { col, row } = this;
        if (this.hoverCol >= 0 && this.hoverRow >= 0) {
            map.setTile(this.hoverCol, this.hoverRow, this.selectedType);
            console.log(`设置 (${this.hoverCol}, ${this.hoverRow}) 为 ${Terrain[this.selectedType]}`);
        }
    },

    // 保存地图为JSON下载
    saveMap() {
        const map = GameState.map;
        if (!map) return;
        const json = map.toJSON();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'map.json';
        a.click();
        URL.revokeObjectURL(url);
        console.log('地图已保存');
    },

    // 加载地图（通过文件上传）
    loadMap() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const json = JSON.parse(ev.target.result);
                    const map = GameState.map;
                    if (map) {
                        map.loadData(json.data);
                        console.log('地图加载成功');
                    }
                } catch (err) {
                    console.error('加载地图失败', err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    // 渲染编辑器的叠加层（显示网格和当前选中格子）
    drawOverlay(ctx) {
        if (!this.active) return;
        const map = GameState.map;
        if (!map) return;
        const { col, row } = this;
        if (col < 0 || row < 0) return;

        const tileSize = map.tileSize;
        const x = col * tileSize - GameState.camera.x;
        const y = row * tileSize - GameState.camera.y;
        ctx.save();
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, tileSize, tileSize);
        ctx.fillStyle = 'rgba(255,0,0,0.2)';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.restore();
    }
};
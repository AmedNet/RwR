好的！以下是更新后的完整项目说明文档，涵盖了所有新增功能（大地图、友军 AI、夺点机制、地图编辑器）。

---

# 小兵步枪 · 战地夺点版

## 📁 项目概述

这是一个基于 **原生 JavaScript + Canvas** 开发的俯视角战术射击游戏，核心玩法为 **夺点占领 + 小队作战**。游戏包含：

- **超大地图**（最高 4000×4000 像素，可配置）
- **地形系统**（草地、房屋、河流、据点）
- **友军 AI 小队**（随军衔提升自动加入）
- **多据点争夺**（玩家 vs 敌人，实时占领进度）
- **内置地图编辑器**（按 `E` 键进入，支持保存/加载 JSON 地图）
- **毛玻璃 HUD** + **全屏自适应**

---

## 🗂️ 完整目录结构

```
RwR/
├── index.html                  # 游戏入口（全屏 + HUD）
├── config.json                 # 外部配置（已废弃，配置内嵌在 main.js）
├── .gitignore
└── src/
    ├── main.js                 # 游戏启动、配置、初始化、主循环
    ├── core/
    │   ├── EventBus.js         # 事件总线（模块间通信）
    │   ├── GameState.js        # 全局游戏状态（玩家、敌人、队友、据点、地图）
    │   └── Map.js              # 地图类（地形数据、渲染、碰撞检测、编辑器支持）
    ├── entities/
    │   ├── Entity.js           # 实体基类
    │   ├── Player.js           # 玩家类（移动、射击、军衔、与地图交互）
    │   ├── Enemy.js            # 敌人类（AI 攻击最近目标、地图交互）
    │   ├── Teammate.js         # 友军 AI（跟随、攻击、侧移战术）
    │   ├── Bullet.js           # 子弹（阵营、碰撞、抵消）
    │   ├── CapturePoint.js     # 据点类（占领进度、所有者、绘制）
    │   └── Obstacle.js         # 旧障碍物（已废弃，保留兼容）
    ├── systems/
    │   ├── SpawnSystem.js      # 敌人生成（动态难度）
    │   ├── CollisionSystem.js  # 碰撞检测（子弹、实体、地图房屋）
    │   └── MapEditor.js        # 地图编辑器（快捷键、鼠标交互、保存/加载）
    ├── rendering/
    │   ├── Renderer.js         # Canvas 渲染（地图、据点、所有实体、编辑器叠加层）
    │   └── UIManager.js        # HTML UI 更新（军衔、击杀、血量、分数）
    └── input/
        └── InputManager.js     # 键盘/鼠标输入
```

---

## 🎮 核心机制

### 1. 大地图与地形
- 地图由网格构成（默认 80×80 格子，每格 50px = 4000×4000 世界）。
- 四种地形：
  - **草地**（默认，可通行）
  - **房屋**（不可通行，子弹和角色均被阻挡）
  - **河流**（移动速度减半）
  - **据点**（本身可通行，但用于标识据点位置）
- 地图数据可通过编辑器修改，并保存为 JSON 文件。

### 2. 夺点系统
- 地图上预设多个据点（可在 `CONFIG.capturePoints` 调整位置和数量）。
- 玩家、友军或敌人进入据点范围（半径 80px）即可开始占领。
- 占领进度实时变化：
  - 只有我方单位在点内 → 进度增加（100% 时占领）。
  - 只有敌方单位在点内 → 进度减少（0% 时中立）。
  - 双方都在 → 人数多的一方缓慢推进，否则僵持。
  - 无人 → 进度缓慢回归 50%（中立）。
- 占领后我方获得 +10 分，敌人占领则 -5 分。

### 3. 友军 AI 小队
- 每升一级（每 5 击杀）生成 1 个队友，最多 4 个。
- AI 行为：
  - 跟随玩家（保持 100~150 距离）。
  - 自动攻击 350px 内最近的敌人。
  - 环绕射击（侧移机动）。
  - 避开房屋、河流减速、不跑出世界边界。

### 4. 地图编辑器
- 按 **`E`** 键进入/退出编辑模式。
- 按数字键 **`1`~`4`** 选择地形类型：
  - `1` 草地
  - `2` 房屋
  - `3` 河流
  - `4` 据点（仅标记，实际据点由配置决定）
- 点击地图格子即可放置所选地形。
- **`S`** 键 → 下载当前地图为 `map.json`。
- **`L`** 键 → 打开文件选择器，加载 JSON 地图。
- 编辑器覆盖层会高亮当前悬停的格子。

---

## 🎯 操作指南

| 按键 | 功能 |
|------|------|
| `W A S D` | 移动角色 |
| `鼠标左键` / `空格` | 向鼠标方向射击 |
| `R` | 游戏结束后重新开始 |
| `E` | 切换地图编辑器 |
| `1`~`4` | 在编辑模式下选择地形类型 |
| `S` | 保存地图（下载 JSON） |
| `L` | 加载地图（上传 JSON） |

---

## ⚙️ 配置说明（`main.js` 中的 `CONFIG`）

所有可调参数集中在 `CONFIG` 对象中：

```javascript
const CONFIG = {
    player: { health, speed, radius, shootDelay, bulletSpeed, damage },
    enemy: { health, speedMin, speedMax, radius, shootDelayMin, shootDelayMax, damage, spawnBaseRate, maxEnemies },
    teammate: { health, speed, radius, shootDelay, damage, bulletSpeed, maxCount },
    bullet: { radius, life },
    rankUpKills: 5,                 // 每击杀数升一级
    colors: { player, playerStroke, enemyHueMin, enemyHueMax },
    world: { width, height },       // 会自动根据地图尺寸调整
    map: { cols, rows, tileSize }, // 地图格子数
    capturePoints: [               // 据点世界坐标
        { x, y }, ...
    ]
};
```

---

## 🛠️ 技术栈

- **语言**：ES6+ JavaScript
- **渲染**：HTML5 Canvas
- **模块化**：ES Module（原生）
- **无第三方依赖**，纯原生实现
- **存储**：地图数据可导出/导入 JSON，支持 `localStorage` 自动加载（可选）

---

## 🚀 如何运行

1. **使用 HTTP 服务器**（必须）：
   - VS Code + Live Server（推荐）
   - 或 `npx serve`
   - 或 `python -m http.server`

2. 打开 `http://localhost:3000`（或对应端口）。

3. 享受游戏，尝试编辑地图并保存/加载。

---

## 📌 扩展建议

- **新增地形类型**：在 `Map.js` 的 `Terrain` 和 `TERRAIN_COLORS` 中添加。
- **增加地图大小**：调整 `CONFIG.map.cols/rows`，并同步 `world.width/height`。
- **调整据点数量**：修改 `CONFIG.capturePoints` 数组。
- **自定义地图**：使用编辑器制作复杂战场，保存后分享给其他玩家。

---

*文档版本：2.0 | 更新日期：2026-07-03*
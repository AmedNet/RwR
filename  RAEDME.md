
# RwR · 项目结构说明

## 📁 项目概述

这是一个基于 **原生 JavaScript + Canvas** 开发的俯视角射击游戏原型，采用 **ES Module** 模块化架构，配置与代码分离，易于扩展和维护。

---

## 🗂️ 目录结构

```
RwR/
├── index.html                  # 游戏入口页面
├── config.json                 # 外部配置文件（当前未使用，配置已内嵌）
├── .gitignore                  # Git 忽略文件
└── src/                        # 源代码目录
    ├── main.js                 # 游戏启动入口
    ├── core/                   # 核心模块
    │   ├── EventBus.js         # 事件总线（模块间通信）
    │   └── GameState.js        # 全局游戏状态（单例）
    ├── entities/               # 实体类
    │   ├── Entity.js           # 实体基类
    │   ├── Player.js           # 玩家类
    │   ├── Enemy.js            # 敌人类
    │   └── Bullet.js           # 子弹类
    ├── systems/                # 系统模块（逻辑层）
    │   ├── SpawnSystem.js      # 敌人生成系统
    │   └── CollisionSystem.js  # 碰撞检测系统
    ├── rendering/              # 渲染模块（表现层）
    │   ├── Renderer.js         # Canvas 渲染器
    │   └── UIManager.js        # HTML UI 管理器
    └── input/                  # 输入模块
        └── InputManager.js     # 键盘/鼠标输入管理
```

---

## 📦 模块详解

### 1. 入口层
| 文件 | 职责 |
|------|------|
| `index.html` | HTML 结构，包含画布和 UI 元素，加载 `main.js` |
| `main.js` | 配置注入、游戏初始化、主循环、重置逻辑 |

### 2. 核心层 (`core/`)
| 文件 | 职责 |
|------|------|
| `EventBus.js` | 发布/订阅模式，解耦模块通信（如 `player_kill`、`game_over` 事件） |
| `GameState.js` | 全局状态容器，存储玩家、敌人、子弹、输入状态等 |

### 3. 实体层 (`entities/`)
| 文件 | 职责 |
|------|------|
| `Entity.js` | 实体基类，定义位置、血量、速度、`takeDamage` 等通用属性/方法 |
| `Player.js` | 玩家逻辑：移动、射击、军衔、击杀统计 |
| `Enemy.js` | 敌人逻辑：追踪玩家、自动射击、血条显示 |
| `Bullet.js` | 子弹逻辑：飞行、生命周期、阵营（敌/友） |

### 4. 系统层 (`systems/`)
| 文件 | 职责 |
|------|------|
| `SpawnSystem.js` | 控制敌人生成位置、频率，受击杀数影响动态调整 |
| `CollisionSystem.js` | 检测并处理所有碰撞（子弹→实体、实体→实体） |

### 5. 渲染层 (`rendering/`)
| 文件 | 职责 |
|------|------|
| `Renderer.js` | Canvas 绘制：网格、所有实体、游戏结束画面 |
| `UIManager.js` | 更新 HTML 界面元素（军衔、击杀数、血量） |

### 6. 输入层 (`input/`)
| 文件 | 职责 |
|------|------|
| `InputManager.js` | 监听键盘（WASD/空格/R）和鼠标（移动/左键射击） |

---

## 🔄 数据流向

```
用户输入 (InputManager)
        ↓
GameState 更新 (keys/mouse)
        ↓
main.js 游戏循环 (gameLoop)
        ↓
┌─────────────────────────────────────┐
│ 1. Player.update()   - 移动/射击    │
│ 2. SpawnSystem.update() - 生成敌人  │
│ 3. Enemy.update()     - AI 行为     │
│ 4. Bullet.update()    - 子弹飞行    │
│ 5. CollisionSystem.checkAll() - 碰撞│
└─────────────────────────────────────┘
        ↓
EventBus 触发事件 (player_kill / game_over)
        ↓
UIManager / Renderer 更新界面
```

---

## ⚙️ 配置管理

配置统一在 `main.js` 顶部的 `CONFIG` 对象中：

```javascript
const CONFIG = {
    player: { health, speed, radius, shootDelay, bulletSpeed, damage },
    enemy: { health, speedMin, speedMax, radius, shootDelayMin, shootDelayMax, damage, spawnBaseRate, maxEnemies },
    bullet: { radius, life },
    rankUpKills: 5,
    colors: { player, playerStroke, enemyHueMin, enemyHueMax }
};
```

**修改方式**：直接编辑 `CONFIG` 中的数值即可调整游戏平衡性。

---

## 🚀 如何运行

### 方式一：VS Code + Live Server（推荐）
1. 安装 Live Server 插件
2. 右键 `index.html` → **Open with Live Server**

### 方式二：命令行
```bash
# Node.js
npx serve

# Python 3
python -m http.server
```
然后访问 `http://localhost:3000` 或 `http://localhost:8000`

### 方式三：直接双击（需代码内嵌配置）
由于已使用内嵌配置，双击 `index.html` 也能运行（但部分浏览器可能限制模块加载，建议使用 HTTP 服务器）。

---

## 🎮 操作说明

| 按键 | 功能 |
|------|------|
| `W A S D` | 控制角色移动 |
| `鼠标左键` / `空格` | 向鼠标方向射击 |
| `R` | 游戏结束后重新开始 |

---

## 🔧 扩展建议

1. **添加新敌人类型**：在 `CONFIG.enemy` 中定义 `types` 数组，在 `SpawnSystem` 中随机选择
2. **大地图与摄像机**：创建 `Camera` 类，在 `Renderer` 中应用偏移
3. **武器切换**：新增 `WeaponSystem`，在 `Player` 中持有当前武器
4. **友军小队**：创建 `Ally` 类，随军衔提升生成

---

## 📄 技术栈

- 原生 JavaScript (ES6+)
- HTML5 Canvas
- ES Module (原生模块化)
- 无第三方依赖

---

## 📌 注意事项

- 所有 `import` 语句必须带 `.js` 后缀
- 使用 **命名导出** (`export const`) 而非 `export default`
- 必须通过 HTTP 服务器运行（ES Module 限制）

---
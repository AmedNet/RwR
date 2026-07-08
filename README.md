# RwR - 2D 战术射击游戏

仿造小兵步枪（Rise of the Reds）开发的 2D 横版战术射击游戏，基于原生 JavaScript + Canvas 实现。

## 游戏特性

- 🎮 俯视角 2D 战术射击
- 🗺️ 随机生成的地图系统
- 🚩 据点占领机制
- 🔫 丰富的武器系统（手枪、步枪、冲锋枪、霰弹枪、狙击枪、重武器）
- 🤝 AI 队友协作系统
- 💰 军械库购买/出售系统
- 🎯 战术复活点选择
- 💥 粒子特效系统

## 操作说明

| 按键 | 功能 |
|------|------|
| WASD | 移动 |
| 鼠标左键/空格 | 射击 |
| 1-7 | 切换武器 |
| Q | 打开/关闭背包 |
| E | 打开/关闭军械库（需在军械库附近） |
| F | 拾取地面武器 |
| G | 投掷手雷 |
| R | 换弹 |
| K | 自杀 |
| 9+1 | 打开 Debug 面板 |

## 项目结构

```
RwR/
├── index.html                 # 游戏入口页面
├── README.md                  # 项目说明文档
│
└── src/
    ├── main.js                # 游戏主循环和初始化
    │
    ├── core/                  # 核心系统
    │   ├── EventBus.js        # 事件总线
    │   ├── GameState.js       # 游戏状态管理
    │   ├── Map.js             # 地图系统
    │   ├── Weapon.js          # 武器基类
    │   └── WeaponRegistry.js  # 武器注册表
    │
    ├── entities/              # 游戏实体
    │   ├── Entity.js          # 实体基类
    │   ├── Player.js          # 玩家
    │   ├── Enemy.js           # 敌人
    │   ├── Teammate.js        # AI 队友
    │   ├── CombatAI.js        # 战斗 AI 基类
    │   ├── Bullet.js          # 子弹
    │   ├── Grenade.js         # 手雷
    │   ├── CapturePoint.js    # 据点
    │   ├── Arsenal.js         # 军械库
    │   └── WeaponPickup.js    # 地面武器掉落物
    │
    ├── systems/               # 游戏系统
    │   ├── SpawnSystem.js     # 敌人生成系统
    │   └── CollisionSystem.js # 碰撞检测系统
    │
    ├── rendering/             # 渲染系统
    │   ├── Renderer.js        # 主渲染器
    │   ├── UIManager.js       # UI 管理器
    │   ├── WeaponHUD.js       # 武器 HUD
    │   ├── InventoryUI.js     # 背包界面
    │   ├── ArsenalUI.js       # 军械库界面
    │   ├── GameOverUI.js      # 阵亡/战败界面
    │   ├── DebugUI.js         # Debug 面板
    │   └── Minimap.js         # 小地图
    │
    ├── input/                 # 输入系统
    │   └── InputManager.js    # 键盘/鼠标输入处理
    │
    ├── utils/                 # 工具类
    │   ├── EffectsManager.js  # 特效管理器（粒子、血迹等）
    │   ├── MovementSystem.js  # 移动系统（避障、卡住检测）
    │   ├── MapGenerator.js    # 地图生成器
    │   ├── SoundManager.js    # 音效管理
    │   ├── StatusEffects.js   # 状态效果（燃烧、减速等）
    │   └── WeaponAI.js        # AI 武器选择逻辑
    │
    └── pkg/                   # 资源文件
        └── weapon/ ...        # 武器贴图
```

## 运行方式

直接用浏览器打开 `index.html` 即可运行，无需构建工具或服务器。

## 技术栈

- 纯原生 JavaScript (ES6+)
- HTML5 Canvas 2D
- 无外部依赖

## 开发中功能

- [x] 基础射击系统
- [x] 武器切换和拾取
- [x] AI 敌人和队友
- [x] 据点占领机制
- [x] 军械库系统
- [x] 特效系统（粒子、血迹、弹壳）
- [x] 死亡动画
- [x] 战术复活界面
- [ ] 更多武器类型
- [ ] 音效系统完善
- [ ] 关卡系统

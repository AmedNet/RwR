# RwR - 2D 战术射击游戏

仿造小兵步枪（Rise of the Reds）开发的 2D 俯视角战术射击游戏，基于原生 JavaScript + Canvas 实现。

## 游戏特性

### 核心玩法
- 🎮 俯视角 2D 战术射击
- 🗺️ 随机生成的地图系统（草地、森林、河流、房屋、山地、道路、沙地）
- 🚩 据点占领机制（3v3 攻防）
- 🔫 丰富的武器系统（手枪、步枪、冲锋枪、霰弹枪、狙击枪、火箭筒）
- 🤝 AI 队友协作系统（最多 50 人）
- 💰 军械库购买/出售系统
- 🎯 战术复活点选择
- 💥 粒子特效系统（血迹、弹壳、muzzle flash）

### 环境系统
- 🌤️ **18 种天气**：晴天、多云、阴天、小雨、中雨、大雨、雾天、雾雨、小雪、暴风雪、暴风、沙尘暴、暴风雨、冰雹、酸雨、血月、日食、龙卷风
- 🌅 **昼夜循环**：20 分钟完整周期，黎明/黄昏暖色调，深夜深蓝暗调
- 💡 **动态光照**：枪口火焰和爆炸在黑暗中照亮周围
- 🔊 **环境音效**：三层混音（天气 + 昼夜 + 地形），无缝循环播放
- ⚡ **闪电系统**：暴风雨时随机闪电 + 屏幕震动
- 🌪️ **龙卷风**：贝塞尔曲线路径移动，超级单体云体，碎屑云团

### 地形音效
- 🌊 靠近河流时听到水声
- 🌲 进入森林时听到风吹树叶
- 🐦 白天随机鸟叫
- 🦗 夜晚蟋蟀声
- 🦉 深夜猫头鹰叫
- ⛈️ 暴风雨时随机雷声

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

### Debug 面板功能
- 💰 增加 RP（100/500/1000）
- ❤️ 满血
- 🌤️ 切换 18 种天气
- 🌅 昼夜时间滑块（拖拽调整）
- ⏸️ 暂停/继续昼夜循环
- 🔊 环境音效音量滑块

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
    │   ├── WeaponRegistry.js  # 武器注册表
    │   ├── WeatherSystem.js   # 天气系统核心
    │   ├── WeatherDefs.js     # 18 种天气定义
    │   ├── WeatherRenderer.js # 天气渲染逻辑
    │   └── DayNightSystem.js  # 昼夜循环系统
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
    │   ├── SoundManager.js    # 音效管理（Web Audio API）
    │   ├── AmbientSoundManager.js # 环境音效管理（三层混音）
    │   ├── StatusEffects.js   # 状态效果（燃烧、减速等）
    │   └── WeaponAI.js        # AI 武器选择逻辑
    │
    └── pkg/                   # 资源文件
        ├── weapon/            # 武器贴图
        └── sounds/            # 环境音效
            ├── weather/       # 天气音效（雨、风、雷等）
            └── ambient/       # 环境音效（鸟、虫、水等）
```

## 运行方式

直接用浏览器打开 `index.html` 即可运行，无需构建工具或服务器。

## 技术栈

- 纯原生 JavaScript (ES6+)
- HTML5 Canvas 2D
- Web Audio API（程序化合成音效 + 无缝循环环境音）
- 无外部依赖

## 已完成功能

- [x] 基础射击系统
- [x] 武器切换和拾取
- [x] AI 敌人和队友
- [x] 据点占领机制
- [x] 军械库系统
- [x] 特效系统（粒子、血迹、弹壳）
- [x] 死亡动画
- [x] 战术复活界面
- [x] 天气系统（18 种天气 + 过渡动画）
- [x] 昼夜循环系统（动态光照）
- [x] 环境音效系统（三层混音）
- [x] 龙卷风系统（贝塞尔路径 + 超级单体）
- [x] Debug 面板（天气/昼夜/音量控制）

## 开发中功能

- [ ] 更多武器类型
- [ ] 关卡系统
- [ ] 多人联机

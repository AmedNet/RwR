# 工作规范与进度计划 (Work Plan & Rules)

## 铁律 (MUST)

### 1. 提交前强制检查
每次 `git commit` 之前，必须运行以下全部检查，**全部通过才能提交**：

```bash
# 语法检查（所有改动过的 JS 文件）
node --check <file1.js> <file2.js> ...

# 括号平衡检查
python3 -c "
files = ['file1.js', 'file2.js']
for f in files:
    c = open(f).read()
    d = c.count('{') - c.count('}')
    if d: print(f'BRACE MISMATCH {f}: {d}')
"

# import 风格检查
# - import { SoundManager } 是错的 → 应该 import * as SoundManager
# - 每个 import { X } 必须对应目标文件的 export const/function/let X

# git diff --stat 确认改动范围合理
```

### 2. 机械搬运原则
- 用 Python 精确按行号区间抽取代码块，不改原代码逻辑
- `this.xxx` → 参数化（如 `ai.xxx`）
- 方法内 `this.method()` → `ai.method()`（通过传入的实例引用）
- 静态常量引用 `ClassName.CONST` → 搬到新文件的独立常量或 import
- **关键**：搬运后检查残留 `},` —— Renderer 对象的方法分隔符在独立函数文件中必须改成 `}`
- import 保持原风格：`import * as SoundManager` 不能变成 `import { SoundManager }`

### 3. 每阶段独立验证
- 完成后 `git commit`，不跨阶段混改
- 如果浏览器报错，先确认是哪个文件、哪一行、什么 token
- 不确定时停下来问，不猜测
- 不一次动超过 7 个文件
- 改动量和计划预估偏差超过 20% 时停下来报告

---

## 已完成阶段

| 阶段 | 状态 | 提交 | 说明 |
|------|------|------|------|
| 阶段一: EventBus + SpawnSystem + CampaignManager | ✅ | `d1f82db` | +230 行，4 文件 |
| 阶段二: Renderer → SupportEffectRenderer + BubbleRenderer | ✅ | `d8b0c07` | Renderer 2018→738行 |
| 阶段二修复: }, + SoundManager import | ✅ | `66f7c81` | 3 文件修复 |
| 阶段三: CombatAI → VehicleAI.js | ✅ | `28d4d39` | CombatAI 1679→1347行 |
| 阶段四: InputManager 拆解 | ✅ | `055857a` | +6 handler 文件, 973+/857- |
| 阶段五: GameConfig + SupportConfig 分离 | ✅ | `79ca9df` | +2 data 文件, 255- 行 |
| 阶段六: main.js 整理 | ✅ | `68bdc82` | +6行注释, 剧情占位 + 分区头 |
| 阶段七: WeatherRenderer 移动 | ✅ | `9eef69a` | src/core/ → src/rendering/, 2文件 |
| 阶段八: EffectsManager/SoundManager 评估 | ✅ | 不拆分 | 内部状态耦合，拆分收益有限 |

---

## 剩余阶段

无（全部阶段已完成或评估）

---

## src/campaign/ 蓝图

```
src/campaign/
  CampaignManager.js   — 状态机: idle → briefing → playing → victory/defeat
  MissionData.js       — 关卡数据类结构 + 触发器/动作枚举
  TriggerSystem.js     — 基于 EventBus.once 的触发器链 (待建)
  MissionScript.js     — 具体关卡脚本 (待建)
  CampaignProgress.js  — localStorage 存档/读档 (待建)
```

---

## 已修复的已知错误

1. **`SupportEffectRenderer.js` / `BubbleRenderer.js` — `},` 残留** (已修复 `66f7c81`)
   - 搬运自 Renderer 对象的方法分隔符 `},` 在独立 `export function` 中变成语法错误
   - 修复：所有 `},` → `}`
2. **`VehicleAI.js` — SoundManager import 错误** (已修复 `66f7c81`)
   - `import { SoundManager }` → `import * as SoundManager`
   - SoundManager.js 导出的是命名函数集合，不是单个对象
---
---
---

# DotsUI

<B><VT>生成时间：</VT></B> 2026-06-14
<B><VT>研究主题：</VT></B> DOTS 与 UI Toolkit 集成样例
<B><VT>分析范围：</VT></B> `EntityComponentSystemSamples-master/Dots101/OtherSamples/DotsUI`
<B><VT>结论状态：</VT></B> 初步分析

---

## 总览

`DotsUI` 是 `Dots101/OtherSamples` 下的 UI 集成样例，主题是“Entities 游戏逻辑如何和 UI Toolkit 协作”。它不是 UI Toolkit 基础教程，也不是纯 ECS 教程，而是把 ECS gameplay、ScriptableObject 配置、UI Toolkit screen wrapper 和事件实体串起来。

样例玩法是玩家控制 wizard 收集材料做 soup。ECS 负责游戏状态、移动、任务、拾取和事件；UI Toolkit 负责 HUD、背包、对话、提示和任务显示。

---

## 资料来源

- `Dots101/OtherSamples/DotsUI/ProjectSettings/ProjectVersion.txt`：Unity `6000.2.10f1`。
- `Dots101/OtherSamples/DotsUI/Packages/manifest.json`：显式依赖 `com.unity.entities.graphics 1.4.16`、`com.unity.physics 1.4.3`、URP `17.2.0` 和 UI 相关内置模块。
- `Dots101/OtherSamples/DotsUI/Assets/README.md`
- `Dots101/OtherSamples/DotsUI/Assets/Scripts/Gameplay/*.cs`
- `Dots101/OtherSamples/DotsUI/Assets/Scripts/UI/*.cs`
- `Dots101/OtherSamples/DotsUI/Assets/Scenes/Main.unity`

---

## 结构地图

```text
DotsUI/
  Assets/
    Scenes/
      Main.unity
      MainSubscene/
    Scripts/
      Gameplay/
      ScriptableObjects/
      UI/
```

核心模块：

- `Gameplay`：ECS component、system、输入、任务、事件和 UI 协调。
- `ScriptableObjects`：收集物、对话和任务数据。
- `UI`：对 UI Toolkit 视觉元素的封装。

---

## 关键发现

- <B>发现：</B>UI 事件通过 entity 进入 ECS 世界。
- <B>依据：</B>README 说明 `UIScreen` 持有 `EntityCommandBuffer`，点击按钮时记录事件实体；`EventSystem` 每帧播放 command buffer。
- <B>影响：</B>这是一种让 UI Toolkit 与 ECS 低耦合协作的模式。

- <B>发现：</B>`UISystem` 是界面状态机。
- <B>依据：</B>`UISystem.cs` 根据 `GameData.InterfaceState` 切换 Help、Inventory、Quest、HUD 等 screen 的显示状态。
- <B>影响：</B>实战中可以把 UI 视觉切换留给 UI wrapper，把状态判断留在 ECS system。

- <B>发现：</B>`UIScreen` 继承 `ScriptableObject` 是为了被 `UnityObjectRef` 存储。
- <B>依据：</B>`UIScreen.cs` 注释说明它作为 UI element 基类，继承 ScriptableObject 以便实例被存在 `UnityObjectRef` 中。
- <B>影响：</B>这提示了 Entities 与 UnityEngine 对象协作时的一种可控边界。

---

## 分项分析

### Gameplay 层

`Gameplay` 下的系统包含：

- `GameManagerSystem`：控制宏观游戏状态，状态存在 `GameData` singleton component。
- `GameInput`：集中初始化和读取 InputAction。
- `PlayerMovementSystem`：玩家是 dynamic rigidbody，通过 `PhysicsVelocity` 控制运动。
- `CameraFollowSystem`：相机跟随玩家。
- `QuestSystem`：处理材料拾取、HUD 更新和交任务。
- `EnergyBallSystem`：处理 energy ball 的靠近、吸附和环绕。

这层说明 ECS 仍然适合管理玩法状态和高频逻辑。

### UI 层

`UI` 下每个 screen wrapper 对应一个 UI Toolkit 界面元素。`UIScreen` 提供 `Show()` 和 `Hide()`，通过 class list、display 和 enable 状态控制显示。

具体 UI 包括：

- `DialogueScreen`
- `HelpScreen`
- `HintScreen`
- `HUDScreen`
- `InventoryScreen`
- `InventorySlot`
- `QuestScreen`
- `SplashScreen`

这些类不是 ECS component，而是 UnityEngine/UIToolkit 层对象，被 ECS 系统间接驱动。

### 事件桥接

UI 点击不会直接改 ECS 状态，而是创建事件实体。`EventSystem` 做三件事：清理上一帧事件、播放 screen 的 `EntityCommandBuffer`、创建新的 command buffer。`UISystem` 再查询事件实体并修改 `GameData.InterfaceState`。

这条路径清晰地区分了“UI 输入发生”和“游戏状态改变”，比在按钮回调里直接改一堆 ECS 数据更可控。

---

## 风险与限制

- 这个样例要求同时懂 UI Toolkit 和 Entities；如果两边都不熟，会比 `HelloCube` 难读。
- 它展示的是集成模式，不是 UI 架构唯一答案。
- UI 对象、ScriptableObject 和 UnityObjectRef 的边界需要谨慎管理，避免把大量托管对象塞进高频 ECS 逻辑。

---

## 后续行动

- 先读 `UIScreen.cs`、`EventSystem.cs`、`UISystem.cs`，理解 UI 到 ECS 的事件桥。
- 再读 `QuestSystem.cs`，看 gameplay 如何触发 UI 更新。
- 如果要做实际项目，可把这个模式提炼成“UI event entity + screen wrapper + ECS state machine”模板。

---

## 关联笔记

- [Dots101 总览](../EntityComponentSystemSamples_Dots101.md)
- [Entities101](./Entities101.md)

---
---
---

# Physics101

<B><VT>生成时间：</VT></B> 2026-06-14
<B><VT>研究主题：</VT></B> Unity Physics 101 样例工程
<B><VT>分析范围：</VT></B> `EntityComponentSystemSamples-master/Dots101/Physics101`
<B><VT>结论状态：</VT></B> 初步分析

---

## 总览

`Physics101` 是 Unity Physics 的入门项目，规模比完整 `PhysicsSamples` 小，更适合先理解“ECS 世界里的物理组件和系统如何驱动玩法”。它包含若干小场景：压力板、搅拌机、破砖、电梯、重力井、激光视线、Pachinko 和布娃娃式 stickman drop。

这个工程的重点不是罗列所有物理 API，而是把常见玩法需求翻译成 ECS 数据：刚体速度、碰撞体、触发区域、射线检测、碰撞过滤、compound collider、浮力区和固定步长系统。

---

## 资料来源

- `Dots101/Physics101/ProjectSettings/ProjectVersion.txt`：Unity `6000.2.10f1`。
- `Dots101/Physics101/Packages/manifest.json`：显式依赖 `com.unity.physics 1.4.3`、`com.unity.entities.graphics 1.4.16` 和 URP `17.2.0`。
- `Dots101/Physics101/Assets` 下递归 Unity 场景：确认样例场景。
- `Dots101/Physics101/Assets/GravityWell/GravityWellSystem.cs`
- `Dots101/Physics101/Assets/LaserSight/LaserSystem.cs`
- `Dots101/Physics101/Assets/ActivationPlates/*.cs`
- `Dots101/Physics101/Assets/Blender/*.cs`
- `Dots101/Physics101/Assets/BreakingBricks/*.cs`

---

## 结构地图

```text
Physics101/
  Assets/
    ActivationPlates/
    Blender/
    BreakingBricks/
    Elevator/
    GravityWell/
    LaserSight/
    Pachinko/
    Pachinko (collision filter)/
    Pachinko (compound colliders)/
    StickmanDrop/
```

每个主题通常包含一个主场景和一个 SubScene。主场景负责 Unity 入口和展示，SubScene 负责被 baking 成实体。

---

## 关键发现

- <B>发现：</B>`Physics101` 是玩法式物理入门，而不是完整测试库。
- <B>依据：</B>场景目录都以具体交互命名，例如 `ActivationPlates`、`BreakingBricks`、`GravityWell`、`LaserSight`。
- <B>影响：</B>先用它理解物理概念，再去完整 `PhysicsSamples` 查边界案例更顺。

- <B>发现：</B>示例强调“物理查询”和“物理响应”两类不同用法。
- <B>依据：</B>`LaserSight/LaserSystem.cs` 使用物理世界 cast 检测命中；`GravityWell`、`BreakingBricks`、`Elevator` 等更偏向对刚体速度、位置或碰撞行为施加影响。
- <B>影响：</B>写实战系统时要先判断是 query 驱动还是 simulation 驱动。

- <B>发现：</B>`Pachinko` 拆成普通、collision filter、compound colliders 三个版本。
- <B>依据：</B>场景目录中存在 `Pachinko`、`Pachinko (collision filter)`、`Pachinko (compound colliders)`。
- <B>影响：</B>这是学习 collision filter 和 collider 组合建模的自然对照组。

---

## 分项分析

### ActivationPlates

这个样例围绕区域触发和玩家交互展开。脚本包含 `ActivationSystem`、`PlayerSystem`、`ZoneAuthoring`、`PlayerAuthoring` 和 `ConfigAuthoring`。它适合理解 trigger-like 玩法如何以组件和系统表达。

实战对应场景包括机关、压力板、区域门、任务触发器和可进入范围检测。

### Blender

`Blender` 同时包含 blade 和 buoyancy 相关脚本：`RotateBladeSystem`、`BuoyancySystem`、`BuoyancyZoneSystem`。它适合观察旋转物体、浮力区域和实体受力之间的组合。

这个样例说明 Unity Physics 入门不只看碰撞，也要看“区域影响 + 系统改写物理相关组件”的模式。

### BreakingBricks

`BreakingBricks` 包含 ball、brick 和 config authoring，以及 `BallSystem`、`BrickSystem`。它像一个小型打砖块物理玩法，用于理解碰撞响应、生命周期和对象状态变化。

### GravityWell

`GravityWell` 以重力井为中心影响小球。源码中有 `GravityWellSystem`、`BallSpawnSystem`、`BallAuthoring`、`GravityWellAuthoring`。这个样例很适合学习“非真实物理但由 ECS 系统施加力场”的写法。

### LaserSight

`LaserSight` 通过系统读取玩家位置并更新 LineRenderer。它体现了一个混合边界：物理检测来自 ECS/Physics 数据，线条表现仍通过 GameObject 组件输出。

这种模式在调试可视化、瞄准线、选取检测中很常见。

### Pachinko 系列

三个 Pachinko 场景是碰撞体建模的对照：

- 普通 Pachinko：基础碰撞和弹跳。
- Collision filter：学习碰撞过滤层。
- Compound colliders：学习复合碰撞体表达。

---

## 风险与限制

- `Physics101` 本身缺少像 `Jobs101` 那样集中的 README，很多判断来自目录、场景和脚本名。
- 没有运行 Unity Physics Debug Display，因此没有验证每个场景的实时表现。
- 更完整的关节、性能、character controller 和边界测试应查 `PhysicsSamples`，不要误以为 `Physics101` 已覆盖全部。

---

## 后续行动

- 先运行 `GravityWell` 和 `LaserSight`，它们分别代表 simulation influence 和 physics query。
- 再看三个 `Pachinko`，建立 collider、filter、compound collider 的差异。
- 想继续深入时，迁移到完整 `PhysicsSamples` 的 `JointTest`、`CharacterController`、`TriggerEvents` 和 `Performance`。

---

## 关联笔记

- [Dots101 总览](../EntityComponentSystemSamples_Dots101.md)
- [Entities101](./Entities101.md)

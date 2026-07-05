---
---
---

# Entities101

<B><VT>生成时间：</VT></B> 2026-06-14
<B><VT>研究主题：</VT></B> Unity Entities 101 样例工程
<B><VT>分析范围：</VT></B> `EntityComponentSystemSamples-master/Dots101/Entities101`
<B><VT>结论状态：</VT></B> 初步分析

---

## 总览

`Entities101` 是 `Dots101` 中最核心的 ECS 入门工程。它不是单个教程，而是一组由浅入深的小样例：`HelloCube` 讲 API 基础，`Kickball` 讲一个小玩法如何逐步 ECS 化，`Tornado` 展示高性能模拟，`Firefighters` 展示更完整的游戏逻辑拆分。

如果只选一个 101 工程深入，优先选 `Entities101`。它覆盖了 DOTS 开发中最常见的概念：Baking、SubScene、singleton component、`ISystem`、`SystemAPI.Query`、`IJobEntity`、`IJobChunk`、Entity prefab、状态变化、空间查询和少量 GameObject 协作。

---

## 资料来源

- `Dots101/Entities101/ProjectSettings/ProjectVersion.txt`：Unity `6000.2.10f1`。
- `Dots101/Entities101/Packages/manifest.json`：显式依赖 `com.unity.entities.graphics 1.4.16` 和 URP `17.2.0`。
- `Dots101/Entities101/Assets/HelloCube/README.md`
- `Dots101/Entities101/Assets/Kickball/README.md`
- `Dots101/Entities101/Assets/Tornado/README.md`
- `Dots101/Entities101/Assets/Firefighters/README.md`
- `Dots101/Entities101/Assets/HelloCube/*/*.cs`
- `Dots101/Entities101/Assets/Kickball/*/*.cs`
- `Dots101/Entities101/Assets/Tornado/*.cs`

---

## 结构地图

```text
Entities101/
  Assets/
    HelloCube/
    Kickball/
    Tornado/
    Firefighters/
    SceneDependencyCache/
    Settings/
```

主要场景群：

- `HelloCube`：15 个小样例，逐个展示 Entities API。
- `Kickball`：5 个 step，从障碍物生成到玩家、球、并行 Job 和携带/踢球逻辑。
- `Tornado`：固定步长的大量点和杆模拟。
- `Firefighters`：以灭火主题组织的多 step gameplay 样例。

---

## 关键发现

- <B>发现：</B>`HelloCube` 是 API 图谱，不是一个单一玩法。
- <B>依据：</B>README 按 MainThread、IJobEntity、Prefabs、IJobChunk、Reparenting、EnableableComponents、GameObjectSync、CrossQuery、RandomSpawn 等小主题拆分。
- <B>影响：</B>查 API 用法时可以把 `HelloCube` 当索引，而不是按线性教程读完。

- <B>发现：</B>`Kickball` 是最适合跟写的 ECS 教程。
- <B>依据：</B>README 以 Step 1 到 Step 5 组织，代码从 `ConfigAuthoring`、`ObstacleSpawnerSystem` 逐步扩展到玩家、球、并行 Job 和携带/踢球。
- <B>影响：</B>想理解 Baking、SubScene 和运行时 Entity prefab，优先看 Kickball。

- <B>发现：</B>`Tornado` 刻意不把所有数据都建成 Entity。
- <B>依据：</B>README 说明 points 存在数组里，bar 和 cube 以 entity 渲染；`BuildingSystem` 使用 `NativeArray`、`IJobParallelFor`、`IJobChunk` 和固定步长。
- <B>影响：</B>Entities 不是“万物 Entity”。对稳定索引、高密度模拟数据，数组可能更合适。

---

## 分项分析

### HelloCube

`HelloCube` 适合作为 API 查表。它从最简单的 `SystemAPI.Query<RefRW<LocalTransform>, RefRO<RotationSpeed>>()` 开始，然后展示如何把同一逻辑迁移到 `IJobEntity` 和 `IJobChunk`。

其中 `1. MainThread/RotationSystem.cs` 展示主线程 query 写法；`2. IJobEntity/RotationSystem.cs` 展示通过 job 的 `Execute` 参数生成隐式 query；`4. IJobChunk/RotationSystem.cs` 展示手动构建 query、获取 `ComponentTypeHandle` 和显式维护 `state.Dependency`。

值得特别标记的小主题：

- `Prefabs`：运行时实例化 Entity prefab。
- `EnableableComponents`：用 enable/disable 表示状态，而不一定做结构变化。
- `GameObjectSync`：Entity 逻辑驱动 GameObject 显示。
- `CrossQuery`：两个查询之间做交叉比较。
- `RandomSpawn`：并行生成时随机种子的处理。
- `ClosestTarget`：从无空间分区到简单分区和 KD Tree。
- `UnityObjectRef`：Entity 逻辑引用 UnityEngine 对象的边界案例。

### Kickball

`Kickball` 更像一个最小玩法切片。Step 1 讲障碍物生成：`ConfigAuthoring` 在 baking 中生成 `Config` singleton，`ObstacleSpawnerSystem` 通过 `state.RequireForUpdate<Config>()` 等待场景实体就绪，然后一次性实例化障碍物 prefab。

Step 2 到 Step 3 增加玩家移动、球生成、球移动和踢球。Step 4 把较重逻辑搬进 `IJobEntity` 并 `ScheduleParallel()`。Step 5 继续扩展携带和踢球语义。

这个教程对实战最有用的不是球类玩法本身，而是它展示了一条典型 ECS 路线：Authoring/Baker 准备数据，SubScene 提供初始 entity，System 按组件筛选并推进游戏规则。

### Tornado

`Tornado` 是性能和数据建模样例。建筑由 points 和 bars 组成，tornado 由 cube 粒子组成。点数据放在 unmanaged arrays 里，杆和渲染对象以 entities 参与渲染和 chunk 处理。

`BuildingSystem` 更新在 `FixedStepSimulationSystemGroup`，先用 `PointUpdateJob` 并行更新点，再按 `BarCluster` 分组调度 `BarUpdateJob` 处理约束和断裂。这种设计强调固定 tick、内存布局、引用大小和约束求解顺序。

这篇适合在学完基础 API 后看，因为它体现了 DOTS 的工程判断：不是把所有逻辑都拆成小组件就完事，而是根据数据访问模式选择 entity、array、shared component 和 job 组合。

### Firefighters

`Firefighters` 从文件结构看是 Step 1 到 Step 4 的 gameplay 教程。脚本包括 `SpawnSystem`、`HeatSystem`、`BotSystem`、`BucketSystem`、`LineSystem`、`AnimationSystem`、`UISystem` 等。

它比 `Kickball` 更接近“有流程的游戏系统”：地图格子、火势、机器人、桶、线条、动画和 UI 分步骤加入。适合后续专门研究 ECS gameplay 分层。

---

## 风险与限制

- `Entities101` 的 README 分散在多个样例目录，没有一个总 README；需要通过目录和场景清单组合理解。
- `manifest.json` 显式列出的是 `entities.graphics`，Entities 核心包可能由依赖链带入；笔记不把它写成直接显式依赖。
- 本分析没有运行场景和 profiler，只基于源码和 README。

---

## 后续行动

- 想快速上手：先看 `HelloCube/1`、`HelloCube/2`、`HelloCube/3`、`Kickball/Step 1`。
- 想理解高性能模拟：看 `Tornado/BuildingSystem.cs` 和 `Tornado/README.md`。
- 想理解状态表达：看 `HelloCube/13. StateChange`，对比 enableable、结构变化和 value change。

---

## 关联笔记

- [Dots101 总览](../EntityComponentSystemSamples_Dots101.md)
- [Jobs101](./Jobs101.md)
- [Physics101](./Physics101.md)

---
---
---

# EntityComponentSystemSamples Dots101

<B><VT>生成时间：</VT></B> 2026-06-14
<B><VT>研究主题：</VT></B> Unity DOTS Samples 中 Dots101 入门工程组
<B><VT>分析范围：</VT></B> `EntityComponentSystemSamples-master/Dots101`
<B><VT>结论状态：</VT></B> 初步分析

---

## 总览

`Dots101` 是 Unity DOTS Samples 中面向入门学习的工程组，不是一个单一 Unity 工程，而是 6 个可以分别打开的 Unity 项目。它覆盖从 Job System、Entities、Physics、Netcode、Content Management 到 UI Toolkit 集成的学习路径。

这组内容适合按“先数据并行，再 ECS，再物理，再网络，再内容加载，最后 UI 集成”的顺序阅读。每个子工程都围绕一个小而完整的场景展开，目标不是做完整游戏，而是把 DOTS 包的核心概念拆成可以逐步验证的样例。

---

## 资料来源

- `README.md`：确认 DOTS Samples 总体定位、Unity 6.2 和 DOTS 1.4 系列背景。
- `Dots101/*/ProjectSettings/ProjectVersion.txt`：确认每个 101 工程的 Unity 版本。
- `Dots101/*/Packages/manifest.json`：确认每个工程显式依赖的 DOTS 包。
- `Dots101` 下递归 README：确认各子工程的教程目标和场景说明。
- `Dots101` 下递归 Unity 场景：确认每个子工程的场景组织方式。
- `Dots101` 下递归 C# 脚本：确认关键系统、Authoring、Baker 和运行时逻辑。

---

## 结构地图

```text
Dots101/
  Jobs101/
  Entities101/
  Physics101/
  Netcode101/
  ContentManagement101/
  OtherSamples/
    DotsUI/
```

6 个工程都带有独立的 `ProjectSettings/` 和 `Packages/`，因此应该分别作为 Unity 项目打开，而不是从 `Dots101` 根目录打开。

---

## 子工程概览

- [Jobs101](./EntityComponentSystemSamples_Dots101/Jobs101.md)：从普通 MonoBehaviour 逐步迁移到 Burst + Job，并引入并行和排序优化。
- [Entities101](./EntityComponentSystemSamples_Dots101/Entities101.md)：Entities API 入门主线，覆盖 Baking、System、IJobEntity、IJobChunk、Prefab、SubScene、状态变化和空间查询。
- [Physics101](./EntityComponentSystemSamples_Dots101/Physics101.md)：Unity Physics 入门样例，覆盖碰撞、触发、查询、关节式玩法、浮力和刚体控制。
- [Netcode101](./EntityComponentSystemSamples_Dots101/Netcode101.md)：Netcode for Entities 的 Kickball 入门版本，展示 client/server world、ghost、输入同步和预测式玩法基础。
- [ContentManagement101](./EntityComponentSystemSamples_Dots101/ContentManagement101.md)：Content Management API 入门，重点是 weak object / weak scene reference 和本地、远程内容加载。
- [DotsUI](./EntityComponentSystemSamples_Dots101/DotsUI.md)：UI Toolkit 与 Entities 的集成样例，展示 ECS 游戏逻辑如何驱动 HUD、背包、对话和任务 UI。

---

## 学习路线

1. 先看 [Jobs101](./EntityComponentSystemSamples_Dots101/Jobs101.md)，理解数据搬进 `NativeArray`、Job 调度、Burst 编译和依赖关系。
2. 再看 [Entities101](./EntityComponentSystemSamples_Dots101/Entities101.md)，把 Job 思维接到 Entity、Component、System、Baking 和 SubScene。
3. 接着看 [Physics101](./EntityComponentSystemSamples_Dots101/Physics101.md)，理解 Unity Physics 在 ECS 世界里的组件化输入和系统更新方式。
4. 然后看 [Netcode101](./EntityComponentSystemSamples_Dots101/Netcode101.md)，理解多人世界拆分、输入、RPC/ghost 的基本模型。
5. 再看 [ContentManagement101](./EntityComponentSystemSamples_Dots101/ContentManagement101.md)，补上运行时内容加载和场景引用。
6. 最后看 [DotsUI](./EntityComponentSystemSamples_Dots101/DotsUI.md)，理解 UI Toolkit 如何通过事件实体和 singleton 与 ECS 逻辑协作。

---

## 关键发现

- <B>发现：</B>`Dots101` 是学习路径，不是包级完整样例库。
- <B>依据：</B>根 README 将 `Dots101` 标为 DOTS 101 starter material，且每个子目录都有独立 Unity 工程结构。
- <B>影响：</B>阅读时不要一次性打开根目录；应按子工程逐个打开和运行。

- <B>发现：</B>大部分 101 工程使用 Unity `6000.2.10f1`，`ContentManagement101` 使用 `6000.2.11f1`。
- <B>依据：</B>各工程 `ProjectSettings/ProjectVersion.txt`。
- <B>影响：</B>如果本机 Unity 版本不同，打开时可能触发升级；最好先复制或用版本匹配的 Editor 打开。

- <B>发现：</B>101 工程不是都显式依赖 `com.unity.entities`。
- <B>依据：</B>`Jobs101` 只显式依赖 URP 等常规包；`Entities101` 显式依赖 `com.unity.entities.graphics`；`Physics101` 显式依赖 `com.unity.physics` 和 Entities Graphics。
- <B>影响：</B>学习 DOTS 时要区分“Job System 教程”和“Entities 工程”；Job System 不是 ECS 专属。

---

## 风险与限制

- 本分析基于本地文件只读研究，没有在 Unity Editor 中实际打开场景运行。
- 未覆盖完整 `EntitiesSamples`、`PhysicsSamples`、`NetcodeSamples` 和 `GraphicsSamples`，这里只分析 `Dots101`。
- 部分 README 很长，笔记保留结构和关键结论，不逐字迁移教程正文。

---

## 后续行动

- 如果要深入代码，可优先展开 `Entities101/HelloCube` 和 `Entities101/Kickball`，它们是后续所有 DOTS 样例的概念骨架。
- 如果目标是做 DOTS 游戏原型，建议追加一篇“Dots101 到实战工程的迁移路线”。
- 如果目标是 Netcode，建议后续单独研究 `NetcodeSamples/HelloNetcode` 和 `NetcodeSamples/NetCube`。

---

## 关联笔记

- [AIGEN 笔记索引](../___AIGEN___.md)

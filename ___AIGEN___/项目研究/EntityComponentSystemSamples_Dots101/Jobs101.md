---
---
---

# Jobs101

<B><VT>生成时间：</VT></B> 2026-06-14
<B><VT>研究主题：</VT></B> Unity Job System 101 样例
<B><VT>分析范围：</VT></B> `EntityComponentSystemSamples-master/Dots101/Jobs101`
<B><VT>结论状态：</VT></B> 初步分析

---

## 总览

`Jobs101` 是 DOTS 学习路线中最底层的一块：它不先讲 Entity，而是先让读者看到“把大量重复计算从 GameObject/MonoBehaviour 主线程代码迁移到 Burst + Job”会带来什么变化。

核心样例是 `TargetsAndSeekers`：大量 seeker 和 target 在平面上移动，每个 seeker 要找最近 target 并画线。教程用 4 个阶段逐步展示普通循环、单线程 Job、并行 Job、排序优化之间的性能差异。

---

## 资料来源

- `Dots101/Jobs101/ProjectSettings/ProjectVersion.txt`：Unity `6000.2.10f1`。
- `Dots101/Jobs101/Packages/manifest.json`：显式依赖包含 URP `17.2.0`，没有显式依赖 Entities 包。
- `Dots101/Jobs101/Assets/TargetsAndSeekers/README.md`：教程说明和性能数据。
- `Dots101/Jobs101/Assets/TargetsAndSeekers/Step 1/FindNearest.cs`
- `Dots101/Jobs101/Assets/TargetsAndSeekers/Step 2/FindNearestJob.cs`
- `Dots101/Jobs101/Assets/TargetsAndSeekers/Step 3/FindNearestJob.cs`
- `Dots101/Jobs101/Assets/TargetsAndSeekers/Step 4/FindNearestJob.cs`

---

## 结构地图

```text
Jobs101/
  Assets/
    TargetsAndSeekers/
      Step 1/
      Step 2/
      Step 3/
      Step 4/
```

场景对应关系：

- `Step1_NoJobs.unity`：纯 MonoBehaviour 解法。
- `Step2_SingleThreadedJob.unity`：单线程 Job + Burst。
- `Step3_ParallelJob.unity`：`IJobParallelFor` 并行。
- `Step4_ParallelJob_Sorting.unity`：排序后减少搜索范围。

---

## 关键发现

- <B>发现：</B>教程的目标不是“把 GameObject 改成 Entity”，而是先讲 Job System 的数据边界。
- <B>依据：</B>`manifest.json` 没有显式 Entities 依赖，Step 1 到 Step 4 都围绕 Transform、NativeArray 和 Job 展开。
- <B>影响：</B>学习时应关注“托管对象不能直接进 Burst Job，所以要把 Transform 数据拷贝到 unmanaged collection”。

- <B>发现：</B>性能提升分成两类：执行模型优化和算法优化。
- <B>依据：</B>README 中 Step 2 通过 Burst 将 1000 x 1000 搜索从约 330ms 降到约 1.5ms；Step 4 又通过排序把 10000 x 10000 搜索的查询成本大幅降低。
- <B>影响：</B>DOTS 不是只靠多线程，数据结构和算法仍然是核心。

- <B>发现：</B>Job 依赖是本教程最后一个关键点。
- <B>依据：</B>Step 4 中排序 Job 必须作为 Find Job 的 dependency，否则安全检查会阻止并发读写同一数据。
- <B>影响：</B>后续学习 Entities 的 `state.Dependency`、`ScheduleParallel` 和系统间依赖时，这里是前置概念。

---

## 分项分析

### Step 1：无 Job

Step 1 保持普通 Unity 写法：`Spawner` 创建 seeker 和 target，`FindNearest` 在每个 seeker 上逐个遍历 target。这个阶段故意保留低效，目的是把 O(N x M) 搜索问题暴露出来。

这个阶段的重点不是语法，而是对照：GameObject 组件访问、Transform 数组、每个对象各自 Update，在数量放大时会很快吃满主线程。

### Step 2：单线程 Job

Step 2 将位置数据复制进 `NativeArray<float3>`，再用 `IJob` 执行查找。它展示了 Job 的基本边界：Job 字段就是输入输出数据，托管对象和 GameObject 组件不能直接放进 Burst 编译的执行体里。

这个阶段即使仍然是单线程，也因为 Burst 和连续内存数据取得明显收益。

### Step 3：并行 Job

Step 3 把 `IJob` 改成 `IJobParallelFor`，每个 seeker 的最近 target 查询可以按 index 分批执行。这里适合观察 batch size、worker thread 和 main thread 等待之间的关系。

它展示的是“工作可拆分时才适合并行”。如果每个 index 之间存在写冲突或依赖，就不能简单改成并行。

### Step 4：排序优化

Step 4 先按 X 坐标排序 target，再用二分和局部扩张减少候选 target。这里的重点是：并行之外，还可以通过数据预处理降低算法复杂度。

排序本身也通过 `SortJob()` 调度，形成 `SegmentSort`、`SegmentSortMerge`、`FindNearestJob` 的依赖链。

---

## 风险与限制

- 本样例仍然使用 GameObject 渲染和 Transform，最后 README 也指出帧时间会被 GameObject 低效部分吃掉。
- 这里展示的 spatial partitioning 是教学用简化方案，不等价于通用生产级空间索引。
- 数据每帧从 Transform 拷贝到 NativeArray 有成本，后续 Entities 样例会进一步消除这类桥接成本。

---

## 后续行动

- 看完本篇后，接 [Entities101](./Entities101.md) 的 `HelloCube`，理解同样的 Job 思维如何进入 ECS System。
- 对比 `Entities101/HelloCube/14. ClosestTarget`，那里把最近目标搜索放进 Entity 查询和 KD Tree 语境中。
- 实战时要同时问两个问题：能否并行，以及是否需要换数据结构。

---

## 关联笔记

- [Dots101 总览](../EntityComponentSystemSamples_Dots101.md)
- [Entities101](./Entities101.md)

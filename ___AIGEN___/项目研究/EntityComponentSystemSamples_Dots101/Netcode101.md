---
---
---

# Netcode101

<B><VT>生成时间：</VT></B> 2026-06-14
<B><VT>研究主题：</VT></B> Netcode for Entities 101 Kickball 样例
<B><VT>分析范围：</VT></B> `EntityComponentSystemSamples-master/Dots101/Netcode101`
<B><VT>结论状态：</VT></B> 初步分析

---

## 总览

`Netcode101` 是 `Entities101/Kickball` 的网络化入门变体。它把一个本地 ECS 小玩法放进 Netcode for Entities 的 client/server world 模型里，展示自动连接、玩家输入、ball/obstacle/player 同步，以及服务器权威玩法的基本形状。

这个工程适合在已经理解 `Entities101/Kickball` 后阅读。否则会同时遇到 ECS、Physics 和 Netcode 三套概念，认知负担会比较重。

---

## 资料来源

- `Dots101/Netcode101/ProjectSettings/ProjectVersion.txt`：Unity `6000.2.10f1`。
- `Dots101/Netcode101/Packages/manifest.json`：显式依赖 `com.unity.netcode 1.9.2`、`com.unity.physics 1.4.3`、`com.unity.entities.graphics 1.4.16`、`com.unity.logging 1.3.10` 和 URP `17.2.0`。
- `Dots101/Netcode101/Assets/Kickball.unity`
- `Dots101/Netcode101/Assets/Subscenes/KickballSubscene.unity`
- `Dots101/Netcode101/Assets/Scripts/GameBootstrap.cs`
- `Dots101/Netcode101/Assets/Systems/*.cs`
- `Dots101/Netcode101/Assets/Authoring/*.cs`

---

## 结构地图

```text
Netcode101/
  Assets/
    Authoring/
    Materials/
    Prefabs/
    Scripts/
    Subscenes/
    Systems/
    Kickball.unity
```

关键脚本：

- `GameBootstrap.cs`：继承 `ClientServerBootstrap`，设置 `AutoConnectPort = 7979` 并创建 client/server worlds。
- `PlayerInputSystem.cs`：运行在 `GhostInputSystemGroup`，只写本地玩家的 `PlayerInput`。
- `GoInGameClientSystem.cs` / `GoInGameServerSystem.cs`：处理进入游戏流程。
- `ObstacleSpawnerSystem.cs`、`BallSpawnerSystem.cs`、`PlayerMovementSystem.cs`、`BallKickingSystem.cs`：玩法系统。

---

## 关键发现

- <B>发现：</B>`Netcode101` 使用自定义 bootstrap 自动创建网络世界。
- <B>依据：</B>`GameBootstrap.cs` 继承 `ClientServerBootstrap`，设置 `AutoConnectPort = 7979`。
- <B>影响：</B>运行样例时要意识到 Editor 中可能同时存在 client 和 server world，而不是普通单世界 ECS。

- <B>发现：</B>输入只写本地 ghost owner。
- <B>依据：</B>`PlayerInputSystem.cs` 的 query 使用 `.WithAll<GhostOwnerIsLocal>()`。
- <B>影响：</B>这是 Netcode 输入同步的关键边界：客户端只修改自己的 input buffer，不改别人的输入副本。

- <B>发现：</B>本样例是 Netcode 入门，不是完整多人游戏架构。
- <B>依据：</B>工程只有一个 Kickball 主场景和少量 systems，复杂样例被放在更大的 `NetcodeSamples` 中。
- <B>影响：</B>学习 ghost、prediction、RPC 等高级主题时，应继续看 `NetcodeSamples/HelloNetcode`、`NetCube` 和 `Asteroids`。

---

## 分项分析

### World 启动

`GameBootstrap` 是入口判断的第一站。它使用 Netcode 默认 client/server bootstrap，但开启 auto-connect。这让样例更适合教学：打开场景后可以直接观察 client/server 流程，而不需要先手写连接 UI。

### 输入同步

`PlayerInputSystem` 更新在 `GhostInputSystemGroup`，读取 Input System 的 `Move` action 和键盘的 space / enter，再写入 `PlayerInput`。它通过 `GhostOwnerIsLocal` 限定只处理本地玩家。

这对应多人游戏中非常常见的一条线：本地输入进入预测或同步管线，服务器再据此推进权威状态。

### 玩法系统

玩法系统继承了 Kickball 的模型：障碍物、玩家、球、踢球和生成。区别在于这些 entity 的生命周期和状态同步需要放在 Netcode 的 ghost 和 world 分组里理解。

如果从 `Entities101/Kickball` 切过来，建议重点对比同名概念的 authoring 和 system 是否因为网络同步而增加了 ghost、owner 或输入 buffer。

---

## 风险与限制

- 本工程没有自己的 README，分析主要来自源码、manifest 和场景结构。
- 未打开 Unity Editor 验证 auto-connect 和多 world 运行状态。
- `Netcode101` 使用 `com.unity.netcode 1.9.2`，而完整 `NetcodeSamples` 在本地 manifest 中是更高版本；后续迁移代码时要注意 API 差异。

---

## 后续行动

- 先读 [Entities101](./Entities101.md) 的 Kickball，再回来看 Netcode101。
- 对照 `GameBootstrap.cs`、`PlayerInputSystem.cs` 和 `GoInGame*System.cs`，画出 client/server world 的启动和入场流程。
- 深入 Netcode 时继续研究完整 `NetcodeSamples/HelloNetcode`。

---

## 关联笔记

- [Dots101 总览](../EntityComponentSystemSamples_Dots101.md)
- [Entities101](./Entities101.md)

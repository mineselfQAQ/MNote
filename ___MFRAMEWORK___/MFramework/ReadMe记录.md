**<center><BBBG>MFramework框架演化记录</BBBG></center>**

<!-- TOC -->

- [v0.1.0](#v010)
  - [简述](#简述)
- [v0.1.1](#v011)
  - [简述](#简述-1)
- [v0.1.2](#v012)
  - [简述](#简述-2)
- [v0.1.3](#v013)
  - [更新简述](#更新简述)
  - [Log模块](#log模块)

<!-- /TOC -->

<BR>

**版本号规定：**
`major.minor.patch` 即 `主.辅.补丁`

# v0.1.0

## 简述

以下为第一版情况的设计：
整体来说主要借鉴了**CatLib**的设计：

- 由于框架核心需要放在dll中，所以必然会有一层包装
  - dll：MFrameworkCore
  - Unity：MEntry
  
  具体情况如下：
  MFrameworkCore在Unity中派生成MCore，MEntry有一基类MEntryBase，MEntryBase为框架Unity层构建，需自行派生为MEntry实现内置功能
- 框架功能有：
  - 生命周期(提供事件回调)
  - IOC(目前为SL实现)

# v0.1.1

**MTracker**进行了一次提升

## 简述

MTracker改进了很多，原来的MTracker使用的是继承的方式，由于扩展内容有多个，容易过度横向扩展，所以改成了**组合模式**
简单来说：

- MTracker：核心类，作为单个追踪器存在
- MTrackerFactory：静态类，可通过`CreateTracker()`创建不同形态的MTracker
- MAutoTracker：自动化版MTracker扩展，用IDisposable实现，由工厂包装MTracker得来

# v0.1.2

EventBus进行了更新，更名为MEventBus
同时修复了一下MLog/MTracker等内容，使输出正常

## 简述

MEventBus现添加Safe版本，这是因为假设生命周期事件中发生错误，会导致后续代码无法正常执行，如果能够catch异常，则可以避免报错
与此同时，MLog也进行了修改，现在错误可正常打印日志了

# v0.1.3

## 更新简述

优化了Log模块的逻辑

## Log模块

Log模块基本完善，能在MEntry下完全跑通(Editor+打包)
优化了流程的各个方面，目前逻辑基本合理
能感受到的唯一的**不足**就是<B><DRD>打包后获取不到堆栈信息</DRD></B>
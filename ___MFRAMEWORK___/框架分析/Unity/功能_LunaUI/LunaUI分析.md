**<center><BBBG>LunaUI分析</BBBG></center>**

# 简述

LunaUI是一套**基于Unity**的**UI框架**
总体来说<B><VT>比较复杂</VT>，特点</B>如下：

- **<GN>优点</GN>**
  - 体系完整，内容多
- **<DRD>缺点</DRD>**
  - 版本虽新，但必须是Unity6之后的版本
  - 引用库很多，即依赖很多
  - 多也意味着学习成本较高

<BR>

从表现上来看，效果非常不错，是一个值得学习的框架
再来看看**涉及内容**：
![](Pic/LunaUI1.png) **本体**
![](Pic/LunaUI2.png) **示例**
**提供解决方案**如下：

- 库
- 组件扩展
- 实例(PC/移动端)
- Addressable包
- 对话
- 本地化
- Json存储

都是非常实用的，它们的**基**就是本体中的内容：

- CupkekGames.Core：核心组件，更多的是提供支持(即底层)
  - Singleton，这很好地说明了Core中的内容
  - Fadeable---渐变动画
  - Pool---池
  - Input---输入系统
  - ...
- CupkekGames.Luna：可以说是业务层底层
  可以看到更多的是一些组件层面的内容，可能是小组件，也可能是组件组
  - Controllers---MonoBehaviour脚本，用于预制界面(view)/组件(component)
  - CustomComponents---自建新组件
  - Managers---核心管理器
  - ...

经过脚本的翻阅，我对其**定义**为：<B><VT>一个基于UI Toolkit的全方位UI扩展库</VT></B>

<BL>问题：有框架吗</BL>
<BL>可能是有的，大致浏览下来LunaUIManager/UIView文件夹可以算的上基，但本质上算不上框架</BL>
**<center><BBBG>DI模块制作思路</BBBG></center>**

DI归属IOC，是相当复杂的一个模块
其**原理核心**并不复杂，即：
**<VT>注册与解析，先注册接口所对应的实现类，解析获取需要的类实例</VT>**
更核心的**本质**：
**<VT>提供解析所需要的信息，由DI结合信息帮助创建</VT>**
关键在于其**细节**：

- <B>注册</B>：总之需要创建映射
  key是什么都是可以的，只要能对应上，而value无论如何，一定需要能够获取具体的实例才行

  - key通常是SourceType，即一个接口(类也是可以的)
  - value会以TargetType/Instance这两种居多
  - value的话会有如下情况：
    - Type：自动解析创建Instance
    - Instance：直接提供Instance
    - Factory(Lambda)：自定义流程创建Instance

- <B>解析</B>：通过注册内容，可以根据注册方式进行解析

  - Instance：直接获取即可
  - Type：已知Type，可通过反射获取
  - Factory：调用工厂方法获取

  Instance/Factory基本上无需操作即可完成，而**Type的反射**
  解析流程中**递归解析**是处理的重点

- <B>生命周期</B>：DI通常会实现生命周期处理
  完整的话可以分为3种情况：

  - Transient：瞬态，每次都新建
  - Scoped：域，域中仅有一个实例
  - Singleton：单例，永远只有一个实例
  
- <B>依赖</B>：Type解析会发生递归，那么避免依赖循环是必须的
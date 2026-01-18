**<center><BBBG>QFramework分析</BBBG></center>**

<!-- TOC -->

- [简述](#简述)
  - [简易分析](#简易分析)
  - [UML类图分析](#uml类图分析)
- [框架](#框架)
  - [框架对比](#框架对比)
  - [框架分析](#框架分析)
    - [接口(规则)](#接口规则)
    - [Architecture](#architecture)
      - [IOCContainer](#ioccontainer)
    - [Controller与Model](#controller与model)
      - [Controller](#controller)
      - [Model](#model)
        - [Event](#event)
          - [Event分析](#event分析)
          - [Event总结](#event总结)
          - [Model中的Event](#model中的event)
        - [BindableProperty](#bindableproperty)
    - [Command](#command)
    - [Utility与System](#utility与system)
      - [Utility](#utility)
      - [System](#system)
    - [Query](#query)
    - [Architecture详述](#architecture详述)
      - [Architecture的初始化](#architecture的初始化)
      - [系统组件](#系统组件)
      - [执行组件](#执行组件)
      - [规则详述](#规则详述)
        - [组件规则](#组件规则)

<!-- TOC -->

# 简述

QFramework是一个**体量比较适中**的框架，相比SKCell这种纯功能框架，QFramework<B><VT>指定了一定的框架规范使得项目体量变大时依旧能很好地管理</B></VT>

## 简易分析

可以先看一下QFramework在Unity的层级目录：
![](Pic/QFramework.png)
显然结构可以分为2部分：

- **Framework**，即<B><VT>框架部分</B></VT>
  仅1个脚本，共不到1000行代码，非常简短(因为说到底就是一些基础规范)
- **Toolkits**，即<B><VT>功能部分</B></VT>

本篇将会详细分析**QFramework脚本**中的内容

## UML类图分析

这里尝试制作了**UML类图**来进行归纳总结：
![](Pic/QFramework_UML.png)

# 框架

框架是极其重要的，有好的框架无论是对个人还是团队都能提升开发效率

## 框架对比

这里先按着QFramework的**QFramework v1.0 使用指南**进行对比：

**<YL>以一个计数器应用为例：</YL>**
**不应用框架**是这样的：

``` csharp
// Controller
public class CounterAppController : MonoBehaviour
{
    // View
    private Button mBtnAdd;
    private Button mBtnSub;
    private Text mCountText;

    // Model
    private int mCount = 0;

    void Start()
    {
        // View 组件获取
        mBtnAdd = transform.Find("BtnAdd").GetComponent<Button>();
        mBtnSub = transform.Find("BtnSub").GetComponent<Button>();
        mCountText = transform.Find("CountText").GetComponent<Text>();

        // 监听输入
        mBtnAdd.onClick.AddListener(() =>
        {
            // 交互逻辑
            mCount++;
            // 表现逻辑
            UpdateView();        
        });
        mBtnSub.onClick.AddListener(() =>
        {
            // 交互逻辑
            mCount--;
            // 表现逻辑
            UpdateView();
        });

        UpdateView();
    }

    void UpdateView()
    {
        mCountText.text = mCount.ToString();
    }
}
```

以上代码某种意义上"简单明了"，仅使用了一个脚本就完成了计数器所需要的所有内容
看似很好，但这意味着<B><DRD>扩展就难了</DRD></B>：

- 目前是3个View，1个Model，那么假如有很多呢？不仅需要声明，还需要初始化与绑定，代码量巨大，一个脚本支撑不了那么多内容
- 目前Model具有初始值0，那么假如需要扩展(读取写入功能)，不满足需要改造，非常容易出错
- `UpdateView()`需要手动调用

<BR>

**QFramework框架定义了以下内容：**

- Architecture，类似于PureMVC的Facade，用于注册各类内容
- Model，即M
- Controller，即C
  - View本质上附属于Controller，通过`UpdateView()`绑定即可
- Command，用于解决Controller过于臃肿的问题(分担职责，内容被拆到Command里了)
- Event，事件用于自动绑定(MVVM)
  - BindableProperty，可取代事件
- Utility，定义功能用于便捷执行
- System，用于集中某一种特定功能(从Command中剥离出来)
- Query，专用于查询

<BR>

**应用框架**是这样的：
首先需要一个**Architecture**入口，即**CounterApp**:

``` csharp
public class CounterApp : Architecture<CounterApp>
{
    protected override void Init()
    {
        // 注册 System 
        this.RegisterSystem<IAchievementSystem>(new AchievementSystem()); 
        // 注册 Model
        this.RegisterModel<ICounterAppModel>(new CounterAppModel());
        // 注册存储工具的对象
        this.RegisterUtility<IStorage>(new Storage());
    }

    // 特性：Command拦截(捕获执行操作并进行额外操作)
    protected override void ExecuteCommand(ICommand command)
    {
        Debug.Log("Before " + command.GetType().Name + "Execute");
        base.ExecuteCommand(command);
        Debug.Log("After " + command.GetType().Name + "Execute");
    }

    protected override TResult ExecuteCommand<TResult>(ICommand<TResult> command)
    {
        Debug.Log("Before " + command.GetType().Name + "Execute");
        var result =  base.ExecuteCommand(command);
        Debug.Log("After " + command.GetType().Name + "Execute");
        return result;
    }
}
```

可以看到对于该例，注册了3个内容：System/Model/Utility
**Model**是核心，即**CounterAppModel**：

``` csharp
public class CounterAppModel : AbstractModel
{
    private int mCount;

    public int Count
    {
        get => mCount;
        set
        {
            if (mCount != value)
            {
                mCount = value;
                this.SendEvent<CountChangeEvent>(value);
            }
        }
    }

    protected override void OnInit()
    {
        var storage = this.GetUtility<Storage>();

        Count = storage.LoadInt(nameof(Count));

        this.RegisterEvent<CountChangeEvent>(e =>
        {
            this.GetUtility<Storage>().SaveInt(nameof(Count), Count);
        });
    }
}
```

可以看到使用了**Event**进行注册，同时我们还需在Command中`SendEvent()`，从而<B><VT>数据变更后自动操作(保存与读取)</VT></B>
但其实有一种更加智能的数据类**BindableProperty**<VT>(用于替换Event)</VT>：

``` csharp
public interface ICounterAppModel : IModel
{
    BindableProperty<int> Count { get; }
}
public class CounterAppModel : AbstractModel, ICounterAppModel
{
    public BindableProperty<int> Count { get; } = new BindableProperty<int>();

    protected override void OnInit()
    {
        var storage = this.GetUtility<IStorage>();
        
        // 设置初始值（不触发事件）
        Count.SetValueWithoutEvent(storage.LoadInt(nameof(Count)));

        // 当数据变更时 存储数据
        Count.Register(newCount =>
        {
            storage.SaveInt(nameof(Count),newCount);
        });
    }
}
```

上述保存存储功能由该**Utility**提供，即**Storage**：

``` csharp
public interface IStorage : IUtility
{
    void SaveInt(string key, int value);
    int LoadInt(string key, int defaultValue = 0);
}
public class Storage : IStorage
{
    public void SaveInt(string key, int value)
    {
        PlayerPrefs.SetInt(key,value);
    }

    public int LoadInt(string key, int defaultValue = 0)
    {
        return PlayerPrefs.GetInt(key, defaultValue);
    }
}
```

**Controller**为另一个核心，这里的是**CounterAppController**：

``` csharp
public class CounterAppController : MonoBehaviour, IController
{
    private Button mBtnAdd;
    private Button mBtnSub;
    private Text mCountText;
    
    private ICounterAppModel mModel;

    void Start()
    {
        mModel = this.GetModel<ICounterAppModel>();
        
        mBtnAdd = transform.Find("BtnAdd").GetComponent<Button>();
        mBtnSub = transform.Find("BtnSub").GetComponent<Button>();
        mCountText = transform.Find("CountText").GetComponent<Text>();
        
        mBtnAdd.onClick.AddListener(() =>
        {
            this.SendCommand<IncreaseCountCommand>();
        });
        
        mBtnSub.onClick.AddListener(() =>
        {
            this.SendCommand(new DecreaseCountCommand());
        });

        mModel.Count.RegisterWithInitValue(newCount =>
        {
            UpdateView();
        }).UnRegisterWhenGameObjectDestroyed(gameObject);
    }
    
    void UpdateView()
    {
        mCountText.text = mModel.Count.ToString();
    }

    public IArchitecture GetArchitecture()
    {
        return CounterApp.Interface;
    }

    private void OnDestroy()
    {
        mModel = null;
    }
}
```

这里做了2件事：

- 按钮绑定Command(使用`SendCommand()`发送相应命令)
- 数据Model绑定视图变化(一旦数据更改视图自动随之更改)

**Command**是很简单的，就是动作的具体实现：

``` csharp
public class IncreaseCountCommand : AbstractCommand 
{
    protected override void OnExecute()
    {
        var model = this.GetModel<ICounterAppModel>();
        model.Count.Value++;
    }
}

public class DecreaseCountCommand : AbstractCommand
{
    protected override void OnExecute()
    {
        this.GetModel<ICounterAppModel>().Count.Value--; // -+
    }
}
```

注册中还有一个**System**，即**AchievementSystem**：　　　　<VT>是Model中剥离出的条件判断</VT>

``` csharp
public interface IAchievementSystem : ISystem {}
public class AchievementSystem : AbstractSystem ,IAchievementSystem
{
    protected override void OnInit()
    {
        this.GetModel<ICounterAppModel>() // -+
            .Count
            .Register(newCount =>
            {
                if (newCount == 10)
                {
                    Debug.Log("触发 点击达人 成就");
                }
                else if (newCount == 20)
                {
                    Debug.Log("触发 点击专家 成就");
                }
                else if (newCount == -10)
                {
                    Debug.Log("触发 点击菜鸟 成就");
                }
            });
    }
}
```

<BR>

这就是这套框架实现的所有，这里简单地分析一下**操作流程**：　　<YL>以9加1到10为例</YL>

- 点击+号，由于按钮已绑定onClick事件，触发IncreaseCountCommand
- 执行`model.Count.Value++`，首先Count的值会+1
  - 由于Count注册storage事件，会将新值通过PlayerPrefs保存下来
  - 由于Count注册成就System，会触发新值为10的成就消息
  - 由于Count注册视图更新事件，会将界面的相应视图刷新
- 由于CounterApp中的拦截操作，在执行Command的前后会输出debug信息

## 框架分析

虽然QFramework教程中讲解了**框架的演变**，但是本质上代码没有发生改变，这里先自行分析一下

### 接口(规则)

随意查看QFramework中的一个架构组件，比如说IController：
`public interface IController : IBelongToArchitecture, ICanSendCommand, ICanGetSystem, ICanGetModel, ICanRegisterEvent, ICanSendQuery, ICanGetUtility`
QFramework中充斥着**大量接口**，<B><VT>用于指定规范</VT></B>
就比如说<B><YL>上述的IController：由于需要实现这些接口，所以我们可以认为：实现了IController接口的某Controller就需要符合具体接口规范</YL></B>
随意查看某一具体接口：
`public interface ICanSendCommand : IBelongToArchitecture {}`
可以发现：<B><VT>接口仅为接口，我们只需要知道"某内容是具有某接口特性的"即可</VT></B>

**具体在后续使用到继续分析**

### Architecture

在QFramework中，<B><VT>Architecture是整个程序的源</VT></B>
简单来说：<B><VT>Architecture中收集了所有架构组件的操作(如`GetModel()`)并自动初始化了注册的组件</VT></B>

``` csharp
public interface IArchitecture
{
    // 一系列操作接口
}

public abstract class Architecture<T> : IArchitecture where T : Architecture<T>, new()
{
    private bool mInited = false;

    public static Action<T> OnRegisterPatch = architecture => { };

    protected static T mArchitecture;

    public static IArchitecture Interface
    {
        get
        {
            if (mArchitecture == null) InitArchitecture();
            return mArchitecture;
        }
    }


    public static void InitArchitecture()
    {
        if (mArchitecture == null)
        {
            mArchitecture = new T();
            mArchitecture.Init();

            OnRegisterPatch?.Invoke(mArchitecture);

            foreach (var model in mArchitecture.mContainer.GetInstancesByType<IModel>().Where(m => !m.Initialized))
            {
                model.Init();
                model.Initialized = true;
            }

            foreach (var system in mArchitecture.mContainer.GetInstancesByType<ISystem>()
                            .Where(m => !m.Initialized))
            {
                system.Init();
                system.Initialized = true;
            }

            mArchitecture.mInited = true;
        }
    }

    // 一系列操作接口实现
}
```

这里可以注意到一种**很不错的设计**：
**<VT>`Architecture<T>`的声明本身是一种单例写法，结合静态`Interface`，可以做到创建多个单例实现，但无论我使用哪种，当前有且仅有一个单例</VT>**
<YL><B>比如说</B>：有`A`/`B`两种Architecture，如果我调用`A.Interface`，那么初始化的就是A版本(当然既然初始化了A那么B就用不到了)，反之<YL>

#### IOCContainer

在Architecture使用到了一个概念<B><GN>IOCContainer</GN></B>，用于<B><VT>控制反转(Inversion of Control)</VT></B>

IOC其实我们会很熟悉，<B><VT>IOC是一种实现<GN>DI</GN>的手段</VT></B>
有了IOC，我们能将强耦合剥离出来，通过**注册到IOCContainer，从IOCContainer中取出**，从而<B><VT>降低耦合</VT></B>
**<VT>Tip：接口本身就是一种IOC，使用IOCContainer是在此基础上的扩展</VT>**

IOCContainer的本身非常简单，内部存储了一个字典：
`private Dictionary<Type, object> mInstances = new Dictionary<Type, object>();`
由此可见：<B><VT>IOCContainer是一个存储了类型的具体类型的容器</VT></B>
这种解释可能不是特别清楚，可以结合以下两者理解：

``` csharp
// <IOCContainer>的注册方法
public void Register<T>(T instance)
{
    var key = typeof(T);

    if (mInstances.ContainsKey(key))
    {
        mInstances[key] = instance;
    }
    else
    {
        mInstances.Add(key, instance);
    }
}

// <Architecture>提供的Model注册方法
public void RegisterModel<TModel>(TModel model) where TModel : IModel
{
    model.SetArchitecture(this);
    mContainer.Register<TModel>(model); // 把TModel类型的model存入IOCContainer中
    // 也就是说：我们尝试获取TModel，实际就会获取到相应model实例，使用时不需要考虑更多

    if (mInited)
    {
        model.Init();
        model.Initialized = true;
    }
}
```

IOCContainer的用法也很简单，只要像上述`RegisterModel()`中一样注册过，后续通过<B>`Get<T>()`</B>即可从容器中将相应实例取出

我们同时也知道了一件**关键的事**：
**<VT>对于该IOCContainer的实现来说，一种TModel对应一个Tmodel的实例，重新注册则会替换</VT>**
显然这<B><DRD>不能处理复杂情况(比如说需要注册同接口的几种实例)</DRD></B>，如需扩展，可以使用一些**针对DI的框架**，比如说：

- Microsoft.Extensions.DependencyInjection(C#)
- Zenject(Unity)

### Controller与Model

通过前面的例子分析，我们也能很清楚地了解到：**<VT>MVC是框架的根</VT>**
QFramework其实和PureMVC是类似的：
**PureMVC**本质上是一个MVC：

- 使用门面模式Facade进行管理这是框架上的优化
- MVC内部演变为Proxy/Mediator/Command，这同样是优化
- 等等

所以对于QFramework来说，首先需要考虑的还是MVC，但是有所不同：**<VT>V被归入C中了</VT>**
这其实是一件**有利有弊**的事情：

- <GN>Controller可以非常容易地访问View，也就是说初始化/按钮绑定/更新视图都可以在一处完成，<B>非常方便，同时无需通信减少开销</B></GN>
- <DRD>Controller的代码量会变大，容易搞不清楚</DRD>
- <DRD>违反单一职责原则</DRD>

所以说这其实是一种<B><VT>用框架规范性换开发效率</VT></B>的方法

回过头来，还是专注于QFramework的实现：
在QFramework中，<B><VT>Controller是整个UIPanel的源</VT></B>

#### Controller

Controller并没有实现抽象类，仅有一个**接口<GN>IController</GN>**：
`public interface IController : IBelongToArchitecture, ICanSendCommand, ICanGetSystem, ICanGetModel, ICanRegisterEvent, ICanSendQuery, ICanGetUtility {}`
这也代表了一个**Controller可以做的操作**(如可以获取Model组件...)

#### Model

同样的，Model也具有**接口<GN>IModel</GN>**：
`public interface IModel : IBelongToArchitecture, ICanSetArchitecture, ICanGetUtility, ICanSendEvent, ICanInit {}`

对于Model来说，更重要的是实现的**抽象类<GN>AbstractModel</GN>**：

``` csharp
public abstract class AbstractModel : IModel
{
    private IArchitecture mArchitecturel;

    IArchitecture IBelongToArchitecture.GetArchitecture() => mArchitecturel;

    void ICanSetArchitecture.SetArchitecture(IArchitecture architecture) => mArchitecturel = architecture;

    public bool Initialized { get; set; }
    void ICanInit.Init() => OnInit();
    public void Deinit() => OnDeinit();

    protected virtual void OnDeinit()
    {
    }

    protected abstract void OnInit();
}
```

我们知道了几件事：

- 由于IModel实现了IBelongToArchitecture接口，所以可以获取IArchitecture
- 由于IModel实现了ICanInit接口，所以具有`Init()`/`Deinit()`操作

这里**值得注意**的是：

- 这里使用了<B><GN>显式接口实现</GN></B>，会<B><VT>强制接口访问</VT></B>：
  - 如果想`GetArchitecture()`，必须转换为IBelongToArchitecture调用
  - 如果想`SetArchitecture()`，必须转换为ICanSetArchitecture调用
  - 如果想`Init()`，必须转换为ICanInit调用<VT>(`Deinit()`不用，因为不是显式接口)</VT>

本质上**框架的目的**是：**<VT>内部自行调用，避免用户了解细节</VT>**
这里举一个<B><YL>例子</YL></B>帮助理解：

``` csharp
public static class CanGetModelExtension
{
    public static T GetModel<T>(this ICanGetModel self) where T : class, IModel =>
        self.GetArchitecture().GetModel<T>();
}
```

<YL>可以看到，在QFramework内部，常常提供了一些接口方法用于调用
对于此例，在实际使用时，我们只会感觉到：<B>因为实现了ICanGetModel接口，所以我能通过`GetModel()`获取相应Model</B></YL>

**<BL>问题：看似好像有一系列操作，但是好像没初始化(mArchitecturel没有赋值)？</BL>**
<BL>确实是这样，这其实在Architecture中：</BL>

``` csharp
public void RegisterModel<TModel>(TModel model) where TModel : IModel
{
    model.SetArchitecture(this); // 即一定执行了Set操作，从而对mArchitecturel赋值
    mContainer.Register<TModel>(model);

    if (mInited)
    {
        model.Init();
        model.Initialized = true;
    }
}

public TModel GetModel<TModel>() where TModel : class, IModel => mContainer.Get<TModel>();
```

可以看到：

- IBelongToArchitecture接口实现完毕后，初始化执行`SetArchitecture()`，后续可自由调用`GetArchitecture()`获取
- 将model注册仅IOCContainer后，后续可通过`Get<T>()`从容器中取出，执行其操作

**<BL>问题：model是IModel类型的，为什么能调用`model.Init()`</BL>**
<BL>虽然在AbstractModel中只有显式接口实现，即`ICanInit.Init()`，但是IModel是个接口，ICanInit是其子接口，是可以直接调用的</BL>

##### Event

###### Event分析

Event用到的地方很多，经过各种包装产生了很多类，需要详细分析一下
首先来看一下有哪些类：

- IEasyEvent
- EasyEvent
- EasyEvents
- TypeEventSystem
  - IOnEvent
- OrEvent

简单来看一下<B><GN>IEasyEvent</GN></B>接口：`IUnRegister Register(Action onEvent);` <VT>就是很简单的注册</VT>

最基本的就是<B><GN>EasyEvent</GN></B>了，对于一个简单的事件来说操作不多：

- `Register()`---注册
- `RegisterWithACall()`---调用后注册
- `UnRegister()`---反注册
- `Trigger()`---调用

代码同样非常简单，其实就是一个<B><VT>Action的封装类</VT></B>：

``` csharp
public class EasyEvent : IEasyEvent
{
    private Action mOnEvent = () => { };

    public IUnRegister Register(Action onEvent)
    {
        mOnEvent += onEvent;
        return new CustomUnRegister(() => { UnRegister(onEvent); });
    }

    public IUnRegister RegisterWithACall(Action onEvent)
    {
        onEvent.Invoke();
        return Register(onEvent);
    }

    public void UnRegister(Action onEvent) => mOnEvent -= onEvent;

    public void Trigger() => mOnEvent?.Invoke();
}
```

**<GN>反注册</GN>**
令我们不太理解的可能是其中的**IUnRegister接口**以及**CustomUnRegister类**
之所以需要IUnRegister的原因是很明确的：<B><VT>提供一种反注册的实例方便操作</VT></B>
**<YL>考虑一种情况：</YL>**
<YL>使用`Register(()=>{...})`使用Lambda进行注册，我们会发现想要`UnRegister()`的时候由于得不到注册时的Action而无法反注册，此时提供的IUnRegister就非常有用了</YL>

**IUnRegister**/**CustomUnRegister**具体代码如下：

``` csharp
public interface IUnRegister
{
    void UnRegister();
}

// 一种存储有Action的IUnRegister
public struct CustomUnRegister : IUnRegister
{
    private Action mOnUnRegister { get; set; }
    public CustomUnRegister(Action onUnRegister) => mOnUnRegister = onUnRegister;

    public void UnRegister()
    {
        mOnUnRegister.Invoke();
        mOnUnRegister = null; // 反注册完后就置空(可GC)
    }
}
```

既然提到了反注册，那么可以再来看**一组便捷类**，具体调用如下：

``` csharp
mModel.Count.RegisterWithInitValue(newCount =>
{
    UpdateView();

}).UnRegisterWhenGameObjectDestroyed(gameObject);
```

可以看到通过`UnRegisterWhenGameObjectDestroyed()`实现了<B><VT>自动反注册</VT></B>
这牵扯到以下类：

- 三种反注册功能
  - `UnRegisterOnDestroyTrigger`
  - `UnRegisterOnDisableTrigger`
  - `UnRegisterCurrentSceneUnloadedTrigger`
- IUnRegister扩展
  - `UnRegisterExtension`

具体如下：

``` csharp
public abstract class UnRegisterTrigger : UnityEngine.MonoBehaviour
{
    private readonly HashSet<IUnRegister> mUnRegisters = new HashSet<IUnRegister>();

    public IUnRegister AddUnRegister(IUnRegister unRegister)
    {
        mUnRegisters.Add(unRegister);
        return unRegister;
    }

    public void RemoveUnRegister(IUnRegister unRegister) => mUnRegisters.Remove(unRegister);

    public void UnRegister()
    {
        foreach (var unRegister in mUnRegisters)
        {
            unRegister.UnRegister();
        }

        mUnRegisters.Clear();
    }
}

public class UnRegisterOnDestroyTrigger : UnRegisterTrigger
{
    private void OnDestroy()
    {
        UnRegister();
    }
}

public class UnRegisterOnDisableTrigger : UnRegisterTrigger
{
    private void OnDisable()
    {
        UnRegister();
    }
}

public class UnRegisterCurrentSceneUnloadedTrigger : UnRegisterTrigger
{
    private static UnRegisterCurrentSceneUnloadedTrigger mDefault;

    public static UnRegisterCurrentSceneUnloadedTrigger Get
    {
        get
        {
            if (!mDefault)
            {
                mDefault = new GameObject("UnRegisterCurrentSceneUnloadedTrigger")
                    .AddComponent<UnRegisterCurrentSceneUnloadedTrigger>();
            }

            return mDefault;
        }
    }

    private void Awake()
    {
        DontDestroyOnLoad(this);
        hideFlags = HideFlags.HideInHierarchy;
        SceneManager.sceneUnloaded += OnSceneUnloaded;
    }

    private void OnDestroy() => SceneManager.sceneUnloaded -= OnSceneUnloaded;
    void OnSceneUnloaded(Scene scene) => UnRegister();
}
#endif

public static class UnRegisterExtension
{
#if UNITY_5_6_OR_NEWER

    static T GetOrAddComponent<T>(GameObject gameObject) where T : Component
    {
        var trigger = gameObject.GetComponent<T>();

        if (!trigger)
        {
            trigger = gameObject.AddComponent<T>();
        }

        return trigger;
    }

    public static IUnRegister UnRegisterWhenGameObjectDestroyed(this IUnRegister unRegister,
        UnityEngine.GameObject gameObject) =>
        GetOrAddComponent<UnRegisterOnDestroyTrigger>(gameObject)
            .AddUnRegister(unRegister);

    public static IUnRegister UnRegisterWhenGameObjectDestroyed<T>(this IUnRegister self, T component)
        where T : UnityEngine.Component =>
        self.UnRegisterWhenGameObjectDestroyed(component.gameObject);

    public static IUnRegister UnRegisterWhenDisabled<T>(this IUnRegister self, T component)
        where T : UnityEngine.Component =>
        self.UnRegisterWhenDisabled(component.gameObject);

    public static IUnRegister UnRegisterWhenDisabled(this IUnRegister unRegister,
        UnityEngine.GameObject gameObject) =>
        GetOrAddComponent<UnRegisterOnDisableTrigger>(gameObject)
            .AddUnRegister(unRegister);
    
    public static IUnRegister UnRegisterWhenCurrentSceneUnloaded(this IUnRegister self) =>
        UnRegisterCurrentSceneUnloadedTrigger.Get.AddUnRegister(self);
#endif
```

代码其实是比较**清晰易懂**的：
**<VT>提供`OnDestroy()`/`OnDisable()`/场景卸载时自动反注册的功能，
核心是由一个组件记录下反注册内容，在Unity生命周期中自动调用</VT>**
需要**注意**的是：<B><DRD>在不同的GameObject会创建不同的组件，注意消耗</DRD></B>

结合EasyEvent来看，会发现无非就是<VT>将反注册需要的event包装进Action，等待后续反注册时调用</VT>

EasyEvent提供了**3种泛型方法**：`EasyEvent<T>`/`EasyEvent<T,K>`/`EasyEvent<T,K,S>`
区别其实就是Action传入参数数量而已
但是要**注意**：<B><VT>泛型形式额外具有显式接口形式的`IEasyEvent.Register()`</VT></B>
这是因为这是<B><VT>备用回退方案(无感知调用)</VT></B>：  <VT>Tip：对BindableProperty同样适用(因为有IEasyEvent+泛型)</VT>

``` csharp
public class EasyEvent<T> : IEasyEvent
{
    public IUnRegister Register(Action<T> onEvent)
    {
        mOnEvent += onEvent;
        return new CustomUnRegister(() => { UnRegister(onEvent); });
    }

    // 如果没有传入T，那么调用的就是该形式了
    IUnRegister IEasyEvent.Register(Action onEvent)
    {
        return Register(Action);
        void Action(T _) => onEvent();
    }
}
```

<B><GN>EasyEvents</GN></B>从名字上就能知道是EasyEvent组
内部实现就是<B><VT>用Dictionary存储IEasyEvent</VT></B>：

``` csharp
public class EasyEvents
{
    // 单例，唯一入口
    private static readonly EasyEvents mGlobalEvents = new EasyEvents();

    public static T Get<T>() where T : IEasyEvent => mGlobalEvents.GetEvent<T>();

    public static void Register<T>() where T : IEasyEvent, new() => mGlobalEvents.AddEvent<T>();

    private readonly Dictionary<Type, IEasyEvent> mTypeEvents = new Dictionary<Type, IEasyEvent>();

    public void AddEvent<T>() where T : IEasyEvent, new() => mTypeEvents.Add(typeof(T), new T());

    public T GetEvent<T>() where T : IEasyEvent
    {
        return mTypeEvents.TryGetValue(typeof(T), out var e) ? (T)e : default;
    }

    public T GetOrAddEvent<T>() where T : IEasyEvent, new()
    {
        var eType = typeof(T);
        if (mTypeEvents.TryGetValue(eType, out var e))
        {
            return (T)e;
        }

        var t = new T();
        mTypeEvents.Add(eType, t);
        return t;
    }
}
```

根据代码，我们会联想到：`Dictionary<Type, IEasyEvent>`这种形式正是**IOCContainer**

<B><GN>TypeEventSystem</GN></B>是一种重要的类型，Architecture中的Event操作正是由它提供，对应的有：

``` csharp
public void SendEvent<TEvent>() where TEvent : new() => mTypeEventSystem.Send<TEvent>();
public void SendEvent<TEvent>(TEvent e) => mTypeEventSystem.Send<TEvent>(e);

public IUnRegister RegisterEvent<TEvent>(Action<TEvent> onEvent) => mTypeEventSystem.Register<TEvent>(onEvent);

public void UnRegisterEvent<TEvent>(Action<TEvent> onEvent) => mTypeEventSystem.UnRegister<TEvent>(onEvent);

```

该类同样简单，为<B><VT>EasyEvents的包装</VT></B>：

``` csharp
public class TypeEventSystem
{
    private readonly EasyEvents mEvents = new EasyEvents();

    public static readonly TypeEventSystem Global = new TypeEventSystem();

    public void Send<T>() where T : new() => mEvents.GetEvent<EasyEvent<T>>()?.Trigger(new T());

    public void Send<T>(T e) => mEvents.GetEvent<EasyEvent<T>>()?.Trigger(e);

    public IUnRegister Register<T>(Action<T> onEvent) => mEvents.GetOrAddEvent<EasyEvent<T>>().Register(onEvent);

    public void UnRegister<T>(Action<T> onEvent)
    {
        var e = mEvents.GetEvent<EasyEvent<T>>();
        e?.UnRegister(onEvent);
    }
}
```

可以看到，其中有一个**Global**，这就是用于<B><GN>IOnEvent</GN></B>配合的静态变量：

``` csharp
public interface IOnEvent<T>
{
    void OnEvent(T e);
}

public static class OnGlobalEventExtension
{
    public static IUnRegister RegisterEvent<T>(this IOnEvent<T> self) where T : struct =>
        TypeEventSystem.Global.Register<T>(self.OnEvent);

    public static void UnRegisterEvent<T>(this IOnEvent<T> self) where T : struct =>
        TypeEventSystem.Global.UnRegister<T>(self.OnEvent);
}
```

内容不多，仅提供了一个接口以及对应的注册方法，可以看出其实就是一种<B><VT>半自动化的回调注册方法</VT></B>
**大致用法**就是：类上加接口，在该类中实现`OnEvent()`并`RegisterEvent()`，在任意处需要调用时通过`TypeEventSystem.Global.Send<XXX>()`即可

<B><GN>OrEvent</GN></B>是一种<B><VT>链式调用的扩充(像LINQ一样)</VT></B>
**用法**如下：

``` csharp
private BindableProperty<int> mPropertyA = new BindableProperty<int>(10);
private BindableProperty<int> mPropertyB = new BindableProperty<int>(5);
private EasyEvent EventA = new EasyEvent();

void Start()
{
    // 为mPropertyA/mPropertyB/EventA都注册事件
    mPropertyA
        .Or(EventA)
        .Or(mPropertyB)
        .Register(() =>
        {
            Debug.Log("Event Received");
        }).UnRegisterWhenGameObjectDestroyed(gameObject);
}
```

可以看到这是一个非常便捷的语法，可以同时为多个需要Register的对象进行注册操作，而无需写多次
**代码**其实并不复杂：

``` csharp
public interface IUnRegisterList
{
    List<IUnRegister> UnregisterList { get; }
}

public class OrEvent : IUnRegisterList
{
    public OrEvent Or(IEasyEvent easyEvent)
    {
        // 将新的easyEvent注册进mOnEvent并将存入IUnRegister存入UnregisterList
        easyEvent.Register(Trigger).AddToUnregisterList(this);
        return this;
    }

    private Action mOnEvent = () => { };

    public IUnRegister Register(Action onEvent)
    {
        mOnEvent += onEvent;
        return new CustomUnRegister(() => { UnRegister(onEvent); });
    }

    public IUnRegister RegisterWithACall(Action onEvent)
    {
        onEvent.Invoke();
        return Register(onEvent);
    }
    
    public void UnRegister(Action onEvent)
    {
        mOnEvent -= onEvent;
        this.UnRegisterAll();
    }

    private void Trigger() => mOnEvent?.Invoke();

    public List<IUnRegister> UnregisterList { get; } = new List<IUnRegister>();
}

public static class OrEventExtensions
{
    public static OrEvent Or(this IEasyEvent self, IEasyEvent e) => new OrEvent().Or(self).Or(e);
}
```

看起来可能一时不太懂，但是只要知道了这一点就非常好理解了：
**<VT>OrEvent本质上也是一个IEasyEvent，只是他"将前人合并到自己"了</VT>**

核心函数为`Or()`，有2种：

- `IEasyEvent.Or()`(OrEventExtensions中)
- `OrEvent.Or()`(OrEvent中)

显然，<B><VT>第一次使用`.Or()`必然是对IEasyEvent使用的，两者合并会变为OrEvent，之后调用`OrEvent.Or()`不断扩容</VT></B>
观察<B><VT>`IEasyEvent.Or()`，本质上这还是在调用`OrEvent.Or()`</VT></B>：
`public static OrEvent Or(this IEasyEvent self, IEasyEvent e) => new OrEvent().Or(self).Or(e);`

**简单理解：**
结合两个`Or()`，说明每一个IEsayEvent都会调用一次`OrEvent.Or()`，
执行`Or()`则会为当前IEasyEvent添加`mOnEvent?.Invoke()`操作<B><DRD>(注意：是该IEasyEvent而非OrEvent)</DRD></B>，即**触发OrEvent中的Register事件**，
同时将IUnRegister收集到List供一并反注册
既然是为IEasyEvent注册的，那么<B><VT>触发方式还是和原来一致</VT></B>：

``` csharp
private void Update()
{
    if (Input.GetMouseButtonDown(0))
    {
        mPropertyA.Value++;
    }

    if (Input.GetMouseButtonDown(1))
    {
        mPropertyB.Value++;
    }

    if (Input.GetKeyDown(KeyCode.Space))
    {
        EventA.Trigger();
    }
}
```

###### Event总结

可以看到QFramework提供了很多种Event的形式，但是本质上其实就一种：**EasyEvent**，其余的都是在此基础上做扩展罢了
**具体如下：**

- **EasyEvent：**
  事件的基础，是Action的一层封装，提供了注册Register/反注册UnRegister/触发Trigger三种操作，同时注册后提供一种反注册手段CustomUnRegister
- **EasyEvents：**
  EasyEvent组，使用IOCContainer(`<Type,IEasyEvent>`)的形式进行事件的存储，无调用封装，仅提供添加AddEvent与获取GetEvent方法
- **TypeEventSystem：**
  EasyEvents的封装，向外界提供注册Register/反注册UnRegister/发送(触发)Send三种操作
- **OrEvent：**
  一种特殊的类型，用于实现链式调用，本质上是一个延迟调用器(为所有参加`.Or()`连点方法的IEasyEvent注册Trigger事件，具体内容为连点后的`Register()`内容)

**所以说：<VT>TypeEventSystem其实和EasyEvent是平级的，都是处理事件的一种方法，而EasyEvents仅是一个存储类</VT>**

###### Model中的Event

对于Model来说，**最核心**的就是其**数据**，使用Event可以解决这个问题
考虑一下**一般情况**，假设有一个数据count，大致是这样的：

``` csharp
public class CounterAppModel : AbstractModel
{
    private int mCount;

    public int Count
    {
        get => mCount;
        set
        {
            if (mCount != value)
            {
                mCount = value;
                PlayerPrefs.SetInt(nameof(Count), mCount);
            }
        }
    }

    protected override void OnInit()
    {
        var storage = this.GetUtility<Storage>();

        Count = storage.LoadInt(nameof(Count));

        CounterApp.Interface.RegisterEvent<CountChangeEvent>(e =>
        {
            this.GetUtility<Storage>().SaveInt(nameof(Count), Count);
        });
    }
}

public struct CountChangeEvent {}
public class CountChangeCommand : AbstractCommand 
{
    protected override void OnExecute()
    {
        this.GetModel<CounterAppModel>().Count++;
        this.SendEvent<CountChangeEvent>(); 
    }
}
```

可以看到：

- 这对应的就是`Architecture.RegisterEvent()/SendEvent()`，最核心的底层当然是`EasyEvent.Register()/Trigger()`
- 我们需要注册一个事件用于CountChange发生时，即每当`CounterAppModel.Count++`时需要添加`SendEvent()`操作

可以想到一个**致命缺点**：<B><DRD>我们需要手动追踪数据变更的位置并添加代码，很容易忘记<DRD></B>
但是也可以想到一个**优点**：<B><GN>虽然麻烦容易忘，但是灵活性很高，一个Event可以用于多处，对于不同情况发生的事件可以更改</GN></B>

##### BindableProperty

Event虽然可以解决，但是最好的方式是<B><VT>使用<GN>BindableProperty</GN>作为数据类型</VT></B>
这里看一下**BindableProperty**的实现：

``` csharp
public class CounterAppModel : AbstractModel,ICounterAppModel
{
    public BindableProperty<int> Count { get; } = new BindableProperty<int>();

    protected override void OnInit()
    {
        var storage = this.GetUtility<IStorage>();
        
        // 设置初始值（不触发事件）
        Count.SetValueWithoutEvent(storage.LoadInt(nameof(Count)));

        // 当数据变更时 存储数据
        Count.Register(newCount =>
        {
            storage.SaveInt(nameof(Count),newCount);
        });
    }
}
```

**对比**发现：BindableProperty对于数据<VT>不再需要声明字段以及属性</VT>，更重要的是<B><VT>不需要在Command中添加事件触发</VT></B>

其**实现**还是比较复杂的：
先从**接口**查看：

``` csharp
public interface IBindableProperty<T> : IReadonlyBindableProperty<T>
{
    new T Value { get; set; }
    void SetValueWithoutEvent(T newValue);
}

public interface IReadonlyBindableProperty<T> : IEasyEvent
{
    T Value { get; }

    IUnRegister RegisterWithInitValue(Action<T> action);
    void UnRegister(Action<T> onValueChanged);
    IUnRegister Register(Action<T> onValueChanged);
}

public interface IEasyEvent
{
    IUnRegister Register(Action onEvent); 
}
```

这说明了：

- IReadonlyBindableProperty
  - 作为一个"绑定属性"，属性`Value`是必须的
  - 同时，提供注册Register与反注册UnRegister操作
- IBindableProperty
  - IBindableProperty是IReadonlyBindableProperty派生，即"不只读可设置"

**<BL>问题：注册是什么</BL>**
<BL>注册显然就是MVVM中的<B><VT>数据驱动方法</VT></B>
详细需要查看实现类BindableProperty：</BL>

``` csharp
public class BindableProperty<T> : IBindableProperty<T>
{
    public BindableProperty(T defaultValue = default) => mValue = defaultValue;

    protected T mValue;

    // 比较函数，判断a和b是否相等
    public static Func<T, T, bool> Comparer { get; set; } = (a, b) => a.Equals(b);
    // 自定义Comparer逻辑
    public BindableProperty<T> WithComparer(Func<T, T, bool> comparer)
    {
        Comparer = comparer;
        return this;
    }

    public T Value
    {
        get => GetValue();
        set
        {
            if (value == null && mValue == null) return;
            if (value != null && Comparer(value, mValue)) return;

            SetValue(value);
            mOnValueChanged.Trigger(value);
        }
    }

    // 内部设置方法(会触发mOnValueChanged)
    protected virtual void SetValue(T newValue) => mValue = newValue;

    protected virtual T GetValue() => mValue;

    // 外部设置方法(不会触发mOnValueChanged)
    public void SetValueWithoutEvent(T newValue) => mValue = newValue;

    private EasyEvent<T> mOnValueChanged = new EasyEvent<T>();

    // 注册
    public IUnRegister Register(Action<T> onValueChanged)
    {
        return mOnValueChanged.Register(onValueChanged);
    }
    // 注册且初始调用一次
    public IUnRegister RegisterWithInitValue(Action<T> onValueChanged)
    {
        onValueChanged(mValue);
        return Register(onValueChanged);
    }

    // 反注册
    public void UnRegister(Action<T> onValueChanged) => mOnValueChanged.UnRegister(onValueChanged);

    // IEasyEvent的注册
    // 这里是为了提供一种便捷调用形式使用户在没有感知的情况下正常使用：
    // BindableProperty<>是泛型的，Register需要泛型，但是如果不需要，就会自动回退至该方法
    IUnRegister IEasyEvent.Register(Action onEvent)
    {
        return Register(Action);
        void Action(T _) => onEvent(); // 将Action<T>适配为Action
    }

    public override string ToString() => Value.ToString();
}

```

可以看到内容很简单：无非就是在调用`EasyEvent<T>`的操作(前面有讲解)
但是要注意有**2种反注册方法**：

- 通过`BindableProperty.UnRegister()`直接反注册
- 通过`BindableProperty.Register()`获取的IUnRegister调用`UnRegister()`进行反注册

根据观察，两种反注册方法**各有优点**：

- **直接反注册**：<VT>不能使用Lambda，需要通过函数进行反注册</VT>
- **IUnRegister反注册**：<VT>需要保存IUnRegister，通过IUnRegister才能反注册</VT>

所以的话**根据实际情况选择**即可

### Command

在UI框架中，用Command集合一组操作是非常常见的事，<VT>代码被分离到Command脚本中减轻了原代码处的职责压力</VT>

System<VT>与Model类似</VT>，具有接口ICommand以及抽象类AbstractCommand：
**接口ISystem：**

``` csharp
public interface ICommand : IBelongToArchitecture, ICanSetArchitecture, ICanGetSystem, ICanGetModel, ICanGetUtility,
    ICanSendEvent, ICanSendCommand, ICanSendQuery
{
    void Execute();
}
```

<B><VT>属于Command最关键的职责即为`Execute()`</VT></B>

Command也实现了**抽象类<GN>AbstractCommand</GN>**：　<VT>与其余的AbstractXXX无异</VT>

``` csharp
public abstract class AbstractCommand : ICommand
{
    private IArchitecture mArchitecture;

    IArchitecture IBelongToArchitecture.GetArchitecture() => mArchitecture;

    void ICanSetArchitecture.SetArchitecture(IArchitecture architecture) => mArchitecture = architecture;

    void ICommand.Execute() => OnExecute();

    protected abstract void OnExecute();
}
```

除此以外，QFramework还提供了一组**有返回值的Command**：
`public abstract class AbstractCommand<TResult> : ICommand<TResult>`

### Utility与System

最核心的当然是Architecture，随后是Controller与Model，而<B><VT>System可以认为是从Model中剥离出来的一部分，Utility则是独立的功能</VT></B>

#### Utility

Utility，即**功能**，为了实现某些内容我们就需要相应的Utility
这有点类似与<B>"纯功能框架"</B>

在QFramework中，<B><VT>Utility仅是一个IUtility接口以及相应规则</VT></B>

``` csharp
public interface IUtility
{
}

// Architecture中
public void RegisterUtility<TUtility>(TUtility utility) where TUtility : IUtility =>
    mContainer.Register<TUtility>(utility);
public TUtility GetUtility<TUtility>() where TUtility : class, IUtility => mContainer.Get<TUtility>();
```

可以看到，无非就是<VT>注册到mInstances，然后从中取出</VT>

#### System

<B><DRD>注意：System是用于处理某类问题的"管理系统"，并非是Model的子集(System可以获取Model，然后处理Model操作，但不仅仅只能这样)</DRD></B>

System<VT>与Model类似</VT>，具有接口IModel以及抽象类AbstractSystem：
**接口ISystem：**
`public interface ISystem : IBelongToArchitecture, ICanSetArchitecture, ICanGetModel, ICanGetUtility, ICanRegisterEvent, ICanSendEvent, ICanGetSystem, ICanInit {}`

同样的，AbstractSystem与注册方法`RegisterSystem()`也是与Model类似的

### Query

有时，我们可能**想获取一些组件中的值用于某些计算得出一个数值**，此时Query就提供了这种功能

接口如下：

``` csharp
public interface IQuery<TResult> : IBelongToArchitecture, ICanSetArchitecture, ICanGetModel, ICanGetSystem,
    ICanSendQuery
{
    TResult Do();
}
```

作为Query最重要的就是`Do()`，这类似于Command的`Execute()`，即计算

在Architecture中有相应的操作`SendQuery()`：

``` csharp
public TResult SendQuery<TResult>(IQuery<TResult> query) => DoQuery<TResult>(query);

protected virtual TResult DoQuery<TResult>(IQuery<TResult> query)
{
    query.SetArchitecture(this);
    return query.Do();
}
```

可以发现是和Command极其类似的，同样也具有AbstractQuery

### Architecture详述

根据源代码，可以知道一切内容都会在Architecture中收束(集中)
从其IArchitecture接口就能知道：

``` csharp
public interface IArchitecture
{
    void RegisterSystem<T>(T system) where T : ISystem;
    void RegisterModel<T>(T model) where T : IModel;
    void RegisterUtility<T>(T utility) where T : IUtility;
    T GetSystem<T>() where T : class, ISystem;
    T GetModel<T>() where T : class, IModel;
    T GetUtility<T>() where T : class, IUtility;
    void SendCommand<T>(T command) where T : ICommand;
    TResult SendCommand<TResult>(ICommand<TResult> command);
    TResult SendQuery<TResult>(IQuery<TResult> query);
    void SendEvent<T>() where T : new();
    void SendEvent<T>(T e);
    IUnRegister RegisterEvent<T>(Action<T> onEvent);
    void UnRegisterEvent<T>(Action<T> onEvent);
    void Deinit();
}
```

从中我们也可以分析出**一些规律**：

- System/Model/Utility是作为一个"系统"存在的，可以注册(到IOCContainer)，也可以获取(从IOCContainer)
- Command/Query/Event是一种操作，需要发送(执行)
- Event本质上是Action，具有注册与反注册操作

再来简单看一下**声明**：
`public abstract class Architecture<T> : IArchitecture where T : Architecture<T>, new()`
显然这是一种类似与单例的声明方法，用于把T传入内部

#### Architecture的初始化

Architecture提供了一种访问的方法Interface，第一次访问时则会初始化填充(单例)：

``` csharp
public static IArchitecture Interface
{
    get
    {
        if (mArchitecture == null) InitArchitecture();
        return mArchitecture;
    }
}

public static void InitArchitecture()
{
    if (mArchitecture == null)
    {
        // 先Init
        mArchitecture = new T();
        mArchitecture.Init();
        // 再回调(传入Arch版Init)
        OnRegisterPatch?.Invoke(mArchitecture);

        // 初始化所有model(注册过的)
        foreach (var model in mArchitecture.mContainer.GetInstancesByType<IModel>().Where(m => !m.Initialized))
        {
            model.Init();
            model.Initialized = true;
        }
        // 初始化所有system(注册过的)
        foreach (var system in mArchitecture.mContainer.GetInstancesByType<ISystem>()
                        .Where(m => !m.Initialized))
        {
            system.Init();
            system.Initialized = true;
        }

        mArchitecture.mInited = true;
    }
}
```

可以看到Model/System需要初始化，而Utility是没有在初始化中的，也就是说：<B><VT>Utility仅需Register而无需初始化操作</VT></B>
事实也确实如此，Utility的接口IUtility仅是一个空接口
同时，我们需要注意：<B><VT>Model/System/(Utility)都应该先自己Register，然后Architecture才会帮忙执行Init</VT></B>

#### 系统组件

对于**Model/System/Utility**，我们会认为是一种<B>"系统"</B>:

- Model中存储着数据，需要将数据绑定至视图，并提供访问Model的方式
- System中执行着某种功能
- Utility是某种功能，可供其它部分获取并调用

显然，它们都有一个**共同点**：<B><VT>被别人需要</VT></B>
所以它们都**提供**了**Register与Get方法**
<B><YL>以Model为例：</YL></B>

``` csharp
public void RegisterModel<TModel>(TModel model) where TModel : IModel
{
    model.SetArchitecture(this); // 填充归属
    mContainer.Register<TModel>(model); // 放入IOCContainer
    // 初始化
    if (mInited)
    {
        model.Init();
        model.Initialized = true;
    }
}

public TModel GetModel<TModel>() where TModel : class, IModel => mContainer.Get<TModel>(); // 从IOCContainer中取出
```

<YL>结合ICanGetModel，我们即可为**可访问**的架构组件提供方法：
`var model = this.GetModel<ICounterAppModel>(); // Command中`
对于该例，最终会找到`T GetModel<T>(this ICanGetModel self)`进行调用</YL>

#### 执行组件

除了以上三者，剩余的是**Command/Query/Event**，它们的**共同点**即为<B><VT>是一段需要执行的内容</VT></B>：

``` csharp
// Command
public class IncreaseCountCommand : AbstractCommand 
{
    protected override void OnExecute()
    {
        var model = this.GetModel<ICounterAppModel>();
        model.Count.Value++;
    }
}
// Query
public class SchoolAllPersonCountQuery : AbstractQuery<int>
{
    protected override int OnDo()
    {
        return this.GetModel<StudentModel>().StudentNames.Count +
                this.GetModel<TeacherModel>().TeacherNames.Count;
    }
}
// Event
CounterApp.Interface.RegisterEvent<CountChangeEvent>(e =>
{
    this.GetUtility<Storage>().SaveInt(nameof(Count), Count);
});
```

所以它们都**提供**了**Send方法**<VT>(由于Event是"嵌入的"，所以需要Register与UnRegister)</VT>
与系统组件一致，最终是通过**CanSendXXX接口**进行调用

问题：为什么Command/Event具有

#### 规则详述

在上述分析中，我们发现**接口**在QFramework中起到了非常重要的作用
在QFramework中，这些接口就是<B><GN>规则Rule</GN></B>

**观察后可以总结为以下几类：**

- Architecture：
  `IBelongToArchitecture`/`ICanSetArchitecture`
- 系统组件：
  Model/System/Utility的`Get`，同时<B><VT>提供ICanXXX的扩展方法</VT></B>
- 执行组件
  Command/Query/Event的`Send`，同时<B><VT>提供ICanSendXXX的扩展方法</VT></B>
- 初始化与反初始化：
  `ICanInit`

**Architecture**：
本质上`IBelongToArchitecture`其实可以称为`ICanGetArchitecture`
观察后我们可以得出**2种用法**：

- <B><VT>接口具有GetArchitecture能力</VT></B>
  如：IModel实现IBelongToArchitecture，在抽象类AbstractModel中具有显式接口实现：`IArchitecture IBelongToArchitecture.GetArchitecture() => mArchitecturel;`
- <B><VT>为接口添加扩展方法</VT></B>
  如：`GetModel()`---一种基于ICanGetModel获取Model的方式
  `public static T GetModel<T>(this ICanGetModel self) where T : class, IModel =>self.GetArchitecture().GetModel<T>();`

<B><BL>问题：IController为什么要自行实现，而IModel被封装在AbstractModel中的显式接口</BL></B>
<BL>显而易见的是两者的功能不同：</BL>

- Model实现了接口的GetSetArchitecture/Init功能，这是接口需要的，而Controller仅有IBelongToArchitecture需要实现
- Model是需要注册进Architecture中的，Controller不需要

更重要的是：

``` csharp
public class CounterAppController : MonoBehaviour , IController
{
    void Start()
    {
        mModel = this.GetModel<ICounterAppModel>();
        // ...
    }

    public IArchitecture GetArchitecture()
    {
        return CounterApp.Interface;
    }
}
```

``` csharp
// Architecture中
public void RegisterModel<TModel>(TModel model) where TModel : IModel
{
    model.SetArchitecture(this); // 存入mArchitecturel
    mContainer.Register<TModel>(model);

    if (mInited)
    {
        model.Init();
        model.Initialized = true;
    }
}

public abstract class AbstractModel : IModel
{
    private IArchitecture mArchitecturel;

    // 对于Architecture中注册过的Model来说，调用时可直接获取
    IArchitecture IBelongToArchitecture.GetArchitecture() => mArchitecturel;

    void ICanSetArchitecture.SetArchitecture(IArchitecture architecture) => mArchitecturel = architecture;

    // ...
}
```

**<VT>Controller需要自行指定Architecture获取，Model可自行捕获</VT>**

**扩展方法：**

可以看到**ICanXXX接口**在QFramework中是极其重要的
以ICanGetModel为例：

``` csharp
public interface ICanGetModel : IBelongToArchitecture
{
}

public static class CanGetModelExtension
{
    public static T GetModel<T>(this ICanGetModel self) where T : class, IModel =>
        self.GetArchitecture().GetModel<T>();
}
```

首先，在前面也有所提及：<VT>一种组件具有ICanXXX接口的话，自然能调用相应功能</VT>，同时，这些功能都有一个**前提：IBelongToArchitecture**，可以看到，因为是**从Architecture中调用相应方法的**
这里有一个**重点**：
<B><VT>事实上调用的是`IBelongToArchitecture.GetArchitecture()`，所以说如果AbstractModel的实现类重写了显式接口实现，即可更改<DRD>(不应该这么做)</DRD>，而如果直接实现`GetArchitecture()`则是无用的</VT></B>

##### 组件规则

在前文中，组件接口并没有详细考虑<B><BL>为什么有这些规则</BL></B>，这里来详细看一下：

- `IController : IBelongToArchitecture, ICanSendCommand, ICanGetSystem, ICanGetModel, ICanRegisterEvent, ICanSendQuery, ICanGetUtility`
- `IModel : IBelongToArchitecture, ICanSetArchitecture, ICanGetUtility, ICanSendEvent, ICanInit`
- `ISystem : IBelongToArchitecture, ICanSetArchitecture, ICanGetModel, ICanGetUtility, ICanRegisterEvent, ICanSendEvent, ICanGetSystem, ICanInit`
- `ICommand : IBelongToArchitecture, ICanSetArchitecture, ICanGetSystem, ICanGetModel, ICanGetUtility,ICanSendEvent, ICanSendCommand, ICanSendQuery`
- `IQuery<TResult> : IBelongToArchitecture, ICanSetArchitecture, ICanGetModel, ICanGetSystem, ICanSendQuery`
- `IUtility(空)`
- 无Event

**以操作分组**进行分析是比较合理的

首先是**获取Get**：
可获取的组件有：**Model/System/Utility**，也就是我们前面说的**系统组件**
**<DRD>注意：Get对应的是Register，但并没有相应规则，Register在Architecture有所实现</DRD>**

- **Model：**
  <VT>需要的组件---Controller/System/Command/Query</VT>
  Model可以说是最常用的了，无论什么操作都会用到数据，所以都需要获取

  - **Model获取Model**是一件非常<B><DRD>不建议</DRD></B>的操作，这是一种<VT><B>直接引用，会造成混乱</B>(A要B/C，B要A/C，C要A/B，Model多的话会非常灾难)</VT>
  
- **System：**
  <VT>需要的组件---Controller/System/Command/Query</VT>
  System是和Model保持一致，但是原因不同：
  - System可以提供任何可能的功能，所以几乎所有的组件都可以获取
  - Model不能获取是因为Model是数据，<B><VT>System的操作是偏向业务的，职责不同</VT></B>
  
- **Utility：**
  <VT>需要的组件---Controller/Model/System/Command</VT>
  
  - Utility是比较好分析的，由于是一种功能，所以基本上肯定能用
  - 没有实现ICanGetUtility的是Query，<B><VT>Query是查询，当然不需要调用任何功能来完成</VT></B>
  - **<BL>问题：为什么Model需要Utility</BL>**
  <BL>Model大部分情况是纯数据，但Model同样可以进行操作(有一个`OnInit()`方法)，此时可能会用到Utility</BL>

<BR>

然后是**发送Send**：
可发送的组件有：**Command/Event/Query**，也就是我们前面说的**执行组件**

- **Command：**
  <VT>需要的组件---Controller/Command</VT>
  可以发送命令的组件不多，只有Controller与自己Command

  - Command可以发送Command，即可以嵌套，这是很好理解的
  - Controller需要Command是因为<B><VT>Command本质上其实就是为事件监听准备的</VT></B>

  > 在UI框架中，用Command集合一组操作是非常常见的事，<VT>代码被分离到Command脚本中减轻了原代码处的职责压力</VT>
- **Event：**
  <VT>需要的组件---Controller/Model/System/Command</VT>
  可以发现Event要比Command**泛用**一些，除了Query都可以使用

  - 与Utility一致，Query不可以使用：<B><VT>Query是查询，当然不需要触发任何事件</VT></B>
  
- **Query：**
  <VT>需要的组件---Controller/Command/Query</VT>
  Query是一个用于查询结果并返回的组件，那么需要的组件一定是需要某项结果的，Model与System不行出于以下原因：
  
  - Model是数据，不能发送查询命令是再正常不过的了
  - System大概是为了减少复杂度，想要操作那就自己运算，不要通过Query查询获取

再然后是**注册Register**：
需要通过接口来注册的只有Event
<VT>需要的组件---Controller/System</VT>

- Controller注册事件是显而易见的，因为视图更新回调需要在Controller中完成
- System则有可能会包装Model操作，需要封装成事件用于调用

<BR>

除此以外还有3个接口：ICanInit/IBelongToArchitecture/ICanSetArchitecture

- **ICanInit**是非常简单的，<VT>需要的组件---Model/System</VT>
  这与Architecture中的`RegisterModel()`/`RegisterSystem()`对应
- **IBelongToArchitecture/ICanSetArchitecture**则与ICanXXX扩展方法有关：
**<VT>如果需要来自Architecture的某方法的话就必须实现IBelongToArchitecture与ICanSetArchitecture两个接口</VT>**
可以看到大部分组件都实现了两接口，<VT>需要的组件---System/Model/Command/Query</VT>
**<BL>问题：为什么Controller仅实现了IBelongToArchitecture</BL>**
<BL>回想Controller的实现，会发现：IController并没有实现抽象类，因此我们仅需实现`GetArchitecture()`，之后在调用相应功能时可直接获取
反过来说，其它组件需要ICanSetArchitecture接口是因为注册时的自动化Set需要，而Controller手动传入了，所以不需要</BL>

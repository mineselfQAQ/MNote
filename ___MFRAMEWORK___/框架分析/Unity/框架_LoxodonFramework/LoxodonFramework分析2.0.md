**<center><BBBG>LoxodonFramework分析第二版</BBBG></center>**

<!-- TOC -->

- [业务分析](#业务分析)
  - [分层架构](#分层架构)
  - [例子简析](#例子简析)
    - [Launcher](#launcher)
    - [View/ViewModel](#viewviewmodel)
    - [其它](#其它)
      - [Domains](#domains)
      - [Services](#services)
      - [Locator](#locator)
      - [Provider](#provider)
- [框架分析](#框架分析)
  - [前置](#前置)
    - [宏](#宏)
    - [设计模式](#设计模式)
  - [其它](#其它-1)
    - [Log](#log)
    - [ObjectPool](#objectpool)
    - [存储相关](#存储相关)
      - [Preferences](#preferences)
      - [Configuration](#configuration)
    - [触发相关](#触发相关)
      - [Observables](#observables)
      - [Interactivity](#interactivity)
      - [Messaging](#messaging)
      - [区别](#区别)
    - [Asynchronous](#asynchronous)

<!-- /TOC -->

<BR>

LoxodonFramework是一套<B><VT>基于Unity</VT></B>的**UI框架**
阅读LoxodonFramework源码后，可以直观地感受到它的<B>特性：<VT>代码结构商业化</VT></B>
所以说该框架是非常**值得学习**的

首先先看一下其**功能方向**，也就是它的文件夹：
![](Pic/Loxodon1.png)
整体来说这些内容是相辅相成的，主要目标还是为了构建UI框架
在上述文件夹中，我们能发现**ViewModels/Views**，这也说明了该框架是<B><VT>基于MVVM</VT></B>的

# 业务分析

框架制作者提供了一个例子供我们参考，如下所示：
![](Pic/Loxodon3.png)

## 分层架构

<B><GN>分层架构</GN></B>是非常常提到的一个名词，我们可以简单地理解为<B><VT>设计规范</VT></B>
简述一下这里使用到的**分层架构**：

- 表现层
  - View
  - ViewModel
- 服务层
  - Service
- 领域层(Domain Model，可以认为是Model)
- 基础层
  - 框架
  - 各类组件(如网络/Log/...)
  - 辅助类

可以看到这些内容与框架内容是**强关联**的,可以说大部分情况下是由框架提供的这些能力

## 例子简析

在分析源码前，看一个例子会是比较好的选择

### Launcher

**Launcher.cs**是主脚本，也就是唯一入口：

``` csharp
public class Launcher : MonoBehaviour
{
    //private static readonly ILog log = LogManager.GetLogger(System.Reflection.MethodBase.GetCurrentMethod().DeclaringType);

    private ApplicationContext context;
    ISubscription<WindowStateEventArgs> subscription;
    void Awake()
    {
        GlobalWindowManagerBase windowManager = FindObjectOfType<GlobalWindowManagerBase>();
        if (windowManager == null)
            throw new NotFoundException("Not found the GlobalWindowManager.");

        context = Context.GetApplicationContext();

        IServiceContainer container = context.GetContainer();

        /* Initialize the data binding service */
        BindingServiceBundle bundle = new BindingServiceBundle(context.GetContainer());
        bundle.Start();

        /* Initialize the ui view locator and register UIViewLocator */
        container.Register<IUIViewLocator>(new ResourcesViewLocator());

        /* Initialize the localization service */
        //CultureInfo cultureInfo = Locale.GetCultureInfoByLanguage (SystemLanguage.English);
        CultureInfo cultureInfo = Locale.GetCultureInfo();
        var localization = Localization.Current;
        localization.CultureInfo = cultureInfo;
        localization.AddDataProvider(new ResourcesDataProvider("LocalizationExamples", new XmlDocumentParser()));

        /* register Localization */
        container.Register<Localization>(localization);

        /* register AccountRepository */
        IAccountRepository accountRepository = new AccountRepository();
        container.Register<IAccountService>(new AccountService(accountRepository));

        /* Enable window state broadcast */
        GlobalSetting.enableWindowStateBroadcast = true;
        /* 
            * Use the CanvasGroup.blocksRaycasts instead of the CanvasGroup.interactable 
            * to control the interactivity of the view
            */
        GlobalSetting.useBlocksRaycastsInsteadOfInteractable = true;

        /* Subscribe to window state change events */
        subscription = Window.Messenger.Subscribe<WindowStateEventArgs>(e =>
        {
            Debug.LogFormat("The window[{0}] state changed from {1} to {2}", e.Window.Name, e.OldState, e.State);
        });
    }

    IEnumerator Start()
    {
        /* Create a window container */
        WindowContainer winContainer = WindowContainer.Create("MAIN");

        yield return null;

        IUIViewLocator locator = context.GetService<IUIViewLocator>();
        StartupWindow window = locator.LoadWindow<StartupWindow>(winContainer, "UI/Startup/Startup");
        window.Create();
        ITransition transition = window.Show().OnStateChanged((w, state) =>
        {
            //log.DebugFormat("Window:{0} State{1}",w.Name,state);
        });

        yield return transition.WaitForDone();
    }
}
```

先看<B>`Awake()`</B>，都是一些**初始化操作**
可以看到出现最多的就是<B>`container.Register()`</B>操作，即<B><VT>服务注册</VT></B>，有：

- UIViewLocator
- Localization
- AccountRepository

除此以外还有：

- Binding初始化
- GlobalSettings设置
- Messenger订阅

<BR>

创建窗口流程在<B>`Start()`</B>中，流程也比较简单，核心当然是`window.Create()`

### View/ViewModel

View和ViewModel是相辅相成的两者，其中：

- View是视图，主要是获取Unity中的控件进行一些操作
- ViewModel是View与Model的中间者，用于沟通两者

**<YL>这里用LoginWindow来展示：</YL>**
先看一下两者的**声明**：
`public class LoginWindow : Window`
`public class LoginViewModel : ViewModelBase`

观察View脚本**LoginWindow.cs**，可以说干了两件事：

- 获取Unity组件(通过public，也就是序列化)
- 在`OnCreate()`中进行绑定：
<BR>

``` csharp
protected override void OnCreate(IBundle bundle)
{
    this.toastAction = new ToastInteractionAction(this);
    BindingSet<LoginWindow, LoginViewModel> bindingSet = this.CreateBindingSet<LoginWindow, LoginViewModel>();
    bindingSet.Bind().For(v => v.OnInteractionFinished).To(vm => vm.InteractionFinished);
    //bindingSet.Bind().For(v => v.OnToastShow).To(vm => vm.ToastRequest);
    bindingSet.Bind().For(v => v.toastAction).To(vm => vm.ToastRequest);

    bindingSet.Bind(this.username).For(v => v.text, v => v.onEndEdit).To(vm => vm.Username).TwoWay();
    bindingSet.Bind(this.usernameErrorPrompt).For(v => v.text).To(vm => vm.Errors["username"]).OneWay();
    bindingSet.Bind(this.password).For(v => v.text, v => v.onEndEdit).To(vm => vm.Password).TwoWay();
    bindingSet.Bind(this.passwordErrorPrompt).For(v => v.text).To(vm => vm.Errors["password"]).OneWay();
    bindingSet.Bind(this.confirmButton).For(v => v.onClick).To(vm => vm.LoginCommand);
    bindingSet.Bind(this.cancelButton).For(v => v.onClick).To(vm => vm.CancelCommand);
    bindingSet.Build();
}
```

而ViewModel脚本**LoginViewModel.cs**当然会与其配对：

``` csharp
public LoginViewModel(IAccountService accountService, Localization localization, Preferences globalPreferences)
{
    // ...
    this.loginCommand = new SimpleCommand(this.Login);
    this.cancelCommand = new SimpleCommand(() =>
    {
        this.interactionFinished.Raise();/* Request to close the login window */
    });
}

public string Username
{
    get { return this.username; }
    set
    {
        if (this.Set(ref this.username, value))
        {
            this.ValidateUsername();
        }
    }
}
// PassWord同上

```

View与ViewModel本质上内容并不多，做的事情就是绑定，比如说：
`bindingSet.Bind(this.username).For(v => v.text, v => v.onEndEdit).To(vm => vm.Username).TwoWay();`
这就是<VT>将username(一个InputField)的text属性绑定上ViewModel中的Username，而且是双向的，这意味着当输入内容修改，代码设置数据了视图会自动更新，用户输入了数据会自动更新</VT>

### 其它

其它内容都是附属于上述内容的，那么来看一下

#### Domains

Domains前面提到过，是领域层，简单理解<B><VT>可以认为是Model</VT></B>
在这里的话就是**Account.cs**：

``` csharp
public class Account : ObservableObject
{
    private string username;
    private string password;

    private DateTime created;

    public string Username {
        get{ return this.username; }
        set{ this.Set(ref this.username, value); }
    }

    public string Password {
        get{ return this.password; }
        set{ this.Set(ref this.password, value); }
    }

    public DateTime Created {
        get{ return this.created; }
        set{ this.Set(ref this.created, value); }
    }
}
```

由于它具有和ViewModelBase一样的**基类ObservableObject**，所以如`Username`属性是非常相似的，但Account从**功能**上还是**不太一样**的：
它牵扯到两个类：**AccountRepository/AccountService**

#### Services

服务本质上就是<B><VT>一个个功能</VT></B>，很明显AccountService就是一个有关Account的功能
<B><GN>AccountRepository</GN></B>是Account的存储地，使用字典`Dictionary<string, Account>`完成
<B><GN>AccountService</GN></B>则使用AccountRepository提供了相关功能，有：

- `Register()`：保存Account
- `Update()`：未实现
- `Login()`：尝试登陆(验证密码是否正确)

注册该服务可执行操作：
`Account account = await this.accountService.Login(this.username, this.password);`

#### Locator

**Locator**即定位器，也就是<B><GN>服务定位器模式Service Locator Pattern</GN></B>
简单来说功能就是：<B><VT>提供A，找到B(隐藏细节)</VT></B>
**核心点：<VT>查找能力</VT>**

<B><GN>ResourcesViewLocator</GN></B>则就是通过一定的规则获取Window：
`StartupWindow window = locator.LoadWindow<StartupWindow>(winContainer, "UI/Startup/Startup");`

#### Provider

**Provider**即提供者，和Service类似，能够<B><VT>提供数据</VT></B>
**核心点：<VT>提供能力</VT>**
看一下<B><GN>ResourcesDataProvider</GN></B>/<B><GN>AssetBundleDataProvider</GN></B>的共同接口IDataProvider即可知道：

``` csharp
public interface IDataProvider
{
    Task<Dictionary<string, object>> Load(CultureInfo cultureInfo);
}
```

也就是根据语言信息获取键值对

# 框架分析

框架本身就是**UI框架**，可以说所有创建的内容都是为了实现好的UI效果而创建的
前面也提到过，该框架使用的是<B><GN>MVVM</GN></B>，其中**最重要的就是绑定**
简单分类的话可以这么分：

- 框架---M/V/VM
- 绑定
- 其它

## 前置

在分析代码前，先介绍一下在后续会出现的一些比较特殊的内容

### 宏
在代码中常常会出现如下代码：

``` csharp
#if NETFX_CORE
    // ...
#else
    // ...
#endif
```

在[Unity文档](https://docs.unity.cn/cn/2019.4/Manual/PlatformDependentCompilation.html)中有所介绍：
> UNITY_WSA：用于通用 Windows 平台的 #define 指令。此外，根据 .NET Core 和使用 .NET 脚本后端来编译 C# 文件时会定义 NETFX_CORE。

### 设计模式
设计模式当然是用来构建好代码的关键，该框架使用了很多设计模式

**<GN>工厂模式</GN>**
工厂模式在该框架中极大量的出现，随便看一处：

``` csharp
public static Preferences GetPreferences(string name)
{
    Preferences prefs;
    if (cache.TryGetValue(name, out prefs))
        return prefs;

    prefs = GetFactory().Create(name);
    cache[name] = prefs;
    return prefs;
}
```

以上就是一种<B><VT>工厂创建并存储</VT></B>的方式
**好处：<GN>封装完整</GN>**
<B><YL>就以上述Preferences举例：</YL></B>
<YL>框架本身提供了PlayerPrefsPreferences/BinaryFilePreferences两种派生类供使用，如果没有工厂类，可能会有如下代码：</YL>

``` csharp
Preferences prefs;
if (XXX) {
    prefs = new PlayerPrefsPreferences(...);
} else {
    prefs = new BinaryFilePreferences(...);
}
```

<YL>如果需要新增Preferences：
这是在业务类实现的代码，即使只有一处我们也需要找到该处才能新增
而有工厂类的话逻辑是固定的：</YL>

``` csharp
Preferences.Register(new FilePreferencesFactory());
// 后续直接调用Preferences封装代码即可
var prefs = Preferences.GetPreferences(...);
```

<YL>显然是添加了工厂类的会更加有逻辑</YL>
简单来说：<B><VT>工厂类将需要的操作包装了一层，可见性更加良好</VT></B>

## 其它

无论是框架还是绑定，都将用到许多**组件辅助类**之类的内容，这里先都分析一下
内容比较多，可以在用到后再进行查阅
**简单来说，可以分为以下几种：**

- 辅助类，即Utility
- 功能类，与框架无强关联
  - Log
  - ObjectPool
- 框架功能类，与框架具有较强关联
  - Preferences
  - Configuration
  - Asynchronous
  - Observables
  - Interactivity
  - Messaging
  - Execution
- 框架底层类，与框架具有强关联
  - Context

### Log

`Debug.Log()`可以说是我们在Unity中最常用的一个API了，**功能**就是<VT><B>输出信息</VT></B>，该框架对其进行了一定的**扩展**

**项目内用法：**
`private static readonly ILog log = LogManager.GetLogger(typeof(XXX));`
**核心类：**

- LogManager
- DefaultLogFactory

<BR>

<B><GN>LogManager</GN></B>
Manager显然是**管理类**，功能很简单：

- `GetLogger()`：获取ILog
- `Registry()`：更改Factory

`GetLogger()`是其关键：

``` csharp
private static readonly DefaultLogFactory _defaultFactory = new DefaultLogFactory();
private static ILogFactory _factory;

public static ILog GetLogger(Type type)
{
    if (_factory != null)
        return _factory.GetLogger(type);

    return _defaultFactory.GetLogger(type);
}
```

显然Manager仅为组织者，具体还是需要**看Factory**
<B><GN>DefaultLogFactory</GN></B>
默认提供的工厂为DefaultLogFactory，当然`GetLogger()`是其关键：

``` csharp
public ILog GetLogger(Type type)
{
    ILog log;
    if (repositories.TryGetValue(type.FullName, out log))
        return log;

    log = new LogImpl(type.Name, this); // 创建log
    repositories[type.FullName] = log;
    return log;
}
```

可以得知：<B><VT>一个Type会创建一个LogImpl，也就是单例</VT></B>
<B><GN>LogImpl</GN></B>当然是一个ILog，也就是我们获取到的内容
LogImpl<B><VT>对Unity的Debug类进行了封装</VT></B>，具体如下：

- `Debug()`：原Log
- `Info()`：原Log
- `Warn()`：原LogWarning
- `Error()`：原LogError
- `Fatal()`：原LogError
- 上述5种函数的Format版本(如`DebugFormat()`)

**<BL>问题：`Debug()`与`Info()`的区别</BL>**
<BL>两者实现是完全一致的，都用的是`Debug.Log()`但它们的level是不一样的：</BL>
`UnityEngine.Debug.Log(Format(message, "DEBUG"));`
`UnityEngine.Debug.Log(Format(message, "INFO"));`
**<VT>`Error()`与`Fatal()`同理</VT>**

下面就用`Debug()`展示一下：

``` csharp
protected virtual string Format(object message, string level)
{
    return string.Format("{0:yyyy-MM-dd HH:mm:ss.fff} [{1}] {2} - {3}", System.DateTime.Now, level, name, message);
}

public virtual void Debug(object message)
{
    if (this._factory.InUnity)
        UnityEngine.Debug.Log(Format(message, "DEBUG"));
#if !NETFX_CORE
    else
        Console.WriteLine(Format(message, "DEBUG"));
#endif
}
public virtual void Debug(object message, Exception exception)
{
    Debug(string.Format("{0} Exception:{1}", message, exception));
}
```

可以看到就是<VT>添加了一些信息</VT>：**时间/log等级/log对象**
level提供了一些等级控制开关，如`IsDebugEnabled()`，这里需要注意的是是否开启取决于对工厂Level的设置，有：

``` csharp
protected bool IsEnabled(Level level)
{
    return level >= this._factory.Level;
}

public enum Level
{
    ALL = 0,
    DEBUG,
    INFO,
    WARN,
    ERROR,
    FATAL,
    OFF
}
```

可以发现这样就处于一种**包含的层级关系**，就像默认的`Level.ALL`就会记录所有level，而`Level.WARN`就只会记录比本身以及比`Level.WARN`更严重的错误(ERROR/FATAL)
可以想到：<B><VT>这是一种基于上线的策略，某些情况，只需记录严重bug即可，其余小问题是无所谓的</VT></B>

### ObjectPool

**<VT>ObjectPool在框架中并无使用，但是作者还是提供了该功能</VT>**
一共有**2种形态**：

- ObjectPool
- MixedObjectPool

先看单纯的<B><GN>ObjectPool</GN></B>：
其**声明**为：
`public class ObjectPool<T> : IObjectPool<T> where T : class`
接口内容不多，**核心**就是：`Allocate()`/`Free()`，这也正是对象池该做的事情
该类的构造函数表明了它的基：

``` csharp
public ObjectPool(IObjectFactory<T> factory, int initialSize, int maxSize)
{
    this.factory = factory;
    this.initialSize = initialSize;
    this.maxSize = maxSize;
    this.entries = new Entry[maxSize];

    if (maxSize < initialSize)
        throw new ArgumentException("the maxSize must be greater than or equal to the initialSize");

    for (int i = 0; i < initialSize; i++)
    {
        this.entries[i].value = factory.Create(this);
    }
}
```

一共有3个信息：**初始容量/最大容量/创建工厂**
显然**工厂**是最重要的：
对于ObjectPool，工厂只提供了一种，为<B><GN>UnityGameObjectFactoryBase</GN></B>，内容也很简单：

``` csharp
public abstract class UnityGameObjectFactoryBase : IObjectFactory<GameObject>
{
    public virtual GameObject Create(IObjectPool<GameObject> pool)
    {
        GameObject target = this.Create();
        PooledUnityObject pooledObj = target.AddComponent<PooledUnityObject>();
        pooledObj.pool = pool;
        return target;
    }

    protected abstract GameObject Create();

    public abstract void Reset(GameObject obj);

    public virtual void Destroy(GameObject obj)
    {
        Object.Destroy(obj);
    }

    public virtual bool Validate(GameObject obj)
    {
        return true;
    }

    class PooledUnityObject : MonoBehaviour, IPooledObject
    {
        internal IObjectPool<GameObject> pool;

        public void Free()
        {
            if (pool != null)
                pool.Free(this.gameObject);
        }
    }
}
```

可以看到没什么特殊的，就是<B><VT>创一个GameObject，然后封装成PooledUnityObject</VT></B>

再来看一下**Mixed版本**：
对于Mixed版本，可以发现基础有所变化：

``` csharp
public MixedObjectPool(IMixedObjectFactory<T> factory, int defaultMaxSizePerType)
{
    this.factory = factory;
    this.defaultMaxSizePerType = defaultMaxSizePerType;

    if (defaultMaxSizePerType <= 0)
        throw new ArgumentException("the maxSize must be greater than 0");

    this.entries = new ConcurrentDictionary<string, List<T>>();
    this.typeSize = new ConcurrentDictionary<string, int>();
}
```

可以发现entries变为了一个字典，而且多了一个typeSize字典
最起码我们肯定能知道：<B><VT>这是一个存储多种类型的对象池</VT></B>
同样的，创建还是通过**工厂**完成，即<B><GN>UnityMixedGameObjectFactoryBase</GN></B>：

``` csharp
public virtual GameObject Create(IMixedObjectPool<GameObject> pool, string typeName)
{
    GameObject target = this.Create(typeName);
    PooledUnityObject pooledObj = target.gameObject.AddComponent<PooledUnityObject>();
    pooledObj.pool = pool;
    pooledObj.target = target;
    pooledObj.typeName = typeName;
    return target;
}
```

整体是完全一致的，只是多了一个typeName
拿一个<B><YL>作者例子</YL></B>就能很清晰的说明了：

``` csharp
public class CubeMixedObjectFactory : UnityMixedGameObjectFactoryBase
{
    // ...
    protected override GameObject Create(string typeName)
    {
        Debug.LogFormat("Create a cube.");
        GameObject go = GameObject.Instantiate(this.template, parent);
        go.GetComponent<MeshRenderer>().material.color = GetColor(typeName);
        return go;
    }

    protected Color GetColor(string typeName)
    {
        if (typeName.Equals("red"))
            return Color.red;
        if (typeName.Equals("green"))
            return Color.green;
        if (typeName.Equals("blue"))
            return Color.blue;

        throw new NotSupportedException("Unsupported type:" + typeName);
    }
    // ...
}
```

这些代码足以看出：<B><VT>typeName不一定是Type，只要能做出区分即可</VT></B>
所以：<B><VT>Mixed不一定是多GameObject混合，单GameObject的多形态更是它的主功能</VT></B>

### 存储相关

**Preferences**与**Configuration**两者都是有关存储的内容
当然它们有着**不同的侧重点**：

- Preferences：项目相关
- Configuration：更多的是一种外部设置，不可保存

#### Preferences
Preferences是**ApplicationContext的重要组成部分**，有：

``` csharp
public virtual Preferences GetGlobalPreferences()
{
    // 本质还是Preferences.GetPreferences()
    return Preferences.GetGlobalPreferences();
}
public virtual Preferences GetUserPreferences(string name)
{
    return Preferences.GetPreferences(name);
}
```

那么先来看一下<B><GN>基础类Preferences</GN></B>：

- **创建**
  对于Preferences，创建是通过工厂完成的，即`prefs = GetFactory().Create(name)`
  具体选择哪个工厂当然取决于`GetFactory()`，有2个选项：`_factory`/`_defaultFactory`
  `_defaultFactory`是一个PlayerPrefsPreferencesFactory
  而`_factory`是通过`Register()`注册存放的(只有1个)
- **获取**
  获取其实和创建是合二为一的，与大部分类相同，这里同样使用的是**工厂模式**，方法如下：
  <BR>

  ``` csharp
  public static Preferences GetPreferences(string name)
  {
      Preferences prefs;
      if (cache.TryGetValue(name, out prefs))
          return prefs;
    
      prefs = GetFactory().Create(name);
      cache[name] = prefs;
      return prefs;
  }

  static Preferences()
  {
      _defaultFactory = new PlayerPrefsPreferencesFactory();
  }
  protected static IFactory GetFactory()
  {
      if (_factory != null)
          return _factory;
      return _defaultFactory;
  }
  ```

  显然，<B><GN>PlayerPrefsPreferencesFactory</GN></B>是创建的关键

- **Get/Set**
  可以说Preferences就是用来进行该操作的，即存储信息获取信息
  在类中可以看到极大量的操作，但核心都指向了`GetObject()`/`SetObject()`
  但其实是abstract函数，需子类实现
- **其它操作**
  除此以外还有一些abstract函数，为：`Save()`/`Delete()`/`Load()`/`Remove()`

**用法**如下：
`var globalPreferences = context.GetGlobalPreferences();`
`this.username = globalPreferences.GetString(LAST_USERNAME_KEY, "");`

<BR>

当然，既然<B><VT>有工厂那么必然会生产出不同类型的实例</VT></B>，有：

- PlayerPrefsPreferencesFactory：生产PlayerPrefsPreferences
- BinaryFilePreferencesFactory：生产BinaryFilePreferences

**两工厂声明**如下：
`public class PlayerPrefsPreferencesFactory : AbstractFactory`
`public class BinaryFilePreferencesFactory : AbstractFactory`
作为**AbstractFactory**，其核心为：

- `Create()`：创建Preferences
- `IEncryptor encryptor`：加密功能，默认为<B><GN>DefaultSerializer</GN></B>
- `ISerializer serializer`：序列化功能，默认为<B><GN>DefaultEncryptor</GN></B>
<BR>

``` csharp
public AbstractFactory(ISerializer serializer, IEncryptor encryptor)
{
#if UNITY_IOS
    Environment.SetEnvironmentVariable("MONO_REFLECTION_SERIALIZER", "yes");
#endif
    this.serializer = serializer;
    this.encryptor = encryptor;

    // 当然，作者提供了默认的工具
    if (this.serializer == null)
        this.serializer = new DefaultSerializer();

    if (this.encryptor == null)
        this.encryptor = new DefaultEncryptor();
}
```

**<GN>PlayerPrefsPreferences</GN>**

作为存储数据，获取流程必然是<B><VT>先加载再读取</VT></B>
**加载**即`Load()`，有：

``` csharp
public PlayerPrefsPreferences(string name, ISerializer serializer, IEncryptor encryptor) : base(name)
{
    this.serializer = serializer;
    this.encryptor = encryptor;
    this.Load();
}
protected override void Load()
{
    LoadKeys();
}

protected virtual void LoadKeys()
{
    if (!PlayerPrefs.HasKey(Key(KEYS)))
        return;

    string value = PlayerPrefs.GetString(Key(KEYS));
    if (string.IsNullOrEmpty(value))
        return;

    string[] keyValues = value.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
    foreach (string key in keyValues)
    {
        if (string.IsNullOrEmpty(key))
            continue;

        this.keys.Add(key);
    }
}
```

**<BL>问题：`Key(KEY)`是什么</BL>**

``` csharp
protected static readonly string KEYS = "_KEYS_";

protected string Key(string key)
{
     // Name为构造函数传入，默认为GLOBAL_NAME，即"_GLOBAL_"
    StringBuilder buf = new StringBuilder(this.Name);
    buf.Append(".").Append(key);
    return buf.ToString();
}
```

<BL>所以简单来说这种形式下就是<B>加了一个前缀</B>，本质上只是用于<B><VT>区分所属实例Preferences</VT></B></BL>

所以<B>`Load()`</B>所做的就是：
**<VT>获取PlayerPrefs所存储的数据集，并拆解成List形式(`keys`)</VT>**

**存取**是通过<B>`SetObject()`/`GetObject()`</B>完成的：

``` csharp
public override void SetObject(string key, object value)
{
    // 序列化为string
    string str = value == null ? "" : serializer.Serialize(value);
    // 加密
    if (this.encryptor != null)
    {
        // 加密方式：转strng明文(二进制)，加密，转string
        byte[] data = Encoding.UTF8.GetBytes(str);
        data = this.encryptor.Encode(data);
        str = Convert.ToBase64String(data);
    }

    PlayerPrefs.SetString(Key(key), str);

    if (!this.keys.Contains(key))
    {
        this.keys.Add(key);
        this.SaveKeys();
    }
}
```

可以看到处理好数据后，本质上其实就是在<B><VT>调用Unity的PlayerPrefs类进行存储</VT></B>
`PlayerPrefs.SetString()`看似已经保存完毕，但这<B><DRD>还不够</DRD></B>：
我们可能保存了许多键值对，我们当然可以手动取出某一个，但到底有哪些我们其实是不知道的，假设我们需要执行`RemoveAll()`来删除所有已有数据，这是无法做到的
<B>`SaveKeys()`</B>就是关键的一步：<B><VT>将所有key保存至PlayerPrefs</VT></B>：

``` csharp
protected virtual void SaveKeys()
{
    if (this.keys == null || this.keys.Count <= 0)
    {
        PlayerPrefs.DeleteKey(Key(KEYS));
        return;
    }

    string[] values = keys.ToArray(); // 取出keys
    // 拼接keys
    StringBuilder buf = new StringBuilder();
    for (int i = 0; i < values.Length; i++)
    {
        if (string.IsNullOrEmpty(values[i]))
            continue;

        buf.Append(values[i]);
        if (i < values.Length - 1)
            buf.Append(",");
    }
    
    PlayerPrefs.SetString(Key(KEYS), buf.ToString());
}
```

可以看到<B><VT>`SaveKeys()`这是在将所有的key用另一个key保存了</VT></B>，它的key就是`Pref名._KEYS_`

<YL>这里<B>举个例子</B>就很好理解了：
`globalPreferences.SetString("LAST_USERNAME", "A")`
`globalPreferences.SetString("FIRST_USERNAME", "B")`
对于GlobalPreferences来说，其Name为`_GLOBAL_`
对于第一句：
此时key为`"_GLOBAL_.LAST_USERNAME"`，value为`"A"`的加密string形式
同时`SaveKeys()`也会存储另一份合集形式，此时key为`_GLOBAL_._KEYS_`，value为`"LAST_USERNAME"`
对于第二句：
此时key为`"_GLOBAL_.FIRST_USERNAME"`，value为`"B"`的加密string形式
同时`SaveKeys()`会进行扩展，此时key为`_GLOBAL_._KEYS_`，value为`"LAST_USERNAME,FIRST_USERNAME"`</YL>


我们能**更清晰地了解**到：
**<VT>本质上`PlayerPrefs.SetString()`是存储，而`SaveKeys()`是更高层面的存储，也就是存储了有哪些key</VT>**
所以我们就能实现这种**清除手段**：

``` csharp
public override void RemoveAll()
{
    foreach (string key in keys)
    {
        PlayerPrefs.DeleteKey(Key(key));
    }
    PlayerPrefs.DeleteKey(Key(KEYS));
    this.keys.Clear();
}
```

**<GN>BinaryFilePreferences</GN>**
BinaryFilePreferences是同理的，用的是BinaryFile，也就是<B><VT>文件流</VT></B>

#### Configuration

Configuration同样是存储设置，但是是不同的
**<YL>先看例子：</YL>**

``` csharp
public class ConfigurationExample : MonoBehaviour
{
    private void Start()
    {
        IConfiguration conf = CreateConfiguration();
        Version appVersion = conf.GetVersion("application.app.version");
        Version dataVersion = conf.GetVersion("application.data.version");

        Debug.LogFormat("application.app.version:{0}", appVersion);
        Debug.LogFormat("application.data.version:{0}", dataVersion);

        string groupName = conf.GetString("application.config-group");
        IConfiguration currentGroupConf = conf.Subset("application." + groupName);

        string upgradeUrl = currentGroupConf.GetString("upgrade.url");
        string username = currentGroupConf.GetString("username");
        string password = currentGroupConf.GetString("password");
        string[] gatewayArray = currentGroupConf.GetArray<string>("gateway");

        Debug.LogFormat("upgrade.url:{0}", upgradeUrl);
        Debug.LogFormat("username:{0}", username);
        Debug.LogFormat("password:{0}", password);

        int i = 1;
        foreach (string gateway in gatewayArray)
        {
            Debug.LogFormat("gateway {0}:{1}", i++, gateway);
        }
    }

    private IConfiguration CreateConfiguration()
    {
        List<IConfiguration> list = new List<IConfiguration>();

        //Load default configuration file
        TextAsset text = Resources.Load<TextAsset>("application.properties");
        list.Add(new PropertiesConfiguration(text.text));

        //Load configuration files based on platform information. Configuration files loaded later 
        //have a higher priority than configuration files loaded first.
        text = Resources.Load<TextAsset>(string.Format("application.{0}.properties", Application.platform.ToString().ToLower()));
        if (text != null)
            list.Add(new PropertiesConfiguration(text.text));

        if (list.Count == 1)
            return list[0];

        return new CompositeConfiguration(list);
    }
}
```

可以发现同样是通过`GetString()`之类的函数完成获取的，但是整体有很多的不同

**继承链**如下所示：
`ConfigurationBase : IConfiguration`<VT>抽象类</VT>
**派生**出：

- MemoryConfiguration：内存流读取(`Dictionary<string, object>`字典)
- PropertiesConfiguration：自定义属性读取
- SubsetConfiguration：子集Configuration
- CompositeConfiguration：组合Configuration

很明显：<B><VT>MemoryConfiguration/PropertiesConfiguration是原生Configuration，SubsetConfiguration/CompositeConfiguration则是通过原始或自建Configuration扩展而成</VT></B>

**<GN>ConfigurationBase</GN>**
四种Configuration的基，简单分析一下**核心内容**：

- 获取
  - `GetProperty()`：<B><VT>核心</VT></B>
  - `GetString()`
  - `GetXXX()`
  - ...
- 其它
  - `Subset()`
- 抽象
  - `GetKeys()`
  - `ContainsKey()`
  - `GetProperty()`(子部分)
  - `AddProperty()`
  - `RemoveProperty()`
  - `SetProperty()`
  - `Clear()`

显然：<B><VT>Property操作是这里的关键</VT></B>

对于这些实现的内容，我们可能会比较好奇的是`Subset()`，这显然**与SubsetConfiguration有关**
除此之外`GetProperty()`是比较重要的：

``` csharp
protected virtual T GetProperty<T>(string key, T defaultValue)
{
    object value = GetProperty(key); // 这里就是抽象的子部分
    if (value == null)
        return defaultValue;

    return (T)ConvertTo(typeof(T), value);
}
```

简单来说就是用派生类的实现获取value后转换为相应类型即可
**转换流程**也很简单：

``` csharp
protected virtual object ConvertTo(Type type, object value)
{
    try
    {
        for (int i = 0; i < converters.Count; i++)
        {
            var converter = converters[i];
            if (!converter.Support(type))
                continue;

            return converter.Convert(type, value);
        }
    }
    // 异常处理
}
```

其中转换器默认添加了一种<B><GN>DefaultTypeConverter</GN></B>，会<VT>支持基础类型，同时也会支持接口中存在的DateTime/Version之类的类型</VT>

接下来当然是先从**基本原生实现**开始

**<GN>MemoryConfiguration/PropertiesConfiguration</GN>**
观察Property操作，以MemoryConfiguration为例：

``` csharp
private readonly Dictionary<string, object> dict = new Dictionary<string, object>();

public MemoryConfiguration(Dictionary<string, object> dict):base()
{
    if (dict != null && dict.Count > 0)
    {
        foreach (var kv in dict)
        {
            dict.Add(kv.Key, kv.Value);
        }
    }
}

public override object GetProperty(string key)
{
    object value = null;
    dict.TryGetValue(key, out value);
    return value;
}
public override void AddProperty(string key, object value)
{
    if (dict.ContainsKey(key))
        throw new AlreadyExistsException(key);

    dict.Add(key, value);
}
public override void SetProperty(string key, object value)
{
    dict[key] = value;
}
public override void RemoveProperty(string key)
{
    dict.Remove(key);
}
```

我们可以得知：
**<VT>MemoryConfiguration核心是加载dic，并对其进行增删查操作</VT>**
而<B><VT>PropertiesConfiguration仅是加载方式不同</VT></B>：

``` csharp
public MemoryConfiguration(Dictionary<string, object> dict):base()
{
    if (dict != null && dict.Count > 0)
    {
        foreach (var kv in dict)
        {
            dict.Add(kv.Key, kv.Value);
        }
    }
}

public PropertiesConfiguration(string text):base()
{
    this.Load(text);
}
protected void Load(string text)
{
    StringReader reader = new StringReader(text);
    string line = null;
    while (null != (line = reader.ReadLine()))
    {
        line = line.Trim();
        if (string.IsNullOrEmpty(line))
            continue;

        if (Regex.IsMatch(line, @"^((#)|(//))"))
            continue;

        int index = line.IndexOf("=");
        if (index <= 0 || (index + 1) >= line.Length)
            throw new FormatException(string.Format("This line is not formatted correctly.line:{0}", line));

        string key = line.Substring(0, index).Trim();
        string value = line.Substring(index + 1).Trim();
        if (string.IsNullOrEmpty(key))
            throw new FormatException(string.Format("The key is null or empty.line:{0}", line));

        if (dict.ContainsKey(key))
            throw new AlreadyExistsException(string.Format("This key already exists.line:{0}", line));

        dict.Add(key, value);
    }
}
```

**所以：**

- MemoryConfiguration是通过一个来自程序的字典完成的，所以可能来自json等序列化文件
- PropertiesConfiguration是通过文本完成的，所以可能来自某txt文本

总的来说，MemoryConfiguration更像是一种**基础形式**，而PropertiesConfiguration是一种**自定义形式**，因为文件的读取方式完全是自定义的：

- MemoryConfiguration：<B><VT>基础的一一配对</VT></B>
- PropertiesConfiguration：<B><VT>基于行的配置</VT></B>
  如：`server.host = 192.168.1.1`会被存入为`["server.host"] = "192.168.1.1"`

<BR>

以上是基础的两个Configuration，接下来看一下**复合型**的：

<B><GN>SubsetConfiguration</GN></B>
从构造函数我们能得知一些信息：

``` csharp
public SubsetConfiguration(ConfigurationBase parent, string prefix)
{
    this.parent = parent;
    this.prefix = prefix;
}
```

**parent**与其名中的**SubSet子集**对应：
**<VT>SubsetConfiguration是某Configuration的子集</VT>**
这是一种<B><GN>装饰器模式</GN></B><VT>(包装parent，进行扩展)</VT>

在继续分析前，我们需要看一下`ConfigurationBase.Subset()`：

``` csharp
public virtual IConfiguration Subset(string prefix)
{
    if (string.IsNullOrEmpty(prefix))
        throw new ArgumentException("the prefix is null or empty", "prefix");

    return new SubsetConfiguration(this, prefix);
}
```

这意味着：
<B><VT>任何Configuration(除了SubsetConfiguration，因为override了)都能直接创出SubsetConfiguration</VT></B>

回到该类，
其中有1个关键函数：

``` csharp
protected string GetParentKey(string key)
{
    if ("".Equals(key) || key == null)
        throw new ArgumentNullException(key);

    return prefix + KEY_DELIMITER + key; // 补充前缀
}
```

再来看override的`Subset()`：

``` csharp
public override IConfiguration Subset(string prefix)
{
    return parent.Subset(GetParentKey(prefix));
}
```

**<YL>举个例子会很好理解：</YL>**

``` csharp
var baseConfig = new PropertiesConfiguration();
baseConfig.SetProperty("app.database.mysql.host", "localhost");
baseConfig.SetProperty("app.database.mysql.port", "3306");

IConfiguration appConfig = baseConfig.Subset("app");
appConig.GetString("database.mysql.host");
IConfiguration dbConfig = appConfig.Subset("database");
dbConfig.GetString("mysql.host");
```

<YL>对于appConfig，其prefix为"app"
对于dbConfig，其prefix为"app.database"，而且它是通过`baseConfig.Subset("app.database")`创建的</YL>

可以说：<B><VT>每一个SubsetConfiguration都是独立的</VT></B>
对于其它函数，也都是通过parent执行的：
`GetProperty()`：`return parent.GetProperty(GetParentKey(key));`

<B><GN>CompositeConfiguration</GN></B>
Subset意味着子集，而Composite意味着**组合**，即<B><VT>由多个Configuration组成的Configuration</VT></B>
其**构造函数**说明了一切：

``` csharp
public CompositeConfiguration(List<IConfiguration> configurations)
{
    this.memoryConfiguration = new MemoryConfiguration();
    this.configurations.Add(memoryConfiguration);

    if (configurations != null && configurations.Count > 0)
    {
        for (int i = 0; i < configurations.Count; i++)
        {
            var config = configurations[i];
            if (config == null)
                continue;

            AddConfiguration(config);
        }
    }
}

public void AddConfiguration(IConfiguration configuration)
{
    if (!configurations.Contains(configuration))
    {
        configurations.Insert(1, configuration);
    }
}
```

可以说这是一种**具有保底机制的Configuration**：
**<VT>依次查看Configuration有没有对应key，最终保底一个memoryConfiguration</VT>**
**也就是：**

- `AddProperty()`/`SetProperty()`/`RemoveProperty()`针对保底memoryConfiguration操作
- `GetProperty()`按序查询获取

### 触发相关

Observables/Interactivity/Messaging三者都是有关触发的内容
当然它们有着**不同的侧重点**：

- Observables：观察者模式
- Interactivity：交互请求模式
- Messaging：发布订阅模式

#### Observables

从名字上我们就可以得知这是有关<B><GN>观察者模式</GN></B>的一组类，
有**4种实现**：

- ObservableObject
- ObservableList
- ObservableDictionary
- ObservableProperty

很明显，就是针对4种内容：Object/List/Dictionary/Property

**<GN>ObservablesList/ObservableDictionary</GN>**
其中最好理解的肯定是List与Dictionary，因为它们必然是<B><VT>在原数据结构的基础上进行扩展</VT></B>的
其**声明**如下所示：
`[Serializable] public class ObservableList<T> : IList<T>, IList, INotifyCollectionChanged, INotifyPropertyChanged`
`[Serializable] public class ObservableDictionary<TKey, TValue> : IDictionary<TKey, TValue>, IDictionary, INotifyCollectionChanged, INotifyPropertyChanged`
IList/IDictionary就是自定义数据结构的基
而<B><VT>INotifyCollectionChanged/INotifyPropertyChanged则是观察者的关键</VT></B>
<B><GN>INotifyPropertyChanged</GN></B>我们可能在C#实现的MVVM中遇到过，也就是<B><VT>数据绑定的核心</VT></B>，正如其名所示，简单来说就是一个<B><VT>通知UI对象属性发生改变的机制</VT></B>
**<VT>Tip：由于脱离了C#MVVM，所以自动绑定的机制不再可用，但可自行实现</VT>**
**接口实现**本身很简单：

``` csharp
public interface INotifyPropertyChanged
{
  event PropertyChangedEventHandler PropertyChanged;
}

public delegate void PropertyChangedEventHandler(object sender, PropertyChangedEventArgs e);
public class PropertyChangedEventArgs : EventArgs
{
  public PropertyChangedEventArgs(string propertyName);

  public virtual string PropertyName { get; }
}
```

在某种操作下，会触发该事件：

``` csharp
// ObservableList
private static readonly PropertyChangedEventArgs CountEventArgs = new PropertyChangedEventArgs("Count");
private static readonly PropertyChangedEventArgs IndexerEventArgs = new PropertyChangedEventArgs("Item[]");

public event PropertyChangedEventHandler PropertyChanged
{
    add { lock (propertyChangedLock) { this.propertyChanged += value; } }
    remove { lock (propertyChangedLock) { this.propertyChanged -= value; } }
}

protected virtual void OnPropertyChanged(PropertyChangedEventArgs e)
{
    if (this.propertyChanged != null)
    {
        this.propertyChanged(this, e);
    }
}

// 例子：Add，在对应情况(即InsertItem)都会触发
public void Add(T item)
{
    if (IsReadOnly)
        throw new NotSupportedException("ReadOnlyCollection");

    int index = items.Count;
    InsertItem(index, item);
}
protected virtual void InsertItem(int index, T item)
{
    CheckReentrancy();

    items.Insert(index, item);

    OnPropertyChanged(CountEventArgs);
    OnPropertyChanged(IndexerEventArgs);
    OnCollectionChanged(NotifyCollectionChangedAction.Add, item, index);
}
```

那么**重中之重**其实是**PropertyChanged事件的添加**，但这属于是业务层面的内容了

<B><GN>INotifyCollectionChanged</GN></B>同理，但处理的是**集合级别**的
但是有一点**需要注意**：

``` csharp
#if NET_2_0 || NET_2_0_SUBSET || (UNITY_EDITOR && UNITY_METRO  && !(NET_STANDARD_2_0 || NET_4_6)) 
namespace System.Collections.Specialized
{
    public delegate void NotifyCollectionChangedEventHandler(object sender, NotifyCollectionChangedEventArgs e);

    public interface INotifyCollectionChanged
    {
        event NotifyCollectionChangedEventHandler CollectionChanged;
    }
}
#endif
```

即<B><VT>INotifyCollectionChanged针对旧平台提供了支持</VT></B>

**<GN>ObservableProperty</GN>**
ObservableProperty本质上和ObservablesList/ObservableDictionary可以**归为一类**，但是有一点**明显不同**：
**<VT>ObservableProperty不继承C#接口而是自定义了接口</VT>**
其**声明与接口**如下：

``` csharp
[Serializable]
public class ObservableProperty : ObservablePropertyBase<object>, IObservableProperty {...}
    
public interface IObservableProperty
{
    event EventHandler ValueChanged;
    Type Type { get; }
    object Value { get; set; }
}
```

由该接口我们可以得知：<B><VT>Property指的是Value，应该会用于某种属性的包装</VT></B>
实际上**触发原理**还是完全一致的：

``` csharp
[Serializable]
public abstract class ObservablePropertyBase<T>
{
    private EventHandler valueChanged;

    public event EventHandler ValueChanged
    {
        add { lock (_lock) { this.valueChanged += value; } }
        remove { lock (_lock) { this.valueChanged -= value; } }
    }

    protected void RaiseValueChanged()
    {
        this.valueChanged?.Invoke(this, EventArgs.Empty);
    }

    // ...
}

[Serializable]
public class ObservableProperty : ObservablePropertyBase<object>, IObservableProperty
{
    public virtual object Value
    {
        get { return this._value; }
        set
        {
            if (this.Equals(this._value, value))
                return;

            this._value = value;
            this.RaiseValueChanged();
        }
    }

    // ...
}
```

**<GN>ObservableObject</GN>**
ObservableObject是4种中**最特殊**的一种，也是**最关键**的一种，原因就在于：
<B><VT>ViewModelBase继承于ObservableObject</VT></B>
先看一下其**声明**：
`[Serializable] public abstract class ObservableObject : INotifyPropertyChanged`
最明显的一点**区别**就是：<B><VT>ObservableObject是抽象的，而非直接创建的实例</VT></B>
正因该区别**实现**也有所不同：

``` csharp
protected virtual void RaisePropertyChanged(PropertyChangedEventArgs eventArgs)
{
    try
    {
        if (propertyChanged != null)
            propertyChanged(this, eventArgs);
    }
    catch (Exception e)
    {
        if (log.IsWarnEnabled)
            log.WarnFormat("Set property '{0}', raise PropertyChanged failure.Exception:{1}", eventArgs.PropertyName, e);
    }
}

protected bool Set<T>(ref T field, T newValue, [CallerMemberName] string propertyName = null)
{
    if (EqualityComparer<T>.Default.Equals(field, newValue))
        return false;

    field = newValue;
    RaisePropertyChanged(propertyName);
    return true;
}
```

触发由`Set()`进行，<B><YL>如：<YL></B>

``` csharp
public string Username
{
    get { return this.username; }
    set
    {
        if (this.Set(ref this.username, value))
        {
            this.ValidateUsername();
        }
    }
}
```

由此我们能更加明白**Object的含义**：
**<VT>ObservableObject本身就是一种需要观察者功能的集合，是其中的属性需要进行`Set()`操作</VT>**

**<BL>问题：`[CallerMemberName]`是什么</BL>**
<BL><B><GN>[CallerMemberName]</GN></B>，这是一个**编译期特性**，可以<B><VT>自动传入属性名</VT></B>
所以对于上述例子，就相当于是：`this.Set(ref this.username, value, "Username")`
那么这里的**含义**就是：<B><VT>先将`username`设置为value，然后通过该string转换为PropertyChangedEventArgs后进行propertyChanged回调</VT></B></BL>

<BR>

#### Interactivity

Interactivity即**互动性**，对于该组内容需要先<B><YL>举一个例子</YL></B>明确一下用法：

``` csharp
// InterationExample(View)
protected override void Start()
{
    // ...
    bindingSet.Bind().For(v => v.OnOpenAlert).To(vm => vm.AlertDialogRequest);

    bindingSet.Bind(this.openAlert).For(v => v.onClick).To(vm => vm.OpenAlertDialog);
    // ...
}
private void OnOpenAlert(object sender, InteractionEventArgs args)
{
    DialogNotification notification = args.Context as DialogNotification;
    var callback = args.Callback;

    if (notification == null)
        return;

    AlertDialog.ShowMessage(notification.Message, notification.Title, notification.ConfirmButtonText, null, notification.CancelButtonText, notification.CanceledOnTouchOutside, (result) =>
        {
            notification.DialogResult = result;
            callback?.Invoke();
        });
}

// InterationViewModel
public InterationViewModel()
{
    this.OpenAlertDialog = new SimpleCommand(() =>
    {
        this.OpenAlertDialog.Enabled = false;

        DialogNotification notification = new DialogNotification("Interation Example", "This is a dialog test.", "Yes", "No", true);

        Action<DialogNotification> callback = n =>
        {
            this.OpenAlertDialog.Enabled = true;

            if (n.DialogResult == AlertDialog.BUTTON_POSITIVE)
            {
                Debug.LogFormat("Click: Yes");
            }
            else if (n.DialogResult == AlertDialog.BUTTON_NEGATIVE)
            {
                Debug.LogFormat("Click: No");
            }
        };

        this.AlertDialogRequest.Raise(notification, callback);
    });
}
```

**由此我们可以得知：**

- **<VT>Interactivity是一系列用于绑定情况(Button)的事件触发机制</VT>**
- **涉及项**有如下几种：
  - Request：请求，ViewModel定义
  - Action：触发事件(如上述的`OnOpenAlert()`)，View定义
    - Notification：通知，即一组信息
- **流程**如下：
  Button触发Command，Command中`request.Raise()`触发callback，即Action

<BR>

**Request**
Request都继承于**接口IInteractionRequest**，如下所示：

``` csharp
public interface IInteractionRequest
{
    event EventHandler<InteractionEventArgs> Raised;
}

public class InteractionEventArgs : EventArgs
{
    private object context;
    private Action callback;
    public InteractionEventArgs(object context, Action callback)
    {
        this.context = context;
        this.callback = callback;
    }
    public object Context { get { return this.context; } }
    public Action Callback { get { return this.callback; } }
}
```

说到底还是一个<B><VT>运用事件的机制</VT></B>
派生了2种形态：

- **InteractionRequest**
- **AsyncInteractionRequest**：异步形态

<BR>

那么就以基础的<B><GN>InteractionRequest</GN></B>来看一下：

``` csharp
public class InteractionRequest : IInteractionRequest
{
    private static readonly InteractionEventArgs emptyEventArgs = new InteractionEventArgs(null, null);

    private object sender;

    public InteractionRequest() : this(null)
    {
    }

    public InteractionRequest(object sender)
    {
        this.sender = sender != null ? sender : this;
    }

    public event EventHandler<InteractionEventArgs> Raised;

    public void Raise()
    {
        this.Raise(null);
    }
    public void Raise(Action callback)
    {
        var handler = this.Raised;
        if (handler != null)
            handler(this.sender, callback == null ? emptyEventArgs : new InteractionEventArgs(null, () => { if (callback != null) callback(); }));
    }
}
```

可以说这就是一个<B><VT>简单的EventHandler触发器</VT></B>

**Action**
在上述例子中，Action并没有任何类，而是<B><VT>通过一个形参为`(object sender, InteractionEventArgs args)`形式的函数</VT></B>完成的，但作者提供了一些**预制Action**，有：

- 基于InteractionActionBase
  - ToastInteractionAction
  - DialogInteractionAction
  - LoadingInteractionAction
- 基于AsyncInteractionActionBase
  - AsyncDialogInteractionAction
  - AsyncViewInteractionAction
  - AsyncWindowInteractionAction

要**注意**的是：
<B><VT>这些Action都是属于Views.InteractionActions命名空间的，即用于View(Base不是)</VT></B>

先来看看**Base**：

``` csharp
public abstract class InteractionActionBase<TNotification> : IInteractionAction
{
    public void OnRequest(object sender, InteractionEventArgs args)
    {
        Action callback = args.Callback;
        TNotification notification = (TNotification)args.Context;
        this.Action(notification, callback);
    }

    public abstract void Action(TNotification notification, Action callback);
}
```

显然使用Action的话<B><VT>只需在指定时刻调用`OnRequest()`即可执行已override的`Action()`</VT></B>
在此我们了解到其中心主旨即可，
但我们要知道到：<B><VT>Request与Action需要<GN>绑定</GN>是完整的</VT></B>

#### Messaging

Messaging即消息，涉及类不多，**核心**为<B><GN>Messenger</GN></B>，在项目中我们可能会看见：
`public static readonly IMessenger Messenger = new Messenger();`
显然Messenger是<B><VT>以单例的形式存在的</VT></B>
其**声明**为：
`public class Messenger : IMessenger`
接口IMessenger异常简单，仅有2类函数：<B>`Subscribe()`/`Publish()`</B>，显然这是<B><VT>发布订阅模式</VT></B>

**<YL>用法如下：</YL>**

``` csharp
public class Launcher : MonoBehaviour
{
    ISubscription<WindowStateEventArgs> subscription;
    void Awake()
    {
        // ...

        /* Subscribe to window state change events */
        subscription = Window.Messenger.Subscribe<WindowStateEventArgs>(e =>
        {
            Debug.LogFormat("The window[{0}] state changed from {1} to {2}", e.Window.Name, e.OldState, e.State);
        });
    }
}

// Window
protected WindowState State
{
    get { return this.state; }
    set
    {
        if (this.state.Equals(value))
            return;

        WindowState old = this.state;
        this.state = value;
        this.RaiseStateChanged(old, this.state);
    }
}
protected void RaiseStateChanged(WindowState oldState, WindowState newState)
{
    try
    {
        WindowStateEventArgs eventArgs = new WindowStateEventArgs(this, oldState, newState);
        if (GlobalSetting.enableWindowStateBroadcast && stateBroadcast)
            Messenger.Publish(eventArgs);

        if (this.stateChanged != null)
            this.stateChanged(this, eventArgs);
    }
    catch (Exception e)
    {
        if (log.IsWarnEnabled)
            log.WarnFormat("{0}", e);
    }
}
```

可以看出这里就是<VT>完成了一个状态记录，一旦状态改变则通知输出Debug</VT>
由此我们也能看出：<B><VT>Messenger通常用于debug输出，并不担任什么必须品</VT></B>

先来看<B>订阅`Messenger.Subscribe()`</B>：

``` csharp
public virtual ISubscription<T> Subscribe<T>(Action<T> action)
{
    Type type = typeof(T);
    SubjectBase notifier;
    if (!notifiers.TryGetValue(type, out notifier))
    {
        notifier = new Subject<T>();
        // 保证线程安全
        if (!notifiers.TryAdd(type, notifier))
            notifiers.TryGetValue(type, out notifier);
    }
    return (notifier as Subject<T>).Subscribe(action);
}
```

可以看到这里的**核心操作**就是<VT>获取SubjectBase然后用它来`Subscribe()`</VT>
**<VT>对于每一个Type都只有一个notifier(因为是字典)</VT>**
`Subscribe()`的另一个版本增加了一个名为channel的string，其实就是在外面再包了一层字典

再来看<B>发布`Messenger.Publish()`</B>：

``` csharp
public virtual void Publish<T>(T message)
{
    if (message == null || notifiers.Count <= 0)
        return;

    Type messageType = message.GetType();
    foreach (var kv in notifiers)
    {
        if (kv.Key.IsAssignableFrom(messageType))
            kv.Value.Publish(message);
    }
}
```

很简单，<VT>找到相应SubjectBase，`Publish()`即可</VT>

<B><GN>Subject</GN></B>显然是<B><VT>`Subscribe()`/`Publish()`的本质，而Messenger仅仅是一层封装</VT></B>

先来看<B>订阅`Subject.Subscribe()`</B>：

``` csharp
public ISubscription<T> Subscribe(Action<T> action)
{
    return new Subscription(this, action);
}
```

仅仅是创建一个Subscription

再来看<B>发布`Subject.Publish()`</B>：

``` csharp
public void Publish(T message)
{
    if (subscriptions.Count <= 0)
        return;

    foreach (var kv in subscriptions)
    {
        Subscription subscription;
        kv.Value.TryGetTarget(out subscription);
        if (subscription != null)
            subscription.Publish(message);
        else
            subscriptions.TryRemove(kv.Key, out _);
    }
}
```

**可以发现：**
**<VT>Subject依旧是一层封装，由`Messenger.Subscribe()`会保存Subscription在内部，最终还是通过`Subscription.Publish()`完成发布操作</VT>**

<B><GN>Subscription</GN></B>是**Publish的本质**，如下所示：

``` csharp
public void Publish(T message)
{
    try
    {
        if (this.context != null)
            context.Post(state => action?.Invoke((T)state), message);
        else
            action?.Invoke(message);
    }
    catch (Exception e)
    {
#if DEBUG
        throw;
#else
        if (log.IsWarnEnabled)
            log.Warn(e);
#endif
    }
}
```

可以发现就是简单的**Action调用**
可以看到有一种`context.Post()`形式，context是通过`ObserveOn()`传入的，就像这种：
`this.subscriptionInUIsThread = this.messenger.Subscribe<TestMessage>(OnMessageInUIThread).ObserveOn(SynchronizationContext.Current);`
也就是说：<B><VT>`ObserveOn()`可以用来指定执行线程的同步上下文</VT></B>

#### 区别

我们会发现三者的相似程度太高了，整体来说都是一种事件机制，但是写法与用途有着很大的区别
三者其实分别是**设计模式的不同体现**：

- Observables：观察者模式，用于<B><VT>数据通知</VT></B>
- Interactivity：观察者模式，用于<B><VT>沟通V与VM</VT></B>
- Messaging：发布订阅模式，用于<B><VT>解耦通信</VT></B>

**<BL>问题：观察者模式与发布订阅模式的区别</BL>**
<BL><B>核心点</B>在于：</BL>
**<VT>观察者模式下观察者与被观察者是耦合的---观察者订阅被观察者事件
发布订阅模式下发布者与订阅者完全不耦合---发布者与订阅者不知道彼此的存在，完全通过中间件通信</VT>**

**关于用法**

- **对于Observables：**
  我们可能创建一个ObservableList并进行回调的添加，在后续使用中会由数据的变动而进行回调
- **对于Interactivity：**
  在VM中创建Request，在V中创建Action，通过绑定使得V与VM联系起来
- **对于Messaging：**
  可通过订阅T，发布T的方式进行通讯

<BR>

发布订阅模式的Messaging与观察者模式的Observables/Interactivity具有较大的区别，正如上述介绍的，Messaging仅需在A处订阅，B处发布即可，无需考虑之间的关系
**Observables与Interactivity的区别在于：**
**<VT>Observables是传统的观察者模式，而Interactivity是针对于MVVM的观察者模式(将Request与Action拆解在VM与V中，由绑定构成观察者模式)</VT>**

### Asynchronous

Async我们肯定很熟悉，即**异步**，但它的全称就是Asynchronous(adj.)
在Unity中我们可能完全用不到异步，因为使用携程即可代替，但是这不意味着异步是没有用的

对于异步部分，有一个**基础核心类**，为<B><GN>AsyncResult</GN></B>：
`public class AsyncResult : IAsyncResult, IPromise`
从Result一词来看，这是一个<B><VT>用于获取结果的类</VT></B>
先看**两接口**：

``` csharp
public interface IAsyncResult
{
    object Result { get; }
    Exception Exception { get; }
    bool IsDone { get; }
    bool IsCancelled { get; }
    bool Cancel();
    ICallbackable Callbackable();
    ISynchronizable Synchronized();
    object WaitForDone();
}
public interface IPromise
{
    object Result { get; }
    Exception Exception { get; }
    bool IsDone { get; }
    bool IsCancelled { get; }
    bool IsCancellationRequested { get; }
    void SetCancelled();
    void SetException(string error);
    void SetException(Exception exception);
    void SetResult(object result = null);
}
```

- **IAsyncResult接口**显然是AsyncResult的基，可以看到最重要的2数据：
  - Result：异步完成结果
  - IsDone/IsCancelled：状态(完成/取消)
- **IPromise**接口从名字上指的是承诺，即<B><VT>承诺完成并给出结果(无论成功还是失败)</VT></B>，这是**JavaScript异步中的一个概念**

**<BL>问题：IAsyncResult与IPromise的区别</BL>**
<BL>可以发现两接口实在太像了，都能返回Result以及判断结果情况
它们的<B>区别</B>在于：</BL>

- <BL>IAsyncResult核心在于<B><VT>使用</VT></B>：`WaitForDone()`等待执行完毕，获取`Result`</BL>
- <BL>IPromise核心在于<B><VT>设置</VT></B>：`SetResult()`设置`Result`</BL>

但是要注意的一点就是：<B><VT>IAsyncResult与IPromise有一定的公用部分，当然，只需要实现一次即可</VT></B>

**回到AsyncResult：**

说到底一切都是为了在异步情况下用一个实例存储Result并记录状态，那么**Set**显然是其中**最重要**的
**函数`SetXXX()`**
Set一共有3种，即`SetResult()`/`SetException()`/`SetCancelled()`
用最常见的<B>`SetResult()`</B>举例：

``` csharp
public virtual void SetResult(object result = null)
{
    lock (_lock)
    {
        if (this.done) 
            return;

        this.result = result;
        this.done = true;
        Monitor.PulseAll(_lock); // 唤醒等待线程
    }

    this.RaiseOnCallback();
}
```

**这里的`Monitor.PulseAll(_lock)`非常关键：**
该函数是有着一对**匹配项**的：

- `Monitor.Wait()`：等待
- `Monitor.PulseAll()`：唤醒

也就是说：<B><VT>在`Monitor.PulseAll()`之前，会有一处`Monitor.Wait()`用于"卡住"线程</VT></B>

**函数`WaitForDone()`**
从名字上来看，这是一个<B><VT>用于等待执行完成</VT></B>的函数，其**用法**如下：
`yield return show.WaitForDone();`
可以看到是<B><VT>与携程配合使用的</VT></B>

``` csharp
public virtual object WaitForDone()
{
    return Executors.WaitWhile(() => !IsDone);
}

public static object WaitWhile(Func<bool> predicate)
{
    if (executor != null && IsMainThread)
        return new WaitWhile(predicate);

    throw new NotSupportedException("The function must execute on main thread.");
}
```

**本质：<VT>Unity的`UnityEngine.WaitWhile()`</VT>**
这个函数我们可能不熟悉，但是我们一定见过**WaitForSeconds类**，其实是一样的

<BR>

除了以上两种函数外，仅剩2种**比较特殊的函数**了，即`Callbackable()`/`Synchronized()`

<B><GN>Synchronizable</GN></B>从名字上来看就能知道是一种<B><VT>同步器</VT></B>
其**用法**如下：
`result.Synchronized().WaitForResult()` <VT>等待结果</VT>

``` csharp
public virtual ISynchronizable Synchronized()
{
    lock (_lock)
    {
        return this.synchronizable ?? (this.synchronizable = new Synchronizable(this, this._lock));
    }
}
```

实现类为**Synchronizable**：
`internal class Synchronizable : ISynchronizable`
其**接口**如下：

``` csharp
public interface ISynchronizable
{
    bool WaitForDone();
    object WaitForResult(int millisecondsTimeout = 0);
    object WaitForResult(TimeSpan timeout);
}
```

以<B>`WaitForResult()`</B>为例：

``` csharp
public object WaitForResult(int millisecondsTimeout = 0)
{
    // 已经完成则直接返回结果
    if (result.IsDone)
    {
        if (result.Exception != null)
            throw result.Exception;

        return result.Result;
    }

    // 等待结果返回
    lock (_lock)
    {
        if (!result.IsDone)
        {
            if (millisecondsTimeout > 0)
                Monitor.Wait(_lock, millisecondsTimeout);
            else
                Monitor.Wait(_lock);
        }
    }

    if (!result.IsDone)
        throw new TimeoutException();

    if (result.Exception != null)
        throw result.Exception;

    return result.Result; // 返回结果
}
```

这里就是前面提及到的`Monitor.PulseAll()`的另一半`Monitor.Wait()`，
即<B><VT>在此处等待`Monitor.PulseAll()`的执行恢复</VT></B>
而<B><VT>`WaitForDone()`则是仅返回完成情况版，本质上是一样的</VT></B>

<B><GN>Callbackable</GN></B>从名字上我们也能了解到这是一个<B><VT>回调器</VT></B>
其**用法**如下：
`result.Callbackable().OnCallback((r) => ...);` <VT>添加回调</VT>

``` csharp
public virtual ICallbackable Callbackable()
{
    lock (_lock)
    {
        return this.callbackable ?? (this.callbackable = new Callbackable(this));
    }
}
```

实现类为**Callbackable**：
`internal class Callbackable : ICallbackable`
其**接口**如下：

``` csharp
public interface ICallbackable
{
    void OnCallback(Action<IAsyncResult> callback);
}
```

`OnCallback()`具体实现如下：

``` csharp
public void OnCallback(Action<IAsyncResult> callback)
{
    lock (_lock)
    {
        if (callback == null)
            return;

        if (this.result.IsDone)
        {
            try
            {
                callback(this.result);
            }
            catch (Exception e)
            {
                if (log.IsWarnEnabled)
                    log.WarnFormat("Class[{0}] callback exception.Error:{1}", this.GetType(), e);
            }
            return;
        }

        this.callback += callback;
    }
}
```

即<VT>已完成直接调，未完成存到回调列表中</VT>

显然<B><VT>回调是在AsyncResult完成时执行的</VT></B>，有`AsyncResult.RaiseOnCallback()`：

``` csharp
protected virtual void RaiseOnCallback()
{
    if (this.callbackable != null)
        this.callbackable.RaiseOnCallback();
}

public void RaiseOnCallback()
{
    lock (_lock)
    {
        try
        {
            if (this.callback == null)
                return;

            var list = this.callback.GetInvocationList();
            this.callback = null;

            foreach (Action<IAsyncResult> action in list)
            {
                try
                {
                    action(this.result);
                }
                catch (Exception e)
                {
                    if (log.IsWarnEnabled)
                        log.WarnFormat("Class[{0}] callback exception.Error:{1}", this.GetType(), e);
                }
            }
        }
        catch (Exception e) {...}
    }
}
```

由此我们可以得知：
**<VT>Callbackable是一个回调缓存地，这是因为异步的不确定性而添加的，我们不清楚当前的完成状态</VT>**

TODO：更多版本的Async
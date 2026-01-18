**<center><BBBG>IOC分析</BBBG></center>**

<!-- TOC -->

- [简述](#简述)
- [参考实现](#参考实现)
  - [QFramework](#qframework)
    - [IOCContainer](#ioccontainer)
    - [IOCKit](#iockit)
  - [LoxodonFramework](#loxodonframework)
  - [CatLib](#catlib)
    - [解析详析](#解析详析)
  - [MicrosoftDI](#microsoftdi)

<!-- /TOC -->

# 简述

<B><GN>控制反转Inversion of Control</GN></B>是重要的一个知识点
**思想：<VT>将程序中对象创建、依赖管理的控制权，从程序内部代码“反转”到外部容器或框架</VT>**
**简单来说：<VT>并非自己创建，而是由他人提供(所需的对象)</VT>**

IOC的实现方式一般有2种：

- <B><GN>依赖注入DI</GN></B>
- <B><GN>服务定位器SL</GN></B>

**SL**是一种更简单的实现，需**主动获取**
**DI**是更高级的实现，可**自动注入**

# 参考实现

参考对象有以下几个：

- **MicrosoftDI** 　<VT>复杂DI</VT>
- **CatLib** 　<VT>复杂DI</VT>
- **QFramework**　<VT>简单SL+简单DI</VT>
- **LoxodonFramework**　<VT>复杂SL</VT>

## QFramework

QFramework提供了2种IOC实现，一种是QFramework核心附带的**IOCContainer**，一种是**IOCKit**

### IOCContainer

IOCContainer是一种SL实现，极其简单，其实就是<B><VT>用一个字典去存储实例</VT></B>：

``` csharp
public class IOCContainer
{
    private Dictionary<Type, object> mInstances = new Dictionary<Type, object>();

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

    public T Get<T>() where T : class
    {
        var key = typeof(T);

        if (mInstances.TryGetValue(key, out var retInstance))
        {
            return retInstance as T;
        }

        return null;
    }

    public IEnumerable<T> GetInstancesByType<T>()
    {
        var type = typeof(T);
        return mInstances.Values.Where(instance => type.IsInstanceOfType(instance)).Cast<T>();
    }

    public void Clear() => mInstances.Clear();
}
```

### IOCKit

IOCKit作为一个Kit提供，实现的是最精简版的DI
提供了2种注入手段：**[Inject]特性/QFrameworkContainer派生**

``` csharp
public class IOCFrameworkExample : MonoBehaviour
{
    [Inject]
    public INetworkExampleService NetworkExampleService { get; set; }

    // Use this for initialization
    void Start()
    {
        // 将模块注入 
        // 这种方式比较方便
        MainContainer.Container.Inject(this);

        NetworkExampleService.Request();


        // 或者 不通过注入，直接获得 实例
        // 这种方式性能更好
        var networkExampleService = MainContainer.Container.Resolve<INetworkExampleService>();

        networkExampleService.Request();
    }
}

public class MainContainer : QFrameworkContainer, ISingleton
{
    private MainContainer()
    {
    }

    public static IQFrameworkContainer Container
    {
        get { return SingletonProperty<MainContainer>.Instance; }
    }


    void ISingleton.OnSingletonInit()
    {
        // 注册网络服务模块
        RegisterInstance<INetworkExampleService>(new NetworkExampleService());
    }
}
```

了解到一些内容：

- `Inject()`需要的是类实例，以配合[Inject]特性
- 无论是`Inject()`还是`Resolve()`，`RegisterInstance()`是必须的

<BR>

<B><GN>QFrameworkContainer</GN></B>显然是最重要的一个类，核心函数都在其中，由**IQFrameworkContainer接口**可知：

``` csharp
public interface IQFrameworkContainer
{
    void Clear();

    void Inject(object obj);
    void InjectAll();

    void Register<TSource, TTarget>(string name = null);
    void RegisterRelation<TFor, TBase, TConcrete>();
    void RegisterInstance<TBase>(TBase @default, bool injectNow) where TBase : class;
    void RegisterInstance(Type type, object @default, bool injectNow);
    void RegisterInstance(Type baseType, object instance = null, string name = null, bool injectNow = true);
    void RegisterInstance<TBase>(TBase instance, string name, bool injectNow = true) where TBase : class;
    void RegisterInstance<TBase>(TBase instance) where TBase : class;

    T Resolve<T>(string name = null, bool requireInstance = false, params object[] args) where T : class;
    TBase ResolveRelation<TBase>(Type tfor, params object[] arg);
    TBase ResolveRelation<TFor, TBase>(params object[] arg);
    IEnumerable<TType> ResolveAll<TType>();

    TypeMappingCollection  Mappings             { get; set; }
    TypeInstanceCollection Instances            { get; set; }
    TypeRelationCollection RelationshipMappings { get; set; }

    void Register(Type source, Type target, string name = null);
    IEnumerable<object> ResolveAll(Type type);
    object Resolve(Type baseType, string name = null, bool requireInstance = false,
        params object[] constructorArgs);
    object ResolveRelation(Type tfor, Type tbase, params object[] arg);
    void RegisterRelation(Type tfor, Type tbase, Type tconcrete);
    object CreateInstance(Type type, params object[] args);
}
```

核心无非就是：

- Register：注册
- Inject：注入
- Resolve：解析

除此以外，可以看到该类中用3种扩展数据结构进行存储：

- <B><GN>TypeMappingCollection</GN></B>
- <B><GN>TypeInstanceCollection</GN></B>
- <B><GN>TypeRelationCollection</GN></B>

先看它们的**声明**：
`public class TypeMappingCollection : Dictionary<Tuple<Type, string>, Type>`
`public class TypeInstanceCollection : Dictionary<Tuple<Type, string>, object>`
`public class TypeRelationCollection : Dictionary<Tuple<Type, Type>, Type>`
**<VT>Tip：Unity的C#版本还没有Tuple，这里仅实现了一个`Tuple<T1, T2>`</VT>**
也就是说Collection是Dictionary的封装，看示例的话会比较容易看清类型：
`Mappings[source, name] = target`
显然，指的是**接口加类型对应实现类型**，如`mappings[typeof(ILogger), "file"] = typeof(FileLogger);`

那么接下来就进行一一对应地分析：

- Mappings(TypeMappingCollection)
  对应内容为：
  - `Register()`
  - `Resolve()`
  - `ResolveAll()`
  
  `Register()`：
  <BR>

  ``` csharp
  public void Register(Type source, Type target, string name = null)
  {
      Mappings[source, name] = target; // 仅建立映射
  }
  ```

  `Resolve()`：
  <BR>

  ``` csharp
  public object Resolve(Type baseType, string name = null, bool requireInstance = false, params object[] constructorArgs)
  {
      // 先找Instances(TypeInstanceCollection)
      var item = Instances[baseType, name];
      if (item != null)
      {
          return item;
      }
      if (requireInstance)
          return null;

      //找不到再找Mappings，以创建实例
      var namedMapping = Mappings[baseType, name];
      if (namedMapping != null)
      {
          var obj = CreateInstance(namedMapping, constructorArgs);
          return obj;
      }

      return null;
  }
  ```

  可以看到Instances其实类似于缓存，会优先获取

- Instances(TypeInstanceCollection)
  对应内容为：
  - `RegisterInstance()`
  - `InjectAll()`
  - `Resolve()`
  - `ResolveAll()`
  
  由`RegisterInstance()`/`InjectAll()`可知：Instances的核心在于**注入**：
  <BR>

  ``` csharp
  public virtual void RegisterInstance(Type baseType, object instance = null, string name = null, bool injectNow = true)
  {
      Instances[baseType, name] = instance;
      if (injectNow) // 默认注入
      {
          Inject(instance);
      }
  }
  ```

- RelationshipMappings(TypeRelationCollection)
  对应内容为：
  - `RegisterRelation()`
  - `ResolveRelation()`

  由`ResolveRelation()`可知：RelationshipMappings是一种另类的映射，本质上仅是用一种Type替代了name，基本无异
  <BR>

  ``` csharp
  public object ResolveRelation(Type tfor, Type tbase, params object[] args)
  {
      var concreteType = RelationshipMappings[tfor, tbase];

      if (concreteType == null)
      {
          return null;
      }

      var result = CreateInstance(concreteType, args);
      return result;
  }
  ```

可以看到，无论使用哪种创建解析，最终都需要进行注入(`Inject()`/`CreateInstance()`)

注入`Inject()`代码如下：

``` csharp
public void Inject(object obj)
{
    if (obj == null) return;
    // 获取实例的成员Info
#if !NETFX_CORE
    var members = obj.GetType().GetMembers();
#else
    var members = obj.GetType().GetTypeInfo().DeclaredMembers;
#endif
    foreach (var memberInfo in members)
    {
        // 寻找[Inject]特性
        var injectAttribute =
            memberInfo.GetCustomAttributes(typeof(InjectAttribute), true).FirstOrDefault() as InjectAttribute;
        if (injectAttribute != null)
        {
            // 注入属性
            if (memberInfo is PropertyInfo)
            {
                var propertyInfo = memberInfo as PropertyInfo;
                propertyInfo.SetValue(obj, Resolve(propertyInfo.PropertyType, injectAttribute.Name), null);
            }
            // 注入字段
            else if (memberInfo is FieldInfo)
            {
                var fieldInfo = memberInfo as FieldInfo;
                fieldInfo.SetValue(obj, Resolve(fieldInfo.FieldType, injectAttribute.Name));
            }
        }
    }
}
```

创建实例`CreateInstance()`代码如下：

``` csharp
public object CreateInstance(Type type, params object[] constructorArgs)
{
    // 提供构造Args情况
    if (constructorArgs != null && constructorArgs.Length > 0)
    {
        var obj2 = Activator.CreateInstance(type, constructorArgs);
        Inject(obj2); // 实例注入
        return obj2;
    }

#if !NETFX_CORE
    ConstructorInfo[] constructor = type.GetConstructors(BindingFlags.Public | BindingFlags.Instance);
#else
    ConstructorInfo[] constructor = type.GetTypeInfo().DeclaredConstructors.ToArray();
#endif

    // 唯一构造
    if (constructor.Length < 1)
    {
        var obj2 = Activator.CreateInstance(type);
        Inject(obj2);
        return obj2;
    }

    // 取参数最多的那个构造
    var maxParameters = constructor.First().GetParameters();
    foreach (var c in constructor)
    {
        var parameters = c.GetParameters();
        if (parameters.Length > maxParameters.Length)
        {
            maxParameters = parameters;
        }
    }

    // 对每个参数进行解析
    var args = maxParameters.Select(p =>
    {
        if (p.ParameterType.IsArray)
        {
            return ResolveAll(p.ParameterType);
        }

        return Resolve(p.ParameterType) ?? Resolve(p.ParameterType, p.Name);
    }).ToArray();

    // 创建实例
    var obj = Activator.CreateInstance(type, args);
    Inject(obj);
    return obj;
}
```

显然**注入**就是<B><VT>递归解析获取实例</VT></B>
逻辑其实很清晰，这里<B><YL>用上述例子举例</YL></B>：

- 开始时通过`RegisterInstance()`提前注册了实例，如果遇到需要时则会去Instances寻找
- 注入流：
  在类中声明了需要的接口属性(具有[Inject]特性)，`Inject()`则会对其设置，设置方法为`Resolve()`，此时由于Instances中已有，所以可直接获取并设置
- 解析流：
  这种方式就是直接去获取了，跳过了`Inject()`一步，同样由于提前注册可直接获取

显然**大致流程**就是：
**<VT>Register建立映射，后续可通过Resolve直接解析，也可通过Inject注入，整体来说就是`Resolve()`/`Inject()`/`CreateInstance()`三者不断递归</VT>**
**更清晰地来讲：**

- 我们可以认为`Resolve()`是起点，目的是为了获取接口实例
- 首先要做的就是创建实例`CreateInstance()`(也可提前缓存`RegisterInstance()`)，创建实例需要找到最完整的那个构造，对于构造的参数，需要递归`Resolve()`进行获取
- 创建完毕后需要`Inject()`对实例中存在的[Inject]特性属性赋值，同样需要递归`Resolve()`进行获取

可以发现：<B><VT>`Inject()`其实是脱离注册解析流程的附加函数，提供了一种更便捷的功能(当然要说Resolve才是附加的也是可行的，但不太合理)</VT></B>

**问题点：**
**<DRD>没有依赖循环检查</DRD>**
这点是比较致命的，其它只是功能性内容，依赖循环是**必须避免**的

<BR>

## LoxodonFramework

LoxodonFramework中用于提供IOC的是<B><GN>ServiceContainer</GN></B>
其**声明**如下：
`public class ServiceContainer : IServiceContainer, IDisposable`
**IServiceContainer接口**是这样的：

``` csharp
public interface IServiceContainer : IServiceLocator, IServiceRegistry {}

public interface IServiceLocator
{
    object Resolve(Type type);
    T Resolve<T>();
    object Resolve(string name);
    T Resolve<T>(string name);
}
public interface IServiceRegistry
{
    void Register(Type type, object target);
    void Register<T>(T target);
    void Register(string name, object target);
    void Register<T>(string name, T target);
    void Register<T>(Func<T> factory);
    void Register<T>(string name, Func<T> factory);
    void Unregister<T>();
    void Unregister(Type type);
    void Unregister(string name);
}
```

这很好理解：

- IServiceLocator：提供SL功能，即获取
- IServiceRegistry：获取前需要注册，这样才能知道获取内容

<BR>

在分析前先了解一下**创建流程**：
`IServiceContainer container = context.GetContainer();`
context为<B><GN>ApplicationContext</GN></B>，是项目的核心之一，有：

``` csharp
public Context(IServiceContainer container, Context contextBase)
{
    this.attributes = new Dictionary<string, object>();
    this.contextBase = contextBase;
    this.container = container;
    if (this.container == null)
    {
        this.innerContainer = true;
        this.container = new ServiceContainer(); // 自动创建
    }
}

public virtual IServiceContainer GetContainer()
{
    return this.container;
}
```

<BR>

**回到ServiceContainer：**
根据上述接口可知：作为SL形态的IOC，无非就是`Register()`/`Resolve()`/`Unregister()`三个操作

**<GN>Entry</GN>**
Entry是用于存储的数据结构，如下：

``` csharp
public Entry(string name, Type type, IFactory factory)
{
    this.Name = name;
    this.Type = type;
    this.Factory = factory;
}
```

显然是`Resolve()`所需要的数据
其中IFactory即工厂，当然是用于实例化的，有2种实现：

- `GenericFactory<T>`：泛型工厂，传入`Func<T>`，创建时调用返回T
- `SingleInstanceFactory`：单例工厂，传入target实例，创建时获取返回即可

显然：**泛型工厂**是<B><VT>延迟创建</VT></B>，**单例工厂**相当于是<B><VT>预存结果</VT></B>

**`Register()`**
注册有6种形式，但无非就是两种工厂选一个，注册的核心为`Register0()`：

``` csharp
// GenericFactory
public virtual void Register<T>(Func<T> factory)
{
    // Type
    this.Register0(typeof(T), new GenericFactory<T>(factory));
}
// SingleInstanceFactory
public virtual void Register<T>(T target)
{
    // Type
    this.Register0(typeof(T), new SingleInstanceFactory(target));
}

internal void Register0(Type type, IFactory factory)
{
    lock (_lock)
    {
        string name = type.IsGenericType ? null : type.Name;
        Entry entry = new Entry(name, type, factory);
        if (!typeServiceMappings.TryAdd(type, entry))
            throw new DuplicateRegisterServiceException(string.Format("Duplicate key {0}", type));

        // 在nameServiceMappings也加一份，避免重复
        // 那么后续也可通过name解析了
        if (!string.IsNullOrEmpty(name))
            nameServiceMappings.TryAdd(name, entry);
    }
}

internal void Register0(string name, IFactory factory)
{
    lock (_lock)
    {
        if (!nameServiceMappings.TryAdd(name, new Entry(name, null, factory)))
            throw new DuplicateRegisterServiceException(string.Format("Duplicate key {0}", name));
    }
}
```

整体来说相当简单，无非就是<VT>将信息收集到字典中，供解析使用</VT>

**`Resolve()`**
解析那就更简单了，<VT>从字典中获取了调用工厂</VT>即可

**`Unregister()`**
反注册同样简单，<VT>从字典中移除相应Entry</VT>即可
有一点需要注意：由于Type形式注册中为两个字典都添加了一份，所以反注册时需要考虑到这一点

<BR>

## CatLib

对于CatLib和MicrosoftDI，相对来说CatLib实现的DI还是简单一些的
具体可以参考**CatLib分析**中的，这里简短地再总结一下：

- DI的核心离不开绑定(注册)与解析(获取)，在这里是`Bind()`/`Make()`
  - `Bind()`：绑定的核心是<B><GN>BindData</GN></B>，本质上是信息集合，即传入的`IOC容器container`/`服务名service`/`创建事件Concrete`/`生命周期IsStatic`，同时提供了一些扩展函数以及内部函数
  - `Make()`：收集到了信息即可解析，核心流程如下：
    - `Make()`几乎等价于`Resolve()`(只是多了一层检测)
    - 获取到BindData后核心是进行`Build()`，这样就能得到所需实例
      - `Build()`：创建实例的操作
        - 有Concrete：用事件创即可
        - 无Concrete：没有事件，只能用通用`CreateInstance()`，这必须通过`OnFindType()`添加映射后才能使用，创建中参数解析流程是比较复杂的  
      - 创建完实例后，需要`Inject()`注入，针对内容为[Inject]特性，简单来说就是为带有[Inject]特性的属性进行实例创建
    - 获取实例后还需根据生命周期IsStatic进行操作： <VT>仅考虑生命周期</VT>
      - IsStatic：先释放，再重新存储
      - !IsStatic：不操作
- 核心流程如上，其余的都是扩展功能，都是使用连写形式方便执行，内容穿插在上述流程的各处

### 解析详析

在上述主流程中，最值得注意的部分是这里：

``` csharp
protected virtual object Build(BindData makeServiceBindData, object[] userParams)
{
  object instance = makeServiceBindData.Concrete != null ? makeServiceBindData.Concrete((IContainer) this, userParams) : this.CreateInstance((Bindable) makeServiceBindData, this.SpeculatedServiceType(makeServiceBindData.Service), userParams);
  return this.Inject((Bindable) makeServiceBindData, instance);
}
```

该部分完成后将得到`Resolve()`的结果(核心结果，不考虑扩展)
Corcrete事件情况很简单，由于已经提供了事件，所以直接调用即可
比较复杂的是<B>`CreateInstance()`</B>：
其中传入了一个Type，通过`SpeculatedServiceType(makeServiceBindData.Service)`获取：

``` csharp
protected virtual Type SpeculatedServiceType(string service)
{
  Type type1;
  if (this.findTypeCache.TryGetValue(service, out type1))
    return type1;
  foreach (Func<string, Type> func in (IEnumerable<Func<string, Type>>) this.findType)
  {
    Type type2 = func(service);
    if (type2 != (Type) null)
      return this.findTypeCache[service] = type2;
  }
  return this.findTypeCache[service] = (Type) null;
}
```

这里就是上述所提到的：必须通过`OnFindType()`添加映射后才能使用
回到函数本身：

``` csharp
protected virtual object CreateInstance(
  Bindable makeServiceBindData,
  Type makeServiceType,
  object[] userParams)
{
  if (this.IsUnableType(makeServiceType))
    return (object) null;
  userParams = this.GetConstructorsInjectParams(makeServiceBindData, makeServiceType, userParams);
  try
  {
    return this.CreateInstance(makeServiceType, userParams);
  }
  catch (System.Exception ex)
  {
    throw this.MakeBuildFaildException(makeServiceBindData.Service, makeServiceType, ex);
  }
}

protected virtual object CreateInstance(Type makeServiceType, object[] userParams)
{
  return userParams == null || userParams.Length == 0 ? Activator.CreateInstance(makeServiceType) : Activator.CreateInstance(makeServiceType, userParams);
}
```

可以看到：
`CreateInstance()`的本质其实相当简单，就是调用`Activator.CreateInstance()`，核心难点在于**获取Params**上，即`GetConstructorsInjectParams()`
同时我们也可能会存有<B><BL>疑问</BL></B>：
**<BL>userParams通过`GetConstructorsInjectParams()`做了什么，返回的userParams和原来的有什么不同</BL>**
我们首先要明确一件事：
**可能的调用函数**是这样的：

``` csharp
public static TService Make<TService>(params object[] userParams)
{
  return App.That.Make<TService>(userParams);
}
```

结合来看，<B><VT>userParams必定用于TService实例的构造</VT></B>
继续看：

``` csharp
protected virtual object[] GetConstructorsInjectParams(
  Bindable makeServiceBindData,
  Type makeServiceType,
  object[] userParams)
{
  ConstructorInfo[] constructors = makeServiceType.GetConstructors();
  if (constructors.Length == 0)
    return Array.Empty<object>();
  ExceptionDispatchInfo exceptionDispatchInfo = (ExceptionDispatchInfo) null;
  // 获取所有构造
  foreach (ConstructorInfo constructorInfo in constructors)
  {
    try
    {
      // 依次尝试
      // 注意：由于constructors并不能保证顺序，所以并非最优选择(能得到只能说明这个构造能用)
      return this.GetDependencies(makeServiceBindData, constructorInfo.GetParameters(), userParams);
    }
    catch (System.Exception ex)
    {
      if (exceptionDispatchInfo == null)
        exceptionDispatchInfo = ExceptionDispatchInfo.Capture(ex);
    }
  }
  exceptionDispatchInfo?.Throw();
  throw new AssertException("Exception dispatch info is null.");
}

protected internal virtual object[] GetDependencies(
  Bindable makeServiceBindData,
  ParameterInfo[] baseParams,
  object[] userParams)
{
  if (baseParams.Length == 0)
    return Array.Empty<object>();
  object[] dependencies = new object[baseParams.Length];
  Func<ParameterInfo, object> paramsMatcher = this.GetParamsMatcher(ref userParams);
  for (int index = 0; index < baseParams.Length; ++index)
  {
    ParameterInfo baseParam = baseParams[index];
    object instance = ((paramsMatcher != null ? paramsMatcher(baseParam) : (object) null) ?? this.GetCompactInjectUserParams(baseParam, ref userParams)) ?? this.GetDependenciesFromUserParams(baseParam, ref userParams);
    string service = (string) null;
    if (instance == null)
    {
      service = this.GetParamNeedsService(baseParam);
      instance = baseParam.ParameterType.IsClass || baseParam.ParameterType.IsInterface ? this.ResloveClass(makeServiceBindData, service, baseParam) : this.ResolvePrimitive(makeServiceBindData, service, baseParam);
    }
    if (!this.CanInject(baseParam.ParameterType, instance))
    {
      string str = $"[{makeServiceBindData.Service}] Params inject type must be [{baseParam.ParameterType}] , But instance is [{instance?.GetType()}]";
      throw new UnresolvableException(service != null ? $"{str} Make service is [{service}]." : str + " Inject params from user incoming parameters.");
    }
    dependencies[index] = instance;
  }
  return dependencies;
}
```

首先进行的一步是`Func<ParameterInfo, object> paramsMatcher = this.GetParamsMatcher(ref userParams);`

``` csharp
protected virtual Func<ParameterInfo, object> GetParamsMatcher(ref object[] userParams)
{
  if (userParams == null || userParams.Length == 0)
    return (Func<ParameterInfo, object>) null;
  IParams[] typeInUserParams = this.GetParamsTypeInUserParams(ref userParams);
  return typeInUserParams.Length != 0 ? this.MakeParamsMatcher(typeInUserParams) : (Func<ParameterInfo, object>) null;
}

private IParams[] GetParamsTypeInUserParams(ref object[] userParams)
{
  // 仅选择实现了IParams的params
  object[] objArray = Arr.Filter<object>((IEnumerable<object>) userParams, (Predicate<object>) (value => value is IParams));
  // 获取
  IParams[] typeInUserParams = new IParams[objArray.Length];
  for (int index = 0; index < objArray.Length; ++index)
    typeInUserParams[index] = (IParams) objArray[index];
  return typeInUserParams;
}

private Func<ParameterInfo, object> MakeParamsMatcher(IParams[] tables)
{
  // 创建一个输入ParameterInfo，输出object的回调
  // 含义：给我一个ParameterInfo，我去IParams数组中通过接口的`TryGetValue()`实现获取输出
  return (Func<ParameterInfo, object>) (parameterInfo =>
  {
    foreach (IParams table in tables)
    {
      object result;
      // TryGetValue---IParams实现
      if (table.TryGetValue(parameterInfo.Name, out result) && this.ChangeType(ref result, parameterInfo.ParameterType))
        return result;
    }
    return (object) null;
  });
}

protected virtual bool ChangeType(ref object result, Type conversionType)
{
  try
  {
    // 1.无需转换情况
    if (result == null || conversionType.IsInstanceOfType(result))
      return true;
    // 2.转换前为基本类型
    if (this.IsBasicType(result.GetType()))
    {
      // 2.1.目标类型带有[Variant]特性
      if (conversionType.IsDefined(typeof (VariantAttribute), false))
      {
        try
        {
          // 创建实例
          result = this.Make(this.Type2Service(conversionType), new object[1]
          {
            result
          });
          return true;
        }
        catch (System.Exception ex)
        {
        }
      }
    }
    // 2.2.实现IConvertible(基本类型都实现了)
    if (result is IConvertible)
    {
      // 可转就转
      if (typeof (IConvertible).IsAssignableFrom(conversionType))
      {
        result = Convert.ChangeType(result, conversionType);
        return true;
      }
    }
  }
  catch (System.Exception ex)
  {
  }
  return false;
}
```

综上所述：`GetParamsMatcher()`可以获取一个转换事件，即传入ParameterInfo，输出IParams转换的值
接下来就会进行dependencies的收集了：

``` csharp
for (int index = 0; index < baseParams.Length; ++index)
{
  ParameterInfo baseParam = baseParams[index];
  object instance = ((paramsMatcher != null ? paramsMatcher(baseParam) : (object) null) ?? this.GetCompactInjectUserParams(baseParam, ref userParams)) ?? this.GetDependenciesFromUserParams(baseParam, ref userParams);
  string service = (string) null;
  if (instance == null)
  {
    service = this.GetParamNeedsService(baseParam);
    instance = baseParam.ParameterType.IsClass || baseParam.ParameterType.IsInterface ? this.ResloveClass(makeServiceBindData, service, baseParam) : this.ResolvePrimitive(makeServiceBindData, service, baseParam);
  }
  if (!this.CanInject(baseParam.ParameterType, instance))
  {
    string str = $"[{makeServiceBindData.Service}] Params inject type must be [{baseParam.ParameterType}] , But instance is [{instance?.GetType()}]";
    throw new UnresolvableException(service != null ? $"{str} Make service is [{service}]." : str + " Inject params from user incoming parameters.");
  }
  dependencies[index] = instance;
}
```

结合`ParameterInfo baseParam = baseParams[index]`/`dependencies[index] = instance`，可以意识到<VT>所谓的dependencies数组其实就是所需的参数实例</VT>
**参数实例获取流程**是以下部分：

``` csharp
object instance = ((paramsMatcher != null ? paramsMatcher(baseParam) : (object) null) ?? this.GetCompactInjectUserParams(baseParam, ref userParams)) ?? this.GetDependenciesFromUserParams(baseParam, ref userParams);
string service = (string) null;
if (instance == null)
{
  service = this.GetParamNeedsService(baseParam);
  instance = baseParam.ParameterType.IsClass || baseParam.ParameterType.IsInterface ? this.ResloveClass(makeServiceBindData, service, baseParam) : this.ResolvePrimitive(makeServiceBindData, service, baseParam);
}
```

- 有paramsMatcher事件，尝试直接获取
- 没有paramsMatcher事件
  - 尝试`GetCompactInjectUserParams()`，失败继续尝试`GetDependenciesFromUserParams()`
  - 还没成功的话
    - 如果是类或接口：`ResloveClass()`
    - 如果不是类或接口：`ResolvePrimitive()`

也就是说paramsMatcher其实是一个便利事件，如果实现即可非常轻松地获取
那么来看看其它尝试：
- `GetCompactInjectUserParams()`：
  <BR>

``` csharp
protected virtual object GetCompactInjectUserParams(
  ParameterInfo baseParam,
  ref object[] userParams)
{
  if (!this.CheckCompactInjectUserParams(baseParam, userParams))
    return (object) null;
  try
  {
    // 单参数：取出  多参数：装箱
    return baseParam.ParameterType == typeof (object) && userParams != null && userParams.Length == 1 ? userParams[0] : (object) userParams;
  }
  finally
  {
    // 清理
    userParams = (object[]) null;
  }
}
```

`GetCompactInjectUserParams()`看起来很奇怪，无论baseParam是object还是object[]，都会直接使用userParams输出同时清空，尤其是object[]显得更为奇怪
其想法可能是这样的：
**<VT>`GetCompactInjectUserParams()`针对object/object[]与params类似，仅用于最后一个参数</VT>**
如果这么考虑的话object[]就合理了，userParams是一个一个参数列出来的(不存在装箱情况)，baseParam需要多参，那么就把剩余参数都交给它

- `GetDependenciesFromUserParams()`：
  该函数相对简单，就是简单的匹配，但是可以发现：
  **<VT>实际位置无需匹配(但不匹配可预想的存在很多问题)</VT>**
  <BR>

``` csharp
protected virtual object GetDependenciesFromUserParams(
  ParameterInfo baseParam,
  ref object[] userParams)
{
  if (userParams == null)
    return (object) null;
  this.GuardUserParamsCount(userParams.Length);
  // 顺序尝试
  for (int index = 0; index < userParams.Length; ++index)
  {
    object result = userParams[index];
    // 匹配则获取并移除
    if (this.ChangeType(ref result, baseParam.ParameterType))
    {
      Arr.RemoveAt<object>(ref userParams, index);
      return result;
    }
  }
  return (object) null;
}
```

- `ResloveClass()`：
  <BR>

``` csharp
protected virtual object ResloveClass(
  Bindable makeServiceBindData,
  string service,
  ParameterInfo baseParam)
{
  object output;
  if (this.ResloveFromContextual(makeServiceBindData, service, baseParam.Name, baseParam.ParameterType, out output))
    return output;
  // 有默认参数(int a = 1这种)则使用
  return baseParam.IsOptional ? baseParam.DefaultValue : throw this.MakeUnresolvableException(baseParam.Name, baseParam.Member?.DeclaringType);
}

protected virtual bool ResloveFromContextual(
    Bindable makeServiceBindData,
    string service,
    string paramName,
    Type paramType,
    out object output)
  {
    return this.MakeFromContextualClosure(this.GetContextualClosure(makeServiceBindData, service, paramName), paramType, out output) || this.MakeFromContextualService(this.GetContextualService(makeServiceBindData, service, paramName), paramType, out output);
  }
```

可以看到真正的解析嵌套了相当多的函数，但核心就是`MakeFromContextualClosure()`：

``` csharp
protected virtual bool MakeFromContextualClosure(
  Func<object> closure,
  Type needType,
  out object ouput)
{
  ouput = (object) null;
  if (closure == null)
    return false;
  ouput = closure();
  return this.ChangeType(ref ouput, needType);
}
```

核心倒是相当简单，本质就是利用closure回调返回结果并转换类型
closure回调需要进行获取，依次进行`GetContextualClosure()`与`MakeFromContextualService()`的尝试：

``` csharp
protected virtual Func<object> GetContextualClosure(
  Bindable makeServiceBindData,
  string service,
  string paramName)
{
  return makeServiceBindData.GetContextualClosure(service) ?? makeServiceBindData.GetContextualClosure($"{this.GetVariableTag()}{paramName}");
}
```

``` csharp
protected virtual bool MakeFromContextualService(
  string service,
  Type needType,
  out object output)
{
  output = (object) null;
  if (!this.CanMake(service))
    return false;
  output = this.Make(service, Array.Empty<object>());
  return this.ChangeType(ref output, needType);
}

protected virtual string GetContextualService(
  Bindable makeServiceBindData,
  string service,
  string paramName)
{
  return makeServiceBindData.GetContextual(service) ?? makeServiceBindData.GetContextual($"{this.GetVariableTag()}{paramName}") ?? service;
}
```

<VT>两者都是是一次`Given()` `Needs()`的扩展使用，`GetContextualClosure()`
直接返回object，`MakeFromContextualService()`获取string后`Make()`出object</VT>

- `ResolvePrimitive()`：
  `ResolvePrimitive()`可以说是和`ResloveClass()`极其相似的
  <BR>

  ``` csharp
  protected virtual object ResolvePrimitive(
    Bindable makeServiceBindData,
    string service,
    ParameterInfo baseParam)
  {
    object output;
    if (this.ResloveFromContextual(makeServiceBindData, service, baseParam.Name, baseParam.ParameterType, out output))
      return output;
    if (baseParam.IsOptional)
      return baseParam.DefaultValue;
    // 特有部分：泛型可空处理(返回null)
    if (baseParam.ParameterType.IsGenericType && baseParam.ParameterType.GetGenericTypeDefinition() == typeof (Nullable<>))
      return (object) null;
    throw this.MakeUnresolvableException(baseParam.Name, baseParam.Member?.DeclaringType);
  }
  ```

经过以上几种尝试，最终目的都是获取一个instance，之后只要通过`CanInject()`确认是否符合即可确认其中一个baseParams，遍历完成后dependencies组成完毕

<BR>

## MicrosoftDI

MicrosoftDI是更加完善的一种DI，毕竟也是Microsoft官方的，CatLib的DI虽然也挺复杂，但是从结构上来看，并没有拆分很多，而Microsoft是十分完善的

同样参考**MicrosoftDI分析**中的，这里简短地再总结一下： <VT>基础调用部分</VT>

``` csharp
var services = new ServiceCollection();
services.AddTransient<IUserService, UserService>();

using (var serviceProvider = services.BuildServiceProvider())
{
    using (var scope = serviceProvider.CreateScope())
    {
        var notificationService = scope.ServiceProvider.GetRequiredService<IUserService>();
        // 服务操作
    }
}
```

- **ServiceCollection**是一个IList数据结构，在创建完ServiceCollection后，添加了一个Transient服务
  由此会在collection中添加一个**ServiceDescriptor**
  descriptor中表明了：
  - 生命周期Lifetime：`ServiceLifetime.Transient`
  - 服务类型ServiceType：IUserService
  - 实现类型ImplementationType：UserService
- 随后通过`services.BuildServiceProvider()`创建了ServiceProvider，本质上为：
  - `IEnumerable<ServiceDescriptor>`(也就是ServiceCollection)
  - 默认`ServiceProviderOptions`
  
  由于是默认的，所以**CallSiteValidator**并没有创建，同时使用的engine为**RuntimeServiceProviderEngine**或**DynamicServiceProviderEngine**<VT>(假设使用的是RuntimeServiceProviderEngine)</VT>
- 后续通过`serviceProvider.CreateScope()`创建了域，看似ServiceProvider类中没有该函数，这被隐藏在<B><GN>ServiceProviderServiceExtensions</GN></B>之中，本质上其实是`provider.GetRequiredService<IServiceScopeFactory>().CreateScope()`，其实也就是调用`_engine.GetService()`，这些内容都是由基类的ServiceProviderEngine提供
  这段流程就是获取服务的流程：
  尝试获取服务，获取不到，那么就去调用`CreateServiceAccessor()`，由于在构造函数中已经为**CallSiteFactory**添加了键值对：`CallSiteFactory.Add(typeof(IServiceScopeFactory), new ServiceScopeFactoryCallSite())`，所以将直接获取到callSite以获得`RealizeService()`内的事件并触发，其中scope使用的是Root(**ServiceProviderEngineScope**)，callSite使用的是**ServiceScopeFactoryCallSite**，计算的核心就是`RuntimeResolver.Resolve(callSite, p)`，**CallSiteRuntimeResolver**是CallSiteVisitor的派生类，需要进行逐层解析，由于是`ResultCache.None`所以进行`VisitCallSiteMain()`，由于是`CallSiteKind.ServiceScopeFactory`所以进行`VisitServiceScopeFactory()`，获取内容为`context.Scope.Engine`，这里的Scope即Root，而Root.Engine即RuntimeServiceProviderEngine
  由此可知，`provider.GetRequiredService<IServiceScopeFactory>().CreateScope()`并无任何特殊之处，其实就是固定的`相应Engine.CreateScope()`，即创建子Scope
- `scope.ServiceProvider.GetRequiredService<IUserService>()`则是真正意义上的获取服务，流程上会和IServiceScopeFactory类似，但由于没有`CallSiteFactory.Add()`提前注册，所以会有所不同：
  首先要注意到的一点是<VT>域是不同的</VT>，由于是通过scope进行的获取，`GetService()`会使用的是子域的ServiceProviderEngineScope而非Root
  流程上核心还是`ServiceProviderEngine.GetService()`，由于是第一次，RealizedServices中必定需要Add而非Get，`CallSiteFactory.Create()`是其中的一步，**CallSiteFactory**记录了存储的ServiceDescriptor，在构造中会进行`Populate()`即记录键值对：Key-IUserService/Value-**ServiceDescriptorCacheItem**<VT>(服务接口所对应的所有ServiceDescriptor)</VT>，这里由于没有提前注册，所以需要`CallSiteFactory.CreateCallSite()`以获取CallSite，对于这种基础的`<IUserService, UserService>`形式会使用`TryCreateExact()`的`CreateConstructorCallSite()`进行创建，对于这种无参构造，是最简单的**ConstructorCallSite**，信息有：
  - lifetime：一组信息，为**ResultCache**
    - Location：由ServiceLifetime转义成**CallSiteResultCacheLocation**，这里是`CallSiteResultCacheLocation.Dispose`
    - Key：为**ServiceCacheKey**，由服务接口Type/格子Slot组成，由于IUserService只对应UserService，所以Slot为0
  - ServiceType：服务接口
  - ConstructorInfo：构造函数
    - ImplementationType：由反射信息可获取实际服务类型
  - Kind：`CallSiteKind.Constructor`

  由于只有一层，也就不用考虑**CallSiteChain**的事情
  同时由于默认创建，也不需要考虑_callback的事
  接下来就是`RealizeService()`的调用，`RuntimeResolver.Resolve()`，由于是`CallSiteResultCacheLocation.Dispose`所以会调用`VisitDisposeCache()`即`return context.Scope.CaptureDisposable(VisitCallSiteMain(transientCallSite, context))`，可以看到这本质上还是在调用`VisitCallSiteMain()`即<VT>无论如何都要重新创建</VT>，对于无参构造相当简单，返回`constructorCallSite.ConstructorInfo.Invoke(Array.Empty<object>())`即可，随后额外处理一下Dispose即可
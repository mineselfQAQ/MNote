**<center><BBBG>MicrosoftDI分析</BBBG></center>**

**参考版本：v3.1.32**
**[Github](https://github.com/dotnet/extensions/tree/v3.1.32/src/DependencyInjection)**

<!-- TOC -->

- [简述](#简述)
- [框架](#框架)
  - [基本流程链](#基本流程链)
    - [ServiceCollection](#servicecollection)
    - [ServiceDescriptor](#servicedescriptor)
    - [ServiceProvider](#serviceprovider)
      - [CallSiteValidator](#callsitevalidator)
      - [ServiceProviderEngine](#serviceproviderengine)
        - [CallSiteFactory](#callsitefactory)
        - [CallSiteRuntimeResolver](#callsiteruntimeresolver)
        - [ServiceProviderEngineScope](#serviceproviderenginescope)
  - [基础调用](#基础调用)

<!-- /TOC -->

# 简述

该框架是由微软提供的<B><VT>依赖注入框架</VT></B>，全称为`Microsoft.Extensions.DependencyInjection`
该DI框架是相对来说比较完善的，提供了诸多功能：

- 服务生命周期
- 构造函数自动注入
- 泛型服务支持

# 框架

对于这种比较复杂的框架，首先应该看一下**使用例**：

**定义：**

``` csharp
public interface IUserService
{
    string GetUserName(int userId);
}
public interface IEmailService
{
    void SendEmail(string to, string subject, string body);
}

public class UserService : IUserService
{
    public string GetUserName(int userId)
    {
        return $"User_{userId}";
    }
}
public class EmailService : IEmailService
{
    public void SendEmail(string to, string subject, string body)
    {
        Console.WriteLine($"发送邮件给: {to}");
        Console.WriteLine($"主题: {subject}");
        Console.WriteLine($"内容: {body}");
    }
}

public class NotificationService
{
    private readonly IUserService _userService;
    private readonly IEmailService _emailService;

    public NotificationService(IUserService userService, IEmailService emailService)
    {
        _userService = userService;
        _emailService = emailService;
    }

    public void SendWelcomeEmail(int userId)
    {
        var userName = _userService.GetUserName(userId);
        var subject = "欢迎使用我们的服务";
        var body = $"亲爱的 {userName}，欢迎加入我们！";
        
        _emailService.SendEmail($"{userName}@example.com", subject, body);
    }
}
```

**实现：**

``` csharp
static void Main()
{
    var services = new ServiceCollection();
    
    services.AddTransient<IUserService, UserService>();
    services.AddScoped<IEmailService, EmailService>();
    services.AddSingleton<NotificationService>();
    
    services.AddTransient<SomeOtherService>(); // 无接口形式
    
    using (var serviceProvider = services.BuildServiceProvider())
    {
        using (var scope = serviceProvider.CreateScope())
        {
            var notificationService = scope.ServiceProvider.GetRequiredService<NotificationService>();
            notificationService.SendWelcomeEmail(123);
        }
    }
}

public class SomeOtherService
{
    public void DoSomething()
    {
        Console.WriteLine("...");
    }
}
```

以上可以说是最常规的基本用法了，绝大多数情况上述内容已经够用
**特点**如下：

- Transient/Scoped/Singleton是三种生命周期，会配合Scope使用
- ServiceCollection下`AddXXX()`，ServiceProvider下`GetXXX()`

<BR>

## 基本流程链

上述使用例包含了一条最基本的使用链：

- 创建ServiceCollection，在其中注册服务(`AddXXX()`)
- 通过serviceCollection创建ServiceProvider，在其中进行服务获取(`GetXXX()`)与使用

### ServiceCollection

显而易见的是，<B><GN>ServiceCollection</GN></B>是源头
其**声明**为：
`public class ServiceCollection : IServiceCollection`
`public interface IServiceCollection : IList<ServiceDescriptor> {}`
可以看到**接口IServiceCollection**本质上是一个IList<>，即<B><VT>具有列表功能</VT></B>
也就是说：<B><VT>本质上ServiceCollection就是一个IList实现</VT></B>
所以在源码一开始我们就能看到：
`private readonly List<ServiceDescriptor> _descriptors = new List<ServiceDescriptor>();`
其余内容也只是包装一下接口函数

所以**总结**来说：
**<VT>ServiceCollection是一个储存了ServiceDescriptor列表的数据结构</VT>**

**<BL>问题：`AddXXX()`去哪了</BL>**
<BL>既然不在类中，那么只可能会在扩展函数中，有<B><GN>ServiceCollectionServiceExtensions<GN></B></BL>
观察ServiceCollectionServiceExtensions，可以发现其中有相当多的实现，**汇总**如下：

- 函数
  - `AddTransient()`
  - `AddScoped()`
  - `AddSingleton()`
- 形式
  - 类型注册
    - `AddXXX(Type serviceType, Type implementationType)`
    - `AddXXX(Type serviceType)`
  - 泛型注册
    - `AddXXX<TService, TImplementation>()`
    - `AddXXX<TService>()`
  - 工厂注册
    - `AddXXX(Type serviceType, Func<IServiceProvider, object> implementationFactory)`
    - `AddXXX<TService>(Func<IServiceProvider, TService> implementationFactory)`
    - `AddXXX<TService, TImplementation>(Func<IServiceProvider, TImplementation> implementationFactory)`
  - 实例注册<VT>(仅Singleton)</VT>
    - `AddSingleton(Type serviceType, object implementationInstance)`
    - `AddSingleton<TService>(TService implementationInstance)`

一般来说**泛型注册**应该会是比较常用的一种形式，毕竟这看起来最方便
观察各个函数的实现，会发现<B>最终都是由`Add()`完成</B>：

``` csharp
private static IServiceCollection Add(
    IServiceCollection collection,
    Type serviceType,
    Type implementationType,
    ServiceLifetime lifetime)
{
    var descriptor = new ServiceDescriptor(serviceType, implementationType, lifetime);
    collection.Add(descriptor);
    return collection;
}

private static IServiceCollection Add(
    IServiceCollection collection,
    Type serviceType,
    Func<IServiceProvider, object> implementationFactory,
    ServiceLifetime lifetime)
{
    var descriptor = new ServiceDescriptor(serviceType, implementationFactory, lifetime);
    collection.Add(descriptor);
    return collection;
}
```

可以看到那么多形式最终会**收束为2种**：

- `Type implementationType`：实现类
- `Func<IServiceProvider, object> implementationFactory`：工厂，调用返回实例

`Add()`功能很简单，即<B><VT>向collection添加ServiceDescriptor</VT></B>

<B><GN>ServiceLifetime</GN></B>是其中一个参数， 可以看到是构建ServiceDescriptor的一部分，其实是个**枚举**：

``` csharp
public enum ServiceLifetime
{
    Singleton,
    Scoped,
    Transient
}
```

显然，各种生命周期的函数都会传入相应的ServiceLifetime值

### ServiceDescriptor

显然，<B><GN>ServiceDescriptor</GN></B>是关键的类，从descriptor也能了解到，应该是一个<B><VT>用于收集服务描述的类</VT></B>
**构造函数**即收集数据，无非就是：

- 必有
  - `ServiceLifetime lifetime`：生命周期
  - `Type serviceType`：基服务类型
- 3选1
  - `Type implementationType`：实现服务类型
  - `object instance`：服务实例(此时必定为`ServiceLifetime.Singleton`情况)
  - `Func<IServiceProvider, object> factory`：工厂

观察其**函数**：

- `Transient()`
- `Scoped()`
- `Singleton()`
- `Describe()`(上述3种的底层)

可以发现其函数就是非常熟悉的<VT>生命周期创建函数，返回ServiceDescriptor</VT>
这**和ServiceCollection是一致的**
也就是说我们其实能通过`ServiceDescriptor.XXX()`直接创建出ServiceDescriptor
同时还有`AddXXX()`版本，在<B><GN>ServiceCollectionDescriptorExtensions</GN></B>中：

- `Add()`
- `TryAdd()`
- `TryAddTransient()`
- `TryAddScoped()`
- `TryAddSingleton()`
- `TryAddEnumerable()`
- `Replace()`
- `RemoveAll()`

**要注意：**
**<VT>其中的内容更丰富，但扩展对象依旧是IServiceCollection，所以用法是没有变的</VT>**

结合来看，有以下几情况：

- ServiceDescriptor静态函数创建
- ServiceCollectionDescriptorExtensions扩展方法(额外)
- ServiceCollectionServiceExtensions扩展方法(基础)

显然ServiceCollectionServiceExtensions的是最基础最常用的，而ServiceCollectionDescriptorExtensions在某些情况会需要使用，而如`Add()`这种函数就需要ServiceDescriptor静态函数获取后才能调用

这么来说：<B><VT>ServiceDescriptor就是非常简单的信息收集类，除此以外没有任何功能</VT></B>

<BR>

### ServiceProvider

下一个关键的内容为：
`var serviceProvider = services.BuildServiceProvider()`
该函数在<B><GN>ServiceCollectionContainerBuilderExtensions</GN></B>中进行扩展，其中有3种Build形式：

``` csharp
public static ServiceProvider BuildServiceProvider(this IServiceCollection services)
{
    return BuildServiceProvider(services, ServiceProviderOptions.Default);
}

public static ServiceProvider BuildServiceProvider(this IServiceCollection services, bool validateScopes)
{
    return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = validateScopes });
}

public static ServiceProvider BuildServiceProvider(this IServiceCollection services, ServiceProviderOptions options)
{
    if (services == null)
    {
        throw new ArgumentNullException(nameof(services));
    }

    if (options == null)
    {
        throw new ArgumentNullException(nameof(options));
    }

    return new ServiceProvider(services, options);
}
```

可以发现：<VT>对于ServiceProvider，其中除了IServiceCollection，还会设置一个ServiceProviderOptions</VT>
<B><GN>ServiceProviderOptions</GN></B>具体如下：

``` csharp
public class ServiceProviderOptions
{
    internal static readonly ServiceProviderOptions Default = new ServiceProviderOptions();

    public bool ValidateScopes { get; set; }
    public bool ValidateOnBuild { get; set; }
    internal ServiceProviderMode Mode { get; set; } = ServiceProviderMode.Default;
}

internal enum ServiceProviderMode
{
    Default,
    Dynamic,
    Runtime,
    Expressions,
    ILEmit
}
```

这些都将在ServiceProvider的构造函数中设置
由此可见：<B><VT>ServiceProvider就是ServiceCollection补充了ServiceProviderOptions设置本质上其实是</VT></B>
<B><GN>ServiceProvider</GN></B>**声明**如下：
`public sealed class ServiceProvider : IServiceProvider, IDisposable, IServiceProviderEngineCallback, IAsyncDisposable`
其中**IDisposable/IAsyncDisposable**是<B><VT>dispose功能</VT></B>，using语句就是它提供的
**<VT>Tip：`using`对应IDisposable，`await using`对应IAsyncDisposable</VT>**

**IServiceProviderEngineCallback**看起来是有关引擎的回调，内容如下：

``` csharp
internal interface IServiceProviderEngineCallback
{
    void OnCreate(ServiceCallSite callSite);
    void OnResolve(Type serviceType, IServiceScope scope);
}
```

**IServiceProvider**则是核心，其中只有一个函数`object GetService(Type serviceType)`
这也是provider的功能：<B><VT>提供service</VT></B>

那么这里先看一下前面没有分析的**构造函数**：

``` csharp
internal ServiceProvider(IEnumerable<ServiceDescriptor> serviceDescriptors, ServiceProviderOptions options)
{
    IServiceProviderEngineCallback callback = null;
    if (options.ValidateScopes)
    {
        callback = this;
        _callSiteValidator = new CallSiteValidator();
    }

    switch (options.Mode)
    {
        case ServiceProviderMode.Default:
#if !NETCOREAPP
            _engine = new DynamicServiceProviderEngine(serviceDescriptors, callback);
#else
            if (RuntimeFeature.IsSupported("IsDynamicCodeCompiled"))
            {
                _engine = new DynamicServiceProviderEngine(serviceDescriptors, callback);
            }
            else
            {
                // Don't try to compile Expressions/IL if they are going to get interpreted
                _engine = new RuntimeServiceProviderEngine(serviceDescriptors, callback);
            }
#endif
            break;
        case ServiceProviderMode.Dynamic:
            _engine = new DynamicServiceProviderEngine(serviceDescriptors, callback);
            break;
        case ServiceProviderMode.Runtime:
            _engine = new RuntimeServiceProviderEngine(serviceDescriptors, callback);
            break;
#if IL_EMIT
        case ServiceProviderMode.ILEmit:
            _engine = new ILEmitServiceProviderEngine(serviceDescriptors, callback);
            break;
#endif
        case ServiceProviderMode.Expressions:
            _engine = new ExpressionsServiceProviderEngine(serviceDescriptors, callback);
            break;
        default:
            throw new NotSupportedException(nameof(options.Mode));
    }

    if (options.ValidateOnBuild)
    {
        List<Exception> exceptions = null;
        foreach (var serviceDescriptor in serviceDescriptors)
        {
            try
            {
                _engine.ValidateService(serviceDescriptor);
            }
            catch (Exception e)
            {
                exceptions = exceptions ?? new List<Exception>();
                exceptions.Add(e);
            }
        }

        if (exceptions != null)
        {
            throw new AggregateException("Some services are not able to be constructed", exceptions.ToArray());
        }
    }
}
```

**options**是这样控制的：

- ValidateScopes：是否设置`callback`+`_callSiteValidator`
- Mode：控制Engine的选择
  - DynamicServiceProviderEngine
  - RuntimeServiceProviderEngine
  - ILEmitServiceProviderEngine
  - ExpressionsServiceProviderEngine
- ValidateOnBuild：使用engine进行serviceDescriptor的验证

可以看得出这里的2个关键：**IServiceProviderEngine与CallSiteValidator**

先看一下其它函数：

- `GetService()`
- `Dispose()`
- `IServiceProviderEngineCallback.OnCreate()`
- `IServiceProviderEngineCallback.OnResolve()`
- `DisposeAsync()`

接口的实现就其全部，而这些函数其实都是<B><VT>engine函数的包装</VT></B>
`public object GetService(Type serviceType) => _engine.GetService(serviceType);`

所以我们大致可以理解：
**<VT>ServiceProvider是一个用于获取service的类，这主要通过engine完成(需要CallSiteValidator的配合)</VT>**

#### CallSiteValidator

<B><GN>CallSiteValidator</GN></B>该类也算是ServiceProvider的重要组成部分
其**创建**在此处：

``` csharp
// 构造函数中
if (options.ValidateScopes)
{
    callback = this;
    _callSiteValidator = new CallSiteValidator();
}
```

结合唯二两处**调用**：

``` csharp
void IServiceProviderEngineCallback.OnCreate(ServiceCallSite callSite)
{
    _callSiteValidator.ValidateCallSite(callSite);
}
void IServiceProviderEngineCallback.OnResolve(Type serviceType, IServiceScope scope)
{
    _callSiteValidator.ValidateResolution(serviceType, scope, _engine.RootScope);
}
```

可知：<B><VT>CallSiteValidator的功能就是IServiceProviderEngineCallback接口，会在某刻进行回调调用</VT></B>

先看其**声明**：
`internal class CallSiteValidator: CallSiteVisitor<CallSiteValidator.CallSiteValidatorState, Type>`
其<B>基类<GN>CallSiteVisitor<></GN></B>相当重要，除了CallSiteValidator还有很多相关的派生类：

- CallSiteValidator
- CallSiteJsonFormatter
- CallSiteRuntimeResolver
- ExpressionResolverBuilder
- ILEmitResolverBuilder

由此可见CallSiteVisitor相当重要
CallSiteVisitor一看就是<B><VT>访问者模式</VT></B>，先看**构造**：

``` csharp
protected CallSiteVisitor()
{
    _stackGuard = new StackGuard();
}
```

构造没什么特别，<B><GN>StackGuard</GN></B>是一个用于**栈检查**的类，后续会通过它<B><VT>确保栈不会溢出</VT></B>

该类的**核心**是2个函数：

``` csharp
protected virtual TResult VisitCallSite(ServiceCallSite callSite, TArgument argument)
{
    if (!_stackGuard.TryEnterOnCurrentStack())
    {
        return _stackGuard.RunOnEmptyStack((c, a) => VisitCallSite(c, a), callSite, argument);
    }

    switch (callSite.Cache.Location)
    {
        case CallSiteResultCacheLocation.Root:
            return VisitRootCache(callSite, argument);
        case CallSiteResultCacheLocation.Scope:
            return VisitScopeCache(callSite, argument);
        case CallSiteResultCacheLocation.Dispose:
            return VisitDisposeCache(callSite, argument);
        case CallSiteResultCacheLocation.None:
            return VisitNoCache(callSite, argument);
        default:
            throw new ArgumentOutOfRangeException();
    }
}

protected virtual TResult VisitCallSiteMain(ServiceCallSite callSite, TArgument argument)
{
    switch (callSite.Kind)
    {
        case CallSiteKind.Factory:
            return VisitFactory((FactoryCallSite)callSite, argument);
        case  CallSiteKind.IEnumerable:
            return VisitIEnumerable((IEnumerableCallSite)callSite, argument);
        case CallSiteKind.Constructor:
            return VisitConstructor((ConstructorCallSite)callSite, argument);
        case CallSiteKind.Constant:
            return VisitConstant((ConstantCallSite)callSite, argument);
        case CallSiteKind.ServiceProvider:
            return VisitServiceProvider((ServiceProviderCallSite)callSite, argument);
        case CallSiteKind.ServiceScopeFactory:
            return VisitServiceScopeFactory((ServiceScopeFactoryCallSite)callSite, argument);
        default:
            throw new NotSupportedException($"Call site type {callSite.GetType()} is not supported");
    }
}
```

这里最先需要了解的是<B><GN>ServiceCallSite</GN></B>，看起来其实是**一组信息**，类似Descriptor，看起来都挺熟悉：
要注意的是：<B><VT>ServiceCallSite只是个抽象类，也就是个接口基类，需要派生</VT></B>

- ServiceType
- ImplementationType
- Kind(<B><GN>CallSiteKind</GN></B>，一组枚举值)
- Cache(<B><GN>ResultCache</GN></B>，收集的<B><GN>CallSiteResultCacheLocation</GN></B>/<B><GN>ServiceCacheKey</GN></B>)
- `CaptureDisposable()`

<BR>

看一下函数声明，可以了解到：
**<VT>泛型中，TArgument指的是传入参数，TResult指的是输出结果</VT>**
以CallSiteValidator的`CallSiteVisitor<CallSiteValidator.CallSiteValidatorState, Type>`为例：显然是告知CallSiteValidatorState，返回一个类型

`VisitCallSite()`有4种选择：　<VT>默认的实现都是`VisitCallSiteMain()`，但ServiceCallSite的派生形式有所不同</VT>

- VisitRootCache()
- VisitScopeCache()
- VisitDisposeCache()
- VisitNoCache()

`VisitCallSiteMain()`有6种选择：　<VT>都是抽象类需派生</VT>

- VisitFactory()
- VisitIEnumerable()
- VisitConstructor()
- VisitConstant()
- VisitServiceProvider()
- VisitServiceScopeFactory()

由`callSite.Cache.Location`可知：
**<VT>对于缓存情况，只要派生类实现即可，如没有实现则使用默认创建方式`VisitCallSiteMain()`，其中`VisitNoCache()`虽然使用了virtual，但不会进行override，一定会使用`VisitCallSiteMain()`，对于创建的每一种情况则必须进行override(因为是抽象的)</VT>**

<BR>

回到CallSiteValidator上，根据调用，我们知道核心其实在`ValidateCallSite()`/`ValidateResolution()`两函数：

``` csharp
public void ValidateCallSite(ServiceCallSite callSite)
{
    var scoped = VisitCallSite(callSite, default);
    if (scoped != null)
    {
        _scopedServices[callSite.ServiceType] = scoped;
    }
}

public void ValidateResolution(Type serviceType, IServiceScope scope, IServiceScope rootScope)
{
    if (ReferenceEquals(scope, rootScope)
        && _scopedServices.TryGetValue(serviceType, out var scopedService))
    {
        if (serviceType == scopedService)
        {
            throw new InvalidOperationException(
                Resources.FormatDirectScopedResolvedFromRootException(serviceType,
                    nameof(ServiceLifetime.Scoped).ToLowerInvariant()));
        }

        throw new InvalidOperationException(
            Resources.FormatScopedResolvedFromRootException(
                serviceType,
                scopedService,
                nameof(ServiceLifetime.Scoped).ToLowerInvariant()));
    }
}
```

能够了解到：

- ValidateCallSite()：注册检测
- ValidateResolution()：解析检测(resolve)

具体实现则在遇到回调时再分析

<BR>

#### ServiceProviderEngine

比起检查器来说，更重要的会是engine，再构造中，根据`ServiceProviderOptions.Mode`，有4种情况：

- DynamicServiceProviderEngine
- RuntimeServiceProviderEngine
- ILEmitServiceProviderEngine
- ExpressionsServiceProviderEngine

默认情况下，优先选择DynamicServiceProviderEngine，否则会使用RuntimeServiceProviderEngine，显然**动态的要更好**

这些Engine都有一个**基类**，为<B><GN>ServiceProviderEngine</GN></B>
其**声明**为：
`internal abstract class ServiceProviderEngine : IServiceProviderEngine, IServiceScopeFactory`

**IServiceProviderEngine接口**是一个复合接口，有：
`internal interface IServiceProviderEngine : IServiceProvider, IDisposable, IAsyncDisposable`
也就是：

- ServiceProvider功能：`GetService()`
- Disposable功能：`Dispose()`/`DisposeAsync()`
- ServiceProviderEngine功能：`RootScope`/`ValidateService()`

而**IServiceScopeFactory接口**提供了`CreateScope()`

先看**构造**：

``` csharp
protected ServiceProviderEngine(IEnumerable<ServiceDescriptor> serviceDescriptors, IServiceProviderEngineCallback callback)
{
    _createServiceAccessor = CreateServiceAccessor;
    _callback = callback;
    Root = new ServiceProviderEngineScope(this);
    RuntimeResolver = new CallSiteRuntimeResolver();
    CallSiteFactory = new CallSiteFactory(serviceDescriptors);
    CallSiteFactory.Add(typeof(IServiceProvider), new ServiceProviderCallSite());
    CallSiteFactory.Add(typeof(IServiceScopeFactory), new ServiceScopeFactoryCallSite());
    RealizedServices = new ConcurrentDictionary<Type, Func<ServiceProviderEngineScope, object>>();
}
```

传入内容很简单，<VT>核心是一个serviceDescriptors，callback由options决定</VT>
构造函数中，我们就能发现**许多重要内容**：

- _createServiceAccessor：一个双重回调，传入Type，返回一个Func-传入object返回**ServiceProviderEngineScope**
- Root：就是一个**ServiceProviderEngineScope**
- RuntimeResolver：**CallSiteRuntimeResolver**类似CallSiteValidator，另一种CallSiteVisitor派生
- CallSiteFactory：一个**CallSiteFactory**
  - 工厂中添加了2组键值对：Type/ServiceCallSite
    - IServiceProvider-ServiceProviderCallSite
    - IServiceScopeFactory-ServiceScopeFactoryCallSite
- RealizedServices：一个字典，key为Type，获取_createServiceAccessor的结果

先来看一下<B>_createServiceAccessor</B>，可以说构造函数中大部分内容都在此处：
_createServiceAccessor是一个Func，其实就是一个函数，如下：

``` csharp
private Func<ServiceProviderEngineScope, object> CreateServiceAccessor(Type serviceType)
{
    var callSite = CallSiteFactory.GetCallSite(serviceType, new CallSiteChain());
    if (callSite != null)
    {
        DependencyInjectionEventSource.Log.CallSiteBuilt(serviceType, callSite);
        _callback?.OnCreate(callSite);
        return RealizeService(callSite);
    }

    return _ => null;
}
```

##### CallSiteFactory

**CallSiteFactory**即<B><GN>CallSiteFactory</GN></B>
**构造**如下：

``` csharp
public CallSiteFactory(IEnumerable<ServiceDescriptor> descriptors)
{
    _stackGuard = new StackGuard();
    _descriptors = descriptors.ToList();
    Populate();
}
```

其中<B>`Populate()`</B>显然是关键：

``` csharp
private void Populate()
{
    foreach (var descriptor in _descriptors)
    {
        var serviceTypeInfo = descriptor.ServiceType.GetTypeInfo();
        // 验证1
        if (serviceTypeInfo.IsGenericTypeDefinition)
        {
            var implementationTypeInfo = descriptor.ImplementationType?.GetTypeInfo();

            if (implementationTypeInfo == null || !implementationTypeInfo.IsGenericTypeDefinition)
            {
                throw new ArgumentException(
                    Resources.FormatOpenGenericServiceRequiresOpenGenericImplementation(descriptor.ServiceType),
                    "descriptors");
            }

            if (implementationTypeInfo.IsAbstract || implementationTypeInfo.IsInterface)
            {
                throw new ArgumentException(
                    Resources.FormatTypeCannotBeActivated(descriptor.ImplementationType, descriptor.ServiceType));
            }
        }
        // 验证2
        else if (descriptor.ImplementationInstance == null && descriptor.ImplementationFactory == null)
        {
            Debug.Assert(descriptor.ImplementationType != null);
            var implementationTypeInfo = descriptor.ImplementationType.GetTypeInfo();

            if (implementationTypeInfo.IsGenericTypeDefinition ||
                implementationTypeInfo.IsAbstract ||
                implementationTypeInfo.IsInterface)
            {
                throw new ArgumentException(
                    Resources.FormatTypeCannotBeActivated(descriptor.ImplementationType, descriptor.ServiceType));
            }
        }

        var cacheKey = descriptor.ServiceType;
        // 第一次也不会报错，因为ServiceDescriptorCacheItem是值类型(得default)
        // Add()则会走_item==null情况，添加_item
        // 同时会发现：第一次只存储_item，_items是空的，后续每一次Add()也是如此，新的在_item中，老的在_items中
        _descriptorLookup.TryGetValue(cacheKey, out var cacheItem);
        _descriptorLookup[cacheKey] = cacheItem.Add(descriptor);
    }
}

// ServiceDescriptorCacheItem结构体
public ServiceDescriptorCacheItem Add(ServiceDescriptor descriptor)
{
    var newCacheItem = new ServiceDescriptorCacheItem();
    if (_item == null)
    {
        Debug.Assert(_items == null);
        newCacheItem._item = descriptor;
    }
    else
    {
        newCacheItem._item = _item;
        newCacheItem._items = _items ?? new List<ServiceDescriptor>();
        newCacheItem._items.Add(descriptor);
    }
    return newCacheItem;
}
```

观察函数，会发现应该有**2个重要函数**：

``` csharp
// 填充_callSiteCache
public void Add(Type type, ServiceCallSite serviceCallSite)
{
    _callSiteCache[type] = serviceCallSite;
}

// 获取或填充获取_callSiteCache
// Tip：这里的形式是TValue GetOrAdd(TKey key, Func<TKey, TValue> valueFactory)
internal ServiceCallSite GetCallSite(Type serviceType, CallSiteChain callSiteChain)
{
    return _callSiteCache.GetOrAdd(serviceType, type => CreateCallSite(type, callSiteChain));
}
internal ServiceCallSite GetCallSite(ServiceDescriptor serviceDescriptor, CallSiteChain callSiteChain)
{
    if (_descriptorLookup.TryGetValue(serviceDescriptor.ServiceType, out var descriptor))
    {
        return TryCreateExact(serviceDescriptor, serviceDescriptor.ServiceType, callSiteChain, descriptor.GetSlot(serviceDescriptor));
    }

    Debug.Fail("_descriptorLookup didn't contain requested serviceDescriptor");
    return null;
}
```

前文中CreateServiceAccessor函数就是调用了`GetCallSite()`：
`var callSite = CallSiteFactory.GetCallSite(serviceType, new CallSiteChain());`
<B><GN>CallSiteChain</GN></B>是创建ServiceCallSite的关键，创建函数`CreateCallSite()`如下所示：

``` csharp
private ServiceCallSite CreateCallSite(Type serviceType, CallSiteChain callSiteChain)
{
    if (!_stackGuard.TryEnterOnCurrentStack())
    {
        return _stackGuard.RunOnEmptyStack((type, chain) => CreateCallSite(type, chain), serviceType, callSiteChain);
    }

    callSiteChain.CheckCircularDependency(serviceType);

    var callSite = TryCreateExact(serviceType, callSiteChain) ??
                               TryCreateOpenGeneric(serviceType, callSiteChain) ??
                               TryCreateEnumerable(serviceType, callSiteChain);

    _callSiteCache[serviceType] = callSite;

    return callSite;
}
```

由`callSiteChain.CheckCircularDependency(serviceType)`一句大致可知：
**<VT>CallSiteChain是一个循环链检查类</VT>**，后续的传递想必也是为了检查循环

**由此我们大致可知：**
**<VT>CallSiteFactory是一个工厂，核心就是在获取ServiceCallSite，具体的细节非常复杂</VT>**

<BR>
<BR>

获取到相应callSite后进行了这些内容：

``` csharp
DependencyInjectionEventSource.Log.CallSiteBuilt(serviceType, callSite); // Log
_callback?.OnCreate(callSite);
return RealizeService(callSite);
```

_callback即前面未分析的`ServiceProvider.callback`，在这里其实就是执行了`_callSiteValidator.ValidateCallSite(callSite)`，回顾函数：

``` csharp
public void ValidateCallSite(ServiceCallSite callSite)
{
    var scoped = VisitCallSite(callSite, default);
    if (scoped != null)
    {
        _scopedServices[callSite.ServiceType] = scoped;
    }
}
```

表面上就是填充_scopedServices，这会在后续检测中**作为条件**：
`if (ReferenceEquals(scope, rootScope) && _scopedServices.TryGetValue(serviceType, out var scopedService))`
看起来<B>_scopedServices的含义</B>为<B><VT>依赖的scoped服务</VT></B>
所以：<B><VT>如果在resolve时发现在根scope下依赖了scoped服务，对于这种非法操作进行报错处理</VT></B>
更关键的是<B>`RealizeService()`</B>，这是一个**抽象函数**，所以每一种Engine都会有自己的实现，最简单的当然是RuntimeServiceProviderEngine：

``` csharp
protected override Func<ServiceProviderEngineScope, object> RealizeService(ServiceCallSite callSite)
{
    return scope =>
    {
        Func<ServiceProviderEngineScope, object> realizedService = p => RuntimeResolver.Resolve(callSite, p);

        RealizedServices[callSite.ServiceType] = realizedService;
        return realizedService(scope);
    };
}
```

首先要记得的是，这里返回的是一个Func，所以操作是<B><VT>延迟执行</VT></B>的
不考虑细节，**具体如下**：
<VT>`RealizeService()`接收ServiceProviderEngineScope，返回了一个具体服务，该服务由realizedService委托执行完成，本质上其实是`RuntimeResolver.Resolve()`</VT>

查看其它Engine的实现，其实大差不大，主要是**realizedService创建方式不同**

<BR>

##### CallSiteRuntimeResolver

如RuntimeServiceProviderEngine所示，`RuntimeResolver.Resolve()`是创建服务的关键，也就是<B><GN>CallSiteRuntimeResolver</GN></B>
其**声明**为：
`internal sealed class CallSiteRuntimeResolver : CallSiteVisitor<RuntimeResolverContext, object>`
该类派生自CallSiteVisitor，结合函数`Resolve()`：

``` csharp
public object Resolve(ServiceCallSite callSite, ServiceProviderEngineScope scope)
{
    return VisitCallSite(callSite, new RuntimeResolverContext
    {
        Scope = scope
    });
}
```

该函数通过`VisitCallSite()`进行创建，具体流程大致如下：

- 看看`callSite.Cache.Location`：
  - 如果说是有缓存的，则使用缓存方式：
    尝试从resolvedServices中获取，如果获取不到则直接调用`VisitCallSiteMain()`获取
  - 如果说是没有缓存的，则直接调用`VisitCallSiteMain()`

- 而对于具体实现，大部分都相当简单：
<BR>

``` csharp
protected override object VisitConstant(ConstantCallSite constantCallSite, RuntimeResolverContext context)
{
    return constantCallSite.DefaultValue;
}

protected override object VisitServiceProvider(ServiceProviderCallSite serviceProviderCallSite, RuntimeResolverContext context)
{
    return context.Scope;
}

protected override object VisitServiceScopeFactory(ServiceScopeFactoryCallSite serviceScopeFactoryCallSite, RuntimeResolverContext context)
{
    return context.Scope.Engine;
}

protected override object VisitFactory(FactoryCallSite factoryCallSite, RuntimeResolverContext context)
{
    return factoryCallSite.Factory(context.Scope);
}
```

由于ServiceCallSite已收集相应的信息，直接调用即可
VisitIEnumerable/VisitConstructor是比较复杂的2种
<B>`VisitConstructor()`</B>想必是**构造函数注入**，流程如下：

``` csharp
protected override object VisitConstructor(ConstructorCallSite constructorCallSite, RuntimeResolverContext context)
{
    // 将所有依赖参数进行解析
    object[] parameterValues;
    if (constructorCallSite.ParameterCallSites.Length == 0)
    {
        parameterValues = Array.Empty<object>();
    }
    else
    {
        parameterValues = new object[constructorCallSite.ParameterCallSites.Length];
        for (var index = 0; index < parameterValues.Length; index++)
        {
            parameterValues[index] = VisitCallSite(constructorCallSite.ParameterCallSites[index], context);
        }
    }

    // 反射创建
#if NETCOREAPP
    return constructorCallSite.ConstructorInfo.Invoke(BindingFlags.DoNotWrapExceptions, binder: null, parameters: parameterValues, culture: null);
#else
    try
    {
        return constructorCallSite.ConstructorInfo.Invoke(parameterValues);
    }
    catch (Exception ex) when (ex.InnerException != null)
    {
        ExceptionDispatchInfo.Capture(ex.InnerException).Throw();
        // The above line will always throw, but the compiler requires we throw explicitly.
        throw;
    }
#endif
}
```

而<B>`VisitIEnumerable()`</B>比较特殊，用于<B><VT>单接口多重服务(`IEnumerable<IXXService>`)</VT></B>：

``` csharp
protected override object VisitIEnumerable(IEnumerableCallSite enumerableCallSite, RuntimeResolverContext context)
{
    // 创建数组
    var array = Array.CreateInstance(
        enumerableCallSite.ItemType,
        enumerableCallSite.ServiceCallSites.Length);
    // 将每一个服务都解析出来为数组设置
    for (var index = 0; index < enumerableCallSite.ServiceCallSites.Length; index++)
    {
        var value = VisitCallSite(enumerableCallSite.ServiceCallSites[index], context);
        array.SetValue(value, index);
    }
    return array;
}
```

可以看到这两种函数本质上其实是<B><VT>递归调用，本质上是在通过`VisitCallSite()`解析各个子服务</VT></B>

##### ServiceProviderEngineScope

<B><GN>ServiceProviderEngineScope</GN></B>想必是一个非常重要的类，
`RealizeService()`生成的事件就需要提供ServiceProviderEngineScope
其**声明**如下：
`internal class ServiceProviderEngineScope : IServiceScope, IServiceProvider, IAsyncDisposable`
**IServiceProvider接口**是关键：

``` csharp
public interface IServiceScope : IDisposable
{
    IServiceProvider ServiceProvider { get; }
}
```

结合**构造函数**：

``` csharp
public ServiceProviderEngineScope(ServiceProviderEngine engine)
{
    Engine = engine;
}
```

可以看出：<B><VT>ServiceProviderEngineScope是ServiceProviderEngine的子部分，scope域的范围会更小</VT></B>

**<DRD>注意：没有嵌套</DRD>**

``` csharp
using (var scope1 = serviceProvider.CreateScope())
{
    var service1 = scope1.ServiceProvider.GetService<IMyScopedService>();
    
    using (var scope2 = serviceProvider.CreateScope())
    {
        var service2 = scope2.ServiceProvider.GetService<IMyScopedService>();
    }
}
```

<VT>看起来这是嵌套，但是由于只有ServiceProviderEngine具有IServiceScopeFactory功能(`CreateScope()`)，所以<B>都是由主serviceProvider创建得来，必定都是同层(第一层)的(包括Root)</B></VT>

<BR>

## 基础调用

以上是流程链的大致分析，回顾一下调用：

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

可以说以上流程就是流程的全部，对于**更复杂的情况**，无非就是：

- 生命周期的选择
- Engine使用的选择
- 各创建形式的选择
- 其余一些设置(如ServiceProviderOptions)
- Keyed(该版本中被删除了，上个版本存在，后续也会出现)
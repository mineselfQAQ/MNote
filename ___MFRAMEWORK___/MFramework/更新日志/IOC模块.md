**<center><BBBG>IOC模块</BBBG></center>**

# v1.0

## 概述

**核心设计**如下：

- MIOCContainer：核心IOC创建器
  - MDIContainer：DI实现(未完成)
  - MSLContainer：SL实现

**重点简述：**

- MSLContainer：
  SL容器，可创建多个(但一般来说有1个就行了)
  提供`RegisterTransient()`/`RegisterInstance()`/`Resolve()`方法
  对于瞬态情况Transient，每次`Resolve()`都会调用工厂函数创建新的
  对于实例情况Instance，每次`Resolve()`都会取出Lazy后的单例
  对于瞬态/实例两者，都是延迟解析(对初始化流程非常有帮助)

## 使用例

``` csharp
protected override void OnBootstrapped(TrackerStoppedEvent e)
{
    MSLContainer container = MIOCContainer.Default;
    
    // 因为是延迟执行，顺序无关，只要保证先注册所有后再解析即可
    container.RegisterTransient<C>(() => new C(container.Resolve<A>()));
    container.RegisterTransient<A>(() => new A(1));
    container.RegisterSingleton<B>(() => new B("A"));
    
    C c = container.Resolve<C>();
    c.Print();
    
    A a1 = container.Resolve<A>();
    a1.I = 2;
    a1.Print();
    A a2 = container.Resolve<A>();
    a2.Print();
    
    B b1 = container.Resolve<B>();
    b1.S = "B";
    b1.Print();
    B b2 = container.Resolve<B>();
    b2.Print();
    
}

public class A
{
    public int I { get; set; }

    public A(int i)
    {
        I = i;
    }

    public void Print()
    {
        MLog.Default.D($"A：{I}");
    }
}

public class B
{
    public string S { get; set; }

    public B(string s)
    {
        S = s;
    }

    public void Print()
    {
        MLog.Default.D($"B：{S}");
    }
}

public class C
{
    public A A { get; set; }
    
    public C(A a)
    {
        A = a;
    }
    
    public void Print()
    {
        MLog.Default.D($"C：{A.I}");
    }
}
```

# v1.1

## 更新概述

MSLContainer优化：

- 优化掉了各种无用的派生类，仅用`Factory<T>`即可整合瞬态/单例两种情况
- Instance更名为Singleton
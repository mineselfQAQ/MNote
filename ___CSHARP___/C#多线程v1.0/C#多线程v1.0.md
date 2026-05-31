**<center><BBBG>C#多线程</BBBG></center>**

<!-- TOC -->

- [多线程与异步](#%E5%A4%9A%E7%BA%BF%E7%A8%8B%E4%B8%8E%E5%BC%82%E6%AD%A5)
    - [多线程](#%E5%A4%9A%E7%BA%BF%E7%A8%8B)
        - [Thread](#thread)
        - [线程安全](#%E7%BA%BF%E7%A8%8B%E5%AE%89%E5%85%A8)
        - [实现方式](#%E5%AE%9E%E7%8E%B0%E6%96%B9%E5%BC%8F)
            - [线程池](#%E7%BA%BF%E7%A8%8B%E6%B1%A0)
            - [Parallel](#parallel)
            - [PLINQ](#plinq)
        - [线程安全扩展](#%E7%BA%BF%E7%A8%8B%E5%AE%89%E5%85%A8%E6%89%A9%E5%B1%95)
            - [原子操作](#%E5%8E%9F%E5%AD%90%E6%93%8D%E4%BD%9C)
            - [同步机制](#%E5%90%8C%E6%AD%A5%E6%9C%BA%E5%88%B6)
- [Unity的多线程](#unity%E7%9A%84%E5%A4%9A%E7%BA%BF%E7%A8%8B)

<!-- /TOC -->

# 多线程与异步

如果我们只是简单了解过多线程/异步的话，我们可能会认为多线程和异步是同一个概念，但**并不如此**

- <B><GN>多线程</GN></B>：<B><VT>并发执行，通过多个线程在同一时间执行多个任务</VT></B>
- <B><GN>异步</GN></B>：<B><VT>非堵塞执行，任务发起后不堵塞当前线程，等待完成后继续进行<VT></B>

<BR>

两者的**核心区别**就是**堵塞情况**：
用一个最简单的例子就是多线程的`Thread.Sleep()`与异步的`Task.Delay()`：

- `Thread.Sleep(1000)`：堵塞当前线程，"卡死"1秒
- `Task.Delay(1000)`：开启一个1秒的等待，线程继续运行，1秒后执行后续代码

最直观的来说，如果将两种等待应用于界面显示的话，`Thread.Sleep()`会直接卡死界面，完成后才能进行如拖动操作，`Task.Delay()`则无影响

详细来说**两者的区别**：

- 多线程通常会堵塞完成，异步是不堵塞的
- **<VT>多线程适合长期任务(CPU密集型操作，同时创建销毁开销大)，而异步适合短暂且数量多的小任务(IO密集型操作)</VT>**
- 多线程更底层，可以使用线程/锁/信号量
- 多线程不易于传参与返回
- 异步仅是一种编程模式，可以是多线程实现，同样也可以是单线程实现

## 多线程

多线程即除了主线程以外，还开了其它线程来进行操作
先介绍一些**概念**：

- <B><GN>线程</GN></B>：<B><VT>操作系统中能够独立运行的最小单位，也是程序中能够并发执行的一段指令序列<VT></B>
- <B><GN>进程</GN></B>：<B><VT>由线程组成，一个进程中可以包含多个多个线程，这些线程共享进程的资源，进程至少有一个入口线程<VT></B>
- <B><GN>线程池</GN></B>：<B><VT>是一组预先创建的线程，可以被重复使用来执行多个任务(类似于对象池)<VT></B>
- <B><GN>前台线程/后台线程</GN></B>：主线程是一个前台线程，前台线程/后台线程中都可以创建后台线程，一旦销毁，后台线程发现后也会销毁，但如果前台线程中创建前台线程，那么就不会自动销毁，所以<B><DRD>对于前台线程必须充分关注其关闭情况</DRD></B>

### Thread

**最基础的多线程实现方式**即<B><GN>Thread</GN></B>：

- **创建**
  创建很简单，new一个Thread即可，如下：
  <BR>

  ``` csharp
  public void M()
  {
      var th1 = new Thread(ThreadMethod1);
      th1.Start();
  
      var th2 = new Thread(ThreadMethod2);
      th2.Start();
  }
  
  void ThreadMethod1() {}
  void ThreadMethod2(object? obj) {}
  ```

  上述内容中其实发生了一次包装：

  - 对于上述ThreadMethod1，为ThreadStart(ThreadMethod1)
    `Thread thread = new Thread(new ThreadStart(ThreadMethod1));`
  - 对于上述ThreadMethod2，为ParameterizedThreadStart(ThreadMethod2)
    `Thread thread2 = new Thread(new ParameterizedThreadStart(ThreadMethod2));`
  
- **终止**
  最简单的终止方式是使用以下2函数：　　<VT>但CancellationToken是更好的</VT>

  - `thread.Join()`：堵塞线程直到运行结束
  - `thread.Interrupt()`：打断线程执行并抛出异常
  
  **<DRD>注意：thread.Abort()由于安全性问题不应该使用(新版本已经强制不让用了)(由于强制中断会导致资源泄露和不可预测问题)</DRD>**

  可能的流程如下：
  <BR>

  ``` csharp
  class Program
  {
      static void Main(string[] args)
      {
          var thread = new Thread(() =>
          {
              try
              {
                  for (int i = 0; i < 10; i++)
                  {
                      Thread.Sleep(1000);
                      Console.WriteLine("Sub thread: " + i);
                  }
              }
              catch (ThreadInterruptedException)
              {
                  Console.WriteLine("Thread interrupted");
              }
          });
  
          thread.Start(); // 子线程开启了
          Thread.Sleep(3500); // 主线程睡了3.5秒
          thread.Interrupt(); // 对子线程进行打断操作(直接进catch)
          thread.Join(); // 堵塞子线程
          Console.WriteLine("Done");
      }
  } 
  ```

  **<BL>问题：为什么`Interrupt()`后还要`Join()`</BL>**
  <BL>因为`Interrupt()`只是打断执行，还有catch以及finally的内容需要执行，此时如果不通过`Join()`堵塞线程则可能先输出主线程的"Done"</BL>

- **挂起与恢复**

  - `Thread.Suspend()`
  - `Thread.Resume()`
  
  **<DRD>和`Thread.Abort()`类似，已不应该使用，因为操作存在安全性问题(死锁/特殊情况挂起)</DRD>**
  推荐使用**锁/信号量**

- **超时**

  - `Join()`传入Timeout
    - 可通过`Interrupt()`/CancellationToken进行终止

<BR>

**等待状态**
前面提到的`Interrupt()`可以打断线程执行，从而结束，但存在**无法打断的情况**：

``` csharp
var thread = new Thread(() =>
{
    try
    {
        while(true)
        {
            // Thread.Sleep(0) // 这里即时是0也行
        }
    }
    catch (ThreadInterruptedException)
    {
        Console.WriteLine("Thread interrupted");
    }
});
```

对于while循环，可以认为线程一直在进行操作，此时无法向操作系统让出CPU时间片，只有等到进入等待状态才可通过`Interrupt()`进行打断
**<VT>`Interrupt()`本质上是设置了中断标志，一旦切换至等待状态，CLR则会相应中断</VT>**

等待状态的**进入方法**有很多：

- `thread.Join();`
- `Monitor.Enter(obj);` 如果等待锁(执行时锁获取不到)
- `waitHandle.WaitOne();`
- `semaphore.Wait();`
- `Task.Wait();`
- `Thread.Sleep()`

但最好还是通过CancellationToken完成

<BR>

### 线程安全

线程安全是<B><VT>使用多线程必须保证的内容</VT></B>
所谓线程安全，就是要**防止发生以下情况**：
多个线程访问共享资源时，对共享资源的访问不会导致数据不一致或不可预期的结果

**线程安全的方式**有2种：

- **<GN>同步机制</GN>**
  用于协调和控制多个线程之间执行顺序和互斥访问共享资源
  确保线程按照特定的顺序执行，避免竞态条件和数值不一致的问题
- **<GN>原子操作</GN>**
  在执行过程种不会被中断的操作，<B><DRD>不可分割</DRD></B>
  在多线程环境下，原子操作能够保证数据的一致性和可靠性，避免出现竞态条件和数据竞争的问题

<BR>

**<YL>举例：</YL>**

``` csharp
class Program
{
    const int total = 10000000;
    private static int count = 0;

    static void Main(string[] args)
    {
        var thread1 = new Thread(ThreadMethod);
        var thread2 = new Thread(ThreadMethod);

        thread1.Start();
        thread2.Start();

        thread1.Join();
        thread2.Join();

        Console.WriteLine($"Count: {count}");
    }

    private static void ThreadMethod()
    {
        for (int i = 0; i < total; i++)
            count++;
    }
}
```

理论上，我们这里希望看到的值为2次ThreadMethod()操作的20000000，但事实并非如此：
14668877/12497755，每次输出的值还不相同
发生以上现象的**原因**是：<B>`count++`并非原子操作</B>

``` csharp
// 读取 count 到寄存器
int temp = count;
// 增加寄存器值
temp = temp + 1
// 写回 count
count = temp;
```

以上是count++大致的运行情况，显然，只要发生同时拿到寄存器的情况，那么有一个操作就白做了，自然最终结果会变小

**同步机制处理方式：**

``` csharp
class Program
{
    // ...
    private static object lockObj = new object();

    static void Main(string[] args)
    {
        // ...
    }

    private static void ThreadMethod()
    {
        for (int i = 0; i < total; i++)
            lock(lockObj)
                count++;
    }
}
```

加锁后，同时只有一个线程可操作，自然不会发生上述情况

**原子操作处理方式：**

``` csharp
private static void ThreadMethod()
{
    for (int i = 0; i < total; i++)
        Interlocked.Increment(ref count); // 原子操作
}
```

`Interlocked.Increment()`相比`count++`来说，由于是原子操作，所以在执行的那一刻就完成了，不存在上述情况

<BR>

### 实现方式

前面已经介绍了Thread，即最基础的多线程创建，同时还有其它的实现方式

#### ThreadPool

线程池显然是一个装有线程的池
**用法**如下：

``` csharp
static void Main()
{
    // 方法1：只有工作方法，没有状态参数
    bool success1 = ThreadPool.QueueUserWorkItem(DoWork1);
    Console.WriteLine($"任务1排队结果: {success1}");

    // 方法2：带有状态参数
    bool success2 = ThreadPool.QueueUserWorkItem(DoWork2, "Hello ThreadPool");
    Console.WriteLine($"任务2排队结果: {success2}");

    // 方法3：使用 WaitCallback 委托
    WaitCallback callback = new WaitCallback(DoWork2);
    bool success3 = ThreadPool.QueueUserWorkItem(callback, "Callback方式");
    Console.WriteLine($"任务3排队结果: {success3}");

    Thread.Sleep(2000);
}

static void DoWork1(object state)
{
    Console.WriteLine($"DoWork1执行 - 线程ID: {Thread.CurrentThread.ManagedThreadId}");
}

static void DoWork2(object state)
{
    string message = state as string;
    Console.WriteLine($"DoWork2执行: {message} - 线程ID: {Thread.CurrentThread.ManagedThreadId}");
}
```

可以发现，不像Thread，这里不需要进行创建操作，因为<B><VT>ThreadPool是一个静态类可直接使用</VT></B>
而最常用的函数就是上述的<B>`ThreadPool.QueueUserWorkItem()`</B>，
同时也有<B>`ThreadPool.UnsafeQueueUserWorkItem()`</B>，即<B><VT>不保持上下文版本</VT></B>
也存在一些**设置/获取函数**：

- `(Get/Set)MaxThreads()`：最大工作线程数
- `(Get/Set)MinThreads()`：最小工作线程数
- `GetAvailableThreads()`：可用工作线程数

对于上述例子，有一种**有趣的现象**：

``` txt
// 情况1
任务1排队结果: True
任务2排队结果: True
任务3排队结果: True
DoWork1执行 - 线程ID: 3
DoWork2执行: Callback方式 - 线程ID: 6
DoWork2执行: Hello ThreadPool - 线程ID: 4

// 情况2
任务1排队结果: True
DoWork1执行 - 线程ID: 3
任务2排队结果: True
任务3排队结果: True
DoWork2执行: Callback方式 - 线程ID: 4
DoWork2执行: Hello ThreadPool - 线程ID: 3
```

可以发现情况1中任务3的输出要比任务2快，这是正常的：线程池并不保证顺序(非FIFO)，三者几乎同时开启线程，只是任务3更快完成罢了
也可以发现情况2中任务1完成后，任务2/3才加入，这也是正常的：可以认为任务1太快了，同时**任务2复用了该线程**进行操作

#### Parallel

Parallel即平行的，也就是并行的含义，即可以<B><VT>并行地完成任务</VT></B>：

``` csharp
static void Main(string[] args)
{
    var inputs = Enumerable.Range(1, 20).ToArray();

    // 类似for循环，对20个i并行地进行HeavyJob操作
    var parallelOutputs = new int[inputs.Length];
    Parallel.For(0, inputs.Length, i =>
    {
        parallelOutputs[i] = HeavyJob(inputs[i]);
    });
}

private static int HeavyJob(int input)
{
    Thread.Sleep(300);
    return input;
}
```

由此我们能很清楚地了解到Parallel类的含义，看看各种函数：

- `For()`：并行版for循环
- `ForEach()`：并行版foreach循环
- `Invoke()`：并行执行多个方法
  <BR>

  ``` csharp
  Parallel.Invoke(
      () => Foo(xx),
      () => Foo(xx),
      () => Foo(xx),
      () => Foo(xx)
  );
  ```

对于Parallel，可添加<B><GN>ParallelOptions</GN></B>

**循环控制：**

``` csharp
static void Main()
    {
        Console.WriteLine("=== 循环状态控制 ===");
        
        // Break - 尽早退出
        Parallel.For(0, 100, (i, state) =>
        {
            if (i == 50)
            {
                Console.WriteLine($"在 i={i} 时调用 Break");
                state.Break();
            }
            Console.WriteLine($"处理 {i}");
        });
        
        // Stop - 立即退出
        Parallel.For(0, 100, (i, state) =>
        {
            if (i == 30)
            {
                Console.WriteLine($"在 i={i} 时调用 Stop");
                state.Stop();
                return;
            }
            Console.WriteLine($"处理 {i}");
        });
    }
```

**`ForEach()`复杂版本：**

``` csharp
static void Main()
{
    var data = Enumerable.Range(1, 10000).ToArray();

    // 并行计算统计信息
    var results = new
    {
        Sum = 0L,
        Max = int.MinValue,
        Min = int.MaxValue,
        Count = 0
    };

    object lockObj = new object();

    Parallel.ForEach(data, () => new
    {
        Sum = 0L,
        Max = int.MinValue,
        Min = int.MaxValue,
        Count = 0
    },
    (item, state, local) =>
    {
        return new
        {
            Sum = local.Sum + item,
            Max = Math.Max(local.Max, item),
            Min = Math.Min(local.Min, item),
            Count = local.Count + 1
        };
    },
    local =>
    {
        lock (lockObj)
        {
            results = new
            {
                Sum = results.Sum + local.Sum,
                Max = Math.Max(results.Max, local.Max),
                Min = Math.Min(results.Min, local.Min),
                Count = results.Count + local.Count
            };
        }
    });

    Console.WriteLine($"统计结果:");
    Console.WriteLine($"  数量: {results.Count}");
    Console.WriteLine($"  总和: {results.Sum}");
    Console.WriteLine($"  最大值: {results.Max}");
    Console.WriteLine($"  最小值: {results.Min}");
    Console.WriteLine($"  平均值: {(double)results.Sum / results.Count:F2}");
}
```

该版本的参数有：

- source：就是需要的源数组
- localInit：局部状态初始化，即对每个线程进行初始化
- body：主体，线程具体进行的操作(对局部状态进行更新)
  - item：处理元素，即source中的某一个
  - state：循环状态(上述Break/Stop)
  - local：局部状态
- localFinally：用各个local进行最终合并(需要lock线程安全)

同样的，**`For()`也能这么写**
而`Invoke()`不行，这是因为<B><VT>Invoke处理的是不同任务，而For/ForEach是相同任务</VT></B>

#### PLINQ

PLINQ即**Parallel LINQ**，也就是<B><VT>使用LINQ语法完成的Parallel</VT></B>

``` csharp
static void Main(string[] args)
{
    var inputs = Enumerable.Range(1, 20).ToArray();

    // 无序版
    var plinqOutputs = inputs.AsParallel().Select(HeavyJob).ToArray();
    // 有序版
    var plinqOutputs = inputs.AsParallel().AsOrdered().Select(HeavyJob).ToArray();
}

private static int HeavyJob(int input)
{
    Thread.Sleep(300);
    return input;
}
```

具有函数如下：

- 操作
  - `AsParallel()`：启用并行查询
  - `ForAll()`：并行执行
  - `Aggregate()`：并行聚合(类似于前面提到的ForEach复杂版)
- 设置
  - `WithDegreeOfParallelism(n)`：设置并行度
  - `WithExecutionMode()`：执行模式
  - `AsOrdered()`：保持顺序
  - `AsUnordered()`：取消顺序
  - `WithMergeOptions()`：合并选项
  - `WithCancellation()`：取消支持

<BR>

### 线程安全扩展

有关线程安全实现，可以分为**原子操作**与**同步机制**
**<VT>Tip：严格来说原子操作不属于同步机制</VT>**

#### 原子操作

原子操作指的是**一步的操作**
<B><GN>Interlocked</GN></B>是最核心最本质的原子操作，有如下操作：

- `Increment()`
- `Decrement()`
- `Add()`
- `Exchange()`
- `CompareExchange()`

#### 同步机制

同步机制有如下几种：

- lock/Monitor
- SpinLock
- Mutex
- Semaphore/SemaphoreSlim
- WaitHandle
  - ManualResetEvent
  - ManualResetEventSlim
  - AutoResetEvent
- ReaderWriterLock/ReaderWriterLockSlim

#### 可见性

可见性指的不是如public的可见性，而是线程专有的可见性，<B><VT>由于CPU的缓存机制/指令重排序机制，会导致读取内容并非最新</VT></B>
相关内容有：

- Volatile
- MemoryBarrier
- volatile关键字
- lock

<BR>

# Unity的多线程

目前来说Unity可用的多线程实现方式有3种：

- 传统原生：Coroutine
- 6.0新增：Awaiter
- 第三方库：UniTask


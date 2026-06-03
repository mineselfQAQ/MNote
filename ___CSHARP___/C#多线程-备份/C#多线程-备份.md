<center><B><BBBG>C#多线程</BBBG></B></center>

---
---
---

# 多线程

<B><BL>问题：线程/进程是什么</BL></B>
<BL>线程是操作系统中能够独立运行的最小单位，也是程序中能够并发执行的一段指令序列
线程是进程的一部分，一个进程中可以包含多个多个线程，这些线程共享进程的资源
进程有入口线程，也可以创建更多的线程</BL>

<B><BL>问题：为什么需要多线程</BL></B>

- <BL>批量重复任务同时进行</BL>
- <BL>多个任务需要互不干扰地进行</BL>

<B><BL>问题：线程池是什么</BL></B>
<BL>是一组预先创建的线程，可以被重复使用来执行多个任务
和对象池的作用是一样的，避免频繁进行创建销毁
<B><VT>异步编程默认使用线程池</VT></B></BL>

<B>线程安全</B>
多个线程访问共享资源时，对共享资源的访问不会导致数据不一致或不可预期的结果

<B>实际上，解决线程安全问题有2种方式：</B>

- <B><GN>同步机制</GN></B>
  用于协调和控制多个线程之间执行顺序和互斥访问共享资源
  确保线程按照特定的顺序执行，避免竞态条件和数值不一致的问题
  上述<B>互斥锁</B>就是一种
- <B><GN>原子操作</GN></B>
  在执行过程种不会被中断的操作，<B><DRD>不可分割</DRD></B>
  在多线程环境下，原子操作能够保证数据的一致性和可靠性，避免出现竞态条件和数据竞争的问题

<BR>

<B>原子操作例子：</B>

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

理论上，我们这里希望看到的值为2次`ThreadMethod()`操作的20000000，但事实并非如此：
14668877/12497755，每次输出的值还不相同

<B>原因：`count++`并非原子操作</B>
对于`count++`，运行情况大致为：

``` csharp
// 读取 count 到寄存器
int temp = count;
// 增加寄存器值
temp = temp + 1;
// 写回 count
count = temp;
```

假设目前的`count`为100，由于有2个线程，只要它们同时拿取值进行操作，就有可能导致temp值都为100，进行完后丢失了一次操作

<B>解决方法1：加个锁</B>

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

<B>解决方法2：使用原子操作</B>

``` csharp
private static void ThreadMethod()
{
    for (int i = 0; i < total; i++)
        Interlocked.Increment(ref count); // 原子操作
}
```

这里我们就能知道原子操作是什么了：<B><VT>Interlocked类提供了一些操作的原子操作形态(一种更底层的操作)</VT></B>

<BR>

<B>多线程实现方式：</B>

- 线程
- 线程池
- 异步编程
- 自带方法
  - Parallel
  - PLINQ

<BR>

<B><GN>Parallel/PLINQ</GN></B>

<B>一般顺序情况：</B>
``` csharp
class Program
{
    static void Main(string[] args)
    {
        var inputs = Enumerable.Range(1, 20).ToArray();

        // Sequential
        var forOutputs = new int[inputs.Length];
        for (int i = 0; i < inputs.Length; i++)
        {
            forOutputs[i] = HeavyJob(inputs[i]);
        }

        Print(inputs);
    }

    private static int HeavyJob(int input)
    {
        Thread.Sleep(300);
        return input;
    }

    private static void Print<T>(T[] arr)
    {
        foreach (T item in arr)
        {
            Console.Write(item + " ");
        }
    }
}
```

显然，一个任务300ms，做20次就是6000ms

<B>Parallel情况：</B>

``` csharp
// Parallel
var parallelOutputs = new int[inputs.Length];
Parallel.For(0, inputs.Length, i =>
{
    parallelOutputs[i] = HeavyJob(inputs[i]);
});
```

可以看得出`Parallel.For()`非常像一个for循环

<B>PLINQ情况：</B>

``` csharp
// 无序版
var plinqOutputs = inputs.AsParallel().Select(HeavyJob).ToArray();
// 有序版
var plinqOutputs = inputs.AsParallel().AsOrdered().Select(HeavyJob).ToArray();
```

可以看得出PLINQ指的就是<B>Parallel LINQ</B>

<B><GN>前台线程/后台线程</GN></B>
首先主线程一定是一个前台线程
前台线程/后台线程中都可以创建后台线程，一旦销毁，后台线程发现后也会销毁
但如果前台线程中创建前台线程，那么就不会自动销毁
<B><DRD>对于前台线程必须充分关注其关闭情况</DRD></B>

<B>线程的创建</B>
创建很简单，new一个Thread即可，如下：

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

这很简单，我们需要知道更重要的一个内容：
<B><VT>对于函数，编译器会将其包装成一个委托</VT></B>
对于上述ThreadMethod1，为`ThreadStart(ThreadMethod1)`
对于上述ThreadMethod2，为`ParameterizedThreadStart(ThreadMethod2)`
所以委托类型即<B>ThreadStart/ParameterizedThreadStart</B>

<B>线程终止</B>
线程终止相关的方法有2种：

- `thread.Join()`：堵塞线程直到运行结束
- `thread.Interrupt()`：打断线程执行并抛出异常
- CancellationToken

<B><DRD>注意：`thread.Abort()`由于安全性问题不应该使用(新版本已经强制不让用了)(由于强制中断会导致资源泄露和不可预测问题)</DRD></B>

严格来说，我们是为了规范终止线程才需要这些函数
举个例子：

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

        thread.Start();
        Thread.Sleep(3500);
        thread.Interrupt();
        thread.Join();
        Console.WriteLine("Done");
    }
}
```

线程操作为每秒进行一次输出，在线程启动后`Thread.Sleep(3500)`执行，3.5秒后由`thread.Interrupt()`直接打断子线程的执行进入catch，最终输出"Done"
<B><BL>问题：为什么`Interrupt()`后还要`Join()`</BL></B>
<BL>因为`Interrupt()`只是打断执行，还有catch以及finally的内容需要执行，此时如果不通过`Join()`堵塞线程则可能先输出主线程的"Done"</BL>

<B>对于`Interrupt()`，有一点很重要：</B>
<B><VT>如果线程很"忙"(如`while(true)`)，此时必须存在一个等待方法(如`Thread.Sleep()`)，否则无法打断</VT></B>

``` csharp
var thread = new Thread(() =>
{
    try
    {
        while(true)
        {
            // Thread.Sleep(0) // 这里即时是0也行，起到一个通知的作用
        }
    }
    catch (ThreadInterruptedException)
    {
        Console.WriteLine("Thread interrupted");
    }
});
```

对于while循环，可以认为线程一直在进行操作，此时无法向操作系统让出CPU时间片，只有等到进入等待状态才可通过`Interrupt()`进行打断
<B><VT>`Interrupt()`本质上是设置了中断标志，一旦切换至等待状态，CLR则会相应中断</VT></B>

等待状态的<B>进入方法</B>有很多：

- `thread.Join();`
- `Monitor.Enter(obj);` 如果等待锁(执行时锁获取不到)
- `waitHandle.WaitOne();`
- `semaphore.Wait();`
- `Task.Wait();`

<BR>

<B>线程的挂起与恢复</B>

函数有：

- `Thread.Suspend()`
- `Thread.Resume()`

<B><DRD>和`Thread.Abort()`类似，已不应该使用，因为操作存在安全性问题(死锁/特殊情况挂起)</DRD></B>

推荐方法为<B>锁/信号量</B>

<B>线程安全与同步机制</B>
前面提到过：<B><VT>同步机制是为了实现线程安全</VT></B>
具体的同步机制就是<B>锁与信号量</B>

有以下内容：

- lock/Monitor
- Mutex
- Semaphore
- SemaphoreSlim
- WaitHandle
  - ManualResetEvent
  - ManualResetEventSlim
  - AutoResetEvent
- ReaderWriterLock
- ReaderWriterLockSlim

<BR>

<B>lock/Monitor</B>
锁是最常见的一种，即使没学过也可能会看到`lock(obj)`这种语句块

``` csharp
private object obj = new object();
public void M()
{
    lock(obj)
    {
        Console.WriteLine();
    }
}
```

其编译会转换为如下形式：

``` csharp
[Nullable(1)]
private object obj = new object();

public void M()
{
    object obj = this.obj;
    bool lockTaken = false;
    try
    {
        Monitor.Enter(obj, ref lockTaken);
        Console.WriteLine();
    }
    finally
    {
        if (lockTaken)
        {
            Monitor.Exit(obj);
        }
    }
}
```

所以说<B><VT>`lock()`也是一种语法糖，本质为Monitor操作</VT></B>
`Monitor.Enter()`/`Monitor.Exit()`是一对一起出现的操作，可以认为：

- `Monitor.Enter()`：线程拿锁
- `Monitor.Exit()`：线程还锁

在调用`Monitor.Enter(obj)`后，线程持有了锁，直到`Monitor.Exit(obj)`才归还，可继续下一次`Monitor.Enter(obj)`

<B><BL>问题：lockTaken是什么</BL></B>
<BL>`Monitor.Enter(obj, ref lockTaken)`是更安全的原子操作，保证了`Monitor.Exit()`的正确执行
lockTaken初始值为false，一旦成功获取锁，lockTaken都会设为true并执行Exit操作，除非Enter操作本身就发生错误或被`Interrupt()`，此时为false也就不会进行Exit操作</BL>
<B><BL>问题：为什么要lockTaken</BL></B>
<BL>因为使用`Monitor.Enter(obj)`是不安全的：</BL>

- <BL>Enter本身就会发生错误，这会导致finally语句块中的Exit出现错误(没有获取锁)</BL>
- <BL>应该还有其它原因</BL>

<BR>

<B>Semaphore</B>
Semaphore翻译过来就是信号标/旗语，指的就是<B>信号量</B>
简单理解就是：<B><VT>控制可通过数量</VT></B>
<B>操作：</B>

- `semaphore.WaitOne()`：等待(堵塞操作)
- `semaphore.Release()`：释放(释放了使WaitOne继续通过)

如前面的`HeavyJob()`就可以这样写：

``` csharp
var semaphore = new Semaphore(3, 3);
private static int HeavyJob(int input)
{
    semaphore.WaitOne();
    Thread.Sleep(300);
    semaphore.Release();
    return input;
}
```

`Semaphore(3, 3)`指的是初始许可数(参数1)为3，最大许可数(参数2)为3
<B><BL>问题：初始许可数是什么意思，不应该是一一对应的吗</BL></B>
<BL>在生产者-消费者模式中容易出现，可以一开始没有许可数，生产者生产完毕后`Release()`，这样消费者就能通过`WaitOne()`进行消费了</BL>

<BR>

以上是一些底层的内容，还有一些<B>更高层的轮子</B>，就比如说Dictionary就有线程安全版本ConcurrentDictionary，具体如下：

- 线程安全单例：Lzay
- 线程安全集合：
  - ConcurrentBag
  - ConcurrentStack
  - ConcurrentQueue
  - ConcurrentDictionary
- 堵塞集合：BlockingCollection
- 通道：Channel
- 原子操作：Interlocked
- 周期任务：PeriodicTimer

<BR>

---
---
---

# 异步

异步我们可能会认为就是多线程，但并不如此：

- 异步不意味着多线程，单线程也可以异步
- 异步默认借助线程池
- 多线程通常会堵塞完成，异步是不堵塞的

简单来说:

- 多线程适合长期任务(CPU密集型操作，同时创建销毁开销大)，而异步适合短暂且数量多的小任务(IO密集型操作)
- 多线程更底层，可以使用线程/锁/信号量
- 多线程不易于传参与返回
- 异步具有不堵塞特性，提高系统响应能力

<BR>

<B>异步任务</B>
异步任务即<B><GN>Task</GN></B>，是一种<B><VT>包含了各种状态(IsComplete)的引用类型</VT></B>
Task具有值类型版本<B><GN>ValueTask</GN></B>

异步不堵塞是很关键的一个概念，这是因为<B><VT>异步任务默认会借助线程池在其它线程上运行(如果是IO操作则更本不需要)</VT></B>
<B>这里简单来说：</B>

- 硬件/操作系统
  - `Task.Delay()`：使用系统计时器
  - 文件IO：使用IO完成端口
  - 网络请求：网络驱动
  - 数据库：数据库驱动
- 线程池线程
  - `Task.Run()`
  - `Task.Factory.StartNew`：Run的完整版
  - `Parallel.ForEach`
  - CPU密集型工作

Task具有泛型版本，非泛型为无返回值，泛型T为T类型返回值

<B>异步方法</B>
异步方法即`async Task`，我们可能会觉得异步中的async关键字是一定需要的，但并不如此

``` csharp
async Task Main()
{
    await FooAsync();
}
Task FooAsync()
{
    return Task.Delay(1000);
}
```

由于`Task.Delay(1000)`的返回值也是一个Task，所以是可行的
但是<B><VT>只有有了async关键字，在函数中才能使用await关键字</VT></B>
<B><GN>await</GN></B>：<B><VT>等待异步任务结束，并获得结果</VT></B>
<B>不堵塞的含义</B>大概是这样：虽然await处还停留在这，但是实际上线程已经释放可以立刻处理其它操作(响应回调之类的)，直到Task说我完成了
<B><DRD>注意：返回后不一定是原来的线程，如果要保证则可以通过`.ConfigureAwait(true)`进行配置(需要同步上下文)</DRD></B>

<B>Tip：</B>
<B><VT>`Environment.CurrentManagedThreadId`要优于`Thread.CurrentThread.ManagedThreadId`</VT></B>

<B>async的底层</B>
如果我们尝试将以下代码编译：

``` csharp
public class C {
    public void Foo(){
    }
}
```

编译结果是没有区别的
但是如果将Foo函数声明为`public async Task Foo()`，则会是如下结果：

``` csharp
public class C
{
    [CompilerGenerated]
    private sealed class <Foo>d__1 : IAsyncStateMachine
    {
        public int <>1__state;

        public AsyncTaskMethodBuilder <>t__builder;

        public C <>4__this;

        private void MoveNext()
        {
            int num = <>1__state;
            try
            {
            }
            catch (Exception exception)
            {
                <>1__state = -2;
                <>t__builder.SetException(exception);
                return;
            }
            <>1__state = -2;
            <>t__builder.SetResult();
        }

        void IAsyncStateMachine.MoveNext()
        {
            //ILSpy generated this explicit interface implementation from .override directive in MoveNext
            this.MoveNext();
        }

        [DebuggerHidden]
        private void SetStateMachine([Nullable(1)] IAsyncStateMachine stateMachine)
        {
        }

        void IAsyncStateMachine.SetStateMachine([Nullable(1)] IAsyncStateMachine stateMachine)
        {
            //ILSpy generated this explicit interface implementation from .override directive in SetStateMachine
            this.SetStateMachine(stateMachine);
        }
    }

    [NullableContext(1)]
    [AsyncStateMachine(typeof(<Foo>d__1))]
    [DebuggerStepThrough]
    public Task Foo()
    {
        <Foo>d__1 stateMachine = new <Foo>d__1();
        stateMachine.<>t__builder = AsyncTaskMethodBuilder.Create();
        stateMachine.<>4__this = this;
        stateMachine.<>1__state = -1;
        stateMachine.<>t__builder.Start(ref stateMachine);
        return stateMachine.<>t__builder.Task;
    }
}
```

简单来说async就是一种语法糖，本质上async Task还是一种返回Task的形式
而考虑不添加async，则有：

``` csharp
public class C
{
    [NullableContext(1)]
    public Task Foo()
    {
        return Task.Delay(1000); // 这里是因为Task必须返回
    }
}

```

<B><BL>问题：为什么Task必须返回，而async Task可以不返回</BL></B>
<BL>显然是async有所包装，其形式本身就会返回一个Task</BL>

<B>所以说：</B>
<B><VT>async+await的形式会将函数包装成状态机，await则是一个检查点(状态切换)，其中`MoveNext()`则是执行的关键</VT></B>

<B>Task与async Task的返回值</B>

对于Task，是必须要返回Task的，就像下面这样

``` csharp
public Task Foo()
{
    return Task.Delay(1000);
}
```

而对于async Task，具有更好的便利性：

``` csharp
public async Task Foo()
{
    await return Task.Delay(1000);
}
public async Task Foo()
{
    return;
}
public async Task<int> Foo()
{
    return 10;
}
```

从表现上来说，是<B><VT>省略了返回的Task本身，我们只需要考虑返回值(非泛型就是无，泛型就是T)</VT></B>

<B>async void</B>
我们能理解Task，也能理解async Task，但也存在一种async void，这其实很奇怪：

``` csharp
public async void FooAsync()
{
    await Task.Delay(1000);
}
```

有async就可以await，这里也是如此，但是既然这里返回的void，那么对于async Task的Main函数就无法接收：

``` csharp
async Task Main()
{
    // await FooAsync(); //不可用
    FooAsync(); // 只能这样调用
    // 同时由于不返回Task，所以没有任何属性可以.
}
```

<B><DRD>重要：void由于没有Task的功能，所以聚合异常AggregateException(一种很好的Exception封装，有很多信息)同样也没有了，会出现意外情况：</DRD></B>

``` csharp
async Task Main()
{
    try
    {
        FooAsync();
    }
    catch(Exception ex)
    {
        Console.WriteLine(ex.Message);
    }
}
async void VoidAsync()
{
    await Task.Delay(1000);
    throw new Exception("Something was wrong!");
}
```

意外的是，trycatch并不能捕获这里的异常，依旧在throw处进行报错
主要原因就是没有Task，我们可以这样写：

``` csharp
async Task Main()
{
    try
    {
        await FooAsync();
    }
    catch(Exception ex)
    {
        Console.WriteLine(ex.Message);
    }
}
async Task VoidAsync()
{
    await Task.Delay(1000);
    throw new Exception("Something was wrong!");
}
```

这里会捕获到Exception，
我们也可以这么写：`FooAsync().Wait();`，此时捕获到的就是前面提到的AggregateException，这其实是由于await会进行解包从而得到原生错误
`FooAsync().GetAwaiter().GetResult();`这样也能捕获到Exception，但<B>不推荐</B>这么做

<B>async void的作用</B>
看起来async void没什么作用，只需要通过async Task就能干所有事情了，但有一种情况需要使用，即<B>Action事件</B>：

``` csharp
var demo = new Demp();
demp.Callback += FooAsync;

async Task FooAsync()
{
    await Task.Delay(1000);
}

class Demo
{
    public event Func<Task> Callback;
}
```

以上是一种情况，看似事件也可以使用async Task，但是如果事件是无返回值的，比如说Action或者EventHandler那就不行了，此时Task/async Task不行，void无法awaiter，只有async void符合要求

异步的一个<B>特性</B>：<B><VT>传染性</VT></B>
<VT>如果使用异步，就会发现，如果想要为某函数添加异步async，那么一层一层的全部都要添加上async</VT>
这并<B>不是什么很难处理的事情</B>，因为Async版本函数基本都有提供，即使没有也可以通过`Task.Run()`的方式进行包装

<B><DRD>注意：不要再异步方法里用任何方式阻塞当前线程</DRD></B>

``` csharp
async Task FooAsync()
{
    Thread.Sleep(2000);
    await Task.Delay(2000);
}
```

使用Thread，这意味着在异步中使用了同步方法，这会导致本来`Task.Delay()`释放线程前被同步堵塞了，这当然是<B>不好的</B>

同样会堵塞的情况有：

- `Task.Wait()`/`Task.Result`/`Task.GetAwaiter().GetResult()`(Result的Exception版本(没有包装成AggregateException))
- `Thread.Sleep()`
- IO同步版本操作
- 繁重耗时的任务

<BR>

<B>函数`ConfigureAwait()`：<VT>决定await方法结束后是否回到原来线程，默认为true</VT></B>
对于UI线程，必须为true，否则无法继续执行相关操作

<B><GN>TaskScheduler</GN></B>：Task调度器，默认是Default，有这几种：

- Default
- CurrentThread
- STAThread
- LongRunning

可根据需求选择需要的类型，当然也可以自定义，可控制<B>优先级/上下文/执行状态</B>

<B><GN>一发即忘Fire-and-forget</GN></B>：含义是<B><VT>调用异步，但不使用await，也不使用堵塞</VT></B>，这会导致无法观察任务的状态，我们也就无法得知任务的完成状态，即使报错我们也不知道

<B>循环内不要用await：</B>

``` csharp
var inputs = Enumerable.Range(1, 10).ToArray();

var tasks = inputs.Select(HeavyJob).ToList();

await Task.WhenAll(tasks);

var outputs = tasks.Select(x => x.Result).ToArray();

outputs.Dump();

async Task<int> HeavyJob(int input)
{
    await Task.Delay(1000);
    return input * input;
}
```

这里没有用循环来进行`HeavyJob()`操作，如果是循环，那么就会一步一步执行，那么就会用1*10秒来完成了
这里改成了用tasks收集Task，然后同时开启执行，那么自然只需要1秒完成
其中：`await Task.WhenAll()`等待所有任务完成，这样Result就不会同步卡住了(因为已经全部完成)

<B>任务取消方式：</B>
<B><GN>CancellationToken<GN></B>
<B><VT>建议异步方法都添加---可以不用，但不能没有(万一要用呢)</VT></B>

其它的一些操作：

- <B>任务超时</B>
- <B>汇报进度</B>
- <B>同步中调用异步</B>

<B>一些误区：</B>

- <B>异步不一定是多线程</B>
  多线程可以是单线程的：
  - 对于多线程情况：通过不同的线程，进行调度实现
  - 对于单线程情况：通过计时器来完成
- <B>async Task不是必须的</B>
  async Task说到底还是Task，只是使内部可使用await，最重要的是外部使用await去获取Task而已
- <B>await不一定会切换同步上下文</B>
  如果await已完成任务，那么就继续做了，不需要切换了
  有些操作甚至不需要线程
  完整来说：<B><VT>await本身不会创建新线程，具体到底有没有看操作的</VT></B>
  <B><VT>Tip：所以说`ConfigureAwait()`并不会影响Task究竟是谁完成的</VT></B>
- <B>异步不能取代多线程</B>
  毕竟两者是不同的，总有自己合适的情况
- <B>`Task.Result`不会堵塞当前线程</B>
  因为有可能Result直接可获取
- <B>异步中也能堵塞</B>
  只要在await之前进行同步堵塞操作，线程并没有改变，自然会堵塞

<BR>

<B>注意：</B>
<B><DRD>同步中不能使用异步</DRD></B>
最简单的例子就是在lock块中是不能使用await关键字的，
本质原因就在于<B>lock需要保证是同一线程，而异步不能保证</B>
唯一支持的是<B>SemaphoreSlim</B>

<B><BL>问题：异步方法想直接返回值怎么办</BL></B>
对于某些接口来说，可能是异步的，但是函数却又很简单，只需输出值即可，这时候我们可能可以通过`async Task<string>`这种方式来完成，这当然可以，但由于添加async，这会导致状态机的创建，这必然是有消耗的，更好的方式是：

``` csharp
public Task<string> FooAsync()
{
    return Task.FromResult<string>("123");
}
```

即<B><GN>Task.FromResult()</GN></B>
以下方式就不好：

``` csharp
public async Task<string> FooAsync()
{
    await Task.Delay(0); // 没办法，只能加一个没用的Delay
    return "123";
}
```

<B>添加CancellationToken版本：</B>

``` csharp
public Task<string> FooAsync()
{
    if(token.IsCancellationRequested)
        return Task.FromCanceled<string>(token);
    return Task.FromResult<string>("123");
}
```

Unity异步
[https://docs.unity3d.org.cn/6000.0/Documentation/Manual/async-await-support.html]
[https://blog.zhulegend.com/blog/unity%E4%B8%AD%E5%AF%B9await%E7%9A%84%E6%94%AF%E6%8C%81]
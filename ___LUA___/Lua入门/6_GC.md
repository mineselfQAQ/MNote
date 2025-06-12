**<center><T>6_GC</T></center>**

<!-- TOC -->

- [弱引用表](#%E5%BC%B1%E5%BC%95%E7%94%A8%E8%A1%A8)
    - [基础](#%E5%9F%BA%E7%A1%80)
    - [应用](#%E5%BA%94%E7%94%A8)
        - [记忆函数](#%E8%AE%B0%E5%BF%86%E5%87%BD%E6%95%B0)
            - [例子：服务器接收指令](#%E4%BE%8B%E5%AD%90%E6%9C%8D%E5%8A%A1%E5%99%A8%E6%8E%A5%E6%94%B6%E6%8C%87%E4%BB%A4)
            - [例子2：颜色表](#%E4%BE%8B%E5%AD%902%E9%A2%9C%E8%89%B2%E8%A1%A8)
        - [对象属性](#%E5%AF%B9%E8%B1%A1%E5%B1%9E%E6%80%A7)
        - [表的默认值](#%E8%A1%A8%E7%9A%84%E9%BB%98%E8%AE%A4%E5%80%BC)
        - [瞬表](#%E7%9E%AC%E8%A1%A8)
- [析构器](#%E6%9E%90%E6%9E%84%E5%99%A8)
    - [元方法__gc](#%E5%85%83%E6%96%B9%E6%B3%95__gc)
    - [复苏](#%E5%A4%8D%E8%8B%8F)
    - [特性与技巧](#%E7%89%B9%E6%80%A7%E4%B8%8E%E6%8A%80%E5%B7%A7)
- [GC](#gc)
    - [collectgarbage](#collectgarbage)

<!-- /TOC -->

在Lua中，**<VT>GC不能猜测我们认为哪些是垃圾</VT>**
<YL><B>就比如说栈</B>：栈是通过一个table+一个索引组成的，那么`pop()`操作我们其实只需简单地将索引-1即可，但是这样操作后Lua不可能知道该元素已经"不存在"了</YL>\

所以简单来说：**只要还留在数组或存储在全局变量的对象，无论是否会使用，都不会被GC**
为了GC，我们将其**赋为nil**即可<DRD>(全局变量可以，数组不行)</DRD>

# 弱引用表

## 基础

根据前面提到的内容，其中**table比较特殊**：
**<VT>一旦一个对象成为了table的一部分，就再也无法被回收了，因为table在引用它</VT>**

为了解决这个问题，我们所需的就是**弱引用表**：
**<GN>弱引用表</GN>---<VT>用来告知Lua语言一个引用不应阻止对一个对象回收的机制</VT>**
**<GN>弱引用</GN>---<VT>一种不在GC考虑范围内的对象引用</VT>**

**逻辑如下：**

- 如果对象的所有引用都是弱引用，GC将会回收这个对象并删除这些弱引用
- 如果一个对象只被一个弱引用表持有，Lua会回收这个对象

<BR>

**默认情况**下，键值都是<B><GN>强引用</GN>---<VT>会阻止对其所指对象的回收</VT></B>
弱引用可以通过<B>元表`__mode`</B>表示，有3种：

- `"k"`---弱键表
- `"v"`---弱值表
- `"kv"`---弱键值表

**具体来说：<VT>只要有一个键或值被回收了，那么对应的整个键值对都会被从表中删除</VT>**

``` lua
a = {}
mt = {__mode = "k"} -- 弱键表
setmetatable(a, mt)

-- a作为一个table，在其内部添加一个table，该table由key引用
-- 将该table作为key在a中建立键值对
-- 随后key被覆盖了，key引用了一个新table，然后同样建立键值对
-- 此时：
-- a中确实存在2个table，而key引用是针对与a[key]=2的(a[key]=1的key已经被覆盖了)
-- 由于a是弱key表，只有a[key]=2所属的table为强引用，那么a[key]=1所属的table将被清除
key = {}
a[key] = 1
key = {}
a[key] = 2

collectgarbage()
for k, v in pairs(a) do print(v) end -- 只有2存在
```

**<DRD>注意：只有对象可以被移除，而值是不可回收的
注意：对于字符串来说，从程序员角度看字符串就是值而非对象，无需考虑那么多，是不会被移除的</DRD>**

## 应用

### 记忆函数

**<GN>记忆函数</GN>---<VT>用空间换时间，参数相同返回记忆结果</VT>**
对于记忆函数，是非常需要弱引用表的

#### 例子：服务器接收指令

``` lua
local results = {}
function mem_loadstring(s)
    local res = results[s]
    if res == nil then
        res = assert(load(s))
        results[s] = res 
    end
    return res
end
```

可以看到，这其实就是我们非常常用的一种优化方式，就是所谓的**缓存表**<VT>(记忆函数的子集)</VT>

**不足之处：**
很明显，通过缓存的方式必然能够对于需要多次访问的情况起到加速作用，但是同时带来的就是**单次访问的浪费**：<VT>如果只需要访问一次存储则是没有意义的</VT>
同时，如果运行时间过久，进行大量的存储，**内存**迟早会被**耗尽**

**优化方案：弱引用表**

``` lua
local results = {}
setmetatable(results, {__mode = "v"}) -- 索引是string，所以可以是kv
function mem_loadstring(s)
    local res = results[s]
    if res == nil then
        res = assert(load(s))
        results[s] = res
    end
    return res
end
```

此时有：

- `mem_loadstring("return 1")`：由于结果res没有被引用，可回收
- `func1 = mem_loadstring("return 1")`：由于结果被全局变量`func1`所引用，在`func1 = nil`之前都不可回收

#### 例子2：颜色表

``` lua
local results = {}
setmetatable(results, {__mode = "v"})

function createRGB(r, g, b)
    local key = string.format("%d-%d-%d", r, g, b)
    local color = results[key]
    if color == nil then
        color = {red = r, green = g, blue = b}
        results[key] = color
    end
    return color
end
```

可以发现这其实与上一个例子是完全一致的

### 对象属性

对于一个对象(table)来说，是可以拥有各种属性的，如：`book = {name = "book1", prize = 12}`
如果我们想要添加同样是可行的，有：`book.count = 5`

但是：**如果对象不是table或不想污染元表以上方法就做不到了**
**解决方案：外部表**

``` lua
local properties = {}
properties[obj] = { name = "foo", size = 10 }
print(properties[obj].name)
```

可以看到对于该obj，无论它是table还是其它类型，都可存储属性
**存在问题：**
properties表是<VT>强引用</VT>的，这会**导致obj无法被GC**
**追加解决方案：弱引用表**

``` lua
local properties = {}
setmetatable(results, {__mode = "k"})

...
```

**完整实例如下：**

``` lua
-- 弱键表存储属性（键可被GC回收）
local properties = setmetatable({}, { __mode = "k" })

local function create_object()
    local obj = {}
    properties[obj] = { id = math.random(100), tag = "test" }
    return obj
end

local x = create_object()
print(properties[x].tag)  -- 输出 "test"

x = nil -- 当x不再被引用时，properties[x]会被自动清除
```

### 表的默认值

对于表来说，添加默认值是很有用的一种操作，
但是强引用必然会导致无法GC，所以**改为弱引用**肯定是一种更好的方案：

``` lua
-- 对偶方案，适用于少量共享默认值的表
local defaults = {}
setmetatable(defaults, {__mode = "k"}) -- 要是t不用了(=nil)就可以GC了
local mt = {__index = function (t) return defaults[t] end}
function setDefault(t, d)
    defaults[t] = d
    setmetatable(t, mt) -- 对于key来说，会使用defaults[key]，即默认值
end

-- 记忆方案，适用于上千个具有少量不同默认值的表
local metas = {}
setmetatable(metas, {__mode = "v"}) -- 要是mt不用了(=nil)就可以GC了
function setDefault(t, d)
    local mt = metas[d]
    if mt == nil then
        mt = {__index = function () return d end}
        metas[d] = mt -- 记忆
    end
    setmetatable(t, mt) -- 闭包，直接返d
end
```

### 瞬表

我们有时可能会遇到这种问题：**一个具有弱引用键的表中的值又引用了对应的键**


**例子：常量函数工厂**

``` lua
function factory(o)
    return (function() return o end)
end
```

我们能发现工厂函数的**问题**：<VT>该函数会产生闭包，如果有相同的o，那么这是多余的闭包</VT>
那么解决方案就是**记忆方案**：

``` lua
do
    local mem = {}
    setmetatable(mem, {__mode = "k"})
    function factory(o)
        local res = mem[o]
        if not res then
            res = (function () return o end)
            mem[o] = res
        end
        return res
    end
end
```

此时存在一个值得注意的**问题**：
此时有**弱键o**以及**强值res**<VT>(内部引用o)</VT>，我们可能考虑的是`o=nil`之后就可以回收了，但是<VT><B>由于强值res引用o(函数闭包导致)，导致无法GC</B></VT>

但是这是<DRD><B>不会发生</B></DRD>的，因为有瞬表：
<B><GN>瞬表Ephemeron Table</GN>---<VT>具有弱key和强value的表</VT></B>
对于瞬表，即`__mode="k"`情况，Lua会进行**特殊处理**：

- 只有当键o被外部强引用时，对应的值res才会被保留
- 如果键o仅被值res引用(无外部引用)，则键值对o/res会被GC

<BR>

**更通俗易懂的逻辑：**
我们要求的是弱key，所以关注key，存在2种情况：

- key还在使用，那么自然不可能GC
- key置为nil，那么这意味着key不再有用，此时<VT>强value如果只引用了key，那么这种自循环是不成立的，自然应该GC</VT>

# 析构器

## 元方法__gc

在Lua中，析构器是通过<B>元方法`__gc`</B>完成的：　　　**<DRD>Lua5.1没有</DRD>**

``` lua
o = {x = "hi"}
setmetatable(o, {__gc = function (o) print(o.x) end})
o = nil
collectgarbage() -- hi

-- 以下情况由于顺序问题无法鉴别(因为lua不清楚此时__gc有什么用，就不会进行)
o = {x = "hi"}
mt = {}
setmetatable(o, mt)
mt.__gc = function (o) print(o.x) end
o = nil
collectgarbage() -- 不输出

-- 如果想要在后续进行__gc设置，可以使用占位符
o = {x = "hi"}
mt = {__gc = true} -- 占位，代表析构启用
setmetatable(o, mt)
mt.__gc = function (o) print(o.x) end
o = nil
collectgarbage() -- hi
```

**<VT>注意：析构器是逆序调用的</VT>**

``` lua
mt = {__gc = function(o) print(o[1]) end}
list = nil
for i = 1,3 do
    list = setmetatable({i, link = list}, mt)
end
list = nil
collectgarbage() -- 将会输出3 2 1
```

<VT>简单理解的话就是：这里创建了一个链表，即3个表，创建是1->2->3的方式创建的，那么删除就会以3->2->1的方式删除</VT>

## 复苏

析构器会导致**复苏**
<B><GN>临时复苏</GN>---<VT>一个正在析构的对象由于另一个析构器的析构(参数中有析构对象)导致在析构期间重新活跃</VT></B>
<B><GN>永久复苏</GN>---<VT>会把对象存储在全局变量中，使其在析构器返回仍可访问</VT></B>
**复苏例子：**

```lua
-- 由于B的析构器访问了A，因此A在B析构前不能被回收
-- Lua在运行析构器之前必须同时复苏B和A
-- 即：B死A才能死
A = {x = "this is A"}
B = {f = A}
setmetatable(B, {__gc = function(o) print(o.f.x) end})
A, B = nil
collectgarbage -- this is A
```

由于**复苏**的原因，**Lua会在2个阶段回收具有析构器的对象**：

- 当GC首次发现某个析构器对象不可达，则会将其复苏并放入等待析构队列，一旦析构器指向，该对象就会被标记为已被析构
- 当下一次GC又发现不可达时，会将对象删除

**<VT>因此想要保证所有垃圾被释放的话，必须调用collectgarbage两次</VT>**

**具体如下：**

``` lua
local obj = setmetatable({}, { __gc = function() print("析构器执行") end })
obj = nil -- 对象不可达
collectgarbage() -- 第一次调用：执行析构器，输出"析构器执行"
collectgarbage() -- 第二次调用：彻底删除对象
```

## 特性与技巧

**特性：**
**<VT>如果一个对象直到程序运行结束还没有被回收，那么Lua语言就会在整个Lua虚拟机关闭后调用它的析构器</VT>**

``` lua
local t = {
    __gc = function()
    print("finishing lua program")
  end
}
setmetatable(t, t) -- 自引用，这是可以的，但可能没什么意义
_G["*AA*"] = t -- 锚定到全局表中

-- 运行后由于会退出程序，所以会执行"finishing lua program"
```

可以认为该析构器会在`atexit()`<VT>(C语言中程序退出后使用的函数指针回调函数)</VT>执行析构

**特性2：**
**<VT>在GC周期内，GC会在调用析构器前清理弱引用表的值，在调用析构器之后再清理键</VT>**
即：

1. 清理弱value表的value
2. 调用`__gc`元方法
3. 清理弱key表的key

<BR>

**技巧：析构创析构**

``` lua
do
  local mt = {__gc = function (o)
    print("new cycle")
    setmetatable({}, getmetatable(o)) -- 当执行析构后，会生成下一个具有析构的新表
  end}

  setmetatable({}, mt) -- 第一个表
end

collectgarbage()
collectgarbage()
collectgarbage()
-- 共输出4次"new cycle"
```

4次分别是*程序运行结束后表的析构(1)**，以及每次**新表的析构(3)**

# GC

直到Lua5.0，GC使用的是<GN><B>标记-清除式GC</B></GN>，这种方法会时不时停止主程序的运行执行一次完整的GC周期，有四个阶段：**标记mark->清理cleaning->清除sweep->析构finalization**

- **标记阶段**---把<GN><B>根节点集合root set</B></GN><VT>(Lua语言可直接访问的对象)</VT>标记为活跃，即C注册表，当所有可达对象都被标记为活跃后，标记阶段完成
- **清理阶段**---用于处理析构器和弱引用表。会遍历需要析构但没有被标记为活跃的对象，它们会被标记为活跃(复苏)，并放在单独的列表中(在析构阶段用到)，然后遍历弱引用表并从中移除键或值未被标记的元素
- **清除阶段**---遍历所有对象(通过链表)，没有被标记为活跃的就回收，否则清理标记，准备进行下一GC周期
- **析构阶段**---调用清理阶段被分离出的对象的析构器

**Lua5.1**改为<GN><B>增量式垃圾收集器Incremental Collector</B></GN>，在原基础上不再需要停止主程序的运行，会与解释器交替运行，每当解释器分配了一定量的内存时，垃圾收集器也执行一小步
**Lua5.2**引入<GN><B>紧急垃圾收集Emergency Collection</B></GN>，当内存分配失败时，会强制进行一次完整GC后再尝试分配

## collectgarbage()

我们一般调用的为无参数的`collectgarbage()`，但其实是存在参数的：

- `"stop"`
<B>作用：</B>立即停止垃圾收集器的自动运行。
<B>后续操作：</B>需显式调用`collectgarbage("restart")`重新启动。

- `"restart"`
<B>作用：</B>重启被停止的垃圾收集器，恢复自动垃圾回收。

- `"collect"`　　**<VT>等价于无参数情况</VT>**
<B>作用：</B>执行一次完整的垃圾回收周期（默认选项），回收所有不可达对象并调用析构器（__gc）。
<VT><B>注意：</B>对于带析构器的对象，可能需要调用两次才能完全释放（第一次触发析构器，第二次删除对象）。</VT>

- `"step"`
<B>作用：</B>执行增量垃圾回收，逐步处理垃圾。
<B>参数：</B>data 指定工作量（单位：字节），表示分配 data 字节后触发一步回收。
<B>返回值：</B>布尔值，若完成回收返回 true，否则 false。

- `"count"`
<B>作用：</B>返回当前 Lua 已用内存量（单位：KB，浮点数）。
<VT><B>注意：</B>结果包含未被回收的“死对象”，精确字节数需乘以 1024。</VT>

- `"setpause"`
**作用：**设置垃圾收集器的 间歇率（pause 参数），控制回收频率。
<B>参数：</B>ata 为百分比值（如 100 表示 1.0）。值越高，GC 越不频繁（内存压力更小）。

- `"setstepmul"`
**作用：**设置垃圾收集器的 步进倍率（stepmul 参数），控制回收速度。
<B>参数：</B>data 为百分比值（如 200 表示 2.0）。值越高，每次回收工作量越大（速度越快，但可能卡顿）。

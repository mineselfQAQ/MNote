**<center><BBBG>C#反射</BBBG></center>**

<!-- TOC -->

- [API](#api)
  - [Assembly](#assembly)
  - [Type](#type)
  - [Activator](#activator)
  - [各对象获取](#各对象获取)
    - [BindingFlags](#bindingflags)
    - [XXXInfo](#xxxinfo)
      - [MemberInfo](#memberinfo)
      - [FieldInfo](#fieldinfo)
      - [PropertyInfo](#propertyinfo)
      - [MethodInfo/ConstructorInfo](#methodinfoconstructorinfo)
      - [EventInfo](#eventinfo)
      - [ParameterInfo](#parameterinfo)
      - [Attribute](#attribute)
      - [高级](#高级)
        - [泛型](#泛型)
        - [其它](#其它)

<!-- /TOC -->

反射是一种比较常见的功能，简单来说就是：
**<VT>程序运行时，获取并操作"类型本身"的能力</VT>**

**重要：<DRD>反射虽然方便，但是很慢</DRD>**

# API

反射都知道怎么一回事，但是API总的来说是比较复杂的，需要整理一下

## Assembly

Assembly即<B><GN>程序集(dll/exe)</GN></B>，某些情况下需要从**Assembly**开始**获取**，操作如下：

- `Assembly.Load()`：按名称
- `Assembly.LoadFrom()`：按路径
- `Assembly.LoadFile()`：按完整路径
- `typeof(xxx).Assembly`：通过类型获取

需要注意：`Load()`不需要后缀，`LoadFrom()/LoadFile()`需要后缀

获取到Assembly对象后，最常用的就是**获取Assembly下的类型**：

- `asm.GetTypes()`
- `asm.GetType()`　　<VT>需要传入FullName(命名空间+类名)</VT>

**<BL>问题：为什么有时获取不到Type</BL>**
<BL>一般来说是缺引用了，假如A引用了B，如果B获取不到，那么A自然也无法获取</BL>


## Type

Type是反射中的重中之重，可以说一切的起点就是类型

**类型的获取**很简单：

- `typeof(xxx)`
- `obj.GetType()`
- `Assembly.GetType()`
- `Type.GetType()`：全局搜索<DRD>(不推荐，仅在当前程序集+.NET核心)</DRD>

以下是Type的**核心属性**：

- `t.Assembly`
- `t.Namespace`
- `t.Name`
- `t.FullName`
- `t.BaseType`：父类
- `t.IsClass`
- `t.IsAbstract`
- `t.IsInterface`

## Activator

Activator即<B><GN>激活器</GN></B>，从名字上来看就是用来**创建**的
该静态类中仅有一种函数：`Activator.CreateInstance()`
有多种调用方式：

``` csharp
public static object CreateInstance(Type type);
public static object CreateInstance(Type type, bool nonPublic);
public static object CreateInstance(Type type, params object[] args);
public static object CreateInstance(Type type, object[] args, object[] activationAttributes);

public static object CreateInstance(
Type type,
BindingFlags bindingAttr,
Binder binder,
object[] args,
CultureInfo culture);

public static object CreateInstance(
Type type,
BindingFlags bindingAttr,
Binder binder,
object[] args,
CultureInfo culture,
object[] activationAttributes);

public static T CreateInstance<T>();
```

**注意：**
**<DRD>`(Type type, bool nonPublic)`版本指定了访问性，除复杂版本(带BindingFlags)，都等价于寻找public版本</DRD>**

## 各对象获取

### BindingFlags

对于获取对象，非常常见的一种参数就是**BindingFlags**，从名字上来看，其含义为**绑定标识**，其实各类控制开关
**常用的**如下所示：

- 访问修饰符
  - Instance/Static
  - Public/NonPublic
- 其它
  - DeclaredOnly：当前类(默认会带上父类)
    <VT>所以可以排除`ToString()`这种来自object的</VT>
  - IgnoreCase：忽略大小写
  - FlattenHierarchy：支持父类public与protected的static
  - ExactBinding：精准匹配<VT>(用于相似重载，尤其是可隐式转换的情况)</VT>
  - OptionalParamBinding：支持可选参数<VT>(如`Foo(int x = 1)`)</VT>

这里最关键的就是**访问修饰符**：
几个flag的含义很清楚，但是有2点需要注意：

- 无参情况**默认**为`BindingFlags.Public | BindingFlags.Instance`
- 4种访问修饰符**不是互斥的**
- Public包含public
  NonPublic包含private/protected/internal

### XXXInfo

反射中能获取到各种对象，每种对象都对应着一种**XXXInfo**

**获取XXXInfo：**
一般来说通过`GetXXX()`即可，具体如下：
<VT>Tip：都有单数形式，同时不一定通过Type获取</VT>

- ConstructorInfo：`GetConstructors()`
- MethodInfo：`GetMethods()`
- PropertyInfo：`GetProperties()`
- FieldInfo：`GetFields()`
- `GetCustomAttributes()`，返回`IEnumerable<Attribute>`

**继承链：**

- MemberInfo
  - Type
  - FieldInfo
  - MethodBase
    - MethodInfo
    - ConstructorInfo
  - PropertyInfo
  - EventInfo
- 其它
  - ParameterInfo
  - Attribute

#### MemberInfo

可以看到MemberInfo是**最基类**，大部分其它的Info都会继承于它，因为说到底是某种对象
值得注意的是<B><VT>Type也是继承于MemberInfo的</VT></B>

既然是最基类，那么其中必然具有一些**通用内容**：

- `Name`
- `MemberType`：成员类型，为<B><GN>MemberTypes枚举</GN></B>
- `DeclaringType`：声明Member的最基类
- `ReflectedType`：当前类

<BR>

一般情况下，虽然我们会获取MemberInfo，但在之后必然会通过MemberInfo获取所需的XXXInfo进行操作

#### FieldInfo

Field即**字段**
**内容**有：

- `GetValue()`
- `SetValue()`
- `FieldType`
- `IsStatic`
- `IsPrivate`

#### PropertyInfo

Property即**属性**
**内容**有：

- `GetValue()`
- `SetValue()`
- `PropertyType`
- `CanRead`
- `CanWrite`
- `GetMethod`：获取getter方法(MethodInfo)
- `SetMethod`：获取setter方法(MethodInfo)

#### MethodInfo/ConstructorInfo

Method即**方法**，Constructor即**构造方法**，本质上两者都是方法，所以它们有一基类MethodBase
由于是方法，所以有一些**共有内容**：

- `Invoke()`
- `GetParameters()`
- `IsStatic`

而MethodInfo会有`ReturnType`/`ReturnParameter`/`ReturnTypeCustomAttributes`：

- `ReturnType`就是一个返回值Type
- `ReturnParameter`比较特殊，指代的也是返回值，但是是其ParameterInfo元数据
- `ReturnTypeCustomAttributes`则是一个可能会获取的项，如果函数上有`[return: MyAttr]`则可能使用

#### EventInfo

Event即**事件**
内容有：

- `AddEventHandler()`
- `RemoveEventHandler()`
- `EventHandlerType`

#### ParameterInfo

Parameter即**参数**
**内容**有：

- `Name`
- `ParameterType`
- `HasDefaultValue`
- `DefaultValue`

参数通常来自方法，通常有`method.GetParameters()`(包括MethodInfo和ConstructorInfo)
但也有其它情况，也就是**索引器**：`public string this[int index] { get; set; }`，其获取方法为：

``` csharp
var prop = type.GetProperty("Item"); // 索引器是一种属性
var ps = prop.GetIndexParameters();
```

#### Attribute

Attribute即**特性**，也就是在内容前的`[XXX]`
**内容**有：

- `Attribute.GetCustomAttribute()`
- `Attribute.GetCustomAttributes()`
- `Attribute.IsDefined()`

除了通过静态方法来获取特性，<B><VT>只要该内容可以添加`[XXX]`，相应内容就存在GetCustomAttribute方法</VT></B>

#### 高级

##### 泛型

对于泛型，值得详细了解一下
首先是**名字**：
以`typeof(Dictionary<,>)`为例，其名为``Dictionary`2``，即：``类名+ˋ+泛型参数数量``
以嵌套情况举例：

``` csharp
class A<T1>
{
    class B<T2> {}
}
```

对于B(`typeof(A<>.B<>)`)来说，其名为``A`1+B`1``
<DRD>注意：传参也是传2个，顺序为从外到内</DRD>

一个重要的**概念**：

- <B><GN>开放泛型</GN></B>：`X<>`，即泛型本身，类型未确认
- <B><GN>半开放泛型</GN></B>：`X<T>`，即未确认泛型
- <B><GN>封闭泛型</GN></B>：`X<int>`，即已确认泛型

<BR>

**对于泛型来说，存在于两处：**

- Type
- MethodBase<VT>(仅指代MethodInfo，因为泛型构造根本就不存在，编译都不会通过)</VT>

<BR>

**对于Type情况**，分为3种情况： <VT>以`class XXX<T> {}`为例</VT>

- `XXX<T>`：泛型定义(可以理解为开放泛型)
- `XXX<int>`：泛型实例(可以理解为封闭泛型)
- `T`：泛型参数占位符

一些重要方法/属性：

- 重要函数
  - `MakeGenericType()`：创建开放泛型的封闭泛型(只有转为封闭类型后才能调用创建实例)
  - `GetGenericArguments()`：获取泛型参数(`Type[]`)
- 判断属性
  - `IsGenericType`
  - `IsGenericTypeDefinition`
  - `ContainsGenericParameters`
  - `IsGenericParameter`
- 约束
  - `GetGenericParameterConstraints()`：类型约束(仅包含接口和基类)
  - `GenericParameterAttributes`：修饰符约束(`class`/`struct`/`new()`之类的)

其中`IsGenericType`/`IsGenericTypeDefinition`/`ContainsGenericParameters`是一组内容，区别如下：

- `IsGenericType`：是否是泛型
- `IsGenericTypeDefinition`：是否为泛型定义(模板)
- `ContainsGenericParameters`：是否具有泛型参数

这样看很难理解，首先先看一下各属性为true的情况：

- `IsGenericType==true`：开放泛型/半开放泛型/封闭泛型
- `IsGenericTypeDefinition==true`：开放泛型
- `ContainsGenericParameters==true`：开放泛型/半开放泛型

由此也可以大概理解了

**对于MethodBase情况**
一些重要方法/属性：

- `MakeGenericMethod()`
- `GetGenericArguments()`
- `IsGenericMethodDefinition`

总的来说和Type还是类似的，由于是方法，有一重要函数：

**<BL>问题：为什么字段之类的没有，明明有`List<T>`这种</BL>**
<BL>并不是没有，而是被包含了，以字段为例，有`FieldInfo.FieldType`，使用该属性即可判断</BL>

##### 其它

- 实例构造函数名为`.ctor`，静态构造函数名为`..ctor`
- 索引器的名字为`Item`，是属性的一员
- 事件类似于属性，属性是getter/setter，而事件是add方法/remove方法
  这些方法的名字都是以`操作_名字`命名，如Age属性就有`set_Age()`
- `IsSpecialName`可用于检查是否为语法糖名，适用于Field/Property/Method/Constructor/Event
- `Attributes`是一更底层的属性，对应一个XXXAttributes枚举，适用于Field/Property/Method/Constructor/Event/Parameter，其中可以发现如`FieldAttributes.Private`这种值，而更多的是一些高级的值
- 如果想获取一个virtual方法的根，可以通过`GetBaseDefinition()`获取

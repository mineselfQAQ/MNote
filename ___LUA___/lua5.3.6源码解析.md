**<center><BBBG>lua5.3.6源码解析</BBBG></center>**

<!-- TOC -->

- [关键数据结构](#关键数据结构)
  - [lua\_State / global\_State](#lua_state--global_state)
  - [LexState / FuncState](#lexstate--funcstate)
    - [SParser](#sparser)
    - [Proto](#proto)
    - [CallInfo](#callinfo)
    - [Token](#token)
      - [SemInfo](#seminfo)
  - [\_ENV](#_env)
    - [沙箱机制](#沙箱机制)
- [数据结构](#数据结构)
  - [数据结构基础](#数据结构基础)
    - [类型](#类型)
    - [GC](#gc)
  - [字符串](#字符串)
  - [创建](#创建)
    - [短字符串](#短字符串)
- [函数执行](#函数执行)
  - [函数执行](#函数执行-1)
  - [安全执行（异常处理）](#安全执行异常处理)
- [编译与虚拟机执行流程](#编译与虚拟机执行流程)
  - [启动](#启动)
    - [命令行启动](#命令行启动)
    - [嵌入](#嵌入)
  - [编译期](#编译期)
    - [二进制反序列化](#二进制反序列化)
    - [文本编译](#文本编译)
      - [mainfunc](#mainfunc)
      - [总览](#总览)
  - [执行期](#执行期)
    - [虚拟机执行](#虚拟机执行)
  - [示例](#示例)

<!-- /TOC -->

如果让我理解lua源码，我会以这个顺序进行：

- 编译与虚拟机执行流程
  - 词法分析器
  - 语法分析器
  - 虚拟机
- 虚拟栈
- 函数执行
- string / table
- upvalue
- metatable

---
---
---

# 关键数据结构

lua源码中数据结构众多，涉及面广很容易忘记，但是本质上重要的其实并不算太多

## lua_State / global_State

启动处：`lua_newstate()`
lua_State：luaVM线程（执行上下文）
global_State：luaVM共享部分

``` c
LUA_API lua_State *lua_newstate (lua_Alloc f, void *ud) {
  int i;
  lua_State *L;
  global_State *g;
  LG *l = cast(LG *, (*f)(ud, NULL, LUA_TTHREAD, sizeof(LG)));
  if (l == NULL) return NULL;
  L = &l->l.l;
  g = &l->g;
  L->next = NULL;
  L->tt = LUA_TTHREAD;
  g->currentwhite = bitmask(WHITE0BIT);
  L->marked = luaC_white(g);
  preinit_thread(L, g);
  g->frealloc = f;
  g->ud = ud;
  g->mainthread = L;
  g->seed = makeseed(L);
  g->gcrunning = 0;  /* no GC while building state */
  g->GCestimate = 0;
  g->strt.size = g->strt.nuse = 0;
  g->strt.hash = NULL;
  setnilvalue(&g->l_registry);
  g->panic = NULL;
  g->version = NULL;
  g->gcstate = GCSpause;
  g->gckind = KGC_NORMAL;
  g->allgc = g->finobj = g->tobefnz = g->fixedgc = NULL;
  g->sweepgc = NULL;
  g->gray = g->grayagain = NULL;
  g->weak = g->ephemeron = g->allweak = NULL;
  g->twups = NULL;
  g->totalbytes = sizeof(LG);
  g->GCdebt = 0;
  g->gcfinnum = 0;
  g->gcpause = LUAI_GCPAUSE;
  g->gcstepmul = LUAI_GCMUL;
  for (i=0; i < LUA_NUMTAGS; i++) g->mt[i] = NULL;
  if (luaD_rawrunprotected(L, f_luaopen, NULL) != LUA_OK) {
    /* memory allocation error: free partial state */
    close_state(L);
    L = NULL;
  }
  return L;
}
```

<B>重点1：`g->mainthread = L;`</B>
<B><VT>lua_State被作为主线程存在</VT></B>
<B>简单理解：</B>
`g->mainthread`可以理解为<B>唯一不变的</B>，`lua_newstate()`创建出来就是唯一主线程，如需其它线程，通过`lua_newthread()`创建（携程也是）

<B>重点2：`g->seed = makeseed(L);`</B>
<B><VT>哈希种子在初始化阶段会创建</VT></B>

``` c
static unsigned int makeseed (lua_State *L) {
  char buff[4 * sizeof(size_t)];
  unsigned int h = luai_makeseed();
  int p = 0;
  addbuff(buff, p, L);  /* heap variable */
  addbuff(buff, p, &h);  /* local variable */
  addbuff(buff, p, luaO_nilobject);  /* global variable */
  addbuff(buff, p, &lua_newstate);  /* public function */
  lua_assert(p == sizeof(buff));
  return luaS_hash(buff, p, h);
}

#define luai_makeseed()		cast(unsigned int, time(NULL))
```

即：<B><VT>以时间作为基础种子，结合不同的地址，进行哈希函数</VT></B>
<B><DRD>注意：lua的seed不够安全，仅作为随机种子存在</DRD></B>

<B>重点3：`lua_newstate()`不止创建了一个lua_State</B>
主线程lua_State只是lua虚拟机中最重要的部分之一，具体结构如下：

``` txt
LG
├─ LX
│  ├─ extra_[LUA_EXTRASPACE]
│  └─ lua_State l   // 主线程
└─ global_State g   // 整个 VM 共享状态
```

``` c
typedef struct LG {
  LX l;
  global_State g;
} LG;

typedef struct LX {
  lu_byte extra_[LUA_EXTRASPACE];
  lua_State l;
} LX;
```

- LG：lua_State + global_State
- LX：extra + lua_State，即带额外空间的lua_State

所以：
<B><VT>本质上`lua_newstate()`创建的是LG数据结构，其中包含了主线程lua_State以及共享global_State并预留了一块额外空间（放指针）</VT></B>

<B>`f_luaopen()`</B>
`lua_newstate()`具有大量的初始化操作，两个数据结构中内容众多
真正的设置其实只有`f_luaopen()`：

``` c
static void f_luaopen (lua_State *L, void *ud) {
  global_State *g = G(L);
  UNUSED(ud);
  stack_init(L, L);  /* init stack */
  init_registry(L, g);
  luaS_init(L);
  luaT_init(L);
  luaX_init(L);
  g->gcrunning = 1;  /* allow gc */
  g->version = lua_version(NULL);
  luai_userstateopen(L);
}
```

- `stack_init()`：初始化stack相关
  - 之所以传入2个相同的L，是因为在内部语义不同：
    在`lua_newthread()`中有：`stack_init(L1, L);`，显然：
    - 左`L1`：需初始化的对象
    - 右`L`：上下文线程（实际会调用`luaM_newvector()`进行分配stack）
- `init_registry()`：创建注册表，并设置到g->l_registry上
  - `registry[LUA_RIDX_MAINTHREAD]`：主线程L
  - `registry[LUA_RIDX_GLOBALS]`：全局表（目前为空，`luaL_openlibs()`会注册标准库）
- `luaS_init()`：初始化字符串
  - `g->memerrmsg`：预留错误信息，防止内存不足创建不出来
  - `g->strcache`：字符串缓存（先用`g->memerrmsg`作为哨兵占位）
- `luaT_init()`：初始化元方法名表
  - `g->tmname`：元表名缓存
- `luaX_init()`：初始化词法保留字系统
  - `_ENV`预创建（`#define LUA_ENV		"_ENV"`）
  - 保留字预创建，并设置`ts->extra`为非0值

## LexState / FuncState

从名字上来看，和lua_State / global_State是一类内容
作为解析流程的两个数据结构，用于`luaY_parser()`

- LexState：编译上下文（读取进度/token状态）
  核心是词法分析阶段，语法分析阶段也会借用数据，直到`luaY_parser()`结束
  <VT>LexState中会指向一个FuncState</VT>
- FuncState：当前函数的生成上下文（编译进度/寄存器状态/局部变量跳转处理）

### SParser

SParser是用于call的数据组合体（毕竟call函数里只有一个位置存放）
本质上是用于f_parser函数（调用者`luaD_protectedparser()`）的：

``` c
struct SParser {  /* data to 'f_parser' */
  ZIO *z;
  Mbuffer buff;  /* dynamic structure used by the scanner */
  Dyndata dyd;  /* dynamic structures used by the parser */
  const char *mode;
  const char *name;
};
```

- ZIO：读取流，用于不断读取字节
- Mbuffer：缓冲，用于拼token
- Dyndata：动态数据
  - actvar：当前活跃局部变量（作用域下还活着的局部变量）
  - gt：待解析goto列表，后续`::x::`可跳转
  - label：可见label列表，检测重复label

这些数据基本都是直接提供给LexState/FuncState

### Proto

Proto是编译后得到的结果，后续在执行中会转换为CallInfo（由`luaD_precall()`完成）
Proto数据众多，核心有：

- `TValue *k`：常量表
- `int *code`：指令
- `struct Proto **p`：子Proto
- `LocVar *locvars`：局部变量信息
- `Upvaldesc *upvalues`：上值信息

### CallInfo

CallInfo指的是函数调用时上下文，是虚拟机执行所需要的数据，由Proto得来由`luaD_precall()`完成）
<B>lua_State</B>需要该类型数据：
`CallInfo *ci;  /* call info for current function */`
`CallInfo base_ci;  /* CallInfo for first level (C calling Lua) */`
<B><VT>在编译期间，两者只是占位，直到执行</VT></B>

### Token

在编译途中，<B><VT>最小语法单位</VT></B>就被称之为<B><GN>token</GN></B>

``` c
typedef struct Token {
  int token;
  SemInfo seminfo;
} Token;
```

简单来说就是读取过程中读到的信息

#### SemInfo

SemInfo是作为<B><VT>Token的附加信息</VT></B>存在的

``` c
typedef union {
  lua_Number r;
  lua_Integer i;
  TString *ts;
} SemInfo;  /* semantics information */
```

也就是说：如果token代表着一个值（TK_NUMBER/TK_STRING/TK_NAME），则会记录

## _ENV

流程如下：

- 初始化`luaX_init()`时会进行`TString *e = luaS_newliteral(L, LUA_ENV);`
  即：创建一个不会被GC回收的`_ENV`（因为会`luaC_fix()`所以不会被回收）
- 解析`mainfunc()`时，会：
  `init_exp(&v, VLOCAL, 0);`
  `newupvalue(fs, ls->envn, &v);`
  即：给主函数Proto添加一个upvalue，名为`_ENV`
- `luaY_parser()`流程结束后，会：
  `luaF_initupvals(L, cl);`
  即：封闭upvalue并设为nil
- 在`luaD_protectedparser()`解析完成后，有：

  ``` c
  LClosure *f = clLvalue(L->top - 1);  /* get newly created function */
  if (f->nupvalues >= 1) {  /* does it have an upvalue? */
    /* get global table from registry */
    Table *reg = hvalue(&G(L)->l_registry);
    const TValue *gt = luaH_getint(reg, LUA_RIDX_GLOBALS);
    /* set global table as 1st upvalue of 'f' (may be LUA_ENV) */
    setobj(L, f->upvals[0]->v, gt);
    luaC_upvalbarrier(L, f->upvals[0]);
  }
  ```

  即：全局表`registry[LUA_RIDX_GLOBALS]`设置到主闭包第一个upvalue（`_ENV`）
  <B><DRD>注意：此时依旧没有设置具体的值，在执行期才会设置</DRD></B>

使用方式：
`luaX_setinput()`会记录`_ENV`到`LexState->envn`中
解析时会进入`singlevar()`，如果逐层寻找local/upvalue没找到，就会作为全局名使用，调用`luaK_indexed()`设置指令

### 沙箱机制

``` c
local _ENV = sandbox
function f()
  return print
end
```

由于`_ENV`被遮蔽，`f()`不再获得原始表，而是`sandbox.print`

---
---
---

# 数据结构

在lua中，数据结构具有一定的封装，最常见在源码中见到的就是TValue

## 数据结构基础

<B><GN>TValue</GN></B>即值，是lua最关键的一层封装：

``` c
typedef struct lua_TValue {
  TValuefields;
} TValue;

#define TValuefields	Value value_; int tt_

typedef union Value {
  GCObject *gc;    /* collectable objects */
  void *p;         /* light userdata */
  int b;           /* booleans */
  lua_CFunction f; /* light C functions */
  lua_Integer i;   /* integer numbers */
  lua_Number n;    /* float numbers */
} Value;
```

可以看到TValue由2字段组成：

- `Value value_`：值本身
- `int tt_`：type

<B><BL>问题：为什么要封装成TValue</BL></B>
<BL>因为lua是动态类型语言，变量类型随时可变，只靠Value是无法知道当前存储类型的，所以需要额外数据`tt_`</BL>

### 类型

在lua.h中有所定义：

``` c
#define LUA_TNONE		(-1)

#define LUA_TNIL		0
#define LUA_TBOOLEAN		1
#define LUA_TLIGHTUSERDATA	2
#define LUA_TNUMBER		3
#define LUA_TSTRING		4
#define LUA_TTABLE		5
#define LUA_TFUNCTION		6
#define LUA_TUSERDATA		7
#define LUA_TTHREAD		8

#define LUA_NUMTAGS		9
```

注意：LUA_XXX并非完整`tt_`，在lobject.h有注释：

``` c
/*
** tags for Tagged Values have the following use of bits:
** bits 0-3: actual tag (a LUA_T* value)
** bits 4-5: variant bits
** bit 6: whether value is collectable
*/
```

在lobject.h可以看到：

``` c
/* Variant tags for functions */
#define LUA_TLCL	(LUA_TFUNCTION | (0 << 4))  /* Lua closure */
#define LUA_TLCF	(LUA_TFUNCTION | (1 << 4))  /* light C function */
#define LUA_TCCL	(LUA_TFUNCTION | (2 << 4))  /* C closure */
/* Variant tags for strings */
#define LUA_TSHRSTR	(LUA_TSTRING | (0 << 4))  /* short strings */
#define LUA_TLNGSTR	(LUA_TSTRING | (1 << 4))  /* long strings */
/* Variant tags for numbers */
#define LUA_TNUMFLT	(LUA_TNUMBER | (0 << 4))  /* float numbers */
#define LUA_TNUMINT	(LUA_TNUMBER | (1 << 4))  /* integer numbers */
/* Bit mark for collectable types */
#define BIT_ISCOLLECTABLE	(1 << 6)
```

即对于某些类型，会派生出细分类型
对于这些派生类型，创建时就会直接用上，如：
`ts = createstrobj(L, l, LUA_TSHRSTR, h);`
对于可GC类型，需要通过`ctb()`宏额外补充：
`#define ctb(t) ((t) | BIT_ISCOLLECTABLE)`
对于TValue设置类操作（如：`setsvalue()`）就会进行设置

具体操作如下：

- 获取：

``` c
#define rttype(o)	((o)->tt_) // 完整tt_(0-6位)
#define ttype(o)	(rttype(o) & 0x3F) // 基础类型+派生类型(0-5位)
#define ttnov(o)	(novariant(rttype(o))) // 基础类型(0-3位)

#define novariant(x)	((x) & 0x0F)
```

### GC

对于需要回收的类型，会使用<B><GN>GCObject</GN></B>：

``` c
typedef struct GCObject GCObject;
struct GCObject {
  CommonHeader;
};

#define CommonHeader GCObject *next; lu_byte tt; lu_byte marked
```

<B><BL>问题：关于`TValue.tt_` / `GCObject.tt`</BL></B>
<BL>对于GCObject来说，自身已经完全说明是带有GC的，所以tt不会存储第6位BIT_ISCOLLECTABLE信息</BL></B>

GCObject是一个<B><VT>公共头</VT></B>，具体有以下对象：

- TString
- Table
- Udata
- Proto
- Closure
- lua_State

<B><BL>问题：GCObject与TValue的关系</BL></B>
<BL>某些TValue（就是GC类型）会指向GCObject</BL>
<YL><B>举例</B>：TString是一个字符串对象，在lua中字符串是可复用的，某一个TString可能被多个TValue所引用</YL>

---

## 字符串

字符串是lua中核心的数据类型
对应结构<B><GN>TString</GN></B>：

``` c
typedef struct TString {
  CommonHeader;
  lu_byte extra;  /* reserved words for short strings; "has hash" for longs */
  lu_byte shrlen;  /* length for short strings */
  unsigned int hash;
  union {
    size_t lnglen;  /* length for long strings */
    struct TString *hnext;  /* linked list for hash table */
  } u;
} TString;
```

根据注释可知：TString包含短字符串与长字符串两种，两种实际结构不同

- 共有
  - hash：字符串哈希
- 短字符串
  - extra：保留字
  - shrlen：长度
  - u.hnext：桶链表指针
- 长字符串
  - extra："是否已算过hash"的标记
  - u.lnglen：长度

<B>重点：</B>
<B><VT>TString本身不带有字节数据（也就是说TString是字符串头），字节数据紧跟在<GN>UTString</GN>后</B>

``` c
typedef union UTString {
  L_Umaxalign dummy;  /* ensures maximum alignment for strings */
  TString tsv;
} UTString;
```

``` txt
地址 ts
┌──────────────────────────────┐
│ UTString (含 TString 头部)    │  sizeof(UTString)
└──────────────────────────────┘
┌──────────────────────────────┐
│ 字节数据 char[0..len-1]       │  len 字节（可包含 '\0'）
├──────────────────────────────┤
│ 结尾 '\0'                     │  额外 1 字节
└──────────────────────────────┘
```

所以可以看到取字符串宏`getstr()`是这么用的：
`#define getstr(ts)  \`
`check_exp(sizeof((ts)->extra), cast(char *, (ts)) + sizeof(UTString))`

---

## 创建

`luaS_newlstr()`

``` csharp
TString *luaS_newlstr (lua_State *L, const char *str, size_t l) {
  if (l <= LUAI_MAXSHORTLEN)  /* short string? */
    return internshrstr(L, str, l);
  else {
    TString *ts;
    if (l >= (MAX_SIZE - sizeof(TString))/sizeof(char))
      luaM_toobig(L);
    ts = luaS_createlngstrobj(L, l);
    memcpy(getstr(ts), str, l * sizeof(char));
    return ts;
  }
}
```

这里也能看到字符串的长短分类，其中：
<B><VT>宏`LUAI_MAXSHORTLEN`区分了长短字符串的长度，界限为40</VT></B>

### 短字符串

短字符串走的是`internshrstr()`：

``` c
static TString *internshrstr (lua_State *L, const char *str, size_t l) {
  TString *ts;
  global_State *g = G(L);
  unsigned int h = luaS_hash(str, l, g->seed);
  TString **list = &g->strt.hash[lmod(h, g->strt.size)];
  lua_assert(str != NULL);  /* otherwise 'memcmp'/'memcpy' are undefined */
  for (ts = *list; ts != NULL; ts = ts->u.hnext) {
    if (l == ts->shrlen &&
        (memcmp(str, getstr(ts), l * sizeof(char)) == 0)) {
      /* found! */
      if (isdead(g, ts))  /* dead (but not collected yet)? */
        changewhite(ts);  /* resurrect it */
      return ts;
    }
  }
  if (g->strt.nuse >= g->strt.size && g->strt.size <= MAX_INT/2) {
    luaS_resize(L, g->strt.size * 2);
    list = &g->strt.hash[lmod(h, g->strt.size)];  /* recompute with new size */
  }
  ts = createstrobj(L, l, LUA_TSHRSTR, h);
  memcpy(getstr(ts), str, l * sizeof(char));
  ts->shrlen = cast_byte(l);
  ts->u.hnext = *list;
  *list = ts;
  g->strt.nuse++;
  return ts;
}
```

- 核心1：复用（哈希桶）
  - 使用`luaS_hash()`计算哈希值
    - `g->seed`会在`lua_newstate()`进行初始化，这也意味着`g->seed`仅存在一个值且不会变化
  - 获取桶：`TString **list = &g->strt.hash[lmod(h, g->strt.size)];`
    - `&g->strt`：stringtable类型，是<B><VT>全局的驻留短字符串</VT></B>
  - 尝试在桶中找到TString
- 核心2：扩容
  - 如果负载过高（`g->strt`用超了或但还没到达上限（MAX_INT/2））则会调用`luaS_resize()`扩表
- 核心3：设置
  - 如果前面找不到复用就会创一个新的

    ``` c
    ts = createstrobj(L, l, LUA_TSHRSTR, h); // 创建短字符串
    memcpy(getstr(ts), str, l * sizeof(char)); // 拷贝值
    ts->shrlen = cast_byte(l); // 设置长度
    // 头插法
    ts->u.hnext = *list;
    *list = ts;
    ```

在哈希计算中提到了驻留intern，这与`internshrstr()`对应（所以intern指的其实是驻留而非内部）
<B><GN>stringtable</GN></B>可以说是专用于短字符串驻留的数据结构，具体结构如下：

``` c
typedef struct stringtable {
  TString **hash;
  int nuse;  /* number of elements */
  int size;
} stringtable;
```

<B><BL>问题：nuse和size的区别</BL></B>
<BL>其实很明确，nuse即已存在数量，size为桶大小</BL>
可以看到`hash`是TString**类型，即数组，这与哈希计算可以对应上，即<B><GN>拉链法</GN></B>哈希冲突方案

---
---
---

# 函数执行

函数执行是核心部分之一，可以分为2部分：

- 函数执行
- 安全执行

---

## 函数执行

函数执行指的是函数执行流程本体
本质上入口只有2个函数：

- `luaD_call()`
- `luaD_callnoyield()`：noyield版本

<B><VT>函数的执行与lua栈紧密相关</VT></B>

``` c
void luaD_call (lua_State *L, StkId func, int nResults) {
  if (++L->nCcalls >= LUAI_MAXCCALLS)
    stackerror(L);
  if (!luaD_precall(L, func, nResults))  /* is a Lua function? */
    luaV_execute(L);  /* call it */
  L->nCcalls--;
}
```

流程为：

1. `luaD_precall()`：执行前准备
2. `luaV_execute()` / `(*f)(L)`：执行
3. `luaD_poscall()`：执行后处理

对于LClosure来说，走的是`luaV_execute()`
而对于CClosure来说，走的是直接调用，因为c函数根本不需要使用虚拟机完成
但流程上来说还是差不多的

<B>准备</B>
准备即`luaD_precall()`，LClosure与CClosure的区分就是从这里开始的
具体来说其实有3种：

- C函数
  - 进入新CallInfo（`next_ci()`）并设置
  - 直接调用
  - `luaD_poscall()`
- Lua函数
  - 计算传参数量
    - `adjust_varargs()`：具有可变参数情况的调整
    - 对于非可变参数情况，缺少参数就补nil
  - 获取函数需要的栈帧大小
    - 更新top（`L->top` / `ci->top`）
  - 进入新CallInfo（`next_ci()`）并设置
    - 关键参数savedpc：`p->code`
- 不可调用对象
  - 走`__call`元方法

ci即CallInfo在这里极其关键，核心就是设置ci
<B>CallInfo的理解：</B>
CallInfo是某函数的执行，在函数中的指令可能存在CALL命令，则会再次调用`luaD_call()`，此时就会通过`next_ci()`进行推进，链表形态的`L->ci`则会进行链接
`#define next_ci(L) (L->ci = (L->ci->next ? L->ci->next : luaE_extendCI(L)))`
<B><BL>问题：一般来说next不存在则创建新ci，何时会发生获取next情况</BL></B>
<BL>只要以前到达过更深的调用就会复用（除非被shrink回收），因为CallInfo结构与深度确认即可，函数相关数据都是拿到后重新赋值（初始化）的</BL>

<B>结束处理</B>
最核心当然是返回上一CallInfo：
`L->ci = ci->previous;  /* back to caller */`
除此以外，进行了`moveresults()`操作：根据参数移动结果并决定新栈顶位置

- `const TValue *firstResult`：原第一个返回值位置
- `StkId res`："搬家"后第一个返回值位置
- `int nres`：返回值个数
- `int wanted`：想要的结果数量

理解起来很简单：
<B><VT>根据`wanted`决定操作，需要将`firstResult`元素依次搬到`res`</VT></B>

![](Pic/lua1.png)

---

## 安全执行（异常处理）

在 C++ / C# 中，有trycatch机制，可以保证程序的安全执行
但 c 中<B>没有trycatch机制</B>，但可以通过<B><GN>跳转机制</GN><VT>模拟异常</VT></B>

``` c
#include <setjmp.h>

jmp_buf buf;

void func() {
    longjmp(buf, 1); // 跳回
}

int main() {
    if (setjmp(buf) == 0) {
        func();
    } else {
        printf("Caught something\n");
    }
}
```

以上就是一个安全执行实例：
`setjmp()`：记录当前位置（保存当前执行状态并返回0，跳转回来返回1）
`longjmp()`：跳回位置
也就是说：第一次`setjmp()`时会返回0，会进入if语句块，而通过`longjmp()`跳转回来时，会再次执行`setjmp()`，但此时会返回1，从而执行else语句块

安全执行的<B>核心</B>为以下函数：

- `luaD_rawrunprotected()`：负责利用jump机制创建安全执行环境
- `luaD_throw()`：遇错时利用jump机制跳转回`luaD_rawrunprotected()`

具体来说是以下函数：

- `lua_pcall()`
  - 本质`luaD_pcall()`的封装
- 除此以外，只要需要保护，就会通过`luaD_rawrunprotected()`启动函数（如：`lua_newstate()`中`f_luaopen()`就进行了保护）

<BR>

由于存在<B>多平台</B>情况，用宏进行控制：

``` c
#if !defined(LUAI_THROW)				/* { */

#if defined(__cplusplus) && !defined(LUA_USE_LONGJMP)	/* { */

/* C++ exceptions */
#define LUAI_THROW(L,c)		throw(c)
#define LUAI_TRY(L,c,a) \
	try { a } catch(...) { if ((c)->status == 0) (c)->status = -1; }
#define luai_jmpbuf		int  /* dummy variable */

#elif defined(LUA_USE_POSIX)				/* }{ */

/* in POSIX, try _longjmp/_setjmp (more efficient) */
#define LUAI_THROW(L,c)		_longjmp((c)->b, 1)
#define LUAI_TRY(L,c,a)		if (_setjmp((c)->b) == 0) { a }
#define luai_jmpbuf		jmp_buf

#else							/* }{ */

/* ISO C handling with long jumps */
#define LUAI_THROW(L,c)		longjmp((c)->b, 1)
#define LUAI_TRY(L,c,a)		if (setjmp((c)->b) == 0) { a }
#define luai_jmpbuf		jmp_buf

#endif							/* } */

#endif							/* } */
```

所以：

- C++：还是用trycatch机制
- POSIX（Linux/macOS）：用更高效的`_longjmp` / `_setjmp`
- C：`longjmp` / `setjmp`

<B>重点：</B>
<B><VT>由于C++/POSIX是C的超集，所以虽然源码是C编写的，但是可以直接编译成C++/POSIX
但C#并不是所以不行，只能通过调用 C库 / 重写 / 绑定层 方式进行</VT></B>

`luaD_rawrunprotected()`

``` c
int luaD_rawrunprotected (lua_State *L, Pfunc f, void *ud) {
  unsigned short oldnCcalls = L->nCcalls;
  struct lua_longjmp lj;
  lj.status = LUA_OK;
  lj.previous = L->errorJmp;  /* chain new error handler */
  L->errorJmp = &lj;
  LUAI_TRY(L, &lj,
    (*f)(L, ud);
  );
  L->errorJmp = lj.previous;  /* restore old error handler */
  L->nCcalls = oldnCcalls;
  return lj.status;
}
```

以C为例，宏`LUAI_TRY`可转换为：

``` c
if (_setjmp((&lj)->b) == 0) 
{
  (*f)(L, ud);
}
```

`luaD_throw()`

``` c
l_noret luaD_throw (lua_State *L, int errcode) {
  if (L->errorJmp) {  /* thread has an error handler? */
    L->errorJmp->status = errcode;  /* set status */
    LUAI_THROW(L, L->errorJmp);  /* jump to it */
  }
  else {  /* thread has no error handler */
    global_State *g = G(L);
    L->status = cast_byte(errcode);  /* mark it as dead */
    if (g->mainthread->errorJmp) {  /* main thread has a handler? */
      setobjs2s(L, g->mainthread->top++, L->top - 1);  /* copy error obj. */
      luaD_throw(g->mainthread, errcode);  /* re-throw in main thread */
    }
    else {  /* no handler at all; abort */
      if (g->panic) {  /* panic function? */
        seterrorobj(L, errcode, L->top);  /* assume EXTRA_STACK */
        if (L->ci->top < L->top)
          L->ci->top = L->top;  /* pushing msg. can break this invariant */
        lua_unlock(L);
        g->panic(L);  /* call panic function (last chance to jump out) */
      }
      abort();
    }
  }
}
```

所以说：

- 只要是通过`luaD_rawrunprotected()`调用函数，函数内`luaD_throw()`触发，都可以走`LUAI_THROW()`异常处理（因为存在errorJmp）
- 如果没有，走兜底机制：
  - 主线程errorJmp尝试处理
  - panic最终尝试
  - 失败，abort退出

---
---
---

# 编译与虚拟机执行流程

## 启动

在lua中，启动方式有很多，简单来说：

- 命令行启动
  `lua script.lua`
- 嵌入

  ``` c
  lua_State *L = luaL_newstate();
  luaL_openlibs(L);
  luaL_dofile(L, "script.lua");
  lua_close(L);
  ```

### 命令行启动

命令行启动的本质其实就是执行可执行文件，
那么必然存在一个<B>main函数</B>，即lua.c的main()：

``` csharp
int main (int argc, char **argv) {
  int status, result;
  lua_State *L = luaL_newstate();  /* create state */
  if (L == NULL) {
    l_message(argv[0], "cannot create state: not enough memory");
    return EXIT_FAILURE;
  }
  lua_pushcfunction(L, &pmain);  /* to call 'pmain' in protected mode */
  lua_pushinteger(L, argc);  /* 1st argument */
  lua_pushlightuserdata(L, argv); /* 2nd argument */
  status = lua_pcall(L, 2, 1, 0);  /* do the call */
  result = lua_toboolean(L, -1);  /* get result */
  report(L, status);
  lua_close(L);
  return (result && status == LUA_OK) ? EXIT_SUCCESS : EXIT_FAILURE;
}
```

对比嵌入情况，操作流程是极其相似的，都是以`luaL_newstate()`起，`lua_close()`结束，`luaL_openlibs()`同样在pmain函数中进行，只是多封装了一些启动选项（`-E`/`-v`之类的）
执行流程：`luaL_loadfile()` + `docall()`

### 嵌入

嵌入即<B><VT>其它语言作为宿主，驱动lua虚拟机执行lua代码</VT></B>
如上述例子所示，为基础核心流程：
- `luaL_newstate()`：启动（来自lauxlib.c，aux：辅助）
- `luaL_openlibs(L)`：加载全局库（来自linit.c）
- `luaL_dofile(L, "xxx.lua")`：执行（核心）（来自lauxlib.h）
- `lua_close(L)`：退出（来自lstate.c）

这里绝大部分都是lua提供的嵌入层的封装函数，用于实现嵌入功能
<B>前缀`luaL`</B>：<VT>辅助函数</VT>

---

## 编译期

无论是从：

- lua层
  - `dofile()`
  - `loadfile()`
  - `load()`
  - `require()`
- c辅助层
  - `luaL_dofile()`
  - `luaL_dostring()`
  - `luaL_loadfile()`
  - `luaL_loadfilex()`
  - `luaL_loadstring()`
  - `luaL_loadbuffer()`
  - `luaL_loadbufferx()`

最终都会汇入<B>c层的`lua_load()`</B>中
即：<B><VT>`lua_load()`是编译的统一入口</VT></B>

``` c
LUA_API int lua_load (lua_State *L, lua_Reader reader, void *data,
                      const char *chunkname, const char *mode) {
  ZIO z;
  int status;
  lua_lock(L);
  if (!chunkname) chunkname = "?";
  luaZ_init(L, &z, reader, data);
  status = luaD_protectedparser(L, &z, chunkname, mode);
  if (status == LUA_OK) {  /* no errors? */
    LClosure *f = clLvalue(L->top - 1);  /* get newly created function */
    if (f->nupvalues >= 1) {  /* does it have an upvalue? */
      /* get global table from registry */
      Table *reg = hvalue(&G(L)->l_registry);
      const TValue *gt = luaH_getint(reg, LUA_RIDX_GLOBALS);
      /* set global table as 1st upvalue of 'f' (may be LUA_ENV) */
      setobj(L, f->upvals[0]->v, gt);
      luaC_upvalbarrier(L, f->upvals[0]);
    }
  }
  lua_unlock(L);
  return status;
}
```

核心路径：

``` txt
lua_load
  -> luaZ_init // 初始化
  -> luaD_protectedparser
     -> f_parser
        -> luaY_parser    // 文本源码
        -> luaU_undump    // 预编译二进制 chunk
```

- reader：读取器（函数指针）
  - `getF()`：文件读取
  - `getS()`：内存读取
  - `generic_reader()` / `reader()`（luac.c）/ 自定义
- data：数据，<VT>与reader对应</VT>
  - LoadF（getF）
  - LoadS（getS）
  - NULL（generic_reader不需要）
  - int*（reader）
- chunkname：来源名（没有就是`?`）
- mode：
  - `t`：文本
  - `b`：二进制
  - `bt`：文本 + 二进制

<BR>

<B>简单理解的话：</B>
<B><VT>lua_load()就是在不断地读取，通过`f_parser()`</VT></B>

``` c
static void f_parser (lua_State *L, void *ud) {
  LClosure *cl;
  struct SParser *p = cast(struct SParser *, ud);
  int c = zgetc(p->z);  /* read first character */
  if (c == LUA_SIGNATURE[0]) {
    checkmode(L, p->mode, "binary");
    cl = luaU_undump(L, p->z, p->name);
  }
  else {
    checkmode(L, p->mode, "text");
    cl = luaY_parser(L, p->z, &p->buff, &p->dyd, p->name, c);
  }
  lua_assert(cl->nupvalues == cl->p->sizeupvalues);
  luaF_initupvals(L, cl);
}
```

<B><BL>问题：`LUA_SIGNATURE[0]`是什么</BL></B>
<BL>宏定义如下所示：
`#define LUA_SIGNATURE	"\x1bLua"`
`LUA_SIGNATURE[0]`即读取了第一个字符ESC
这是由于<B><VT>对于luac文件（二进制文件），有固定的头，其中首字符必定是ESC</VT></B></BL>

`f_parser()`的两种情况很好理解：

- `luaU_undump()`：二进制反序列化
- `luaY_parser()`：文本编译

<B><BL>问题：序列化 / 编译</BL></B>
<BL>`luaU_undump()`对应的逆操作为`luaU_dump()`，在执行luac.c完成后，就会通过`luaU_dump()`生成luac文件
重点：lua源码走`luaY_parser()`生成Proto进行`luaU_dump`，luac预编译代码走`luaU_undump()`还原出Proto后再`luaU_dump()`</BL>

### 二进制反序列化

在这里需要说明：
<B><VT>二进制文件其实早已经过编译，在`luaU_dump()`时已经完成序列化并进行了编译</VT></B>

在luac.c中，main流程其实是先进行`luaL_loadfile()`，`combine()`获取Proto后，调用`luaU_dump()`利用Proto进行序列化
简单理解的话：
<B><VT>luac文件已经存储了Proto信息，大概率还是通过`luaY_parser()`完成的（也许存在lua+luac组合序列化情况）</VT></B>

所以：`luaY_parser()`才是编译的关键

### 文本编译

文本编译使用的就是`luaY_parser()`

``` c
LClosure *luaY_parser (lua_State *L, ZIO *z, Mbuffer *buff,
                       Dyndata *dyd, const char *name, int firstchar) {
  LexState lexstate;
  FuncState funcstate;
  LClosure *cl = luaF_newLclosure(L, 1);  /* create main closure */
  setclLvalue(L, L->top, cl);  /* anchor it (to avoid being collected) */
  luaD_inctop(L);
  lexstate.h = luaH_new(L);  /* create table for scanner */
  sethvalue(L, L->top, lexstate.h);  /* anchor it */
  luaD_inctop(L);
  funcstate.f = cl->p = luaF_newproto(L);
  luaC_objbarrier(L, cl, cl->p);
  funcstate.f->source = luaS_new(L, name);  /* create and anchor TString */
  lua_assert(iswhite(funcstate.f));  /* do not need barrier here */
  lexstate.buff = buff;
  lexstate.dyd = dyd;
  dyd->actvar.n = dyd->gt.n = dyd->label.n = 0;
  luaX_setinput(L, &lexstate, z, funcstate.f->source, firstchar);
  mainfunc(&lexstate, &funcstate);
  lua_assert(!funcstate.prev && funcstate.nups == 1 && !lexstate.fs);
  /* all scopes should be correctly finished */
  lua_assert(dyd->actvar.n == 0 && dyd->gt.n == 0 && dyd->label.n == 0);
  L->top--;  /* remove scanner's table */
  return cl;  /* closure is on the stack, too */
}
```

核心就几个：

- 闭包压栈
- 创建`lexstate.h`空表，压栈
- 创建Proto，设置到`cl->p`/`funcstate.f`
- 读取：`luaX_setinput()`进行初始化输入状态，后续使用`mainfunc()`继续读取
  <B><DRD>注意：`luaX_setinput()`并非只是预读所需的提前处理，而是初始化</DRD></B>

<B><BL>问题：为什么要先读一个字符</BL></B>
<BL>在`f_parser()`判断 binary / text 时，需要预读一个字符（ESC）进行判断</BL>

所以说：
<B><VT>每次`luaY_parser()`解析都会生成一个LClosure，本质上是一个Proto附带其UpVal</VT></B>

#### mainfunc

文本编译的核心说到底还是在<B>`mainfunc()`</B>之中：

``` c
static void mainfunc (LexState *ls, FuncState *fs) {
  BlockCnt bl;
  expdesc v;
  open_func(ls, fs, &bl);
  fs->f->is_vararg = 1;  /* main function is always declared vararg */
  init_exp(&v, VLOCAL, 0);  /* create and... */
  newupvalue(fs, ls->envn, &v);  /* ...set environment upvalue */
  luaC_objbarrier(ls->L, fs->f, ls->envn);
  luaX_next(ls);  /* read first token */
  statlist(ls);  /* parse main body */
  check(ls, TK_EOS);
  close_func(ls);
}
```

可以观察该函数注释：

> compiles the main function, which is a regular vararg function with an upvalue named LUA_ENV

关键点：

- `fs->f->is_vararg = 1;`
  将is_vararg设置为1，说明对于主函数来说，一定可以接收vararg，即`...`可变参数
- `newupvalue(fs, ls->envn, &v);`
  给主函数Proto添加upvalue，即`_ENV`（未设置）

更关键的是`luaX_next()` + `statlist()`，即<B>解析流程</B>：
<B><VT>编译的本质：根据EBNF词法不断向下执行</VT></B>

``` c
static void statlist (LexState *ls) {
  /* statlist -> { stat [';'] } */
  while (!block_follow(ls, 1)) {
    if (ls->t.token == TK_RETURN) {
      statement(ls);
      return;  /* 'return' must be last statement */
    }
    statement(ls);
  }
}
```

从函数名可知：`statlist()`是一个语句（stat）列表，可能会读取多个语句
简单理解就是：
- 遇到结束符，就终止当前`statlist()`
- 遇到`return`，就调用`statement()`处理完return内容返回
  - 本质上和终止符不同，因为return并不意味着后面没有代码，而是单纯的遇到了return必须返回，语义上略有不同
- 否则持续进行`statement()`解析

<B><VT>重要：`statlist()`存在嵌套</VT></B>
文件本身就是一次`statlist()`，当遇到如`if`之类的token，则会递归`statlist()`

流程本质：<B>读取token->消费token（解析）->生成指令 的循环</B>
<B><TT>读取与消耗</TT></B>
<B>`llex()`：<VT>状态机，返回token（int值）</VT></B>
`luaX_next()`同时承担了读取与消耗token的职责

``` c
void luaX_next (LexState *ls) {
  ls->lastline = ls->linenumber;
  if (ls->lookahead.token != TK_EOS) {  /* is there a look-ahead token? */
    ls->t = ls->lookahead;  /* use this one */
    ls->lookahead.token = TK_EOS;  /* and discharge it */
  }
  else
    ls->t.token = llex(ls, &ls->t.seminfo);  /* read next token */
}
```

即：

- 有预读token，消耗并设置为当前token
- 没有预读token，调用`llex()`读取下一个token

<B><BL>问题：预读token是什么，为什么和`TK_EOS`有关</BL></B>
<BL>预读token会调用`luaX_lookahead()`预读，
比如：token为变量a，此时后面可以接非常多可能性，比如`=`/`.`，此时就需要预读
TK_EOS这里不代表终止符，而是意味着无，`ls->lookahead.token = TK_EOS;`一句也可以证明TK_EOS是用来当作无使用的
初始化位置：`luaX_setinput()`</BL>

<B><TT>生成指令</TT></B>
生成指令发生在某些token流程中，本质上是在填充`Proto->code`
指令即<B><GN>Instruction</GN></B>，本质上其实就是个32位值

``` c
#if LUAI_BITSINT >= 32
typedef unsigned int Instruction;
#else
typedef unsigned long Instruction;
#endif
```

<B>指令格式</B>如下： <VT>从高到低</VT>

- iABC：B:9 | C:9 | A:8 | OpCode:6
- iABx：Bx:18 | A:8 | OpCode:6
- iAsBx：sBx:18 | A:8 | OpCode:6

在lopcodes.h中也能找到注解
本质上其实就是<B><VT>不同指令情况的不同分配</VT></B>
有些指令只有2个操作数，就可以多分配一点，3个操作数就需要匀一下

<B><VT>重点：本质上所有生成指令函数都会收束到以下宏：</VT></B>

- `CREATE_ABC(o,a,b,c)`
- `CREATE_ABx(o,a,bc)`
- `CREATE_Ax(o,a)`

<YL><B>举例</B>：`CREATE_ABC(OP_MOVE, 2, 0, 0)` 将R0复制到R2</YL>

<B>`RA(i)`宏</B>
在虚拟机执行中，通常会调用`RA(i)`之类的宏获取R(A)真实地址：
`#define RA(i)	(base+GETARG_A(i))`
`#define GETARG_A(i)	getarg(i, POS_A, SIZE_A)`
`#define getarg(i,pos,size)	(cast(int, ((i)>>pos) & MASK1(size,0)))`
即 <B><VT>基地址+指令i中A的逻辑索引</VT></B>

#### 总览

- `luaY_parser()`：解析主函数，返回LClosure闭包
  - 初始化：
    - 创建闭包与对应Proto
    - 接收信息，组合LexState/FuncState
    - `luaX_setinput()`：额外处理lexstate中解析相关数据
  - `mainfunc()`：解析流程
    - 主函数创建环境upvalue（`_ENV`）
    - `luaX_next()`：读取首token
    - `statlist()`：正式解析
      - `statement()`：会消费token进行相应操作
        - 某些情况会`statlist()`递归（如TK_IF）
        - 途中需要`luaX_next()`/`luaX_lookahead()`读取token
          - `luaX_next()`：核心为`llex()`状态机
        - 会通过`luaK_XXX()`生成指令
      - 最终遇到终止符退出

## 执行期

针对官方用法（lua.c），有：

``` csharp
static int handle_script (lua_State *L, char **argv) {
  int status;
  const char *fname = argv[0];
  if (strcmp(fname, "-") == 0 && strcmp(argv[-1], "--") != 0)
    fname = NULL;  /* stdin */
  status = luaL_loadfile(L, fname);
  if (status == LUA_OK) {
    int n = pushargs(L);  /* push arguments to script */
    status = docall(L, n, LUA_MULTRET);
  }
  return report(L, status);
}
```

`luaL_loadfile()`完成后会生成LClosure并压栈
`docall()`则会调用该函数
<B><BL>问题：LClosure为什么是函数</BL></B>
<BL><B><VT>LClosure与CClosure都是函数</VT></B>，这是由判断决定的：
`#define ttisfunction(o)		checktype(o, LUA_TFUNCTION)`
也就是说只要符合就是，那么LUA_TLCL，即LUA_TFUNCTION</BL>

更本质来说：执行调用的是`luaD_call()`
在[函数执行](#函数执行-1)中，已讲解`luaD_call()`的执行流程

### 虚拟机执行

虚拟机执行即`luaV_execute()`，是执行流程的核心
该函数是一个极长的<B><VT>状态机</VT></B>，内部包含了所有的OpCode枚举的执行
<B>主结构</B>如下：

``` c
void luaV_execute (lua_State *L) {
  CallInfo *ci = L->ci;
  LClosure *cl;
  TValue *k;
  StkId base;
  ci->callstatus |= CIST_FRESH;  /* fresh invocation of 'luaV_execute" */
 newframe:  /* reentry point when frame changes (call/return) */
  lua_assert(ci == L->ci);
  cl = clLvalue(ci->func);  /* local reference to function's closure */
  k = cl->p->k;  /* local reference to function's constant table */
  base = ci->u.l.base;  /* local copy of function's base */
  /* main loop of interpreter */
  for (;;) {
    Instruction i;
    StkId ra;
    vmfetch();
    vmdispatch (GET_OPCODE(i)) {
      vmcase(OP_MOVE) {
        setobjs2s(L, ra, RB(i));
        vmbreak;
      }
      vmcase(...) {
        ...
      }
      ...
    }
  }
}
```

可以看到核心就是newframe循环，同时内部具有for循环：

- newframe循环：每次goto都是新栈帧，即进入下（上）一个函数
  - OP_CALL / OP_TAILCALL / OP_RETURN
- for循环：函数内部执行循环

`vmfetch()`是循环第一步：

``` c
#define vmfetch()	{ \
  i = *(ci->u.l.savedpc++); \
  if (L->hookmask & (LUA_MASKLINE | LUA_MASKCOUNT)) \
    Protect(luaG_traceexec(L)); \
  ra = RA(i); /* WARNING: any stack reallocation invalidates 'ra' */ \
  lua_assert(base == ci->u.l.base); \
  lua_assert(base <= L->top && L->top < L->stack + L->stacksize); \
}
```

即：

- 获取i（savedpc），并移到下一个指令
- 获取ra

<B><BL>问题：为什么这里只算了ra没算其它的</BL></B>
<BL>ra是目标寄存器，是几乎必定存在的，而其它的不一定存在</BL>

`vmdispatch()`：宏，其实就是switch
`vmcase(l)`：宏，其实就是case
`vmbreak`：宏，其实就是break

过程变化：

- `cl->u.l.savedpc`：<B><GN>Saved Program Counter，保存的程序计数器</GN></B>
  - `vmfetch()`会直接`savedpc++`指向下一个指令（此时进行当前指令）
  - OP_JMP / OP_TEST 之类的跳转操作会直接修改savedpc，其实就是跳过语句
- `cl->u.l.base`：基址缓存
  - `goto newframe`会导致进入下一函数导致重置
  - `Protect()`会强制重新同步
- `L->top`：虚拟机栈顶
  - 大多指令仅临时性修改，不改回去
  - 收尾指令会`L->top = ci->top`恢复（如OP_CALL）

<B><BL>问题：`L->top`与`ci->top`的关系</BL></B>
<BL>两者指的都是`L->stack`的栈顶，但是具体含义不同：</BL>

- <BL>`L->top`：线程当前栈顶</BL>
- <BL>`ci->top`：当前栈帧允许的栈顶</BL>

<BL>规则：`L->top <= ci->top`
简单理解：<B><VT>`ci->top`是边界，`L->top`会自行根据边界进行调整</VT></B></BL>

<B><VT>相比`L->top`/`ci->top`，更应该关注的是`L->stack`即真正的上限，在`luaD_precall()`中可能会执行`luaD_growstack()`扩容</VT></B>

当虚拟机执行完毕，<B>最后一次</B>必然会遇到OP_RETURN执行返回
其中会进行`luaD_poscall()`进行善后处理

## 示例

<B>例1：简单局部变量</B>
`local a = "hello world"`
<B>编译期：</B>
核心产物：LClosure（内部核心Proto）
![](Pic/luaskill1.png)

- 常量表k：存储"hello world"
- locvars/lineinfo：调试信息（执行期无意义）
- 槽位：2个槽位，即`Proto->maxstacksize = 2`
- 指令：
  - `LOADK 0 -1`，即：将第一个常量（`K[0]`）加载到寄存器0
  - `RETURN 0 1`，即：结束，不返回值

<B>执行期：</B>
核心产物：CallInfo

- 执行OP_LOADK：
  - 找到ra：R(0)
  - 取常量kb：K(0)
  - 将kb写入ra：`setobj2s()`

此时R(0)存放"hello world"，R(1)无用（但槽位存在）

- 执行OP_RETURN：
  - 直接结束chunk（因为只有一个CallInfo）

<B><BL>问题："hello world"没有名字吗，后续怎么访问</BL></B>
<BL>在执行期，变量没有名字，寄存器编号可以认为是它的名字
关键：在回收前，局部变量位置永不变</BL>

<B>例2：综合例子</B>

``` lua
local x = 10
local y = 20

function add(a, b)
    local sum = a + b
    return sum
end

local z = add(x, y)
print(z)
```

![](Pic/lua2.png)

关注于指令流程：

- 指令1/2，LOADK：定义x和y，存放在R(0)/R(1)
- 指令3，CLOSURE：创建add函数
- 指令4，SETTABUP：设置全局变量add，设到`_ENV`
- 指令5/6/7/8：调用add函数
  - GETTABUP：获取add函数（在`_ENV`中）
  - MOVE：传入x和y
  - CALL：调用
    - 子指令1，ADD：传入参数相加
    - 子指令2，RETURN：返回结果
    - 子指令3，RETURN：默认return出口（兜底），这里不触发
- 指令9/10/11：调用print函数
  - GETTABUP：获取print函数（也在`_ENV`中）
  - MOVE：传入z
  - CALL：调用
- 指令12，RETURN：返回，没有返回值

关注于栈变化：

- 编译期处理：
  - 5slots，最多只存在5个寄存器
  - 已决定所有操作需要的寄存器
- 执行期处理：
  - 局部变量加载：R(0)=10 R(1)=20
  - 函数创建：R(2)=add
  - 复制参数：R(3)=10 R(4)=20
  - 调用add：调用R(2)函数，使用R(3)/R(4)参数，返回到R(2)
    - 内部新栈帧情况：
      - R(0)=10 R(1)=20（复制到新栈帧）
      - 相加：R(2)=30
      - 返回：返回R(2)，即30
    - 完成后R(2)被覆盖为30
    - R(3)/R(4)大概率不会清理，但后续可直接覆盖
  - 调用print：同add，但由于是CClosure，不走虚拟机执行
  - 返回：无返回值



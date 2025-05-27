**<center><BBBG>Markdown测试文档</BBBG></center>**

<!-- TOC -->

- [字体测试](#%E5%AD%97%E4%BD%93%E6%B5%8B%E8%AF%95)
- [代码测试](#%E4%BB%A3%E7%A0%81%E6%B5%8B%E8%AF%95)
- [列表测试](#%E5%88%97%E8%A1%A8%E6%B5%8B%E8%AF%95)
- [超链接测试](#%E8%B6%85%E9%93%BE%E6%8E%A5%E6%B5%8B%E8%AF%95)
- [图片测试](#%E5%9B%BE%E7%89%87%E6%B5%8B%E8%AF%95)

<!-- /TOC -->

<BR>

Code搜索栏中搜索`> customize css`，然后像在`<style>`中添加字体模板
![CSS更改方法](Pic/CSS1.png)

``` css
.markdown-preview.markdown-preview {
  /* 个性化字体 */
  VT, vt {color: rgb(126, 0, 98);}
  GN, gn {color: rgb(74, 117, 0);}
  RD, rd {color: rgb(255, 0, 0);}
  DRD, drd {color: rgb(131, 0, 15);}
  BL, bl {color: rgb(45, 0, 129);}
  YL, yl {color: rgb(180, 121, 0);}
  BG, bg {font-size:1.25em;}
  BBG, bbg {font-size:1.5em;}
  BBBG, bbbg {font-size:2em;}
  T, t {font-size:2.5em;}

  /* 限制代码块最大高度 */
  pre {
    max-height: 515px;
    overflow: auto;

    margin-top: -15px;/* 上间距缩小 */
  }

  /* 控制列表间距 */
  ul, ol {
    margin-top: -10px;  
    margin-bottom: 0px;
  }
  /* 避免影响多级列表(n级到n+1级之间的间距) */
  ul ul, ol ol {
    margin-top: 0px;
    margin-bottom: 0px;
  }
  /* 控制列表项间距 */
  li {
    margin-bottom: 0px; 
  }
  
  /* 更改标题色 */
  h1, h2, h3, h4, h5, h6 {
    color: #0857a5;
  }
  /* 更改标题大小 */
  h1 {
    font-size: 2.0em;
  }
  h2 {
    font-size: 1.5em;
  }
  h3 {
    font-size: 1.25em;
  }
  h4, h5, h6 {
    font-size: 1.15em;
  }
}
```

可以看到名字叫`style.less`，位置就在`C:\Users\Administrator\.crossnote\style.less`

**实用插件：<GN>Markdown Paste (telesoho)</GN>**
**配置：**在设置中修改Path
![MarkdownPaste](Pic/MarkdownPaste.png)
然后使用<B>Ctrl+Alt+V</B>进行粘贴即可

<!-- 标题开头不能是数字字符，否则无法使用TOC -->
<!-- 但是可以通过手动将某个改为如[1.xxx](#1.xxx)的形式，保存后即可使用 -->
# 字体测试

**加粗** | *斜体* | ***斜体加粗***  

HTML语法：  
这是<font color="red">红色</font> | 这是<font color="purple">紫色</font> | 这是<font color="green">绿色</font>  

CSS语法：　　**<VT>我通常会使用该方法</VT>**
这是<VT>注释色</VT> | 这是<RD>警告色</RD> | 这是<DRD>注意色</DRD> | 这是<GN>名词色</GN> | 这是<YL>例子色</YL> | 这是<BL>问题色</BL>

# 代码测试

代码句：`print("Hello")`  

---

1.Lua代码

``` lua
-- 输出"Hello"
function printHello()
    print("Hello")
end
```

2.C#代码

``` CSharp
private void PrintHello()
{
    Console.WriteLine("Hello");
}
```

# 列表测试

- first
  
    ``` lua
    print("OK")
    ```

- second
    > ok
- third

1. first
2. second
3. third

# 超链接测试

这是 **[BILIBILI](https://www.bilibili.com "备注:视频网站")** 网站
这也是<https://www.bilibili.com>

# 图片测试

![图片1](Pic/sylvain-sarrailh-lostremains.jpg){width=200 height=100 align=left}

![数字1](Pic/Num67.png) ![数字2](Pic/Num73.png) ![数字3](Pic/Num100.png)

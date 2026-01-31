**<center><BBBG>Unity测试</BBBG></center>**

# 单元测试

Unity中可进行单元测试，使用的是自动集成的<B><GN>Test Framework</GN></B>(如果没有在Package Manager中安装)
通过**Window->General->Test Runner**即可打开面板
根据指示，可创建一个Tests程序集，在Tests文件夹下可以创建各个测试脚本

``` csharp
using NUnit.Framework;

[TestFixture]
public class XXXTests
{
    [SetUp]
    public void SetUp()
    {
        // 设置
    }

    [TearDown]
    public void TearDown()
    {
        // 清理
    }

    [Test]
    public void XXX_XXX_XXX()
    {
        // 通过Assert断言判断正确性
    }
}
```
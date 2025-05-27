**<center><BBBG>VSCode语言配置方式</BBBG></center>**

# C#

在VSCode中，如果要配置C#的话是略有麻烦的，**具体如下：**
在VSCode的配置前，首先需要去<B>[官网](https://dotnet.microsoft.com/zh-cn/download)</B>下载.NET即可，一般选择**长期支持版**<VT>(目前是8.0)</VT>
在VSCode中，**扩展**肯定是需要添加的，有：

- C# (Microsoft)
- C# Dev Kit (Microsoft)
  <VT>可以Shift+Ctrl+P输入walkthrough选择`Welcome:Open Walkthrough`并选择`C# Dev Kit`即可查看全流程</VT>

**具体构建流程：**

1. 创建一个文件夹，在其中打开VSCode
2. Shift+Ctrl+P输入`.NET:Project`，选择Console App并一路确认即可
3. 然后就能看到创建的文件，打开Program.cs，通过**F5运行**即可

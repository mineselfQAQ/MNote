**<center><BBBG>Log分析</BBBG></center>**

<!-- TOC -->

- [简述](#简述)
- [参考实现](#参考实现)
  - [QFramework](#qframework)
  - [LoxodonFramework](#loxodonframework)
  - [MFramework](#mframework)

<!-- /TOC -->

# 简述

Log是项目中**极其常见**的一项内容，是一种<B><VT>提示方式</VT></B>
Unity自带的Log为<B><GN>Debug类</GN></B>，如`Debug.Log()`，虽然简单输出足够起到提示作用，但功能性略弱

# 参考实现

参考对象有以下几个：

- **QFramework**
- **LoxodonFramework**
- **MFramework(老)**

## QFramework

QFramework中的扩展很简单，为<B><GN>LogKit</GN></B>
基本上就是一层简单的封装，比如`Debug.Log()`的封装`LogKit.I()`：

``` csharp
public static void I(object msg, params object[] args)
{
    if (mLogLevel < LogLevel.Normal)
    {
        return;
    }

    if (args == null || args.Length == 0)
    {
        Debug.Log(msg);
    }
    else
    {
        Debug.LogFormat(msg.ToString(), args);
    }
}
```

可以看到很简单，为`Debug.Log()`/`Debug.LogFormat()`的合并封装，同时增加**Log等级**：

``` csharp
public enum LogLevel
{
    None = 0,
    Exception = 1,
    Error = 2,
    Warning = 3,
    Normal = 4,
    Max = 5,
}

private static LogLevel mLogLevel = LogLevel.Normal;
```

<BR>

LogKit比较有用的的以下部分：

- 反向Extension
  <BR>

  ``` csharp
  public static void LogInfo<T>(this T selfMsg)
  {
      // 如："a".LogInfo()
      LogKit.I(selfMsg);
  }
  ```
  
  ``` csharp
  public static StringBuilder GreenColor(this StringBuilder self,   Action<StringBuilder> childContent)
  {
      //拼接绿色字
      self.Append("<color=green>");
      childContent?.Invoke(self);
      self.Append("</color>");
      return self;
  }
  ```

- UnityConsole面板双击后定位源码位置
  这个问题在我的MFramework中曾经遇到，采用了同样的方法解决：
  <BR>
  
  ``` csharp
  #if UNITY_EDITOR
  public static class OpenAssetLogLine
  {
      private static bool m_hasForceMono = false;
  
      // 处理asset打开的callback函数
      [UnityEditor.Callbacks.OnOpenAssetAttribute(-1)]
      static bool OnOpenAsset(int instance, int line)
      {
          if (m_hasForceMono) return false;
  
          // 自定义函数，用来获取log中的stacktrace，定义在后面。
          string stack_trace = GetStackTrace();
          // 通过stacktrace来定位是否是自定义的log，log中有LogKit/LogKit.  cs，很好识别
          if (!string.IsNullOrEmpty(stack_trace) && stack_trace.  Contains("LogKit/LogKit.cs"))
          {
              // 正则匹配at xxx，在第几行
              Match matches = Regex.Match(stack_trace, @"\(at (.+)\)",   RegexOptions.IgnoreCase);
              string pathline = "";
              while (matches.Success)
              {
                  pathline = matches.Groups[1].Value;
  
                  // 找到不是我们自定义log文件的那行，重新整理文件路径，手  动打开
                  if (!pathline.Contains("LogKit/LogKit.cs") &&   !string.IsNullOrEmpty(pathline))
                  {
                      int split_index = pathline.LastIndexOf(":");
                      string path = pathline.Substring(0, split_index);
                      line = Convert.ToInt32(pathline.Substring  (split_index + 1));
                      m_hasForceMono = true;
                      //方式一
                      AssetDatabase.OpenAsset(AssetDatabase.  LoadAssetAtPath<UnityEngine.Object>(path), line);
                      m_hasForceMono = false;
                      //方式二
                      //string fullpath = Application.dataPath.  Substring(0, Application.dataPath.LastIndexOf  ("Assets"));
                      // fullpath = fullpath + path;
                      //  UnityEditorInternal.InternalEditorUtility.  OpenFileAtLineExternal(fullpath.Replace('/',   '\\'), line);
                      return true;
                  }
  
                  matches = matches.NextMatch();
              }
  
              return true;
          }
  
          return false;
      }
  
      static string GetStackTrace()
      {
  // 找到类UnityEditor.ConsoleWindow
          var type_console_window = typeof(EditorWindow).Assembly.  GetType("UnityEditor.ConsoleWindow");
  // 找到UnityEditor.ConsoleWindow中的成员ms_ConsoleWindow
          var filedInfo =
              type_console_window.GetField("ms_ConsoleWindow",   BindingFlags.Static | BindingFlags.NonPublic);
  // 获取ms_ConsoleWindow的值
          var ConsoleWindowInstance = filedInfo.GetValue(null);
          if (ConsoleWindowInstance != null)
          {
              if ((object)EditorWindow.focusedWindow ==   ConsoleWindowInstance)
              {
  // 找到类UnityEditor.ConsoleWindow中的成员m_ActiveText
                  filedInfo = type_console_window.GetField  ("m_ActiveText",
                      BindingFlags.Instance | BindingFlags.NonPublic);
                  string activeText = filedInfo.GetValue  (ConsoleWindowInstance).ToString();
                  return activeText;
              }
          }
  
          return null;
      }
  }
  #endif
  ```

## LoxodonFramework

LoxodonFramework所对应的核心类为<B><GN>LogManager</GN></B>
已经在LoxodonFramework分析2.0中分析过，这里简单归纳一下：

- 通过ILogFactory创建ILog，默认为DefaultLogFactory
  - 具有Level/inUnity(个人认为inUnity不合适)，DefaultLogFactory具有`Level.All`级别
  - 在DefaultLogFactory中，每个ILog都是LogImpl
    - 封装基本上仅实现了额外信息输出(还有inUnity区分，倒是没什么用)
    - 默认不限制Level，需通过如`IsDebugEnabled()`自行开启限制

## MFramework

我的实现类为<B><GN>MLog</GN></B>
整体来说倒也不复杂，基本上主体就是一个超合一函数`MLog.Print()`：

``` csharp
public static void Print(object message, MLogType type = MLogType.Log, Object context = null)
{
    switch (type) 
    {
#if UNITY_EDITOR
        case MLogType.Log:
            Debug.Log($"<b>Log:</b> {message}", context);
            break;
        case MLogType.Warning:
            Debug.LogWarning($"<b><color=#CC9A06FF>Warning:</color></b> {message}", context);
            break;
        case MLogType.Error:
            Debug.LogError($"<b><color=#FF6E40FF>Error:</color></b> {message}", context);
            throw new System.Exception("...");
#else
        case MLogType.Log:
            if (MCore.Instance.LogState) Debug.Log($"Log: {message}", context);
            break;
        case MLogType.Warning:
            if (MCore.Instance.LogState) Debug.LogWarning($"Warning: {message}", context);
            break;
        case MLogType.Error:
            if (MCore.Instance.LogState) Debug.LogError($"Error: {message}", context);
            throw new System.Exception("...");
#endif
    }
}
```

除了QFramework也使用的**UnityConsole面板双击后定位源码位置**以外，还有**日志功能**：

``` csharp
// 结合框架的INeedInit, INeedQuit，配合MCore自动调用
public void Init()
{
#if !UNITY_EDITOR
    if (MCore.Instance.LogState)
    {
        Application.logMessageReceived += OnLogCallBack;
    }
#endif
}
public void Quit()
{
#if !UNITY_EDITOR
    if (MCore.Instance.LogState)
    {
        Application.logMessageReceived -= OnLogCallBack;
    }
#endif
}

private static void OnLogCallBack(string logString, string stackTrace, LogType type)
{
    fs = new FileStream(path, FileMode.OpenOrCreate);
    fs.Position = fs.Length;

    string str = null;
    str = $"Time: {GetCurrTime()}\n" +
            $"{logString}\n\n\n";

    byte[] bytes = System.Text.Encoding.Default.GetBytes(str);
    fs.Write(bytes, 0, bytes.Length);
    fs.Close();
}
```


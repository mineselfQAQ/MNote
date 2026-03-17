**<center><BBBG>codex问题</BBBG></center>**

# 重试5次后才能对话

这是因为需要**配置代理**，操作：

```
// 当前 PowerShell
$env:HTTP_PROXY="http://127.0.0.1:20081"
$env:HTTPS_PROXY="http://127.0.0.1:20081"
$env:ALL_PROXY="http://127.0.0.1:20081"
$env:NO_PROXY="localhost,127.0.0.1"

// 全局
setx HTTP_PROXY "http://127.0.0.1:20081"
setx HTTPS_PROXY "http://127.0.0.1:20081"
setx ALL_PROXY "http://127.0.0.1:20081"
setx NO_PROXY "localhost,127.0.0.1"
```

**<BL>问题：如何找到端口</BL>**
<BL>输入指令：`netstat -ano | findstr LISTENING`
![](Pic/codex1.png)
![](Pic/codex2.png)
由此即可对应上</BL>

**<BL>问题：VSCode下使用Codex插件依旧重试</BL>**
<BL>这是因为VSCode可能不完全走全局设置，在设置中找到Proxy Authorization按如下设置即可</BL>
![](Pic/codex3.png)

``` json
"http.proxyAuthorization": null,
"http.proxy": "http://127.0.0.1:20081",
"https.proxy": "http://127.0.0.1:20081",
"http.proxySupport": "override",
"http.proxyStrictSSL": false
```

<VT>dsaijdsa</VT>
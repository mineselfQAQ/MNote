**<center><BBBG>Unity重要设置</BBBG></center>**

# Project Settings

## Player

- Scripting Backend：脚本后端，简单来说就是编译方式，<B><VT>推荐发布前使用Mono，发布使用IL2CPP</VT></B>
  - Mono：默认选项，即时编译，编译更快，但性能低
  - IL2CPP：需转换为C++，编译更慢，但性能更好
- Api Compatibility Level：API兼容级别，决定了外部dll的可用性，<B><VT>推荐使用 .NET Standard 2.1</VT></B>
  - .NET Framework：更老的Framework
  - .NET Standard 2.1：稍微新一点的Standard
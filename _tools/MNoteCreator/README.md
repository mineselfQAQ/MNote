# MNoteCreator

MNoteCreator 是 MNote 的本地 WPF 新建笔记工具，用来减少手动创建目录、同名 Markdown 和父级索引的步骤。

## 启动

从 MNote 根目录运行：

```bat
_tools\open-note-creator.bat
```

首次运行会自动发布到 `_tools/MNoteCreator/.publish/`，随后启动 `MNoteCreator.exe`，bat 会立即退出。

发布完成后也可以直接启动：

```bat
_tools\MNoteCreator\.publish\MNoteCreator.exe
```

## 创建规则

- 选择已有 `___...___` 主题目录。
- 输入笔记名或主题内相对路径。
- 工具会创建 `笔记名/笔记名.md`。
- 工具只自动更新看起来由工具生成的索引，避免覆盖手写索引。
- 点击“新建主题”可以创建新的 `___...___` 顶层主题目录。

示例：

```text
主题：___CSHARP___
笔记：WPF绑定
```

会创建：

```text
___CSHARP___/WPF绑定/WPF绑定.md
```

嵌套示例：

```text
主题：___MFRAMEWORK___
笔记：框架分析/Unity/框架_XXX
```

会创建：

```text
___MFRAMEWORK___/框架分析/Unity/框架_XXX/框架_XXX.md
```

新建主题示例：

```text
主题名：WPF
```

会创建：

```text
___WPF___/___WPF___.md
```

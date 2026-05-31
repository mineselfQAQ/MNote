# 仓库规则

本仓库作为 MCodexCore 的嵌套项目管理。

修改本仓库前，先读取父级 MCodexCore 规则：

- `../AGENTS.md`
- `../.codex/skills/`

如果无法找到父级 MCodexCore 规则，停止操作，并请用户将本仓库按 MCodexCore 嵌套形式放置，或确认正确的父级路径。

## 项目身份

本仓库是 MNote，Mineself 的笔记库，作为 MCodexCore 的嵌套子项目管理。

识别本项目时，应结合：

- 本文件
- `README.md`
- 现有 `___...___` 主题目录结构
- 项目 default Skill：`../.codex/skills/projects/mnote/mp-mnote-default/SKILL.md`

处理本项目时，优先读取并使用上述项目 default Skill。

## 编码与读取

本仓库包含大量中文 Markdown、图片引用和规则说明。

在 PowerShell 中读取 `AGENTS.md`、`README.md`、笔记 Markdown 或 Skill 文件时，应显式使用 UTF-8，例如：

`[IO.File]::ReadAllText($path, [Text.UTF8Encoding]::UTF8)`

若终端显示中文乱码，先用显式 UTF-8 重新读取确认，不要直接判断文件内容损坏。

## 工作边界

笔记整理、HTML 生成或迁移、目录调整、文件重命名、索引重建等操作前，必须先说明整理范围、影响文件和验证方式，并等待用户明确确认。

默认沿用现有 `___...___` 主题目录结构，不擅自重命名、合并、拆分或批量格式化笔记。

本仓库是独立 Git 仓库，应分别检查父级 MCodexCore 和当前子项目的 Git 状态。

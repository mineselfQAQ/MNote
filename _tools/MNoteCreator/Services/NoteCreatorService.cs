using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace MNoteCreator.Services;

public sealed class NoteCreatorService
{
    private static readonly UTF8Encoding Utf8NoBom = new(false);

    public NoteCreatorService()
    {
        RootPath = FindRootPath();
    }

    public string RootPath { get; }

    public IReadOnlyList<string> GetTopics()
    {
        return Directory.EnumerateDirectories(RootPath)
            .Select(Path.GetFileName)
            .Where(name => name is not null && IsTopicDir(name))
            .Cast<string>()
            .OrderBy(name => name, StringComparer.Create(new System.Globalization.CultureInfo("zh-Hans-CN"), false))
            .ToList();
    }

    public string NormalizeTopicName(string rawTopicName)
    {
        var trimmed = rawTopicName.Trim().Trim('"').Trim('\'');
        if (string.IsNullOrWhiteSpace(trimmed)) throw new InvalidOperationException("请输入主题名。");

        var topicName = trimmed.StartsWith("___", StringComparison.Ordinal) && trimmed.EndsWith("___", StringComparison.Ordinal)
            ? trimmed
            : $"___{trimmed}___";

        if (!IsTopicDir(topicName)) throw new InvalidOperationException("主题目录必须是 ___...___ 格式。");

        var core = topicName[3..^3];
        if (string.IsNullOrWhiteSpace(core)) throw new InvalidOperationException("主题名不能为空。");
        if (topicName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) throw new InvalidOperationException($"主题名包含非法字符：{topicName}");
        if (core.EndsWith('.') || core.EndsWith(' ')) throw new InvalidOperationException($"主题名不能以空格或点结尾：{topicName}");
        if (IsIgnoredDir(topicName)) throw new InvalidOperationException($"主题名不能使用保留目录：{topicName}");

        return topicName;
    }

    public CreateTopicResult CreateTopic(string rawTopicName)
    {
        var topicName = NormalizeTopicName(rawTopicName);
        var topicRoot = Path.GetFullPath(Path.Combine(RootPath, topicName));
        EnsureInside(RootPath, topicRoot);

        if (Directory.Exists(topicRoot) || File.Exists(topicRoot))
        {
            throw new InvalidOperationException($"主题已存在：{topicName}");
        }

        Directory.CreateDirectory(topicRoot);
        var entryFile = EntryFileForDir(topicRoot);
        WriteUtf8(entryFile, $"# {topicName} 笔记索引\n\n## 笔记\n\n");

        return new CreateTopicResult(topicName, topicRoot, entryFile);
    }

    public NotePlan PlanNote(string topic, string rawNotePath)
    {
        topic = topic.Trim();
        if (!IsTopicDir(topic)) throw new InvalidOperationException("主题目录必须是 ___...___ 格式。");

        var topicRoot = Path.GetFullPath(Path.Combine(RootPath, topic));
        if (!Directory.Exists(topicRoot)) throw new DirectoryNotFoundException($"主题目录不存在：{topic}");

        var segments = ParseNotePath(rawNotePath);
        var noteTitle = segments[^1];
        var targetDir = Path.GetFullPath(Path.Combine(new[] { topicRoot }.Concat(segments).ToArray()));
        EnsureInside(topicRoot, targetDir);

        var noteFile = Path.Combine(targetDir, $"{noteTitle}.md");
        var parentDir = Directory.GetParent(targetDir)?.FullName ?? topicRoot;
        var indexDirs = AncestorsBetween(topicRoot, parentDir)
            .Select(EntryFileForDir)
            .ToList();

        return new NotePlan(
            topic,
            topicRoot,
            noteTitle,
            targetDir,
            noteFile,
            File.Exists(noteFile),
            indexDirs,
            ToRelativePath(noteFile));
    }

    public CreateNoteResult CreateNote(NotePlan plan)
    {
        if (plan.NoteExists || File.Exists(plan.NoteFile))
        {
            throw new InvalidOperationException("目标笔记已存在。");
        }

        Directory.CreateDirectory(plan.NoteDirectory);
        File.WriteAllText(plan.NoteFile, $"# {plan.NoteTitle}\n\n", Utf8NoBom);

        var touchedIndexes = UpdateIndexes(plan.TopicRoot, plan.NoteDirectory);
        return new CreateNoteResult(plan.NoteFile, touchedIndexes);
    }

    public ProcessRunResult ExportHtml()
    {
        var script = Path.Combine(RootPath, "_tools", "scripts", "mnote-export-html.js");
        if (!File.Exists(script)) throw new FileNotFoundException("找不到 HTML 导出脚本。", script);

        var startInfo = new ProcessStartInfo
        {
            FileName = "node",
            Arguments = $"\"{script}\"",
            WorkingDirectory = RootPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("无法启动 node。");
        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        process.WaitForExit();

        return new ProcessRunResult(process.ExitCode, string.Join(Environment.NewLine, new[] { output, error }.Where(x => !string.IsNullOrWhiteSpace(x))));
    }

    public string ToRelativePath(string path)
    {
        return ToPosix(Path.GetRelativePath(RootPath, path));
    }

    private static string FindRootPath()
    {
        var candidates = new[]
        {
            Directory.GetCurrentDirectory(),
            AppContext.BaseDirectory
        };

        foreach (var candidate in candidates)
        {
            var current = new DirectoryInfo(candidate);
            while (current is not null)
            {
                if (LooksLikeMNoteRoot(current.FullName)) return current.FullName;
                current = current.Parent;
            }
        }

        throw new DirectoryNotFoundException("无法定位 MNote 根目录。请从仓库根目录或 _tools/open-note-creator.bat 启动。");
    }

    private static bool LooksLikeMNoteRoot(string path)
    {
        return File.Exists(Path.Combine(path, "AGENTS.md"))
            && File.Exists(Path.Combine(path, "README.md"))
            && File.Exists(Path.Combine(path, "_tools", "scripts", "mnote-export-html.js"))
            && Directory.EnumerateDirectories(path).Any(dir => IsTopicDir(Path.GetFileName(dir)));
    }

    private static bool IsTopicDir(string? name)
    {
        return !string.IsNullOrWhiteSpace(name) && Regex.IsMatch(name, "^___.+___$");
    }

    private static IReadOnlyList<string> ParseNotePath(string rawNotePath)
    {
        var cleaned = rawNotePath.Trim().Trim('"').Trim('\'').Replace('\\', '/');
        var segments = cleaned.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length == 0) throw new InvalidOperationException("请输入笔记名或相对路径。");

        var invalid = Path.GetInvalidFileNameChars();
        foreach (var segment in segments)
        {
            if (segment is "." or "..") throw new InvalidOperationException("笔记路径不能包含 . 或 ..。");
            if (segment.IndexOfAny(invalid) >= 0) throw new InvalidOperationException($"笔记路径包含非法字符：{segment}");
            if (segment.EndsWith('.') || segment.EndsWith(' ')) throw new InvalidOperationException($"目录名不能以空格或点结尾：{segment}");
        }

        return segments;
    }

    private static void EnsureInside(string root, string target)
    {
        var normalizedRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var normalizedTarget = Path.GetFullPath(target).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!normalizedTarget.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("目标路径必须位于主题目录内。");
        }
    }

    private static List<string> UpdateIndexes(string topicRoot, string noteDirectory)
    {
        var parent = Directory.GetParent(noteDirectory)?.FullName ?? topicRoot;
        var dirs = AncestorsBetween(topicRoot, parent).ToList();
        var touched = new List<string>();

        foreach (var dir in dirs)
        {
            var entry = EntryFileForDir(dir);
            var children = ListVisibleChildren(dir).Where(HasEntry).ToList();
            if (!children.Any()) continue;

            if (!File.Exists(entry))
            {
                WriteUtf8(entry, GeneratedIndexText(dir, children));
                touched.Add(entry);
            }
        }

        foreach (var dir in dirs.AsEnumerable().Reverse())
        {
            var entry = EntryFileForDir(dir);
            if (!File.Exists(entry)) continue;

            var children = ListVisibleChildren(dir).Where(HasEntry).ToList();
            if (!children.Any()) continue;

            var current = ReadUtf8(entry);
            if (!IsGeneratedIndex(current, dir, Path.GetFileName(topicRoot))) continue;

            var next = GeneratedIndexText(dir, children);
            if (current != next)
            {
                WriteUtf8(entry, next);
                if (!touched.Contains(entry, StringComparer.OrdinalIgnoreCase)) touched.Add(entry);
            }
        }

        return touched;
    }

    private static IEnumerable<string> AncestorsBetween(string root, string leaf)
    {
        var rootFull = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar);
        var current = Path.GetFullPath(leaf).TrimEnd(Path.DirectorySeparatorChar);
        var stack = new Stack<string>();

        while (true)
        {
            stack.Push(current);
            if (string.Equals(current, rootFull, StringComparison.OrdinalIgnoreCase)) break;

            var parent = Directory.GetParent(current)?.FullName;
            if (parent is null) throw new InvalidOperationException("无法解析父级目录。");
            current = parent.TrimEnd(Path.DirectorySeparatorChar);
        }

        return stack;
    }

    private static string EntryFileForDir(string dir)
    {
        return Path.Combine(dir, $"{Path.GetFileName(dir)}.md");
    }

    private static bool HasEntry(string dir)
    {
        return File.Exists(EntryFileForDir(dir));
    }

    private static IReadOnlyList<string> ListVisibleChildren(string dir)
    {
        return Directory.EnumerateDirectories(dir)
            .Where(child => !IsIgnoredDir(Path.GetFileName(child)))
            .OrderBy(child => Path.GetFileName(child), StringComparer.Create(new System.Globalization.CultureInfo("zh-Hans-CN"), false))
            .ToList();
    }

    private static bool IsIgnoredDir(string? name)
    {
        return name is ".git" or "_html" or "_html_test" or "_tools" or "Pic";
    }

    private static string GeneratedIndexText(string dir, IReadOnlyList<string> children)
    {
        var directories = new List<string>();
        var notes = new List<string>();

        foreach (var child in children)
        {
            if (IsGeneratedIndexFile(EntryFileForDir(child))) directories.Add(child);
            else notes.Add(child);
        }

        var lines = new List<string> { $"# {Path.GetFileName(dir)} 笔记索引", "" };
        if (directories.Count > 0)
        {
            lines.Add("## 目录");
            lines.Add("");
            lines.AddRange(directories.Select(child => ChildLinkLine(dir, child)));
            lines.Add("");
        }

        if (notes.Count > 0)
        {
            lines.Add("## 笔记");
            lines.Add("");
            lines.AddRange(notes.Select(child => ChildLinkLine(dir, child)));
            lines.Add("");
        }

        if (directories.Count == 0 && notes.Count == 0)
        {
            lines.Add("## 目录");
            lines.Add("");
        }

        lines.Add("");
        return string.Join("\n", lines);
    }

    private static string ChildLinkLine(string dir, string child)
    {
        var childEntry = EntryFileForDir(child);
        var href = ToPosix(Path.GetRelativePath(dir, childEntry));
        var wrapped = Regex.IsMatch(href, @"[()\s#]") ? $"<{href}>" : href;
        return $"- [{EscapeMarkdownLabel(Path.GetFileName(child))}]({wrapped})";
    }

    private static bool IsGeneratedIndexFile(string file)
    {
        return File.Exists(file) && Regex.IsMatch(ReadUtf8(file), @"^# .+ 笔记索引\s*\r?\n", RegexOptions.Multiline);
    }

    private static bool IsGeneratedIndex(string current, string dir, string? category)
    {
        var trimmed = current.Trim();
        return Regex.IsMatch(current, @"^# .*(笔记索引)?\s*\r?\n\s*## 主题", RegexOptions.Multiline)
            || Regex.IsMatch(current, @"^# .*(笔记索引)?\s*\r?\n\s*## 目录", RegexOptions.Multiline)
            || trimmed == $"# {Path.GetFileName(dir)}"
            || (!string.IsNullOrWhiteSpace(category) && trimmed == $"# {category}");
    }

    private static string EscapeMarkdownLabel(string value)
    {
        var builder = new StringBuilder();
        foreach (var ch in value)
        {
            if ("\\`*_[]{}()#+-.!|>".Contains(ch)) builder.Append('\\');
            builder.Append(ch);
        }

        return builder.ToString();
    }

    private static string ReadUtf8(string file)
    {
        return File.ReadAllText(file, Encoding.UTF8);
    }

    private static void WriteUtf8(string file, string text)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(file) ?? ".");
        File.WriteAllText(file, text, Utf8NoBom);
    }

    private static string ToPosix(string value)
    {
        return value.Replace(Path.DirectorySeparatorChar, '/');
    }
}

public sealed record NotePlan(
    string Topic,
    string TopicRoot,
    string NoteTitle,
    string NoteDirectory,
    string NoteFile,
    bool NoteExists,
    IReadOnlyList<string> IndexFiles,
    string RelativeNoteFile);

public sealed record CreateNoteResult(string NoteFile, IReadOnlyList<string> UpdatedIndexes);

public sealed record CreateTopicResult(string TopicName, string TopicDirectory, string EntryFile);

public sealed record ProcessRunResult(int ExitCode, string Output);

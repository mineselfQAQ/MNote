using MNoteCreator.Services;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;

namespace MNoteCreator;

public partial class MainWindow : Window
{
    private readonly NoteCreatorService _service;
    private string? _lastCreatedFile;
    private bool _busy;

    public MainWindow()
    {
        InitializeComponent();
        _service = new NoteCreatorService();
        RootPathTextBlock.Text = _service.RootPath;
    }

    private void Window_Loaded(object sender, RoutedEventArgs e)
    {
        LoadTopics();
        NotePathTextBox.Focus();
    }

    private void LoadTopics(string? selectedTopic = null)
    {
        var previous = selectedTopic ?? TopicComboBox.SelectedItem as string;
        var topics = _service.GetTopics().ToList();
        TopicComboBox.ItemsSource = topics;

        if (!string.IsNullOrWhiteSpace(previous) && topics.Contains(previous))
        {
            TopicComboBox.SelectedItem = previous;
        }
        else if (topics.Count > 0)
        {
            TopicComboBox.SelectedIndex = 0;
        }

        AppendLog($"已读取 {topics.Count} 个主题目录。");
        UpdatePreview();
    }

    private void RefreshButton_Click(object sender, RoutedEventArgs e)
    {
        LoadTopics();
    }

    private async void NewTopicButton_Click(object sender, RoutedEventArgs e)
    {
        var rawTopicName = ShowTopicNameDialog();
        if (string.IsNullOrWhiteSpace(rawTopicName)) return;

        SetBusy(true);
        try
        {
            var result = await Task.Run(() => _service.CreateTopic(rawTopicName));
            AppendLog($"已创建主题：{result.TopicName}");
            AppendLog($"已创建索引：{_service.ToRelativePath(result.EntryFile)}");
            LoadTopics(result.TopicName);
            StatusTextBlock.Text = "主题创建完成";
        }
        catch (Exception ex)
        {
            AppendLog($"新建主题失败：{ex.Message}");
            StatusTextBlock.Text = "新建主题失败";
        }
        finally
        {
            SetBusy(false);
        }
    }

    private void Input_Changed(object sender, RoutedEventArgs e)
    {
        UpdatePreview();
    }

    private void Input_Changed(object sender, SelectionChangedEventArgs e)
    {
        UpdatePreview();
    }

    private void UpdatePreview()
    {
        if (!IsLoaded) return;

        try
        {
            var plan = GetCurrentPlanOrNull();
            if (plan is null)
            {
                PreviewTextBlock.Text = "请选择主题并输入笔记名。";
                ImpactTextBlock.Text = "";
                CreateButton.IsEnabled = !_busy && false;
                return;
            }

            PreviewTextBlock.Text = plan.RelativeNoteFile;
            ImpactTextBlock.Text = plan.NoteExists
                ? "目标笔记已存在，创建按钮会保持禁用。"
                : $"将创建 1 个 Markdown 文件，并按需更新 {plan.IndexFiles.Count} 个父级索引。";
            CreateButton.IsEnabled = !_busy && !plan.NoteExists;
        }
        catch (Exception ex)
        {
            PreviewTextBlock.Text = ex.Message;
            ImpactTextBlock.Text = "";
            CreateButton.IsEnabled = false;
        }
    }

    private async void CreateButton_Click(object sender, RoutedEventArgs e)
    {
        var plan = GetCurrentPlanOrNull();
        if (plan is null) return;

        SetBusy(true);
        try
        {
            var result = await Task.Run(() => _service.CreateNote(plan));
            _lastCreatedFile = result.NoteFile;
            OpenCreatedButton.IsEnabled = true;

            AppendLog($"已创建：{_service.ToRelativePath(result.NoteFile)}");
            foreach (var index in result.UpdatedIndexes)
            {
                AppendLog($"已更新索引：{_service.ToRelativePath(index)}");
            }

            StatusTextBlock.Text = "笔记创建完成";

            if (OpenAfterCreateCheckBox.IsChecked == true)
            {
                OpenPath(result.NoteFile);
            }

            if (ExportAfterCreateCheckBox.IsChecked == true)
            {
                await RunExportAsync();
            }

            UpdatePreview();
        }
        catch (Exception ex)
        {
            AppendLog($"创建失败：{ex.Message}");
            StatusTextBlock.Text = "创建失败";
        }
        finally
        {
            SetBusy(false);
        }
    }

    private async void ExportButton_Click(object sender, RoutedEventArgs e)
    {
        SetBusy(true);
        try
        {
            await RunExportAsync();
        }
        finally
        {
            SetBusy(false);
        }
    }

    private async Task RunExportAsync()
    {
        try
        {
            StatusTextBlock.Text = "正在导出 HTML...";
            var result = await Task.Run(() => _service.ExportHtml());
            AppendLog(result.Output.Trim());
            StatusTextBlock.Text = result.ExitCode == 0 ? "HTML 导出完成" : $"HTML 导出失败，退出码 {result.ExitCode}";
        }
        catch (Exception ex)
        {
            AppendLog($"HTML 导出失败：{ex.Message}");
            StatusTextBlock.Text = "HTML 导出失败";
        }
    }

    private void OpenCreatedButton_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrWhiteSpace(_lastCreatedFile) && File.Exists(_lastCreatedFile))
        {
            OpenPath(_lastCreatedFile);
        }
    }

    private void OpenHtmlButton_Click(object sender, RoutedEventArgs e)
    {
        var index = Path.Combine(_service.RootPath, "_html", "index.html");
        OpenPath(File.Exists(index) ? index : Path.Combine(_service.RootPath, "_html"));
    }

    private void OpenRootButton_Click(object sender, RoutedEventArgs e)
    {
        OpenPath(_service.RootPath);
    }

    private NotePlan? GetCurrentPlanOrNull()
    {
        var topic = TopicComboBox.SelectedItem as string;
        var notePath = NotePathTextBox.Text;
        if (string.IsNullOrWhiteSpace(topic) || string.IsNullOrWhiteSpace(notePath)) return null;
        return _service.PlanNote(topic, notePath);
    }

    private void SetBusy(bool busy)
    {
        _busy = busy;
        CreateButton.IsEnabled = !busy;
        NewTopicButton.IsEnabled = !busy;
        TopicComboBox.IsEnabled = !busy;
        NotePathTextBox.IsEnabled = !busy;
        StatusTextBlock.Text = busy ? "处理中..." : StatusTextBlock.Text;
        UpdatePreview();
    }

    private string? ShowTopicNameDialog()
    {
        var dialog = new Window
        {
            Title = "新建主题",
            Owner = this,
            Width = 420,
            Height = 190,
            ResizeMode = ResizeMode.NoResize,
            WindowStartupLocation = WindowStartupLocation.CenterOwner
        };

        var grid = new Grid { Margin = new Thickness(18) };
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var label = new TextBlock
        {
            Text = "主题名",
            FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 8)
        };
        Grid.SetRow(label, 0);
        grid.Children.Add(label);

        var input = new TextBox();
        Grid.SetRow(input, 1);
        grid.Children.Add(input);

        var preview = new TextBlock
        {
            Foreground = SystemColors.GrayTextBrush,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 8, 0, 16)
        };
        Grid.SetRow(preview, 2);
        grid.Children.Add(preview);

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right
        };
        var okButton = new Button
        {
            Content = "创建",
            MinWidth = 76,
            IsDefault = true
        };
        var cancelButton = new Button
        {
            Content = "取消",
            MinWidth = 76,
            IsCancel = true,
            Margin = new Thickness(0)
        };
        buttons.Children.Add(okButton);
        buttons.Children.Add(cancelButton);
        Grid.SetRow(buttons, 3);
        grid.Children.Add(buttons);

        string? result = null;

        void RefreshPreview()
        {
            try
            {
                var normalized = _service.NormalizeTopicName(input.Text);
                preview.Text = $"将创建：{normalized}";
                okButton.IsEnabled = true;
            }
            catch (Exception ex)
            {
                preview.Text = ex.Message;
                okButton.IsEnabled = false;
            }
        }

        input.TextChanged += (_, _) => RefreshPreview();
        okButton.Click += (_, _) =>
        {
            result = input.Text;
            dialog.DialogResult = true;
        };

        dialog.Content = grid;
        dialog.Loaded += (_, _) =>
        {
            input.Focus();
            RefreshPreview();
        };

        return dialog.ShowDialog() == true ? result : null;
    }

    private void AppendLog(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        LogTextBox.AppendText($"[{DateTime.Now:HH:mm:ss}] {text}{Environment.NewLine}");
        LogTextBox.ScrollToEnd();
    }

    private void OpenPath(string path)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            AppendLog($"打开失败：{ex.Message}");
        }
    }
}

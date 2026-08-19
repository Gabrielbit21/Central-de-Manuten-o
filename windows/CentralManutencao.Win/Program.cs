using System.Diagnostics;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CentralManutencaoSE;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Any(a => string.Equals(a, "--self-test", StringComparison.OrdinalIgnoreCase)))
            return SelfTest();

        using var instanceMutex = new Mutex(true, @"Local\CentralManutencaoSE.v1", out var isFirstInstance);
        if (!isFirstInstance)
        {
            MessageBox.Show(
                "A Central de Manutenção já está em execução. Verifique a barra de tarefas ou a área de notificação do Windows.",
                "Central de Manutenção SE",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return 0;
        }

        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.ThreadException += (_, e) => CrashLog.Write("ThreadException", e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) => CrashLog.Write("UnhandledException", e.ExceptionObject as Exception);
        Application.Run(new MainForm());
        GC.KeepAlive(instanceMutex);
        return 0;
    }

    private static int SelfTest()
    {
        try
        {
            var webRoot = Path.Combine(AppContext.BaseDirectory, "web");
            var required = new[]
            {
                "index.html",
                "app.js",
                "native-windows.js",
                "manifest.webmanifest",
                "version.json",
                "sw.js",
                Path.Combine("vendor", "supabase-js-2.57.4.min.js"),
                Path.Combine("vendor", "xlsx-0.20.3.full.min.js"),
                Path.Combine("assets", "icons", "central-manutencao.ico")
            };

            foreach (var relative in required)
            {
                var full = Path.Combine(webRoot, relative);
                if (!File.Exists(full) || new FileInfo(full).Length == 0)
                {
                    Console.Error.WriteLine($"Arquivo ausente ou vazio: {relative}");
                    return 10;
                }
            }

            var versionManifestPath = Path.Combine(webRoot, "version.json");
            using (var versionDocument = JsonDocument.Parse(File.ReadAllText(versionManifestPath)))
            {
                if (!versionDocument.RootElement.TryGetProperty("build", out var buildElement))
                {
                    Console.Error.WriteLine("version.json não contém a propriedade build.");
                    return 10;
                }

                var webVersion = buildElement.GetString();
                var executableVersion = FileVersionInfo.GetVersionInfo(Environment.ProcessPath!).ProductVersion;
                if (string.IsNullOrWhiteSpace(webVersion) ||
                    string.IsNullOrWhiteSpace(executableVersion) ||
                    !(string.Equals(executableVersion, webVersion, StringComparison.Ordinal) ||
                      executableVersion.StartsWith(webVersion + ".", StringComparison.Ordinal) ||
                      executableVersion.StartsWith(webVersion + "+", StringComparison.Ordinal) ||
                      executableVersion.StartsWith(webVersion + "-", StringComparison.Ordinal)))
                {
                    Console.Error.WriteLine($"Versão inconsistente. Web={webVersion}; EXE={executableVersion}");
                    return 13;
                }
            }

            var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (string.IsNullOrWhiteSpace(version))
            {
                Console.Error.WriteLine("WebView2 Runtime não detectado.");
                return 11;
            }

            var testUserData = Path.Combine(Path.GetTempPath(), "CentralManutencaoSE-SelfTest-" + Guid.NewGuid().ToString("N"));
            try
            {
                Directory.CreateDirectory(testUserData);
                _ = CoreWebView2Environment.CreateAsync(null, testUserData).GetAwaiter().GetResult();
            }
            finally
            {
                try { Directory.Delete(testUserData, true); } catch { }
            }

            var productVersion = FileVersionInfo.GetVersionInfo(Environment.ProcessPath!).ProductVersion;
            Console.WriteLine($"SELFTEST_OK App={productVersion} WebView2={version}");
            return 0;
        }
        catch (WebView2RuntimeNotFoundException ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 11;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            return 12;
        }
    }
}

internal sealed class MainForm : Form
{
    private const string AppTitle = "Central de Manutenção SE";
    private const string VirtualHost = "central-manutencao.invalid";

    private readonly WebView2 _webView = new();
    private readonly NotifyIcon _trayIcon = new();
    private readonly System.Windows.Forms.Timer _pollTimer = new() { Interval = 15_000 };
    private readonly string _webRoot = Path.Combine(AppContext.BaseDirectory, "web");
    private readonly string _userDataFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "CentralManutencaoSE",
        "WebView2");

    private bool _exiting;
    private bool _webReady;
    private bool _pollInProgress;
    private string? _lastNotificationId;

    public MainForm()
    {
        Text = AppTitle;
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;
        MinimumSize = new Size(1024, 700);
        BackColor = Color.White;

        var appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        if (appIcon is not null)
            Icon = appIcon;

        _webView.Dock = DockStyle.Fill;
        _webView.DefaultBackgroundColor = Color.White;
        Controls.Add(_webView);

        ConfigureTray(appIcon);

        Shown += async (_, _) => await InitializeWebViewAsync();
        FormClosing += OnFormClosing;
        _pollTimer.Tick += async (_, _) => await PollNotificationsAsync();
    }

    private void ConfigureTray(Icon? icon)
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Abrir Central", null, (_, _) => ShowFromTray());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Sair", null, (_, _) => ExitApplication());

        _trayIcon.Text = AppTitle;
        _trayIcon.Icon = icon ?? SystemIcons.Application;
        _trayIcon.ContextMenuStrip = menu;
        _trayIcon.Visible = true;
        _trayIcon.DoubleClick += (_, _) => ShowFromTray();
        _trayIcon.BalloonTipClicked += async (_, _) =>
        {
            ShowFromTray();
            if (!string.IsNullOrWhiteSpace(_lastNotificationId) && _webReady)
            {
                var idJson = JsonSerializer.Serialize(_lastNotificationId);
                await SafeExecuteScriptAsync($"window.centralNativeOpenNotification?.({idJson});");
            }
        };
    }

    private async Task InitializeWebViewAsync()
    {
        try
        {
            ValidateWebFiles();
            Directory.CreateDirectory(_userDataFolder);

            var environment = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: _userDataFolder);

            await _webView.EnsureCoreWebView2Async(environment);

            var core = _webView.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsZoomControlEnabled = true;

            core.SetVirtualHostNameToFolderMapping(
                VirtualHost,
                _webRoot,
                CoreWebView2HostResourceAccessKind.Deny);

            core.NewWindowRequested += OnNewWindowRequested;
            core.NavigationStarting += OnNavigationStarting;
            core.NavigationCompleted += OnNavigationCompleted;
            core.WebMessageReceived += OnWebMessageReceived;
            core.DownloadStarting += OnDownloadStarting;
            core.ProcessFailed += OnProcessFailed;

            await core.AddScriptToExecuteOnDocumentCreatedAsync(
                "window.__CENTRAL_WINDOWS_NATIVE__ = true;");

            core.Navigate($"https://{VirtualHost}/index.html");
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(
                "O Microsoft Edge WebView2 Runtime não está disponível. " +
                "Execute novamente o instalador da Central para que o componente oficial da Microsoft seja instalado.",
                AppTitle,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            ExitApplication();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Não foi possível iniciar a Central de Manutenção.\n\n" + ex.Message,
                AppTitle,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            ExitApplication();
        }
    }

    private void ValidateWebFiles()
    {
        var required = new[]
        {
            "index.html",
            "app.js",
            "native-windows.js",
            "manifest.webmanifest",
            "version.json",
            "sw.js",
            Path.Combine("vendor", "supabase-js-2.57.4.min.js"),
            Path.Combine("vendor", "xlsx-0.20.3.full.min.js")
        };

        foreach (var relative in required)
        {
            var full = Path.Combine(_webRoot, relative);
            if (!File.Exists(full) || new FileInfo(full).Length == 0)
                throw new FileNotFoundException($"Arquivo obrigatório não encontrado: {relative}", full);
        }
    }

    private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri))
            return;

        if (IsTrustedAppUri(uri))
            return;

        e.Cancel = true;
        if (uri.Scheme is "http" or "https")
            OpenExternal(uri.ToString());
    }

    private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri))
            return;

        if (IsTrustedAppUri(uri))
        {
            _webView.CoreWebView2.Navigate(uri.ToString());
            return;
        }

        if (uri.Scheme is "http" or "https")
            OpenExternal(uri.ToString());
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!e.IsSuccess)
        {
            MessageBox.Show(
                $"A interface da Central não pôde ser carregada ({e.WebErrorStatus}).",
                AppTitle,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        _webReady = true;
        _pollTimer.Start();
    }

    private void OnProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        _webReady = false;
        BeginInvoke(new Action(async () =>
        {
            try
            {
                await _webView.EnsureCoreWebView2Async();
                _webView.Reload();
            }
            catch
            {
                MessageBox.Show(
                    "O componente de interface da Central foi encerrado inesperadamente. " +
                    "Feche e abra o aplicativo novamente.",
                    AppTitle,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }
        }));
    }

    private void OnDownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        var deferral = e.GetDeferral();
        BeginInvoke(new Action(() =>
        {
            using (deferral)
            {
                e.Handled = true;

                var suggested = Path.GetFileName(e.ResultFilePath);
                if (string.IsNullOrWhiteSpace(suggested))
                    suggested = "exportacao.xlsx";

                var profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                var downloads = string.IsNullOrWhiteSpace(profile)
                    ? string.Empty
                    : Path.Combine(profile, "Downloads");

                using var dialog = new SaveFileDialog
                {
                    Title = "Salvar arquivo - Central de Manutenção",
                    FileName = suggested,
                    InitialDirectory = Directory.Exists(downloads) ? downloads : string.Empty,
                    OverwritePrompt = true,
                    AddExtension = true
                };

                var extension = Path.GetExtension(suggested);
                dialog.Filter = string.Equals(extension, ".xlsx", StringComparison.OrdinalIgnoreCase)
                    ? "Planilha Excel (*.xlsx)|*.xlsx|Todos os arquivos (*.*)|*.*"
                    : "Todos os arquivos (*.*)|*.*";

                if (dialog.ShowDialog(this) == DialogResult.OK)
                    e.ResultFilePath = dialog.FileName;
                else
                    e.Cancel = true;
            }
        }));
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var source) || !IsTrustedAppUri(source))
                return;

            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;
            if (!root.TryGetProperty("type", out var typeElement))
                return;

            var type = typeElement.GetString();
            if (!string.Equals(type, "notify", StringComparison.Ordinal))
                return;

            var title = root.TryGetProperty("title", out var titleElement)
                ? titleElement.GetString()
                : "Central de Manutenção";
            var body = root.TryGetProperty("body", out var bodyElement)
                ? bodyElement.GetString()
                : "Há uma nova atualização na Central.";
            _lastNotificationId = root.TryGetProperty("id", out var idElement)
                ? idElement.GetString()
                : null;

            _trayIcon.BalloonTipTitle = ClampText(
                string.IsNullOrWhiteSpace(title) ? "Central de Manutenção" : title,
                63);
            _trayIcon.BalloonTipText = ClampText(
                string.IsNullOrWhiteSpace(body) ? "Há uma nova atualização na Central." : body,
                255);
            _trayIcon.BalloonTipIcon = ToolTipIcon.Info;
            _trayIcon.ShowBalloonTip(8000);
        }
        catch
        {
            // Mensagens desconhecidas da página são ignoradas de propósito.
        }
    }

    private async Task PollNotificationsAsync()
    {
        if (!_webReady || _pollInProgress)
            return;

        _pollInProgress = true;
        try
        {
            await SafeExecuteScriptAsync("window.centralNativePollNow?.();");
        }
        finally
        {
            _pollInProgress = false;
        }
    }

    private async Task SafeExecuteScriptAsync(string script)
    {
        try
        {
            if (_webReady && _webView.CoreWebView2 is not null)
                await _webView.CoreWebView2.ExecuteScriptAsync(script);
        }
        catch
        {
            // A próxima iteração do timer tenta novamente.
        }
    }

    private void OnFormClosing(object? sender, FormClosingEventArgs e)
    {
        if (_exiting || e.CloseReason == CloseReason.WindowsShutDown)
            return;

        e.Cancel = true;
        Hide();
        _trayIcon.ShowBalloonTip(
            2500,
            AppTitle,
            "A Central continua ativa na área de notificação para receber avisos. Use 'Sair' no ícone da Central para encerrar.",
            ToolTipIcon.Info);
    }

    private void ShowFromTray()
    {
        if (!Visible)
            Show();
        if (WindowState == FormWindowState.Minimized)
            WindowState = FormWindowState.Normal;
        Activate();
        BringToFront();
    }

    private void ExitApplication()
    {
        _exiting = true;
        _pollTimer.Stop();
        _trayIcon.Visible = false;
        _trayIcon.Dispose();
        Close();
        Application.Exit();
    }


    private static bool IsTrustedAppUri(Uri uri) =>
        string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(uri.Host, VirtualHost, StringComparison.OrdinalIgnoreCase);

    private static string ClampText(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];

    private static void OpenExternal(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch
        {
            // O Windows ou a política corporativa pode bloquear URLs externas.
        }
    }
}

internal static class CrashLog
{
    public static void Write(string category, Exception? exception)
    {
        try
        {
            var root = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CentralManutencaoSE",
                "Logs");
            Directory.CreateDirectory(root);
            var path = Path.Combine(root, "central-windows.log");
            var message = $"[{DateTimeOffset.Now:O}] {category}{Environment.NewLine}{exception}{Environment.NewLine}{new string('-', 80)}{Environment.NewLine}";
            File.AppendAllText(path, message);
        }
        catch
        {
            // Logging must never prevent application startup or shutdown.
        }
    }
}

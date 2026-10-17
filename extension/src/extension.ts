import * as vscode from "vscode";
import { SecretManager } from "./secretManager";
import { N8nService } from "./n8nService";
import { ProcessManager } from "./processManager";
import { StatusBarManager } from "./statusBar";
import { HudViewProvider } from "./hudViewProvider";
import * as path from "path";
import * as fs from "fs";
import * as cp from "child_process";

let n8nService: N8nService | undefined;

function checkPythonDependencies(coreDir: string, processManager: ProcessManager) {
  const pyCmd = processManager.getPythonCmd();
  cp.exec(`${pyCmd} -c "import PyQt6, openwakeword, edge_tts"`, (err) => {
    if (err) {
      vscode.window
        .showWarningMessage(
          "Jarvis: Python dependencies are missing on this system. Would you like to install them now?",
          "Install Dependencies"
        )
        .then((choice) => {
          if (choice === "Install Dependencies") {
            vscode.commands.executeCommand("jarvis.installDependencies");
          }
        });
    }
  });
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("[Jarvis Extension] Activating Autonomous Systems...");

  // 1. Read & auto-resolve core directory (works on C:, D:, or any drive)
  const config = vscode.workspace.getConfiguration("jarvis");
  const configuredDir = config.get<string>("coreDir");
  const bundledDir = path.join(context.extensionPath, "python");
  const activeWs = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  let coreDir = bundledDir;
  if (configuredDir && fs.existsSync(configuredDir)) {
    coreDir = configuredDir;
  } else if (activeWs && (fs.existsSync(path.join(activeWs, "jarvis_listener.py")) || fs.existsSync(path.join(activeWs, "transcribe.py")))) {
    coreDir = activeWs;
  } else if (fs.existsSync(bundledDir)) {
    coreDir = bundledDir;
  } else if (fs.existsSync("C:\\Programming\\Jarvis\\Jarvis-Voice-Assistant")) {
    coreDir = "C:\\Programming\\Jarvis\\Jarvis-Voice-Assistant";
  }

  const autoStartN8n = config.get<boolean>("autoStartN8n") ?? true;
  const n8nUrl = config.get<string>("n8nUrl") || "http://localhost:5678";

  // 2. Initialize Subsystems
  const secretManager = new SecretManager(context, coreDir);
  n8nService = new N8nService(coreDir, n8nUrl);
  const processManager = new ProcessManager(coreDir);
  const statusBar = new StatusBarManager(context, n8nService, processManager);
  const hudProvider = new HudViewProvider(context, coreDir, n8nService, processManager);

  // 3. Register Sidebar Webview Provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HudViewProvider.viewType,
      hudProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // 4. Register Command Handlers
  context.subscriptions.push(
    vscode.commands.registerCommand("jarvis.start", () => {
      processManager.startVoiceListener();
    }),

    vscode.commands.registerCommand("jarvis.stop", () => {
      processManager.stopVoiceListener();
    }),

    vscode.commands.registerCommand("jarvis.openDesktopHud", () => {
      processManager.launchDesktopHud();
    }),

    vscode.commands.registerCommand("jarvis.openSidebarHud", () => {
      vscode.commands.executeCommand("workbench.view.extension.jarvis-sidebar");
    }),

    vscode.commands.registerCommand("jarvis.setGroqKey", async () => {
      await secretManager.promptForGroqKey(true);
    }),

    vscode.commands.registerCommand("jarvis.startN8n", async () => {
      await n8nService?.ensureRunning(false);
    }),

    vscode.commands.registerCommand("jarvis.initProject", async () => {
      await processManager.initWorkspace();
    }),

    vscode.commands.registerCommand("jarvis.status", () => {
      const ws = processManager.getActiveWorkspace();
      const n8nUp = n8nService?.getStatus() ? "ONLINE (5678)" : "OFFLINE";
      vscode.window.showInformationMessage(
        `Jarvis Status: Project [${path.basename(ws).toUpperCase()}] | n8n: ${n8nUp} | Core: ${coreDir}`
      );
    }),

    vscode.commands.registerCommand("jarvis.installDependencies", () => {
      const term = vscode.window.createTerminal({
        name: "JARVIS SETUP",
        iconPath: new vscode.ThemeIcon("tools"),
      });
      term.show();
      const reqFile = path.join(coreDir, "requirements.txt");
      const pyCmd = processManager.getPythonCmd();
      term.sendText(`${pyCmd} -m pip install -r "${reqFile}"`);
    }),

    vscode.commands.registerCommand("jarvis.quickMenu", async () => {
      await statusBar.showQuickMenu();
    })
  );

  // 5. Check and prompt for Groq API Key if missing
  const groqKey = await secretManager.getGroqKey();
  if (!groqKey) {
    setTimeout(() => {
      secretManager.promptForGroqKey(false);
    }, 1200);
  }

  // 6. Check Python dependencies in background
  setTimeout(() => {
    checkPythonDependencies(coreDir, processManager);
  }, 2500);

  // 7. Start n8n automation engine if configured
  if (autoStartN8n) {
    n8nService.startPolling(5000);
    setTimeout(() => {
      n8nService?.ensureRunning(true);
    }, 2000);
  }

  console.log("[Jarvis Extension] Fully activated and operational.");
}

export function deactivate() {
  if (n8nService) {
    n8nService.stopPolling();
  }
}

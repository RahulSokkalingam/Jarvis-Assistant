import * as vscode from "vscode";
import { SecretManager } from "./secretManager";
import { N8nService } from "./n8nService";
import { ProcessManager } from "./processManager";
import { StatusBarManager } from "./statusBar";
import { HudViewProvider } from "./hudViewProvider";
import * as path from "path";

let n8nService: N8nService | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log("[Jarvis Extension] Activating Autonomous Systems...");

  // 1. Read configurations
  const config = vscode.workspace.getConfiguration("jarvis");
  const coreDir =
    config.get<string>("coreDir") ||
    "C:\\Programming\\Jarvis\\Jarvis-Voice-Assistant";
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

    vscode.commands.registerCommand("jarvis.quickMenu", async () => {
      await statusBar.showQuickMenu();
    })
  );

  // 5. Check and prompt for Groq API Key if missing
  const groqKey = await secretManager.getGroqKey();
  if (!groqKey) {
    // Give user a brief moment after IDE load before showing the setup modal
    setTimeout(() => {
      secretManager.promptForGroqKey(false);
    }, 1200);
  }

  // 6. Start n8n automation engine if configured
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

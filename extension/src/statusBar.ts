import * as vscode from "vscode";
import { N8nService } from "./n8nService";
import { ProcessManager } from "./processManager";
import * as path from "path";

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly n8nService: N8nService,
    private readonly processManager: ProcessManager
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      1000
    );
    this.statusBarItem.command = "jarvis.quickMenu";
    this.context.subscriptions.push(this.statusBarItem);

    // Update on n8n status change
    this.n8nService.onStatusChange(() => {
      this.updateDisplay();
    });

    this.updateDisplay();
    this.statusBarItem.show();
  }

  public updateDisplay(): void {
    const ws = this.processManager.getActiveWorkspace();
    const projName = path.basename(ws).toUpperCase();
    const n8nOnline = this.n8nService.getStatus();

    this.statusBarItem.text = `$(hubot) JARVIS [${projName}]`;
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `### ⚡ JARVIS AUTONOMOUS ASSISTANT\n\n` +
      `- **Active Project**: \`${projName}\`\n` +
      `- **n8n Automation**: ${n8nOnline ? "🟢 `ONLINE (5678)`" : "🔴 `OFFLINE`"}\n` +
      `- **Voice Listener**: Standing by for *'Hey Jarvis'*\n\n` +
      `*Click to open Command Center Quick Actions*`
    );
    this.statusBarItem.tooltip.isTrusted = true;
    this.statusBarItem.color = n8nOnline ? "#00ff88" : "#00e1ff";
  }

  /**
   * Displays interactive Cyber Menu on status bar click.
   */
  public async showQuickMenu(): Promise<void> {
    const n8nOnline = this.n8nService.getStatus();
    const items: vscode.QuickPickItem[] = [
      {
        label: "$(mic) Start Voice Listener",
        description: "Listen for 'Hey Jarvis' wake word in active workspace",
      },
      {
        label: "$(primitive-square) Stop Voice Listener",
        description: "Terminate background voice listener process",
      },
      {
        label: "$(dashboard) Focus Cyber HUD Sidebar",
        description: "Open the embedded holographic HUD in Antigravity IDE",
      },
      {
        label: "$(window) Launch Desktop HUD Window",
        description: "Open high-FPS PyQt6 desktop holographic dashboard",
      },
      {
        label: `$(server-process) ${n8nOnline ? "n8n Workflow Engine: ONLINE" : "Start n8n Workflow Server"}`,
        description: n8nOnline ? "http://localhost:5678" : "Initialize background server",
      },
      {
        label: "$(key) Configure Groq API Key",
        description: "Update Whisper STT & Llama credentials",
      },
      {
        label: "$(rocket) Initialize Current Workspace",
        description: "Scaffold .jarvis config, git repo, and project launchers",
      },
    ];

    const pick = await vscode.window.showQuickPick(items, {
      title: "Jarvis Autonomous Systems - Command Center",
      placeHolder: "Select action to execute...",
    });

    if (!pick) {
      return;
    }

    if (pick.label.includes("Start Voice Listener")) {
      vscode.commands.executeCommand("jarvis.start");
    } else if (pick.label.includes("Stop Voice Listener")) {
      vscode.commands.executeCommand("jarvis.stop");
    } else if (pick.label.includes("Focus Cyber HUD Sidebar")) {
      vscode.commands.executeCommand("jarvis.openSidebarHud");
    } else if (pick.label.includes("Launch Desktop HUD Window")) {
      vscode.commands.executeCommand("jarvis.openDesktopHud");
    } else if (pick.label.includes("n8n")) {
      vscode.commands.executeCommand("jarvis.startN8n");
    } else if (pick.label.includes("Configure Groq API Key")) {
      vscode.commands.executeCommand("jarvis.setGroqKey");
    } else if (pick.label.includes("Initialize Current Workspace")) {
      vscode.commands.executeCommand("jarvis.initProject");
    }
  }
}

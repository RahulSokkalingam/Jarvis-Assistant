import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";

export class ProcessManager {
  private listenerTerminal: vscode.Terminal | null = null;

  constructor(private readonly coreDir: string) {}

  /**
   * Resolves the current active workspace directory.
   */
  public getActiveWorkspace(): string {
    const wsFolders = vscode.workspace.workspaceFolders;
    if (wsFolders && wsFolders.length > 0) {
      return wsFolders[0].uri.fsPath;
    }
    return this.coreDir;
  }

  /**
   * Launches the Voice Listener in an integrated terminal.
   */
  public startVoiceListener(targetWorkspace?: string): void {
    const ws = targetWorkspace || this.getActiveWorkspace();
    let listenerScript = path.join(this.coreDir, "jarvis_listener.py");
    if (fs.existsSync(path.join(ws, "jarvis_listener.py"))) {
      listenerScript = path.join(ws, "jarvis_listener.py");
    }

    // Close existing terminal if already open
    if (this.listenerTerminal) {
      this.listenerTerminal.dispose();
      this.listenerTerminal = null;
    }

    this.listenerTerminal = vscode.window.createTerminal({
      name: "JARVIS LISTENER",
      cwd: ws,
      env: {
        TARGET_REPO_PATH: ws,
      },
      iconPath: new vscode.ThemeIcon("mic"),
    });

    this.listenerTerminal.show(false);
    this.listenerTerminal.sendText(`py "${listenerScript}" --project "${ws}"`);
    vscode.window.showInformationMessage(
      `Jarvis Voice Assistant active for [${path.basename(ws).toUpperCase()}]. Say 'Hey Jarvis'!`
    );
  }

  /**
   * Stops the active voice listener terminal.
   */
  public stopVoiceListener(): void {
    if (this.listenerTerminal) {
      this.listenerTerminal.dispose();
      this.listenerTerminal = null;
      vscode.window.showInformationMessage("Jarvis: Voice Listener terminated.");
    } else {
      vscode.window.showInformationMessage("Jarvis: Voice Listener is not running.");
    }
  }

  /**
   * Spawns the native PyQt6 Sci-Fi holographic HUD window independently.
   */
  public launchDesktopHud(targetWorkspace?: string): void {
    const ws = targetWorkspace || this.getActiveWorkspace();
    let hudScript = path.join(this.coreDir, "jarvis_hud.py");
    if (fs.existsSync(path.join(ws, "jarvis_hud.py"))) {
      hudScript = path.join(ws, "jarvis_hud.py");
    }

    if (!fs.existsSync(hudScript)) {
      vscode.window.showErrorMessage(`Jarvis HUD script not found at ${hudScript}`);
      return;
    }

    // Windows CREATE_NEW_CONSOLE = 0x00000010
    const CREATE_NEW_CONSOLE = 0x00000010;
    try {
      cp.spawn("py.exe", [hudScript, "--project", ws], {
        cwd: ws,
        detached: true,
        windowsHide: false,
        stdio: "ignore",
        env: {
          ...process.env,
          TARGET_REPO_PATH: ws,
        },
      }).unref();

      vscode.window.showInformationMessage(
        `Jarvis: Desktop Cyber HUD launched for [${path.basename(ws).toUpperCase()}].`
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to launch Desktop HUD: ${err.message || err}`);
    }
  }

  /**
   * Initializes Jarvis for the current open workspace folder.
   */
  public async initWorkspace(targetWorkspace?: string): Promise<void> {
    const ws = targetWorkspace || this.getActiveWorkspace();
    let cliScript = path.join(this.coreDir, "jarvis_cli.py");
    if (fs.existsSync(path.join(ws, "jarvis_cli.py"))) {
      cliScript = path.join(ws, "jarvis_cli.py");
    }

    const terminal = vscode.window.createTerminal({
      name: "JARVIS INIT",
      cwd: ws,
      iconPath: new vscode.ThemeIcon("rocket"),
    });

    terminal.show();
    terminal.sendText(`py "${cliScript}" init "${ws}"`);
  }
}

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
   * Dynamically resolves whether to use 'py', 'python', or a configured python path.
   */
  public getPythonCmd(): string {
    const config = vscode.workspace.getConfiguration("jarvis");
    const configured = config.get<string>("pythonPath");
    if (configured && configured.trim().length > 0) {
      return configured.trim();
    }
    try {
      cp.execSync("py --version", { stdio: "ignore" });
      return "py";
    } catch {
      return "python";
    }
  }

  /**
   * Dynamically resolves script location checking workspace, common subfolders, and coreDir.
   */
  public resolveScript(scriptName: string, ws: string): string {
    const candidates = [
      path.join(ws, scriptName),
      path.join(ws, "Jarvis-Voice-Assistant", scriptName),
      path.join(ws, "Jarvis-Assistant", scriptName),
      path.join(this.coreDir, scriptName),
      path.join(this.coreDir, "Jarvis-Voice-Assistant", scriptName),
      path.join(this.coreDir, "Jarvis-Assistant", scriptName),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
    return path.join(this.coreDir, scriptName);
  }

  /**
   * Launches the Voice Listener in an integrated terminal.
   */
  public startVoiceListener(targetWorkspace?: string): void {
    const ws = targetWorkspace || this.getActiveWorkspace();
    const listenerScript = this.resolveScript("jarvis_listener.py", ws);

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

    const pyCmd = this.getPythonCmd();
    this.listenerTerminal.show(false);
    this.listenerTerminal.sendText(`${pyCmd} "${listenerScript}" --project "${ws}"`);
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
    const hudScript = this.resolveScript("jarvis_hud.py", ws);

    if (!fs.existsSync(hudScript)) {
      vscode.window.showErrorMessage(`Jarvis HUD script not found at ${hudScript}`);
      return;
    }

    const pyCmd = this.getPythonCmd();
    const executable = pyCmd === "py" ? "py.exe" : (pyCmd.endsWith(".exe") ? pyCmd : "python.exe");

    try {
      cp.spawn(executable, [hudScript, "--project", ws], {
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
    const cliScript = this.resolveScript("jarvis_cli.py", ws);

    const terminal = vscode.window.createTerminal({
      name: "JARVIS INIT",
      cwd: ws,
      iconPath: new vscode.ThemeIcon("rocket"),
    });

    const pyCmd = this.getPythonCmd();
    terminal.show();
    terminal.sendText(`${pyCmd} "${cliScript}" init "${ws}"`);
  }
}

import * as vscode from "vscode";
import * as http from "http";
import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";

export class N8nService {
  private isOnline = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private onStatusChangeEmitter = new vscode.EventEmitter<boolean>();
  public readonly onStatusChange = this.onStatusChangeEmitter.event;

  constructor(
    private readonly coreDir: string,
    private readonly n8nUrl: string = "http://localhost:5678"
  ) {}

  public getStatus(): boolean {
    return this.isOnline;
  }

  public getUrl(): string {
    return this.n8nUrl;
  }

  public startPolling(intervalMs = 4000): void {
    this.checkHealth();
    this.checkInterval = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
  }

  public stopPolling(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Pings the n8n HTTP server endpoint.
   */
  public async checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(this.n8nUrl);
        const req = http.get(
          {
            hostname: parsed.hostname,
            port: parsed.port || 5678,
            path: "/",
            timeout: 1000,
          },
          (res) => {
            const online = res.statusCode !== undefined;
            this.updateStatus(online);
            resolve(online);
          }
        );

        req.on("error", () => {
          this.updateStatus(false);
          resolve(false);
        });

        req.on("timeout", () => {
          req.destroy();
          this.updateStatus(false);
          resolve(false);
        });
      } catch {
        this.updateStatus(false);
        resolve(false);
      }
    });
  }

  /**
   * Spins up the background n8n process if not already online.
   */
  public async ensureRunning(silent = false): Promise<boolean> {
    const online = await this.checkHealth();
    if (online) {
      if (!silent) {
        vscode.window.showInformationMessage(`Jarvis: n8n Workflow Server is ONLINE at ${this.n8nUrl}`);
      }
      return true;
    }

    if (!silent) {
      vscode.window.showInformationMessage("Jarvis: Launching n8n Workflow Server in dedicated CMD window...");
    }

    // Resolve start_n8n.bat
    const candidates = [
      path.join(this.coreDir, "start_n8n.bat"),
      path.join(this.coreDir, "Jarvis-Voice-Assistant", "start_n8n.bat"),
      "C:\\Programming\\Jarvis\\Jarvis-Voice-Assistant\\start_n8n.bat",
      "C:\\Programming\\Jarvis\\start_n8n.bat",
    ];

    let batPath = "";
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        batPath = cand;
        break;
      }
    }

    if (batPath) {
      try {
        cp.spawn("cmd.exe", ["/c", "start", "n8n Workflow Server", "cmd.exe", "/k", `"${batPath}"`], {
          cwd: path.dirname(batPath),
          detached: true,
          windowsHide: false,
          stdio: "ignore",
        }).unref();
      } catch (err) {
        console.error("Failed to spawn start_n8n.bat:", err);
      }
    } else {
      // Fallback: integrated terminal
      const existing = vscode.window.terminals.find((t) => t.name === "N8N SERVER");
      const terminal =
        existing ||
        vscode.window.createTerminal({
          name: "N8N SERVER",
          cwd: this.coreDir,
          iconPath: new vscode.ThemeIcon("server-process"),
        });

      terminal.show();
      terminal.sendText("npx -y n8n start");
    }

    // Poll for up to 30 seconds
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const up = await this.checkHealth();
      if (up) {
        if (!silent) {
          vscode.window.showInformationMessage(`Jarvis: n8n Automation Engine is now ONLINE (${this.n8nUrl})`);
        }
        return true;
      }
    }

    return this.isOnline;
  }

  /**
   * Gracefully terminates the n8n server process and terminal.
   */
  public async stopN8n(): Promise<boolean> {
    // 1. Close/dispose any active N8N integrated terminal
    const terminal = vscode.window.terminals.find((t) => t.name === "N8N SERVER");
    if (terminal) {
      terminal.dispose();
    }

    // 2. Kill the process holding port 5678
    try {
      cp.execSync(
        'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5678 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"',
        { stdio: "ignore" }
      );
    } catch {}

    // 3. Fallback kill by window title
    try {
      cp.execSync('taskkill /F /FI "WINDOWTITLE eq *n8n*" 2>nul', { stdio: "ignore" });
    } catch {}

    await new Promise((r) => setTimeout(r, 600));
    await this.checkHealth();
    this.updateStatus(false);
    vscode.window.showInformationMessage("Jarvis: n8n Workflow Server stopped.");
    return true;
  }

  private updateStatus(newStatus: boolean): void {
    if (this.isOnline !== newStatus) {
      this.isOnline = newStatus;
      this.onStatusChangeEmitter.fire(this.isOnline);
    }
  }
}

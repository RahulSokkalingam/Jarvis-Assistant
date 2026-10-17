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
      vscode.window.showInformationMessage("Jarvis: Initializing background n8n workflow server...");
    }

    const batFile = path.join(this.coreDir, "start_n8n.bat");
    if (!fs.existsSync(batFile)) {
      // Fallback: spawn directly via npx
      cp.spawn("npx.cmd", ["-y", "n8n", "start"], {
        cwd: this.coreDir,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
    } else {
      cp.spawn("cmd.exe", ["/c", batFile], {
        cwd: this.coreDir,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
    }

    // Poll for up to 8 seconds
    for (let i = 0; i < 8; i++) {
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

  private updateStatus(newStatus: boolean): void {
    if (this.isOnline !== newStatus) {
      this.isOnline = newStatus;
      this.onStatusChangeEmitter.fire(this.isOnline);
    }
  }
}

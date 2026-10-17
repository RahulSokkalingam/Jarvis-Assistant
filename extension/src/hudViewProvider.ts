import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { N8nService } from "./n8nService";
import { ProcessManager } from "./processManager";

export class HudViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "jarvis-hud-view";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coreDir: string,
    private readonly n8nService: N8nService,
    private readonly processManager: ProcessManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages sent from Webview UI
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "startListener":
          vscode.commands.executeCommand("jarvis.start");
          break;
        case "stopListener":
          vscode.commands.executeCommand("jarvis.stop");
          break;
        case "openDesktopHud":
          vscode.commands.executeCommand("jarvis.openDesktopHud");
          break;
        case "restartN8n":
          vscode.commands.executeCommand("jarvis.startN8n");
          break;
        case "stopN8n":
          vscode.commands.executeCommand("jarvis.stopN8n");
          break;
        case "setGroqKey":
          vscode.commands.executeCommand("jarvis.setGroqKey");
          break;
        case "initProject":
          vscode.commands.executeCommand("jarvis.initProject");
          break;
        case "refresh":
          this.sendTelemetryUpdate();
          break;
      }
    });

    // Update on n8n status change
    this.n8nService.onStatusChange(() => {
      this.sendTelemetryUpdate();
    });

    // Stream telemetry every 2 seconds
    const telemetryTimer = setInterval(() => {
      if (this._view?.visible) {
        this.sendTelemetryUpdate();
      }
    }, 2000);

    this.context.subscriptions.push({
      dispose: () => clearInterval(telemetryTimer),
    });
  }

  public sendTelemetryUpdate(): void {
    if (!this._view) {
      return;
    }

    const ws = this.processManager.getActiveWorkspace();
    const projName = path.basename(ws).toUpperCase();
    const n8nOnline = this.n8nService.getStatus();

    let lastTranscript = "Standing by for wake word 'Hey Jarvis'...";
    let lastStatus = "Systems normal. Ready for commands.";

    try {
      const transFile = path.join(this.coreDir, "last_transcript.txt");
      if (fs.existsSync(transFile)) {
        const text = fs.readFileSync(transFile, "utf-8").trim();
        if (text) {
          lastTranscript = text;
        }
      }

      const statusFile = path.join(this.coreDir, "last_status.txt");
      if (fs.existsSync(statusFile)) {
        const sText = fs.readFileSync(statusFile, "utf-8").trim();
        if (sText) {
          lastStatus = sText;
        }
      }
    } catch {
      // Ignore reading errors
    }

    this._view.webview.postMessage({
      type: "telemetry",
      project: projName,
      workspace: ws,
      n8nOnline: n8nOnline,
      lastTranscript: lastTranscript,
      lastStatus: lastStatus,
    });
  }

  private getHtmlForWebview(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jarvis Cyber HUD</title>
  <style>
    :root {
      --cyan: #00e1ff;
      --cyan-dim: rgba(0, 225, 255, 0.2);
      --green: #00ff88;
      --amber: #ff9d00;
      --red: #ff4444;
      --bg: #0b0b1e;
      --panel-bg: rgba(14, 16, 40, 0.7);
    }
    body {
      background-color: var(--bg);
      color: #cad8e6;
      font-family: 'Consolas', 'Segoe UI', monospace;
      margin: 0;
      padding: 12px;
      user-select: none;
    }
    .hud-header {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }
    .badge {
      font-size: 10px;
      font-weight: bold;
      padding: 3px 6px;
      border-radius: 2px;
      border: 1px solid currentColor;
      letter-spacing: 1px;
    }
    .badge-green { color: var(--green); background: rgba(0, 255, 136, 0.12); }
    .badge-cyan { color: var(--cyan); background: rgba(0, 225, 255, 0.12); }
    .badge-amber { color: var(--amber); background: rgba(255, 157, 0, 0.12); }
    .badge-red { color: var(--red); background: rgba(255, 68, 68, 0.12); }

    .reactor-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 10px 0;
    }
    canvas {
      width: 140px;
      height: 140px;
    }

    .project-title {
      font-size: 13px;
      font-weight: bold;
      color: var(--cyan);
      letter-spacing: 1.5px;
      text-align: center;
      margin-top: 4px;
      border-bottom: 1px solid var(--cyan-dim);
      padding-bottom: 6px;
      width: 100%;
    }

    .panel {
      background: var(--panel-bg);
      border: 1px solid var(--cyan-dim);
      border-radius: 3px;
      padding: 8px 10px;
      margin-bottom: 10px;
      position: relative;
    }
    .panel-title {
      font-size: 9px;
      font-weight: bold;
      color: var(--cyan);
      letter-spacing: 1.5px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }

    .transcript-box {
      font-size: 11px;
      color: #00ff88;
      min-height: 38px;
      word-break: break-word;
      line-height: 1.4;
    }
    .status-box {
      font-size: 11px;
      color: #cad8e6;
      min-height: 30px;
      word-break: break-word;
      line-height: 1.4;
    }

    .btn-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 8px;
    }
    button {
      background: rgba(0, 225, 255, 0.08);
      border: 1px solid var(--cyan);
      color: var(--cyan);
      font-family: inherit;
      font-size: 10px;
      font-weight: bold;
      padding: 7px 4px;
      border-radius: 2px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    button:hover {
      background: rgba(0, 225, 255, 0.25);
      box-shadow: 0 0 10px rgba(0, 225, 255, 0.5);
    }
    button.btn-primary {
      grid-column: span 2;
      background: rgba(0, 255, 136, 0.15);
      border-color: var(--green);
      color: var(--green);
    }
    button.btn-primary:hover {
      background: rgba(0, 255, 136, 0.3);
      box-shadow: 0 0 12px rgba(0, 255, 136, 0.6);
    }
    button.btn-danger {
      border-color: var(--red);
      color: var(--red);
      background: rgba(255, 68, 68, 0.12);
    }
    button.btn-danger:hover {
      background: rgba(255, 68, 68, 0.3);
      box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
    }
  </style>
</head>
<body>
  <div class="hud-header">
    <div class="badge badge-green">[ACTIVE]</div>
    <div class="badge badge-cyan">[SYS_OK]</div>
    <div id="badge-n8n" class="badge badge-green">[N8N: ONLINE]</div>
    <div class="badge badge-amber">[GROQ: OK]</div>
  </div>

  <div class="reactor-container">
    <canvas id="reactorCanvas" width="280" height="280"></canvas>
    <div id="projName" class="project-title">// JARVIS COMMAND CENTER //</div>
  </div>

  <div class="panel">
    <div class="panel-title">// 1. VOICE TRANSCRIPT //</div>
    <div id="transcriptBox" class="transcript-box">Standing by for wake word 'Hey Jarvis'...</div>
  </div>

  <div class="panel">
    <div class="panel-title">// 2. TELEMETRY & STATUS //</div>
    <div id="statusBox" class="status-box">Systems normal. Initialized for active workspace.</div>
  </div>

  <div class="btn-grid">
    <button class="btn-primary" onclick="sendMessage('startListener')">🎤 START VOICE LISTENER</button>
    <button onclick="sendMessage('openDesktopHud')">🖥️ DESKTOP HUD</button>
    <button onclick="sendMessage('restartN8n')">🔄 RESTART N8N</button>
    <button class="btn-danger" onclick="sendMessage('stopN8n')">🛑 STOP N8N</button>
    <button onclick="sendMessage('setGroqKey')">🔑 SET GROQ KEY</button>
    <button onclick="sendMessage('initProject')">🚀 INIT WORKSPACE</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function sendMessage(cmd) {
      vscode.postMessage({ command: cmd });
    }

    // Arc reactor canvas animation
    const canvas = document.getElementById('reactorCanvas');
    const ctx = canvas.getContext('2d');
    let angle = 0;
    let pulse = 0;

    function drawReactor() {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      angle += 0.02;
      pulse = (Math.sin(angle * 3) + 1) / 2;

      // Outer dashed spinning ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.strokeStyle = '#00e1ff';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Middle counter-rotating amber ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-angle * 1.5);
      ctx.strokeStyle = '#ff9d00';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, 75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Inner glowing core
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 15 + pulse * 10;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + pulse * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      requestAnimationFrame(drawReactor);
    }
    drawReactor();

    // Handle messages from VS Code
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'telemetry') {
        document.getElementById('projName').textContent = '// [' + msg.project + '] //';
        document.getElementById('transcriptBox').textContent = msg.lastTranscript;
        document.getElementById('statusBox').textContent = msg.lastStatus;

        const n8nBadge = document.getElementById('badge-n8n');
        if (msg.n8nOnline) {
          n8nBadge.className = 'badge badge-green';
          n8nBadge.textContent = '[N8N: ONLINE]';
        } else {
          n8nBadge.className = 'badge badge-red';
          n8nBadge.textContent = '[N8N: OFFLINE]';
        }
      }
    });
  </script>
</body>
</html>`;
  }
}

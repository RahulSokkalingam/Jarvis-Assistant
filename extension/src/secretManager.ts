import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const SECRET_KEY = "JARVIS_GROQ_KEY";

export class SecretManager {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coreDir: string
  ) {}

  /**
   * Retrieves the Groq API key from VS Code SecretStorage, falling back to core .env.
   */
  public async getGroqKey(): Promise<string> {
    const secret = await this.context.secrets.get(SECRET_KEY);
    if (secret && secret.trim().length > 5) {
      return secret.trim();
    }

    const envKey = this.readKeyFromEnv(path.join(this.coreDir, ".env"));
    if (envKey) {
      await this.context.secrets.store(SECRET_KEY, envKey);
      return envKey;
    }

    return "";
  }

  /**
   * Prompts the user for their Groq API Key and persists it.
   */
  public async promptForGroqKey(forcePrompt = false): Promise<string | undefined> {
    const existing = await this.getGroqKey();
    if (existing && !forcePrompt) {
      return existing;
    }

    const input = await vscode.window.showInputBox({
      title: "Jarvis Autonomous Assistant - Groq API Setup",
      prompt: "Enter your Groq API Key to enable Groq Whisper Speech-to-Text and Llama Reasoning",
      password: true,
      ignoreFocusOut: true,
      placeHolder: "gsk_...",
      value: existing || "",
      validateInput: (text) => {
        if (!text || text.trim().length < 10) {
          return "Please enter a valid Groq API key (starts with gsk_...)";
        }
        return null;
      },
    });

    if (input && input.trim()) {
      const cleanKey = input.trim();
      await this.context.secrets.store(SECRET_KEY, cleanKey);
      this.syncKeyToEnvFiles(cleanKey);
      vscode.window.showInformationMessage(
        "Jarvis: Groq API Key successfully configured and synchronized!"
      );
      return cleanKey;
    }

    if (!existing) {
      const getFreeKey = "Get Free Groq Key";
      vscode.window
        .showWarningMessage(
          "Jarvis requires a Groq API Key for zero-latency speech recognition and reasoning.",
          getFreeKey
        )
        .then((choice) => {
          if (choice === getFreeKey) {
            vscode.env.openExternal(vscode.Uri.parse("https://console.groq.com/keys"));
          }
        });
    }

    return undefined;
  }

  /**
   * Synchronizes the key to core .env and any open workspace .env.
   */
  public syncKeyToEnvFiles(key: string): void {
    // 1. Sync to Jarvis Core .env
    const coreEnv = path.join(this.coreDir, ".env");
    this.updateEnvFile(coreEnv, key);

    // 2. Sync to active workspace folders
    const wsFolders = vscode.workspace.workspaceFolders;
    if (wsFolders) {
      for (const folder of wsFolders) {
        const wsEnv = path.join(folder.uri.fsPath, ".env");
        if (fs.existsSync(wsEnv)) {
          this.updateEnvFile(wsEnv, key);
        }
      }
    }
  }

  private readKeyFromEnv(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      return "";
    }
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        if (line.startsWith("GROQ_API_KEY=")) {
          const val = line.split("=", 2)[1].trim();
          if (val && !val.includes("your_groq_api_key_here")) {
            return val;
          }
        }
      }
    } catch {
      // Ignore read errors
    }
    return "";
  }

  private updateEnvFile(filePath: string, key: string): void {
    try {
      let content = "";
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, "utf-8");
      }
      if (content.includes("GROQ_API_KEY=")) {
        content = content.replace(/GROQ_API_KEY=.*(?:\r?\n|$)/, `GROQ_API_KEY=${key}\n`);
      } else {
        content += `\nGROQ_API_KEY=${key}\n`;
      }
      fs.writeFileSync(filePath, content, "utf-8");
    } catch {
      // Ignore write errors
    }
  }
}

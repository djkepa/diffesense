/**
 * Electron / Tauri Signal Detector
 *
 * Detects desktop app-specific patterns including:
 * - IPC communication
 * - Security boundaries (main/renderer)
 * - Native integrations
 * - Window management
 * - Tauri commands and events
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector } from './base';

export class ElectronDetector extends BaseDetector {
  private runtime: 'electron' | 'tauri' | 'unknown';

  constructor(content: string, filePath: string, changedRanges?: ChangedRange[], contextLines = 5) {
    super(content, filePath, changedRanges, contextLines);
    this.runtime = this.detectRuntime();
  }

  detect(): Signal[] {
    const baseSignals = super.detect();

    if (!this.isDesktopFile()) {
      return baseSignals;
    }

    const signals = [...baseSignals];

    if (this.runtime === 'electron') {
      signals.push(
        ...this.detectElectronIPC(),
        ...this.detectElectronSecurity(),
        ...this.detectElectronAPIs(),
      );
    } else if (this.runtime === 'tauri') {
      signals.push(
        ...this.detectTauriCommands(),
        ...this.detectTauriEvents(),
        ...this.detectTauriAPIs(),
      );
    }

    signals.push(...this.detectWindowManagement());

    return signals;
  }

  private detectRuntime(): 'electron' | 'tauri' | 'unknown' {
    const { content, filePath } = this.ctx;

    if (
      /from\s+['"]electron['"]|require\s*\(\s*['"]electron['"]/.test(content) ||
      filePath.includes('electron') ||
      filePath.includes('/main/') ||
      filePath.includes('/renderer/')
    ) {
      return 'electron';
    }

    if (
      /from\s+['"]@tauri-apps\/api['"]|tauri::/.test(content) ||
      filePath.includes('tauri') ||
      filePath.endsWith('.rs')
    ) {
      return 'tauri';
    }

    return 'unknown';
  }

  private isDesktopFile(): boolean {
    return this.runtime !== 'unknown';
  }

  /**
   * Detect Electron IPC patterns
   */
  private detectElectronIPC(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath } = this.ctx;

    const isMainProcess =
      filePath.includes('/main/') ||
      filePath.includes('main.ts') ||
      filePath.includes('main.js') ||
      filePath.includes('background');

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/ipcMain\.(handle|on|once)\s*\(/.test(line)) {
        const method = line.match(/ipcMain\.(handle|on|once)/)?.[1];
        const channel = line.match(/ipcMain\.\w+\s*\(\s*['"]([^'"]+)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: 'electron-ipc-main',
            title: `IPC Main Handler: ${channel || 'channel'}`,
            category: 'signature',
            reason: 'IPC handler in main process - verify input validation and security',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['electron', 'ipc', 'main', method || 'handler'],
            evidence: { kind: 'regex', pattern: 'ipcMain', details: { channel, method } },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Secure IPC handler',
                steps: [
                  'Validate all incoming data from renderer',
                  'Use invoke/handle pattern for type-safe responses',
                  'Consider using contextBridge for preload isolation',
                  'Never trust renderer-provided data',
                ],
              },
            ],
          }),
        );
      }

      if (/ipcRenderer\.(send|invoke|sendSync)\s*\(/.test(line)) {
        const method = line.match(/ipcRenderer\.(send|invoke|sendSync)/)?.[1];
        const channel = line.match(/ipcRenderer\.\w+\s*\(\s*['"]([^'"]+)['"]/)?.[1];

        const isSendSync = method === 'sendSync';

        signals.push(
          this.createSignal({
            id: isSendSync ? 'electron-ipc-sync' : 'electron-ipc-renderer',
            title: isSendSync ? 'Sync IPC (Blocks Renderer)' : `IPC Send: ${channel || 'channel'}`,
            category: 'side-effect',
            reason: isSendSync
              ? 'sendSync blocks renderer process - use invoke instead'
              : 'IPC message to main process',
            weight: isSendSync ? 0.7 : 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: isSendSync ? 'behavioral' : 'maintainability',
            confidence: 'high',
            tags: ['electron', 'ipc', 'renderer', method || 'send'],
            evidence: { kind: 'regex', pattern: 'ipcRenderer', details: { channel, method } },
            actions: isSendSync
              ? [
                  {
                    type: 'mitigation_steps',
                    text: 'Replace sendSync with invoke',
                    steps: [
                      'Use ipcRenderer.invoke for async IPC',
                      'Use ipcMain.handle in main process',
                      'sendSync blocks the renderer thread',
                    ],
                  },
                ]
              : undefined,
          }),
        );
      }

      if (/contextBridge\.exposeInMainWorld\s*\(/.test(line)) {
        const api = line.match(/exposeInMainWorld\s*\(\s*['"]([^'"]+)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: 'electron-context-bridge',
            title: `Context Bridge: ${api || 'api'}`,
            category: 'signature',
            reason: 'Exposing API to renderer - verify only safe methods are exposed',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['electron', 'security', 'preload', 'context-bridge'],
            evidence: { kind: 'regex', pattern: 'contextBridge', details: { api } },
            actions: [
              {
                type: 'review_request',
                text: 'Security review for exposed API',
                reviewers: ['@security-team'],
              },
              {
                type: 'mitigation_steps',
                text: 'Secure context bridge',
                steps: [
                  'Only expose necessary functions',
                  'Validate all arguments from renderer',
                  'Never expose Node.js APIs directly',
                  'Use narrowly-scoped channel names',
                ],
              },
            ],
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect Electron security patterns
   */
  private detectElectronSecurity(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/nodeIntegration\s*:\s*true/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'electron-node-integration',
            title: 'Node Integration Enabled',
            category: 'side-effect',
            reason: 'nodeIntegration: true is a security risk - use preload scripts instead',
            weight: 0.9,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['electron', 'security', 'node-integration'],
            evidence: { kind: 'regex', pattern: 'nodeIntegration.*true' },
            actions: [
              {
                type: 'review_request',
                text: 'Security review required',
                reviewers: ['@security-team'],
              },
              {
                type: 'mitigation_steps',
                text: 'Disable node integration',
                steps: [
                  'Set nodeIntegration: false',
                  'Set contextIsolation: true',
                  'Use preload script with contextBridge',
                  'Expose only necessary APIs',
                ],
              },
            ],
          }),
        );
      }

      if (/contextIsolation\s*:\s*false/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'electron-context-isolation-disabled',
            title: 'Context Isolation Disabled',
            category: 'side-effect',
            reason: 'contextIsolation: false is a security risk - renderer can access Node.js',
            weight: 0.9,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['electron', 'security', 'context-isolation'],
            evidence: { kind: 'regex', pattern: 'contextIsolation.*false' },
            actions: [
              {
                type: 'review_request',
                text: 'Security review required',
                reviewers: ['@security-team'],
              },
            ],
          }),
        );
      }

      if (/webSecurity\s*:\s*false/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'electron-web-security-disabled',
            title: 'Web Security Disabled',
            category: 'side-effect',
            reason: 'webSecurity: false disables same-origin policy - major security risk',
            weight: 0.9,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['electron', 'security', 'web-security'],
            evidence: { kind: 'regex', pattern: 'webSecurity.*false' },
          }),
        );
      }

      if (/allowRunningInsecureContent\s*:\s*true/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'electron-insecure-content',
            title: 'Insecure Content Allowed',
            category: 'side-effect',
            reason: 'Allowing insecure content is a security risk',
            weight: 0.8,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['electron', 'security', 'insecure-content'],
            evidence: { kind: 'regex', pattern: 'allowRunningInsecureContent.*true' },
          }),
        );
      }

      if (/enableRemoteModule\s*:\s*true|@electron\/remote/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'electron-remote-module',
            title: 'Remote Module Usage',
            category: 'side-effect',
            reason: 'Remote module is deprecated and insecure - use IPC instead',
            weight: 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['electron', 'security', 'remote', 'deprecated'],
            evidence: { kind: 'regex', pattern: 'remote' },
          }),
        );
      }

      if (/shell\.openExternal\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'electron-shell-open',
            title: 'Shell openExternal',
            category: 'side-effect',
            reason: 'Opening external URLs - validate URL to prevent code execution',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['electron', 'security', 'shell'],
            evidence: { kind: 'regex', pattern: 'shell.openExternal' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Validate external URLs',
                steps: [
                  'Validate URL is http/https only',
                  'Do not open file:// URLs from user input',
                  'Consider allowlisting domains',
                ],
              },
            ],
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect Electron-specific APIs
   */
  private detectElectronAPIs(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    const electronAPIs = [
      { pattern: /app\.(quit|exit|relaunch)/, name: 'App Lifecycle', critical: true },
      { pattern: /app\.setAsDefaultProtocolClient/, name: 'Protocol Handler', critical: true },
      { pattern: /autoUpdater/, name: 'Auto Updater', critical: true },
      { pattern: /powerMonitor/, name: 'Power Monitor', critical: false },
      { pattern: /powerSaveBlocker/, name: 'Power Save Blocker', critical: false },
      { pattern: /screen\./, name: 'Screen API', critical: false },
      { pattern: /globalShortcut/, name: 'Global Shortcut', critical: false },
      { pattern: /clipboard\./, name: 'Clipboard', critical: false },
      { pattern: /nativeImage/, name: 'Native Image', critical: false },
      { pattern: /nativeTheme/, name: 'Native Theme', critical: false },
      { pattern: /systemPreferences/, name: 'System Preferences', critical: false },
      { pattern: /desktopCapturer/, name: 'Desktop Capturer', critical: true },
      { pattern: /crashReporter/, name: 'Crash Reporter', critical: false },
      { pattern: /protocol\.register/, name: 'Custom Protocol', critical: true },
      { pattern: /session\./, name: 'Session', critical: true },
      { pattern: /webContents\./, name: 'WebContents', critical: true },
      { pattern: /Notification/, name: 'Notification', critical: false },
      { pattern: /Menu\./, name: 'Menu', critical: false },
      { pattern: /Tray/, name: 'Tray', critical: false },
      { pattern: /dialog\./, name: 'Dialog', critical: false },
      { pattern: /TouchBar/, name: 'TouchBar', critical: false },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      for (const { pattern, name, critical } of electronAPIs) {
        if (pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: `electron-${name.toLowerCase().replace(/\s+/g, '-')}`,
              title: `Electron ${name}`,
              category: 'side-effect',
              reason: critical
                ? `${name} API - security sensitive, verify usage`
                : `${name} API - verify platform behavior`,
              weight: critical ? 0.5 : 0.2,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: critical ? 'behavioral' : 'maintainability',
              confidence: 'high',
              tags: ['electron', 'api', name.toLowerCase().replace(/\s+/g, '-')],
              evidence: { kind: 'regex', pattern: pattern.source, details: { api: name } },
            }),
          );
          break;
        }
      }
    }

    return signals;
  }

  /**
   * Detect Tauri command patterns
   */
  private detectTauriCommands(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/#\[tauri::command\]/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'tauri-command',
            title: 'Tauri Command',
            category: 'signature',
            reason: 'Tauri command exposed to frontend - validate all inputs',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum, lineNum + 3),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['tauri', 'command', 'rust', 'ipc'],
            evidence: { kind: 'regex', pattern: 'tauri::command' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Secure Tauri command',
                steps: [
                  'Validate all input parameters',
                  'Use Result<T, E> for error handling',
                  'Consider using tauri-plugin-store for persistence',
                  'Add command to tauri.conf.json allowlist',
                ],
              },
            ],
          }),
        );
      }

      if (/invoke\s*\(\s*['"]/.test(line)) {
        const command = line.match(/invoke\s*\(\s*['"]([^'"]+)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: 'tauri-invoke',
            title: `Tauri Invoke: ${command || 'command'}`,
            category: 'async',
            reason: 'Invoking Tauri command - verify error handling',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['tauri', 'invoke', 'ipc'],
            evidence: { kind: 'regex', pattern: 'invoke', details: { command } },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect Tauri event patterns
   */
  private detectTauriEvents(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/\b(listen|emit|once)\s*\(\s*['"]/.test(line)) {
        const method = line.match(/\b(listen|emit|once)\s*\(/)?.[1];
        const event = line.match(/\b(?:listen|emit|once)\s*\(\s*['"]([^'"]+)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: `tauri-event-${method}`,
            title: `Tauri ${method}: ${event || 'event'}`,
            category: method === 'listen' ? 'async' : 'side-effect',
            reason:
              method === 'listen'
                ? 'Event listener - ensure cleanup with unlisten'
                : 'Event emission - verify event handlers exist',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['tauri', 'events', method || 'event'],
            evidence: { kind: 'regex', pattern: method || 'event', details: { event } },
            actions:
              method === 'listen'
                ? [
                    {
                      type: 'mitigation_steps',
                      text: 'Cleanup event listener',
                      steps: [
                        'Store the unlisten function returned by listen()',
                        'Call unlisten in cleanup (useEffect return, onDestroy, etc.)',
                        'Consider using once() for one-time events',
                      ],
                    },
                  ]
                : undefined,
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect Tauri-specific APIs
   */
  private detectTauriAPIs(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    const tauriAPIs = [
      { pattern: /from\s+['"]@tauri-apps\/api\/fs['"]/, name: 'File System', critical: true },
      { pattern: /from\s+['"]@tauri-apps\/api\/path['"]/, name: 'Path', critical: false },
      { pattern: /from\s+['"]@tauri-apps\/api\/shell['"]/, name: 'Shell', critical: true },
      { pattern: /from\s+['"]@tauri-apps\/api\/dialog['"]/, name: 'Dialog', critical: false },
      {
        pattern: /from\s+['"]@tauri-apps\/api\/notification['"]/,
        name: 'Notification',
        critical: false,
      },
      { pattern: /from\s+['"]@tauri-apps\/api\/clipboard['"]/, name: 'Clipboard', critical: false },
      {
        pattern: /from\s+['"]@tauri-apps\/api\/globalShortcut['"]/,
        name: 'Global Shortcut',
        critical: false,
      },
      { pattern: /from\s+['"]@tauri-apps\/api\/http['"]/, name: 'HTTP', critical: true },
      { pattern: /from\s+['"]@tauri-apps\/api\/os['"]/, name: 'OS', critical: false },
      { pattern: /from\s+['"]@tauri-apps\/api\/process['"]/, name: 'Process', critical: true },
      { pattern: /from\s+['"]@tauri-apps\/api\/updater['"]/, name: 'Updater', critical: true },
      { pattern: /tauri-plugin-store/, name: 'Store Plugin', critical: false },
      { pattern: /tauri-plugin-sql/, name: 'SQL Plugin', critical: true },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      for (const { pattern, name, critical } of tauriAPIs) {
        if (pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: `tauri-${name.toLowerCase().replace(/\s+/g, '-')}`,
              title: `Tauri ${name}`,
              category: 'side-effect',
              reason: critical
                ? `${name} API requires tauri.conf.json allowlist`
                : `${name} API - verify configuration`,
              weight: critical ? 0.5 : 0.2,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: critical ? 'behavioral' : 'maintainability',
              confidence: 'high',
              tags: ['tauri', 'api', name.toLowerCase().replace(/\s+/g, '-')],
              evidence: { kind: 'regex', pattern: pattern.source, details: { api: name } },
              actions: critical
                ? [
                    {
                      type: 'mitigation_steps',
                      text: `Configure ${name} API`,
                      steps: [
                        'Add to tauri.conf.json allowlist',
                        'Use minimal required permissions',
                        'Validate all user inputs',
                      ],
                    },
                  ]
                : undefined,
            }),
          );
          break;
        }
      }
    }

    return signals;
  }

  /**
   * Detect window management patterns (both Electron and Tauri)
   */
  private detectWindowManagement(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/new\s+BrowserWindow\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'electron-browser-window',
            title: 'Browser Window Creation',
            category: 'side-effect',
            reason: 'New window - verify webPreferences security settings',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum, lineNum + 10),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['electron', 'window', 'security'],
            evidence: { kind: 'regex', pattern: 'new BrowserWindow' },
          }),
        );
      }

      if (/new\s+WebviewWindow\s*\(|WebviewWindow\.new\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'tauri-webview-window',
            title: 'Webview Window Creation',
            category: 'side-effect',
            reason: 'New window - verify window configuration',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['tauri', 'window'],
            evidence: { kind: 'regex', pattern: 'WebviewWindow' },
          }),
        );
      }

      if (/\.(close|hide|show|minimize|maximize|focus)\s*\(\)/.test(line)) {
        const action = line.match(/\.(close|hide|show|minimize|maximize|focus)/)?.[1];
        signals.push(
          this.createSignal({
            id: `desktop-window-${action}`,
            title: `Window ${action}`,
            category: 'side-effect',
            reason: `Window ${action} - verify user experience`,
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: [this.runtime, 'window', action || 'action'],
            evidence: { kind: 'regex', pattern: action || 'window' },
          }),
        );
      }

      if (/\.(loadURL|loadFile)\s*\(/.test(line)) {
        const method = line.includes('loadURL') ? 'loadURL' : 'loadFile';
        signals.push(
          this.createSignal({
            id: `electron-${method.toLowerCase()}`,
            title: `Window ${method}`,
            category: 'side-effect',
            reason:
              method === 'loadURL'
                ? 'Loading external URL - validate source for security'
                : 'Loading local file - verify path resolution',
            weight: method === 'loadURL' ? 0.5 : 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['electron', 'window', method.toLowerCase()],
            evidence: { kind: 'regex', pattern: method },
          }),
        );
      }
    }

    return signals;
  }
}

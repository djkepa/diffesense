/**
 * SSR/Isomorphic Signal Detector
 *
 * Detects Server-Side Rendering boundary issues including:
 * - Next.js (App Router & Pages Router)
 * - Nuxt.js
 * - SvelteKit
 * - Astro
 *
 * Key concerns:
 * - Browser APIs used in server context
 * - Hydration mismatches
 * - Server-only side effects
 * - Environment variable leakage
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector } from './base';

export class SSRDetector extends BaseDetector {
  private framework: 'next' | 'nuxt' | 'sveltekit' | 'astro' | 'unknown';

  constructor(content: string, filePath: string, changedRanges?: ChangedRange[], contextLines = 5) {
    super(content, filePath, changedRanges, contextLines);
    this.framework = this.detectFramework();
  }

  detect(): Signal[] {
    const baseSignals = super.detect();

    if (!this.isSSRFile()) {
      return baseSignals;
    }

    return [
      ...baseSignals,
      ...this.detectBrowserAPIsInServer(),
      ...this.detectHydrationIssues(),
      ...this.detectEnvLeakage(),
      ...this.detectFrameworkSpecific(),
    ];
  }

  private detectFramework(): 'next' | 'nuxt' | 'sveltekit' | 'astro' | 'unknown' {
    const { content, filePath } = this.ctx;

    if (
      /from\s+['"]next\//.test(content) ||
      filePath.includes('/app/') ||
      filePath.includes('/pages/') ||
      /getServerSideProps|getStaticProps/.test(content)
    ) {
      return 'next';
    }

    if (
      /from\s+['"]#app['"]|from\s+['"]nuxt/.test(content) ||
      filePath.includes('.nuxt') ||
      /defineNuxtConfig|useAsyncData|useFetch/.test(content)
    ) {
      return 'nuxt';
    }

    if (
      filePath.includes('+page') ||
      filePath.includes('+layout') ||
      filePath.includes('+server') ||
      /from\s+['"]\$app\//.test(content)
    ) {
      return 'sveltekit';
    }

    if (filePath.endsWith('.astro') || /from\s+['"]astro:/.test(content)) {
      return 'astro';
    }

    return 'unknown';
  }

  private isSSRFile(): boolean {
    const { filePath, content } = this.ctx;

    if (filePath.includes('/app/') && !/"use client"/.test(content)) {
      return true;
    }

    if (/getServerSideProps|getStaticProps/.test(content)) {
      return true;
    }

    if (filePath.includes('/server/') || /defineEventHandler/.test(content)) {
      return true;
    }

    if (filePath.includes('+server') || filePath.includes('+page.server')) {
      return true;
    }

    if (filePath.endsWith('.astro')) {
      return true;
    }

    return /['"]use server['"]|isServer|process\.server/.test(content);
  }

  /**
   * Detect browser APIs used in server context
   */
  private detectBrowserAPIsInServer(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath, content } = this.ctx;

    if (/"use client"|'use client'/.test(content)) {
      return signals;
    }

    const browserAPIs = [
      { pattern: /\bwindow\b(?!\.)/, name: 'window', critical: true },
      { pattern: /\bwindow\./, name: 'window', critical: true },
      { pattern: /\bdocument\b(?!\.)/, name: 'document', critical: true },
      { pattern: /\bdocument\./, name: 'document', critical: true },
      { pattern: /\blocalStorage\b/, name: 'localStorage', critical: true },
      { pattern: /\bsessionStorage\b/, name: 'sessionStorage', critical: true },
      { pattern: /\bnavigator\b/, name: 'navigator', critical: false },
      { pattern: /\blocation\b(?!\s*[:=])/, name: 'location', critical: false },
      { pattern: /\bhistory\b/, name: 'history', critical: false },
      { pattern: /\bself\b/, name: 'self', critical: false },
      { pattern: /\balert\s*\(/, name: 'alert', critical: false },
      { pattern: /\bconfirm\s*\(/, name: 'confirm', critical: false },
      { pattern: /\bprompt\s*\(/, name: 'prompt', critical: false },
      { pattern: /\bIntersectionObserver\b/, name: 'IntersectionObserver', critical: false },
      { pattern: /\bResizeObserver\b/, name: 'ResizeObserver', critical: false },
      { pattern: /\bMutationObserver\b/, name: 'MutationObserver', critical: false },
      { pattern: /\brequestAnimationFrame\b/, name: 'requestAnimationFrame', critical: false },
      { pattern: /\brequestIdleCallback\b/, name: 'requestIdleCallback', critical: false },
      { pattern: /\bgetComputedStyle\b/, name: 'getComputedStyle', critical: false },
      { pattern: /\bmatchMedia\b/, name: 'matchMedia', critical: false },
      { pattern: /\bAudio\b/, name: 'Audio', critical: false },
      { pattern: /\bImage\b/, name: 'Image', critical: false },
      { pattern: /\bBlob\b/, name: 'Blob', critical: false },
      { pattern: /\bFile\b/, name: 'File', critical: false },
      { pattern: /\bFileReader\b/, name: 'FileReader', critical: false },
      { pattern: /\bURL\.createObjectURL\b/, name: 'URL.createObjectURL', critical: false },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/typeof\s+(window|document)/.test(line)) continue;

      if (/if\s*\([^)]*(?:window|document|typeof)/.test(line)) continue;

      for (const { pattern, name, critical } of browserAPIs) {
        if (pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: 'ssr-browser-api',
              title: 'Browser API in Server Context',
              category: 'side-effect',
              reason: `'${name}' is not available during SSR - will crash on server`,
              weight: critical ? 0.8 : 0.5,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: critical ? 'critical' : 'behavioral',
              confidence: 'high',
              tags: ['ssr', 'browser-api', name, this.framework],
              evidence: { kind: 'regex', pattern: pattern.source, details: { api: name } },
              actions: [
                {
                  type: 'mitigation_steps',
                  text: `Guard '${name}' access for SSR`,
                  steps: [
                    `Add check: typeof ${name.split('.')[0]} !== 'undefined'`,
                    'Use dynamic import with { ssr: false } if needed',
                    'Move to useEffect/onMount for client-only code',
                    "Consider using 'use client' directive (Next.js 13+)",
                  ],
                },
              ],
            }),
          );
          break;
        }
      }
    }

    return signals;
  }

  /**
   * Detect potential hydration mismatch issues
   */
  private detectHydrationIssues(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/new\s+Date\s*\(\)|Date\.now\(\)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'ssr-hydration-date',
            title: 'Date Hydration Mismatch',
            category: 'side-effect',
            reason:
              'Date() returns different values on server vs client - causes hydration mismatch',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['ssr', 'hydration', 'date'],
            evidence: { kind: 'regex', pattern: 'Date' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Fix date hydration mismatch',
                steps: [
                  'Pass date as prop from server',
                  'Use suppressHydrationWarning for intentional differences',
                  'Initialize date in useEffect/onMount',
                ],
              },
            ],
          }),
        );
      }

      if (/Math\.random\s*\(\)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'ssr-hydration-random',
            title: 'Random Value Hydration Mismatch',
            category: 'side-effect',
            reason: 'Math.random() produces different values on server vs client',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['ssr', 'hydration', 'random'],
            evidence: { kind: 'regex', pattern: 'Math.random' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Fix random hydration mismatch',
                steps: [
                  'Use seeded random number generator',
                  'Generate random values on server and pass as props',
                  'Generate in useEffect/onMount if only needed client-side',
                ],
              },
            ],
          }),
        );
      }

      if (/uuid\s*\(\)|crypto\.randomUUID\s*\(\)|nanoid\s*\(\)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'ssr-hydration-uuid',
            title: 'UUID Hydration Mismatch',
            category: 'side-effect',
            reason: 'UUID generation differs between server and client',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['ssr', 'hydration', 'uuid'],
            evidence: { kind: 'regex', pattern: 'uuid|randomUUID|nanoid' },
          }),
        );
      }

      if (/isClient|isBrowser|typeof window/.test(line) && /{/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'ssr-conditional-render',
            title: 'Client-Only Conditional Render',
            category: 'side-effect',
            reason: 'Conditional rendering based on client state may cause hydration issues',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['ssr', 'hydration', 'conditional'],
            evidence: { kind: 'regex', pattern: 'isClient|isBrowser' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect environment variable leakage to client
   */
  private detectEnvLeakage(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath } = this.ctx;

    const sensitiveEnvPatterns = [
      /process\.env\.(?!NEXT_PUBLIC_|NUXT_PUBLIC_|PUBLIC_|VITE_)\w*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|API_KEY|PRIVATE)/i,
      /process\.env\.DATABASE/i,
      /process\.env\.MONGODB/i,
      /process\.env\.REDIS/i,
      /process\.env\.AWS_/i,
      /process\.env\.STRIPE_SECRET/i,
      /process\.env\.GITHUB_SECRET/i,
      /process\.env\.JWT_SECRET/i,
      /process\.env\.SESSION_SECRET/i,
      /process\.env\.ENCRYPTION_KEY/i,
    ];

    const isClientFile =
      /"use client"/.test(this.ctx.content) ||
      filePath.includes('/components/') ||
      (filePath.includes('/app/') && !filePath.includes('/api/'));

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      for (const pattern of sensitiveEnvPatterns) {
        if (pattern.test(line)) {
          const envVar = line.match(/process\.env\.(\w+)/)?.[1] || 'UNKNOWN';

          signals.push(
            this.createSignal({
              id: 'ssr-env-leakage',
              title: 'Sensitive Env Var Exposure',
              category: 'side-effect',
              reason: `${envVar} may be exposed to client bundle - use server-only imports`,
              weight: isClientFile ? 0.9 : 0.5,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'critical',
              confidence: isClientFile ? 'high' : 'medium',
              tags: ['ssr', 'security', 'env', 'secrets'],
              evidence: { kind: 'regex', pattern: pattern.source, details: { envVar } },
              actions: [
                {
                  type: 'review_request',
                  text: 'Security review required for env var usage',
                  reviewers: ['@security-team'],
                },
                {
                  type: 'mitigation_steps',
                  text: 'Secure environment variable handling',
                  steps: [
                    'Move to server-only module (server-only package)',
                    'Use Next.js: import "server-only"',
                    'Use API route to access secret server-side',
                    'Use NEXT_PUBLIC_ prefix only for truly public vars',
                  ],
                },
              ],
            }),
          );
          break;
        }
      }
    }

    return signals;
  }

  /**
   * Framework-specific SSR patterns
   */
  private detectFrameworkSpecific(): Signal[] {
    const signals: Signal[] = [];

    switch (this.framework) {
      case 'next':
        signals.push(...this.detectNextJSPatterns());
        break;
      case 'nuxt':
        signals.push(...this.detectNuxtPatterns());
        break;
      case 'astro':
        signals.push(...this.detectAstroPatterns());
        break;
    }

    return signals;
  }

  private detectNextJSPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath, content } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/"use client"|'use client'/.test(line) && lineNum > 1) {
        signals.push(
          this.createSignal({
            id: 'next-use-client-position',
            title: 'use client Not First',
            category: 'side-effect',
            reason: "'use client' must be at the top of the file",
            weight: 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'app-router', 'use-client'],
            evidence: { kind: 'regex', pattern: 'use client' },
          }),
        );
      }

      if (/"use server"|'use server'/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'next-server-action',
            title: 'Server Action',
            category: 'async',
            reason: 'Server Action - verify input validation and error handling',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'server-action', 'security'],
            evidence: { kind: 'regex', pattern: 'use server' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Server Action best practices',
                steps: [
                  'Validate all inputs with zod or similar',
                  'Check authentication/authorization',
                  'Handle errors with try/catch',
                  'Return typed responses',
                ],
              },
            ],
          }),
        );
      }

      if (/export\s+(?:async\s+)?function\s+generateStaticParams/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'next-generate-static-params',
            title: 'Static Params Generation',
            category: 'async',
            reason: 'generateStaticParams affects build time and ISR behavior',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'static-generation', 'build'],
            evidence: { kind: 'regex', pattern: 'generateStaticParams' },
          }),
        );
      }

      if (/export\s+(?:const|async\s+function)\s+(?:metadata|generateMetadata)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'next-metadata',
            title: 'Metadata Generation',
            category: 'signature',
            reason: 'Metadata affects SEO and social sharing',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'metadata', 'seo'],
            evidence: { kind: 'regex', pattern: 'metadata|generateMetadata' },
          }),
        );
      }

      if (/dynamic\s*\([^)]+ssr\s*:\s*false/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'next-dynamic-no-ssr',
            title: 'Client-Only Dynamic Import',
            category: 'async',
            reason: 'Component loads only on client - verify loading state',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'dynamic-import', 'client-only'],
            evidence: { kind: 'regex', pattern: 'dynamic.*ssr.*false' },
          }),
        );
      }

      if (
        /export\s+const\s+(dynamic|revalidate|fetchCache|runtime|preferredRegion)\s*=/.test(line)
      ) {
        signals.push(
          this.createSignal({
            id: 'next-route-config',
            title: 'Route Segment Config',
            category: 'signature',
            reason: 'Route configuration affects caching and runtime behavior',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'route-config', 'caching'],
            evidence: { kind: 'regex', pattern: 'export const (dynamic|revalidate)' },
          }),
        );
      }
    }

    return signals;
  }

  private detectNuxtPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/\b(useAsyncData|useFetch|useLazyAsyncData|useLazyFetch)\s*\(/.test(line)) {
        const hook = line.match(/(useAsyncData|useFetch|useLazyAsyncData|useLazyFetch)/)?.[1];
        signals.push(
          this.createSignal({
            id: 'nuxt-data-fetching',
            title: `Nuxt ${hook}`,
            category: 'async',
            reason: `${hook} - verify error handling and key uniqueness`,
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['nuxt', 'data-fetching', hook?.toLowerCase() || 'fetch'],
            evidence: { kind: 'regex', pattern: hook || 'useAsyncData' },
          }),
        );
      }

      if (
        /\buseState\s*\(/.test(line) &&
        /from\s+['"]#app['"]|from\s+['"]nuxt/.test(this.ctx.content)
      ) {
        signals.push(
          this.createSignal({
            id: 'nuxt-use-state',
            title: 'Nuxt useState',
            category: 'side-effect',
            reason: 'Nuxt useState - state shared between server and client',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['nuxt', 'state', 'ssr'],
            evidence: { kind: 'regex', pattern: 'useState' },
          }),
        );
      }

      if (/defineNuxtPlugin/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'nuxt-plugin',
            title: 'Nuxt Plugin',
            category: 'side-effect',
            reason: 'Nuxt plugin - runs on every request, verify SSR compatibility',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['nuxt', 'plugin', 'ssr'],
            evidence: { kind: 'regex', pattern: 'defineNuxtPlugin' },
          }),
        );
      }

      if (/defineNuxtRouteMiddleware/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'nuxt-middleware',
            title: 'Nuxt Route Middleware',
            category: 'side-effect',
            reason: 'Route middleware - runs on navigation, verify auth logic',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['nuxt', 'middleware', 'routing'],
            evidence: { kind: 'regex', pattern: 'defineNuxtRouteMiddleware' },
          }),
        );
      }

      if (/defineEventHandler/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'nuxt-server-handler',
            title: 'Nuxt Server Handler',
            category: 'async',
            reason: 'Server handler - verify input validation and error handling',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['nuxt', 'server', 'api'],
            evidence: { kind: 'regex', pattern: 'defineEventHandler' },
          }),
        );
      }

      if (/process\.(client|server)/.test(line)) {
        const side = line.includes('process.client') ? 'client' : 'server';
        signals.push(
          this.createSignal({
            id: `nuxt-${side}-check`,
            title: `Nuxt ${side} Check`,
            category: 'side-effect',
            reason: `Conditional ${side}-side code - verify both branches`,
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['nuxt', 'ssr', side],
            evidence: { kind: 'regex', pattern: `process.${side}` },
          }),
        );
      }
    }

    return signals;
  }

  private detectAstroPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath } = this.ctx;

    if (!filePath.endsWith('.astro')) {
      return signals;
    }

    let inFrontmatter = false;
    let frontmatterLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/^---\s*$/.test(line.trim())) {
        if (!inFrontmatter) {
          inFrontmatter = true;
          frontmatterLine = lineNum;
        } else {
          inFrontmatter = false;
        }
        continue;
      }

      if (/Astro\.glob\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'astro-glob',
            title: 'Astro.glob Import',
            category: 'async',
            reason: 'Astro.glob imports multiple files - verify performance',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['astro', 'import', 'glob'],
            evidence: { kind: 'regex', pattern: 'Astro.glob' },
          }),
        );
      }

      if (/client:(load|visible|idle|media|only)/.test(line)) {
        const directive = line.match(/client:(load|visible|idle|media|only)/)?.[1];
        signals.push(
          this.createSignal({
            id: 'astro-client-directive',
            title: `Client Directive: ${directive}`,
            category: 'async',
            reason: `Component hydrates with client:${directive} - verify bundle size impact`,
            weight: directive === 'load' ? 0.4 : 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['astro', 'hydration', `client-${directive}`],
            evidence: { kind: 'regex', pattern: `client:${directive}` },
          }),
        );
      }

      if (/getCollection|getEntry/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'astro-content-collection',
            title: 'Content Collection Access',
            category: 'async',
            reason: 'Content collection query - verify type safety and filters',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['astro', 'content', 'collections'],
            evidence: { kind: 'regex', pattern: 'getCollection|getEntry' },
          }),
        );
      }

      if (/Astro\.props/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'astro-props',
            title: 'Astro Props Access',
            category: 'signature',
            reason: 'Component props - verify type definitions',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['astro', 'props', 'component'],
            evidence: { kind: 'regex', pattern: 'Astro.props' },
          }),
        );
      }

      if (/Astro\.(redirect|rewrite)\s*\(/.test(line)) {
        const action = line.includes('redirect') ? 'redirect' : 'rewrite';
        signals.push(
          this.createSignal({
            id: `astro-${action}`,
            title: `Astro ${action}`,
            category: 'side-effect',
            reason: `Astro ${action} - verify destination and conditions`,
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['astro', action, 'routing'],
            evidence: { kind: 'regex', pattern: `Astro.${action}` },
          }),
        );
      }
    }

    return signals;
  }
}

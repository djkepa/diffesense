/**
 * Node.js Signal Detector
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector } from './base';

export class NodeDetector extends BaseDetector {
  constructor(content: string, filePath: string, changedRanges?: ChangedRange[], contextLines = 5) {
    super(content, filePath, changedRanges, contextLines);
  }

  /**
   * Detect all signals including Node.js-specific ones
   */
  detect(): Signal[] {
    const baseSignals = super.detect();

    if (!this.isNodeFile()) {
      return baseSignals;
    }

    return [...baseSignals, ...this.detectNodePatterns(), ...this.detectServerPatterns()];
  }

  /**
   * Check if this is likely a Node.js file
   */
  private isNodeFile(): boolean {
    const { filePath, content } = this.ctx;

    if (
      filePath.includes('/server/') ||
      filePath.includes('/api/') ||
      filePath.includes('/backend/')
    ) {
      return true;
    }

    const nodeImports = [
      'fs',
      'path',
      'http',
      'https',
      'child_process',
      'crypto',
      'stream',
      'net',
      'os',
      'cluster',
      'worker_threads',
    ];

    for (const mod of nodeImports) {
      if (
        new RegExp(`require\\s*\\(\\s*['"]${mod}['"]\\)`).test(content) ||
        new RegExp(`from\\s+['"]${mod}['"]`).test(content)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect Node.js-specific patterns - ONLY in changed/focus lines
   */
  private detectNodePatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    const syncPatterns = [
      { pattern: /readFileSync/, name: 'readFileSync', desc: 'Sync file read' },
      { pattern: /writeFileSync/, name: 'writeFileSync', desc: 'Sync file write' },
      { pattern: /existsSync/, name: 'existsSync', desc: 'Sync exists check' },
      { pattern: /execSync/, name: 'execSync', desc: 'Sync exec (blocking)' },
      { pattern: /spawnSync/, name: 'spawnSync', desc: 'Sync spawn (blocking)' },
      { pattern: /readdirSync/, name: 'readdirSync', desc: 'Sync directory read' },
      { pattern: /statSync/, name: 'statSync', desc: 'Sync stat' },
      { pattern: /mkdirSync/, name: 'mkdirSync', desc: 'Sync mkdir' },
      { pattern: /unlinkSync/, name: 'unlinkSync', desc: 'Sync unlink' },
      { pattern: /copyFileSync/, name: 'copyFileSync', desc: 'Sync file copy' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      for (const { pattern, name, desc } of syncPatterns) {
        if (pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: 'node-sync-op',
              title: 'Synchronous I/O Operation',
              category: 'side-effect',
              reason: `${desc} blocks event loop - consider async alternative`,
              weight: 0.5,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['node', 'sync', 'blocking', 'performance'],
              evidence: { kind: 'regex', pattern: pattern.source, details: { operation: name } },
              actions: [
                {
                  type: 'mitigation_steps',
                  text: `Replace ${name} with async version`,
                  steps: [
                    `Use ${name.replace('Sync', '')} with await`,
                    'Use fs/promises module for cleaner async code',
                    'Consider if sync operation is acceptable at startup only',
                  ],
                },
              ],
            }),
          );
        }
      }
    }

    const streamLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/\.pipe\s*\(|createReadStream|createWriteStream/.test(lines[i])) {
        streamLines.push(lineNum);
      }
    }

    if (streamLines.length > 0) {
      signals.push(
        this.createSignal({
          id: 'node-stream',
          title: 'Stream Operations',
          category: 'async',
          reason: `${streamLines.length} stream operation(s) - verify error handling and backpressure`,
          weight: 0.4,
          lines: streamLines,
          signalClass: 'behavioral',
          confidence: 'high',
          tags: ['node', 'streams', 'async'],
          evidence: { kind: 'regex', details: { count: streamLines.length } },
        }),
      );
    }

    const processEvents = [
      'exit',
      'uncaughtException',
      'unhandledRejection',
      'SIGINT',
      'SIGTERM',
      'beforeExit',
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      for (const event of processEvents) {
        if (line.includes('process.on') && line.includes(event)) {
          const isCritical = ['uncaughtException', 'unhandledRejection'].includes(event);
          signals.push(
            this.createSignal({
              id: `node-process-${event.toLowerCase()}`,
              title: `Process ${event} Handler`,
              category: 'async',
              reason: `Process ${event} handler - ${
                isCritical ? 'critical error handling' : 'verify cleanup logic'
              }`,
              weight: isCritical ? 0.6 : 0.4,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: isCritical ? 'critical' : 'behavioral',
              confidence: 'high',
              tags: ['node', 'process', 'events', event.toLowerCase()],
              evidence: { kind: 'regex', details: { event } },
              actions: isCritical
                ? [
                    {
                      type: 'review_request',
                      text: 'Review error handling logic',
                      reviewers: ['@backend-team'],
                    },
                  ]
                : undefined,
            }),
          );
        }
      }
    }

    const envLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/process\.env\.\w+/.test(lines[i])) {
        envLines.push(lineNum);
      }
    }

    if (envLines.length > 5) {
      signals.push(
        this.createSignal({
          id: 'node-env-heavy',
          title: 'Heavy Environment Usage',
          category: 'side-effect',
          reason: `${envLines.length} environment variable accesses - consider centralized config`,
          weight: 0.3,
          lines: envLines.slice(0, 5),
          signalClass: 'maintainability',
          confidence: 'high',
          tags: ['node', 'config', 'environment'],
          evidence: { kind: 'regex', details: { count: envLines.length } },
        }),
      );
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/Worker\s*\(|workerData|parentPort/.test(lines[i])) {
        signals.push(
          this.createSignal({
            id: 'node-worker',
            title: 'Worker Thread',
            category: 'async',
            reason: 'Worker thread usage - verify message passing and error handling',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['node', 'workers', 'concurrency'],
            evidence: { kind: 'regex', pattern: 'Worker|workerData|parentPort' },
          }),
        );
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/cluster\.fork|cluster\.isMaster|cluster\.isPrimary/.test(lines[i])) {
        signals.push(
          this.createSignal({
            id: 'node-cluster',
            title: 'Cluster Usage',
            category: 'async',
            reason: 'Cluster usage - verify worker management and IPC',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['node', 'cluster', 'scaling'],
            evidence: { kind: 'regex', pattern: 'cluster\\.' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect server/API patterns - ONLY in changed/focus lines
   */
  private detectServerPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      if (
        /\.(get|post|put|patch|delete)\s*\(\s*['"]/.test(line) ||
        /router\.(get|post|put|patch|delete)/.test(line) ||
        /app\.(get|post|put|patch|delete)/.test(line)
      ) {
        const method = line.match(/(get|post|put|patch|delete)/i)?.[1]?.toUpperCase() || 'HTTP';
        signals.push(
          this.createSignal({
            id: 'node-route',
            title: `${method} Route Handler`,
            category: 'signature',
            reason: `API route handler - verify authentication and validation`,
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['node', 'api', 'route', method.toLowerCase()],
            evidence: { kind: 'regex', details: { method } },
          }),
        );
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/app\.use\s*\(|router\.use\s*\(/.test(lines[i])) {
        const isAuth = /auth|session|jwt|passport|cookie/i.test(lines[i]);
        signals.push(
          this.createSignal({
            id: isAuth ? 'node-auth-middleware' : 'node-middleware',
            title: isAuth ? 'Auth Middleware' : 'Middleware Registration',
            category: 'side-effect',
            reason: isAuth
              ? 'Authentication middleware change - verify security implications'
              : 'Middleware registration - verify order and side effects',
            weight: isAuth ? 0.7 : 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: isAuth ? 'critical' : 'behavioral',
            confidence: 'high',
            tags: ['node', 'middleware', ...(isAuth ? ['auth', 'security'] : [])],
            evidence: { kind: 'regex', pattern: 'app\\.use|router\\.use' },
            actions: isAuth
              ? [
                  {
                    type: 'review_request',
                    text: 'Security review required for auth middleware change',
                    reviewers: ['@security-team'],
                  },
                  {
                    type: 'test_command',
                    text: 'Run auth tests',
                    command: 'npm test -- auth',
                  },
                ]
              : undefined,
          }),
        );
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (
        /\.(query|execute|raw)\s*\(\s*[`'"]/.test(line) ||
        /SELECT\s+|INSERT\s+|UPDATE\s+|DELETE\s+/i.test(line)
      ) {
        signals.push(
          this.createSignal({
            id: 'node-database-query',
            title: 'Database Query',
            category: 'side-effect',
            reason: 'Database query - verify SQL injection prevention and transaction handling',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['node', 'database', 'sql', 'security'],
            evidence: { kind: 'regex', pattern: 'query|execute|SELECT|INSERT|UPDATE|DELETE' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Verify database query safety',
                steps: [
                  'Use parameterized queries to prevent SQL injection',
                  'Verify transaction handling for multi-step operations',
                  'Add appropriate indexes for query performance',
                ],
              },
            ],
          }),
        );
      }

      if (/\.(findOne|findMany|create|update|delete|save|findById|findByPk)\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'node-orm',
            title: 'ORM Operation',
            category: 'side-effect',
            reason: 'ORM operation - verify N+1 queries and eager loading',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['node', 'database', 'orm'],
            evidence: { kind: 'regex', pattern: 'findOne|findMany|create|update|delete' },
          }),
        );
      }

      if (
        /\.(get|set|del|hget|hset|lpush|rpush|zadd)\s*\(/.test(line) &&
        /redis|cache/i.test(line)
      ) {
        signals.push(
          this.createSignal({
            id: 'node-cache',
            title: 'Cache Operation',
            category: 'side-effect',
            reason: 'Cache operation - verify TTL and invalidation strategy',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['node', 'cache', 'redis'],
            evidence: { kind: 'regex', pattern: 'redis|cache' },
          }),
        );
      }

      if (/\.(publish|subscribe|send|receive|ack|nack)\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'node-queue',
            title: 'Message Queue Operation',
            category: 'async',
            reason: 'Message queue operation - verify message handling and acknowledgment',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['node', 'queue', 'messaging', 'async'],
            evidence: { kind: 'regex', pattern: 'publish|subscribe|send|receive' },
          }),
        );
      }
    }

    signals.push(...this.detectGraphQLPatterns());
    signals.push(...this.detectRealtimePatterns());

    return signals;
  }

  /**
   * Detect GraphQL patterns
   */
  private detectGraphQLPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    const isGraphQL =
      /from\s+['"](?:graphql|@apollo|@nestjs\/graphql|type-graphql)['"]/.test(content) ||
      /gql`|graphql`/.test(content);

    if (!isGraphQL) {
      return signals;
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/type\s+Query|type\s+Mutation|type\s+Subscription/.test(line)) {
        const schemaType = line.match(/type\s+(Query|Mutation|Subscription)/)?.[1];
        signals.push(
          this.createSignal({
            id: `graphql-${schemaType?.toLowerCase()}-type`,
            title: `GraphQL ${schemaType} Type`,
            category: 'signature',
            reason: `GraphQL ${schemaType} type changed - verify schema compatibility`,
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum, lineNum + 5),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['graphql', 'schema', schemaType?.toLowerCase() || 'type'],
            evidence: { kind: 'regex', pattern: `type ${schemaType}` },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Verify GraphQL schema change',
                steps: [
                  'Run schema validation',
                  'Check for breaking changes with graphql-inspector',
                  'Update client-side queries if needed',
                  'Regenerate types with codegen',
                ],
              },
            ],
          }),
        );
      }

      if (/@Resolver\s*\(|@Query\s*\(|@Mutation\s*\(|@Subscription\s*\(/.test(line)) {
        const resolverType = line.match(/@(Resolver|Query|Mutation|Subscription)/)?.[1];
        signals.push(
          this.createSignal({
            id: `graphql-${resolverType?.toLowerCase()}`,
            title: `GraphQL ${resolverType}`,
            category: 'signature',
            reason: `GraphQL ${resolverType} - verify input validation and authorization`,
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['graphql', 'resolver', resolverType?.toLowerCase() || 'resolver'],
            evidence: { kind: 'regex', pattern: `@${resolverType}` },
          }),
        );
      }

      if (/new\s+ApolloServer\s*\(|ApolloServer\.start/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'graphql-apollo-server',
            title: 'Apollo Server Configuration',
            category: 'signature',
            reason: 'Apollo Server configuration - verify plugins and security settings',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum, lineNum + 10),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['graphql', 'apollo', 'server'],
            evidence: { kind: 'regex', pattern: 'ApolloServer' },
          }),
        );
      }

      if (/new\s+DataLoader\s*\(|DataLoader/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'graphql-dataloader',
            title: 'DataLoader Usage',
            category: 'async',
            reason: 'DataLoader for batching - verify cache behavior and key function',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['graphql', 'dataloader', 'performance'],
            evidence: { kind: 'regex', pattern: 'DataLoader' },
          }),
        );
      }

      if (/context\s*:\s*(?:async\s*)?\(?\s*\{\s*req/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'graphql-context',
            title: 'GraphQL Context',
            category: 'side-effect',
            reason: 'Context creation - verify authentication and per-request data',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['graphql', 'context', 'auth'],
            evidence: { kind: 'regex', pattern: 'context' },
          }),
        );
      }

      if (/@ResolveField\s*\(|@FieldResolver\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'graphql-field-resolver',
            title: 'Field Resolver',
            category: 'async',
            reason: 'Field resolver - may cause N+1 queries, consider DataLoader',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['graphql', 'resolver', 'field', 'performance'],
            evidence: { kind: 'regex', pattern: '@ResolveField|@FieldResolver' },
          }),
        );
      }

      if (/@Directive\s*\(|directive\s+@\w+/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'graphql-directive',
            title: 'GraphQL Directive',
            category: 'signature',
            reason: 'Custom directive - verify behavior and performance impact',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['graphql', 'directive'],
            evidence: { kind: 'regex', pattern: 'directive' },
          }),
        );
      }

      if (/depthLimit|queryComplexity|costAnalysis/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'graphql-security',
            title: 'GraphQL Security Config',
            category: 'side-effect',
            reason: 'Query security settings - verify limits are appropriate',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['graphql', 'security', 'limits'],
            evidence: { kind: 'regex', pattern: 'depthLimit|queryComplexity' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect realtime patterns (WebSocket, SSE, Socket.io)
   */
  private detectRealtimePatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/new\s+WebSocket\.Server|new\s+WebSocketServer|wss\.on/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'realtime-websocket-server',
            title: 'WebSocket Server',
            category: 'async',
            reason: 'WebSocket server - verify connection limits and authentication',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['realtime', 'websocket', 'server'],
            evidence: { kind: 'regex', pattern: 'WebSocket.Server' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'WebSocket server best practices',
                steps: [
                  'Implement connection authentication',
                  'Add connection rate limiting',
                  'Handle disconnections gracefully',
                  'Implement heartbeat/ping-pong',
                  'Add backpressure handling',
                ],
              },
            ],
          }),
        );
      }

      if (/new\s+Server\s*\(.*socket|io\.on\s*\(\s*['"]connection['"]/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'realtime-socketio',
            title: 'Socket.io Server',
            category: 'async',
            reason: 'Socket.io server - verify rooms, namespaces, and auth',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['realtime', 'socket.io', 'server'],
            evidence: { kind: 'regex', pattern: 'socket.io' },
          }),
        );
      }

      if (/socket\.on\s*\(\s*['"]/.test(line)) {
        const event = line.match(/socket\.on\s*\(\s*['"]([^'"]+)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: 'realtime-socket-event',
            title: `Socket Event: ${event || 'event'}`,
            category: 'async',
            reason: 'Socket event handler - validate payload and handle errors',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['realtime', 'socket', 'event', event || 'handler'],
            evidence: { kind: 'regex', pattern: 'socket.on', details: { event } },
          }),
        );
      }

      if (/socket\.emit\s*\(|io\.emit\s*\(|socket\.broadcast/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'realtime-socket-emit',
            title: 'Socket Emit',
            category: 'side-effect',
            reason: 'Broadcasting message - verify room targeting and payload size',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['realtime', 'socket', 'emit'],
            evidence: { kind: 'regex', pattern: 'emit|broadcast' },
          }),
        );
      }

      if (/res\.write\s*\(\s*['"]data:/.test(line) || /text\/event-stream/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'realtime-sse',
            title: 'Server-Sent Events',
            category: 'async',
            reason: 'SSE endpoint - verify connection cleanup and event format',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['realtime', 'sse', 'streaming'],
            evidence: { kind: 'regex', pattern: 'event-stream|data:' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'SSE best practices',
                steps: [
                  'Set correct Content-Type: text/event-stream',
                  'Handle client disconnection',
                  'Implement keep-alive messages',
                  'Add connection timeout',
                ],
              },
            ],
          }),
        );
      }

      if (/PubSub|pubsub\.(publish|subscribe|asyncIterator)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'realtime-pubsub',
            title: 'PubSub Pattern',
            category: 'async',
            reason: 'PubSub messaging - verify subscription cleanup',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['realtime', 'pubsub', 'messaging'],
            evidence: { kind: 'regex', pattern: 'PubSub' },
          }),
        );
      }

      if (/\.on\s*\(\s*['"][^'"]+['"]\s*,/.test(line) && !/removeListener|off\s*\(/.test(content)) {
        const hasCleanup = /removeListener|removeAllListeners|off\s*\(/.test(content);
        if (!hasCleanup) {
          signals.push(
            this.createSignal({
              id: 'realtime-event-leak',
              title: 'Potential Event Listener Leak',
              category: 'side-effect',
              reason: 'Event listener without cleanup - may cause memory leak',
              weight: 0.5,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['realtime', 'events', 'memory-leak'],
              evidence: { kind: 'regex', pattern: '\\.on\\(' },
            }),
          );
        }
      }

      if (/rateLimit|throttle|debounce/.test(line) && /socket|ws|websocket/i.test(content)) {
        signals.push(
          this.createSignal({
            id: 'realtime-rate-limit',
            title: 'Realtime Rate Limiting',
            category: 'side-effect',
            reason: 'Rate limiting for realtime - verify limits per connection',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['realtime', 'rate-limit', 'security'],
            evidence: { kind: 'regex', pattern: 'rateLimit|throttle' },
          }),
        );
      }

      if (/drain|backpressure|highWaterMark/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'realtime-backpressure',
            title: 'Backpressure Handling',
            category: 'async',
            reason: 'Backpressure handling - critical for high-throughput streams',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['realtime', 'streams', 'backpressure'],
            evidence: { kind: 'regex', pattern: 'drain|backpressure' },
          }),
        );
      }
    }

    return signals;
  }
}

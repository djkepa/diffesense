import { SignalCategory, SignalClass, Confidence } from '../signals/types';

export interface PatternDef {
  id: string;
  name: string;
  description: string;
  match: RegExp;
  category: SignalCategory;
  weight: number;
  signalClass?: SignalClass;
  confidence?: Confidence;
  framework?: 'react' | 'vue' | 'angular' | 'node' | 'generic';
  tags?: string[];
  enabled?: boolean;
}

export const DEFAULT_PATTERNS: PatternDef[] = [
  {
    id: 'auth-boundary',
    name: 'Authentication Boundary',
    description: 'Authentication/authorization logic - verify security implications',
    match:
      /\b(authenticate|authorize|login|logout|signIn|signOut|verifyToken|validateToken|checkAuth|requireAuth)\b/i,
    category: 'core-impact',
    weight: 0.9,
    signalClass: 'critical',
    confidence: 'high',
    tags: ['security', 'auth'],
  },
  {
    id: 'payment-logic',
    name: 'Payment Logic',
    description: 'Payment processing code - requires careful review',
    match: /\b(payment|charge|refund|subscription|billing|stripe|paypal)\b/i,
    category: 'core-impact',
    weight: 0.9,
    signalClass: 'critical',
    confidence: 'high',
    tags: ['payments', 'financial'],
  },
  {
    id: 'security-sensitive',
    name: 'Security Sensitive',
    description: 'Security-sensitive operations - verify encryption/hashing',
    match:
      /\b(encrypt|decrypt|hash|salt|secret|apiKey|API_KEY|privateKey|createHash|createCipher)\b/,
    category: 'core-impact',
    weight: 0.8,
    signalClass: 'critical',
    confidence: 'high',
    tags: ['security', 'crypto'],
  },
  {
    id: 'permission-check',
    name: 'Permission Check',
    description: 'Permission/role checking - verify authorization logic',
    match: /\b(hasPermission|checkRole|isAdmin|canAccess|authorize)\b/,
    category: 'core-impact',
    weight: 0.8,
    signalClass: 'critical',
    confidence: 'high',
    tags: ['security', 'permissions'],
  },
  {
    id: 'session-management',
    name: 'Session Management',
    description: 'Session handling - verify security and expiration',
    match: /\b(session|cookie|jwt|token|bearer)\b.*\b(create|destroy|expire|refresh|validate)\b/i,
    category: 'core-impact',
    weight: 0.7,
    signalClass: 'critical',
    confidence: 'medium',
    tags: ['security', 'session'],
  },

  {
    id: 'conditional-logic',
    name: 'Complex Conditional',
    description: 'Complex conditional statement - verify all branches are tested',
    match: /if\s*\([^)]{50,}\)/,
    category: 'complexity',
    weight: 0.4,
    signalClass: 'behavioral',
    confidence: 'medium',
    tags: ['logic'],
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    description: 'Error handling pattern - verify proper error propagation',
    match: /\b(catch\s*\(|throw\s+new|Error\(|reject\()/,
    category: 'async',
    weight: 0.4,
    signalClass: 'behavioral',
    confidence: 'high',
    tags: ['errors'],
  },
  {
    id: 'async-await',
    name: 'Async Function',
    description: 'Async function - verify error handling and race conditions',
    match: /\basync\s+(function|[(\w])/,
    category: 'async',
    weight: 0.3,
    signalClass: 'behavioral',
    confidence: 'high',
    tags: ['async'],
  },
  {
    id: 'promise-chain',
    name: 'Promise Chain',
    description: 'Promise chaining - consider async/await for readability',
    match: /\.then\s*\([^)]*\)\s*\.then/,
    category: 'async',
    weight: 0.4,
    signalClass: 'behavioral',
    confidence: 'high',
    tags: ['async', 'promises'],
  },
  {
    id: 'network-fetch',
    name: 'Network Fetch',
    description: 'Network fetch call - verify error handling and loading states',
    match: /\bfetch\s*\(/,
    category: 'side-effect',
    weight: 0.5,
    signalClass: 'behavioral',
    confidence: 'high',
    tags: ['network', 'io'],
  },
  {
    id: 'network-axios',
    name: 'Axios Call',
    description: 'Axios HTTP call - verify error handling and timeouts',
    match: /\baxios\s*[.(]/,
    category: 'side-effect',
    weight: 0.5,
    signalClass: 'behavioral',
    confidence: 'high',
    tags: ['network', 'io'],
  },
  {
    id: 'database-query',
    name: 'Database Query',
    description: 'Database operation - verify SQL injection prevention',
    match: /\.(query|execute|findOne|findMany|create|update|delete)\s*\(/,
    category: 'side-effect',
    weight: 0.5,
    signalClass: 'behavioral',
    confidence: 'medium',
    tags: ['database', 'io'],
  },
  {
    id: 'sql-statement',
    name: 'SQL Statement',
    description: 'Raw SQL statement - verify parameterized queries',
    match: /(SELECT|INSERT|UPDATE|DELETE)\s+/i,
    category: 'side-effect',
    weight: 0.6,
    signalClass: 'behavioral',
    confidence: 'high',
    tags: ['database', 'sql', 'security'],
  },
  {
    id: 'state-mutation',
    name: 'State Mutation',
    description: 'State mutation - verify immutability patterns',
    match: /(this\.state\s*=|setState\s*\()/,
    category: 'side-effect',
    weight: 0.4,
    signalClass: 'behavioral',
    confidence: 'high',
    tags: ['state'],
  },
  {
    id: 'global-mutation',
    name: 'Global Mutation',
    description: 'Global variable mutation - verify scope and side effects',
    match: /(window\.|global\.|globalThis\.)\w+\s*=/,
    category: 'side-effect',
    weight: 0.6,
    signalClass: 'behavioral',
    confidence: 'high',
    tags: ['global', 'mutation'],
  },
  {
    id: 'timer-interval',
    name: 'Timer/Interval',
    description: 'Timer or interval - verify cleanup to prevent memory leaks',
    match: /\b(setTimeout|setInterval)\s*\(/,
    category: 'side-effect',
    weight: 0.4,
    signalClass: 'behavioral',
    confidence: 'high',
    tags: ['timer', 'memory'],
  },

  {
    id: 'deep-nesting',
    name: 'Deep Nesting',
    description: 'Deeply nested code - consider extracting functions',
    match: /^\s{10,}\S/,
    category: 'complexity',
    weight: 0.3,
    signalClass: 'maintainability',
    confidence: 'high',
    tags: ['style', 'complexity'],
  },
  {
    id: 'console-log',
    name: 'Console Log',
    description: 'Console output - remove before production',
    match: /console\.(log|warn|error|info|debug)\s*\(/,
    category: 'side-effect',
    weight: 0.1,
    signalClass: 'maintainability',
    confidence: 'high',
    tags: ['logging'],
  },
  {
    id: 'todo-comment',
    name: 'TODO Comment',
    description: 'TODO/FIXME comment - address before merge',
    match: /\/\/\s*(TODO|FIXME|HACK|XXX):/i,
    category: 'complexity',
    weight: 0.1,
    signalClass: 'maintainability',
    confidence: 'high',
    tags: ['comments'],
  },
  {
    id: 'magic-number',
    name: 'Magic Number',
    description: 'Magic number - consider using named constant',
    match: /(?<!\w)\d{4,}(?!\w)/,
    category: 'complexity',
    weight: 0.2,
    signalClass: 'maintainability',
    confidence: 'medium',
    tags: ['style'],
  },
  {
    id: 'any-type',
    name: 'Any Type',
    description: 'TypeScript any type - consider proper typing',
    match: /:\s*any\b/,
    category: 'complexity',
    weight: 0.2,
    signalClass: 'maintainability',
    confidence: 'high',
    tags: ['typescript', 'types'],
  },

  {
    id: 'react-effect-no-deps',
    name: 'useEffect Without Deps',
    description: 'useEffect without dependency array - runs on every render',
    match: /useEffect\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/,
    category: 'async',
    weight: 0.8,
    signalClass: 'behavioral',
    confidence: 'medium',
    framework: 'react',
    tags: ['react', 'hooks'],
  },
  {
    id: 'react-inline-handler',
    name: 'Inline Handler',
    description: 'Inline function in JSX - causes re-renders',
    match: /on\w+=\{\s*\([^)]*\)\s*=>/,
    category: 'side-effect',
    weight: 0.3,
    signalClass: 'maintainability',
    confidence: 'high',
    framework: 'react',
    tags: ['react', 'performance'],
  },
  {
    id: 'react-dangerous-html',
    name: 'dangerouslySetInnerHTML',
    description: 'dangerouslySetInnerHTML - XSS vulnerability risk',
    match: /dangerouslySetInnerHTML/,
    category: 'side-effect',
    weight: 0.7,
    signalClass: 'critical',
    confidence: 'high',
    framework: 'react',
    tags: ['react', 'security'],
  },
  {
    id: 'react-direct-dom',
    name: 'Direct DOM in React',
    description: 'Direct DOM manipulation in React - use refs instead',
    match: /document\.(getElementById|querySelector|createElement)/,
    category: 'side-effect',
    weight: 0.5,
    signalClass: 'behavioral',
    confidence: 'high',
    framework: 'react',
    tags: ['react', 'dom'],
  },

  {
    id: 'vue-props-mutation',
    name: 'Vue Props Mutation',
    description: 'Direct props mutation - emit event instead',
    match: /(this\.\$props\.\w+|props\.\w+)\s*=/,
    category: 'side-effect',
    weight: 0.8,
    signalClass: 'behavioral',
    confidence: 'high',
    framework: 'vue',
    tags: ['vue', 'props'],
  },
  {
    id: 'vue-force-update',
    name: 'Vue Force Update',
    description: '$forceUpdate is an anti-pattern - use reactive data',
    match: /\$forceUpdate\s*\(/,
    category: 'side-effect',
    weight: 0.7,
    signalClass: 'behavioral',
    confidence: 'high',
    framework: 'vue',
    tags: ['vue', 'reactivity'],
  },

  {
    id: 'angular-subscribe-no-unsubscribe',
    name: 'Angular Subscribe Leak',
    description: 'Subscribe without unsubscribe - memory leak risk',
    match: /\.subscribe\s*\(/,
    category: 'async',
    weight: 0.6,
    signalClass: 'behavioral',
    confidence: 'medium',
    framework: 'angular',
    tags: ['angular', 'rxjs', 'memory'],
  },
  {
    id: 'angular-nested-subscribe',
    name: 'Angular Nested Subscribe',
    description: 'Nested subscribe - use switchMap/mergeMap instead',
    match: /\.subscribe\s*\([^)]*\.subscribe/,
    category: 'async',
    weight: 0.7,
    signalClass: 'behavioral',
    confidence: 'high',
    framework: 'angular',
    tags: ['angular', 'rxjs'],
  },

  {
    id: 'node-sync-op',
    name: 'Sync Operation',
    description: 'Synchronous blocking operation - consider async alternative',
    match: /(readFileSync|writeFileSync|execSync|spawnSync|existsSync)/,
    category: 'side-effect',
    weight: 0.5,
    signalClass: 'behavioral',
    confidence: 'high',
    framework: 'node',
    tags: ['node', 'blocking'],
  },
  {
    id: 'node-process-exit',
    name: 'Process Exit',
    description: 'process.exit call - verify this is intentional',
    match: /process\.exit\s*\(/,
    category: 'side-effect',
    weight: 0.7,
    signalClass: 'behavioral',
    confidence: 'high',
    framework: 'node',
    tags: ['node', 'process'],
  },
  {
    id: 'node-child-process',
    name: 'Child Process',
    description: 'Child process spawn - verify security and cleanup',
    match: /\b(spawn|exec|fork|execFile)\s*\(/,
    category: 'side-effect',
    weight: 0.6,
    signalClass: 'behavioral',
    confidence: 'high',
    framework: 'node',
    tags: ['node', 'process'],
  },
  {
    id: 'node-eval',
    name: 'Eval Usage',
    description: 'eval or Function constructor - security risk',
    match: /\b(eval\s*\(|new\s+Function\s*\()/,
    category: 'side-effect',
    weight: 0.9,
    signalClass: 'critical',
    confidence: 'high',
    framework: 'node',
    tags: ['node', 'security'],
  },
];

/**
 * Pattern Registry
 */
export class PatternRegistry {
  private patterns: Map<string, PatternDef> = new Map();
  private patternsByCategory: Map<SignalCategory, PatternDef[]> = new Map();
  private patternsByFramework: Map<string, PatternDef[]> = new Map();

  constructor(customPatterns?: PatternDef[]) {
    for (const pattern of DEFAULT_PATTERNS) {
      this.register({ ...pattern, enabled: pattern.enabled !== false });
    }

    if (customPatterns) {
      for (const pattern of customPatterns) {
        this.register({ ...pattern, enabled: pattern.enabled !== false });
      }
    }
  }

  /**
   * Register a pattern
   */
  register(pattern: PatternDef): void {
    this.patterns.set(pattern.id, pattern);

    if (!this.patternsByCategory.has(pattern.category)) {
      this.patternsByCategory.set(pattern.category, []);
    }
    const categoryPatterns = this.patternsByCategory.get(pattern.category)!;
    const existingCatIdx = categoryPatterns.findIndex((p) => p.id === pattern.id);
    if (existingCatIdx >= 0) {
      categoryPatterns[existingCatIdx] = pattern;
    } else {
      categoryPatterns.push(pattern);
    }

    const framework = pattern.framework || 'generic';
    if (!this.patternsByFramework.has(framework)) {
      this.patternsByFramework.set(framework, []);
    }
    const frameworkPatterns = this.patternsByFramework.get(framework)!;
    const existingFwIdx = frameworkPatterns.findIndex((p) => p.id === pattern.id);
    if (existingFwIdx >= 0) {
      frameworkPatterns[existingFwIdx] = pattern;
    } else {
      frameworkPatterns.push(pattern);
    }
  }

  /**
   * Get pattern by ID
   */
  get(id: string): PatternDef | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all patterns
   */
  getAll(): PatternDef[] {
    return Array.from(this.patterns.values()).filter((p) => p.enabled !== false);
  }

  /**
   * Get patterns by category
   */
  getByCategory(category: SignalCategory): PatternDef[] {
    return (this.patternsByCategory.get(category) || []).filter((p) => p.enabled !== false);
  }

  /**
   * Get patterns by framework (includes generic patterns)
   */
  getByFramework(framework: string): PatternDef[] {
    const generic = (this.patternsByFramework.get('generic') || []).filter(
      (p) => p.enabled !== false,
    );
    const specific = (this.patternsByFramework.get(framework) || []).filter(
      (p) => p.enabled !== false,
    );
    return [...generic, ...specific];
  }

  /**
   * Enable/disable a pattern
   */
  setEnabled(id: string, enabled: boolean): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.enabled = enabled;
    }
  }

  /**
   * Get pattern count
   */
  get size(): number {
    return this.patterns.size;
  }
}

let globalRegistry: PatternRegistry | null = null;

export function getPatternRegistry(): PatternRegistry {
  if (!globalRegistry) {
    globalRegistry = new PatternRegistry();
  }
  return globalRegistry;
}

export function initPatternRegistry(customPatterns?: PatternDef[]): PatternRegistry {
  globalRegistry = new PatternRegistry(customPatterns);
  return globalRegistry;
}

export function resetPatternRegistry(): void {
  globalRegistry = null;
}

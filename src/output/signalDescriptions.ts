/**
 * Human-readable signal descriptions for enterprise-grade output
 *
 * Each signal has:
 * - title: Short, clear name (1 line)
 * - summary: What it means in plain English
 * - impact: What could go wrong
 * - recommendation: What to do about it
 * - category: behavioral | style | security
 */

export interface SignalDescription {
  title: string;
  summary: string;
  impact: string;
  recommendation: string;
  category: 'security' | 'behavioral' | 'style';
}

/**
 * Signal ID -> Human-readable description mapping
 */
export const signalDescriptions: Record<string, SignalDescription> = {
  // === CRITICAL / SECURITY ===
  'process-child': {
    title: 'Spawns child processes',
    summary: 'Code executes external commands or scripts',
    impact: 'Security risk: shell injection, privilege escalation',
    recommendation: 'Validate all inputs, use allowlists for commands',
    category: 'security',
  },
  'process-exit': {
    title: 'Terminates process',
    summary: 'Code calls process.exit() to terminate Node.js',
    impact: 'Abrupt termination may skip cleanup logic',
    recommendation: 'Ensure graceful shutdown, cleanup handlers run',
    category: 'security',
  },
  'node-auth-middleware': {
    title: 'Auth middleware change',
    summary: 'Authentication or authorization logic modified',
    impact: 'Security breach: unauthorized access possible',
    recommendation: 'Security review required, test all auth paths',
    category: 'security',
  },
  'dom-innerhtml': {
    title: 'Unsafe HTML injection',
    summary: 'Code sets innerHTML which can execute scripts',
    impact: 'XSS vulnerability: attackers can inject malicious scripts',
    recommendation: 'Use textContent or sanitize HTML input',
    category: 'security',
  },
  'database-query': {
    title: 'Raw database query',
    summary: 'Direct SQL/query execution detected',
    impact: 'SQL injection risk if inputs not sanitized',
    recommendation: 'Use parameterized queries, never interpolate user input',
    category: 'security',
  },
  'node-database-query': {
    title: 'Database query',
    summary: 'SQL or database operation executed',
    impact: 'Data integrity risk, potential SQL injection',
    recommendation: 'Use parameterized queries, wrap in transactions',
    category: 'behavioral',
  },

  // === BEHAVIORAL / ASYNC ===
  'async-await': {
    title: 'Async functions modified',
    summary: 'Asynchronous code paths changed',
    impact: 'Unhandled rejections, race conditions possible',
    recommendation: 'Add try/catch, verify error handling',
    category: 'behavioral',
  },
  'promise-pattern': {
    title: 'Promise handling',
    summary: 'Promise chains or Promise.all/race used',
    impact: 'Unhandled errors, race conditions',
    recommendation: 'Add .catch() handlers, handle edge cases',
    category: 'behavioral',
  },
  'event-handler': {
    title: 'Event listener',
    summary: 'Event handlers added or modified',
    impact: 'Memory leaks if not cleaned up',
    recommendation: 'Remove listeners on component unmount/destroy',
    category: 'behavioral',
  },
  'network-fetch': {
    title: 'Network request (fetch)',
    summary: 'HTTP request via fetch API',
    impact: 'Network failures, loading states, CORS issues',
    recommendation: 'Add error handling, loading states, timeouts',
    category: 'behavioral',
  },
  'network-axios': {
    title: 'Network request (axios)',
    summary: 'HTTP request via axios library',
    impact: 'Network failures, timeout handling needed',
    recommendation: 'Configure timeouts, handle errors gracefully',
    category: 'behavioral',
  },
  'network-websocket': {
    title: 'WebSocket connection',
    summary: 'Real-time WebSocket communication',
    impact: 'Connection drops, reconnection logic needed',
    recommendation: 'Implement reconnection, handle disconnects',
    category: 'behavioral',
  },
  'timer-timeout': {
    title: 'setTimeout usage',
    summary: 'Delayed execution scheduled',
    impact: 'Memory leak if not cleared on unmount',
    recommendation: 'Clear timeout in cleanup/unmount',
    category: 'behavioral',
  },
  'timer-interval': {
    title: 'setInterval usage',
    summary: 'Recurring execution scheduled',
    impact: 'Memory leak, multiple intervals stacking',
    recommendation: 'Always clearInterval on unmount',
    category: 'behavioral',
  },

  // === FILE SYSTEM ===
  'fs-sync': {
    title: 'Sync file I/O',
    summary: 'Synchronous file operations block event loop',
    impact: 'Server hangs during I/O, poor performance',
    recommendation: 'Use async fs/promises API instead',
    category: 'behavioral',
  },
  'fs-operation': {
    title: 'File system access',
    summary: 'Reading or writing files',
    impact: 'I/O errors, permission issues possible',
    recommendation: 'Add error handling, check permissions',
    category: 'behavioral',
  },
  'node-sync-op': {
    title: 'Blocking I/O operation',
    summary: 'Synchronous operation blocks Node.js event loop',
    impact: 'Server unresponsive during operation',
    recommendation: 'Replace with async version (remove "Sync" suffix)',
    category: 'behavioral',
  },
  'node-stream': {
    title: 'Stream operations',
    summary: 'Streaming data with pipes',
    impact: 'Backpressure issues, memory problems',
    recommendation: 'Handle error events, respect backpressure',
    category: 'behavioral',
  },

  // === EXPORTS / API ===
  'export-change': {
    title: 'Export signature changed',
    summary: 'Public API of this module was modified',
    impact: 'Breaking change: dependent modules may fail',
    recommendation: 'Check all imports, consider semver bump',
    category: 'behavioral',
  },
  'type-export-change': {
    title: 'Type export changed',
    summary: 'TypeScript types/interfaces were modified',
    impact: 'Type errors in dependent code',
    recommendation: 'Run tsc, update dependent modules',
    category: 'behavioral',
  },

  // === ENVIRONMENT / CONFIG ===
  'process-env': {
    title: 'Environment variable access',
    summary: 'Reading from process.env',
    impact: 'Missing env vars cause runtime errors',
    recommendation: 'Validate env vars at startup, provide defaults',
    category: 'behavioral',
  },
  'node-env-heavy': {
    title: 'Heavy env var usage',
    summary: 'Many environment variable accesses',
    impact: 'Hard to track config, deployment issues',
    recommendation: 'Centralize config in one module',
    category: 'style',
  },

  // === STORAGE ===
  'storage-local': {
    title: 'LocalStorage access',
    summary: 'Browser localStorage read/write',
    impact: 'Fails in SSR, private browsing may block',
    recommendation: 'Check availability, handle SSR gracefully',
    category: 'behavioral',
  },
  'storage-session': {
    title: 'SessionStorage access',
    summary: 'Browser sessionStorage read/write',
    impact: 'Fails in SSR, data lost on tab close',
    recommendation: 'Check availability, handle SSR gracefully',
    category: 'behavioral',
  },
  'storage-indexeddb': {
    title: 'IndexedDB access',
    summary: 'Client-side database operations',
    impact: 'Async complexity, storage limits',
    recommendation: 'Handle quota errors, use transactions',
    category: 'behavioral',
  },

  // === DOM / BROWSER ===
  'global-window': {
    title: 'Window object access',
    summary: 'Accessing browser window object',
    impact: 'Crashes in SSR/Node.js environment',
    recommendation: 'Guard with typeof window check',
    category: 'behavioral',
  },
  'global-mutation': {
    title: 'Global state mutation',
    summary: 'Modifying global object',
    impact: 'Hard to track state, testing difficulties',
    recommendation: 'Use module-level state or context instead',
    category: 'style',
  },
  'dom-manipulation': {
    title: 'Direct DOM manipulation',
    summary: 'Using document.querySelector, createElement, etc.',
    impact: 'Bypasses framework, may cause sync issues',
    recommendation: 'Use framework methods (refs, portals)',
    category: 'style',
  },

  // === DATABASE / ORM ===
  'database-orm': {
    title: 'ORM operation',
    summary: 'Database access via ORM (Prisma, TypeORM, etc.)',
    impact: 'N+1 queries, transaction issues',
    recommendation: 'Use eager loading, verify query efficiency',
    category: 'behavioral',
  },
  'node-orm': {
    title: 'ORM database call',
    summary: 'Database operation via ORM',
    impact: 'Performance: watch for N+1 queries',
    recommendation: 'Use include/eager loading where needed',
    category: 'behavioral',
  },
  'node-cache': {
    title: 'Cache operation',
    summary: 'Redis/cache read or write',
    impact: 'Stale data if TTL wrong, cache stampede',
    recommendation: 'Set appropriate TTL, handle cache misses',
    category: 'behavioral',
  },
  'node-queue': {
    title: 'Message queue operation',
    summary: 'Publishing or consuming queue messages',
    impact: 'Lost messages if not acknowledged properly',
    recommendation: 'Implement proper ack/nack, dead letter handling',
    category: 'behavioral',
  },

  // === SERVER / API ===
  'node-route': {
    title: 'API route handler',
    summary: 'HTTP endpoint handler modified',
    impact: 'API behavior change, potential breaking change',
    recommendation: 'Verify auth, validation, update API docs',
    category: 'behavioral',
  },
  'node-middleware': {
    title: 'Middleware registration',
    summary: 'Express/Koa middleware added or changed',
    impact: 'Affects all requests, order matters',
    recommendation: 'Verify middleware order, test thoroughly',
    category: 'behavioral',
  },

  // === NODE.JS SPECIFIC ===
  'node-worker': {
    title: 'Worker thread',
    summary: 'Using worker_threads for parallel processing',
    impact: 'Complex IPC, error handling across threads',
    recommendation: 'Handle worker errors, proper message passing',
    category: 'behavioral',
  },
  'node-cluster': {
    title: 'Cluster mode',
    summary: 'Multi-process cluster for scaling',
    impact: 'IPC complexity, shared state issues',
    recommendation: 'Verify worker management, use sticky sessions if needed',
    category: 'behavioral',
  },
  'node-process-uncaughtexception': {
    title: 'Uncaught exception handler',
    summary: 'Handling uncaught exceptions at process level',
    impact: 'Critical: affects error recovery behavior',
    recommendation: 'Log errors, consider graceful shutdown',
    category: 'security',
  },
  'node-process-unhandledrejection': {
    title: 'Unhandled rejection handler',
    summary: 'Handling unhandled promise rejections',
    impact: 'Critical: prevents silent failures',
    recommendation: 'Log rejections, fix root cause',
    category: 'security',
  },

  // === COMPLEXITY / MAINTAINABILITY ===
  'deep-nesting': {
    title: 'Deep nesting',
    summary: 'Code has many levels of indentation',
    impact: 'Hard to read, test, and maintain',
    recommendation: 'Extract functions, use early returns',
    category: 'style',
  },
  'long-function': {
    title: 'Long function',
    summary: 'Function exceeds recommended length',
    impact: 'Hard to understand, test, and modify',
    recommendation: 'Split into smaller, focused functions',
    category: 'style',
  },
  'large-file': {
    title: 'Large file',
    summary: 'File has many lines of code',
    impact: 'Hard to navigate, slow to load in editors',
    recommendation: 'Consider splitting into modules',
    category: 'style',
  },
  'high-params': {
    title: 'Many parameters',
    summary: 'Function has 5+ parameters',
    impact: 'Hard to call correctly, error-prone',
    recommendation: 'Use options object pattern instead',
    category: 'style',
  },
  'logging-console': {
    title: 'Console output',
    summary: 'console.log/warn/error statements',
    impact: 'Debug code in production, info leakage',
    recommendation: 'Remove or replace with proper logging',
    category: 'style',
  },

  // === REACT SPECIFIC ===
  'react-useeffect': {
    title: 'useEffect hook',
    summary: 'Side effect in React component',
    impact: 'Missing deps cause stale closures, memory leaks',
    recommendation: 'Include all deps, add cleanup function',
    category: 'behavioral',
  },
  'react-usestate': {
    title: 'useState hook',
    summary: 'Component state modified',
    impact: 'Re-renders, state sync issues',
    recommendation: 'Consider if state is needed, memoize if expensive',
    category: 'behavioral',
  },
  'react-usememo': {
    title: 'useMemo hook',
    summary: 'Memoized computation',
    impact: 'Stale values if deps wrong',
    recommendation: 'Verify dependency array is complete',
    category: 'behavioral',
  },
  'react-usecallback': {
    title: 'useCallback hook',
    summary: 'Memoized callback function',
    impact: 'Stale closures if deps wrong',
    recommendation: 'Verify dependency array is complete',
    category: 'behavioral',
  },
  'react-useref': {
    title: 'useRef hook',
    summary: 'Mutable ref or DOM reference',
    impact: 'Bypasses React rendering, can cause issues',
    recommendation: 'Use for DOM refs or stable values only',
    category: 'behavioral',
  },
  'react-context': {
    title: 'Context usage',
    summary: 'React Context provider or consumer',
    impact: 'Re-renders all consumers on change',
    recommendation: 'Split contexts, memoize provider value',
    category: 'behavioral',
  },

  // === VUE SPECIFIC ===
  'vue-reactive': {
    title: 'Vue reactive state',
    summary: 'Reactive state with ref() or reactive()',
    impact: 'Reactivity issues if used incorrectly',
    recommendation: 'Use .value for refs, avoid destructuring reactive',
    category: 'behavioral',
  },
  'vue-watch': {
    title: 'Vue watcher',
    summary: 'Watching reactive state changes',
    impact: 'Infinite loops, performance issues possible',
    recommendation: 'Use watchEffect for side effects, add stop condition',
    category: 'behavioral',
  },
  'vue-lifecycle': {
    title: 'Vue lifecycle hook',
    summary: 'Component lifecycle method called',
    impact: 'Timing issues, cleanup needed',
    recommendation: 'Add cleanup in onUnmounted, verify timing',
    category: 'behavioral',
  },

  // === ANGULAR SPECIFIC ===
  'angular-injectable': {
    title: 'Angular service',
    summary: 'Injectable service modified',
    impact: 'Affects all components using this service',
    recommendation: 'Verify DI scope, test all consumers',
    category: 'behavioral',
  },
  'angular-observable': {
    title: 'RxJS observable',
    summary: 'Observable stream modified',
    impact: 'Memory leaks if not unsubscribed',
    recommendation: 'Use async pipe or unsubscribe in ngOnDestroy',
    category: 'behavioral',
  },
  'angular-decorator': {
    title: 'Angular decorator',
    summary: 'Component/directive decorator changed',
    impact: 'Metadata affects component behavior',
    recommendation: 'Verify selector, inputs/outputs are correct',
    category: 'behavioral',
  },

  // === SVELTE / SVELTEKIT ===
  'svelte-reactive-statement': {
    title: 'Reactive statement',
    summary: 'Svelte $: reactive block that auto-runs on dependencies',
    impact: 'May trigger on unexpected changes',
    recommendation: 'Verify dependency tracking, avoid side effects in reactive blocks',
    category: 'behavioral',
  },
  'svelte-reactive-side-effect': {
    title: 'Reactive side effect',
    summary: 'Side effect inside Svelte reactive block',
    impact: 'May cause infinite loops or race conditions',
    recommendation: 'Move side effects to onMount or event handlers',
    category: 'behavioral',
  },
  'svelte-complex-reactive': {
    title: 'Complex reactive declaration',
    summary: 'Reactive expression with complex logic',
    impact: 'Hard to maintain and debug',
    recommendation: 'Extract to a function for clarity',
    category: 'style',
  },
  'svelte-bind': {
    title: 'Two-way binding',
    summary: 'Svelte bind: directive for two-way data flow',
    impact: 'Data can change from multiple sources',
    recommendation: 'Verify data flow and potential circular updates',
    category: 'behavioral',
  },
  'svelte-component-binding': {
    title: 'Component binding',
    summary: 'Special binding (bind:this, bind:group, bind:files)',
    impact: 'Lifecycle implications for DOM access',
    recommendation: 'Ensure component is mounted before accessing',
    category: 'behavioral',
  },
  'svelte-store-writable': {
    title: 'Writable store',
    summary: 'Svelte writable store for shared state',
    impact: 'State shared across components',
    recommendation: 'Verify subscription cleanup in components',
    category: 'behavioral',
  },
  'svelte-store-readable': {
    title: 'Readable store',
    summary: 'Svelte readable store for read-only shared state',
    impact: 'State derived from external source',
    recommendation: 'Verify cleanup function in store definition',
    category: 'behavioral',
  },
  'svelte-store-derived': {
    title: 'Derived store',
    summary: 'Svelte store derived from other stores',
    impact: 'Updates when source stores change',
    recommendation: 'Avoid complex derivation logic',
    category: 'behavioral',
  },
  'svelte-store-auto-subscription': {
    title: 'Auto-subscription',
    summary: 'Store accessed with $ prefix (auto-subscribed)',
    impact: 'Automatically subscribed and cleaned up',
    recommendation: 'Preferred over manual .subscribe()',
    category: 'behavioral',
  },
  'svelte-store-manual-subscription': {
    title: 'Manual subscription',
    summary: 'Manual store .subscribe() call',
    impact: 'Memory leak if not unsubscribed',
    recommendation: 'Call unsubscribe in onDestroy, prefer $ syntax',
    category: 'behavioral',
  },
  'svelte-store-update': {
    title: 'Store update',
    summary: 'Store .set() or .update() mutation',
    impact: 'Triggers all subscribers',
    recommendation: 'Consider performance with many subscribers',
    category: 'behavioral',
  },
  'svelte-lifecycle-onmount': {
    title: 'onMount hook',
    summary: 'Svelte lifecycle: runs after component mounts',
    impact: 'Good for browser APIs and fetch',
    recommendation: 'Return cleanup function for subscriptions',
    category: 'behavioral',
  },
  'svelte-lifecycle-beforeupdate': {
    title: 'beforeUpdate hook',
    summary: 'Svelte lifecycle: runs before DOM update',
    impact: 'Runs synchronously, can block rendering',
    recommendation: 'Avoid heavy operations',
    category: 'behavioral',
  },
  'svelte-lifecycle-afterupdate': {
    title: 'afterUpdate hook',
    summary: 'Svelte lifecycle: runs after DOM update',
    impact: 'Good for post-render effects',
    recommendation: 'Avoid triggering more updates',
    category: 'behavioral',
  },
  'svelte-lifecycle-ondestroy': {
    title: 'onDestroy hook',
    summary: 'Svelte lifecycle: cleanup on unmount',
    impact: 'Critical for cleanup',
    recommendation: 'Unsubscribe, clear timers, remove listeners',
    category: 'behavioral',
  },
  'svelte-lifecycle-tick': {
    title: 'tick function',
    summary: 'Svelte tick() waits for pending state changes',
    impact: 'Useful for DOM measurements after updates',
    recommendation: 'Use sparingly, prefer reactive statements',
    category: 'behavioral',
  },
  'sveltekit-load': {
    title: 'Load function',
    summary: 'SvelteKit load function for data fetching',
    impact: 'Runs on server and client navigation',
    recommendation: 'Handle errors with error(), use depends() for invalidation',
    category: 'behavioral',
  },
  'sveltekit-actions': {
    title: 'Form actions',
    summary: 'SvelteKit server-side form handlers',
    impact: 'Handles form submissions securely',
    recommendation: 'Validate all inputs, use fail() for errors',
    category: 'behavioral',
  },
  'sveltekit-api-endpoint': {
    title: 'API endpoint',
    summary: 'SvelteKit +server.ts endpoint',
    impact: 'Server-only HTTP endpoint',
    recommendation: 'Verify authentication and input validation',
    category: 'behavioral',
  },
  'sveltekit-hook': {
    title: 'Server hook',
    summary: 'SvelteKit hooks.server.ts handle function',
    impact: 'Runs on every request',
    recommendation: 'Keep lightweight, verify performance',
    category: 'behavioral',
  },
  'sveltekit-redirect': {
    title: 'Redirect',
    summary: 'SvelteKit redirect() helper',
    impact: 'Redirects user to different route',
    recommendation: 'Verify status code (301/302/307/308)',
    category: 'behavioral',
  },
  'sveltekit-error': {
    title: 'Error response',
    summary: 'SvelteKit error() helper for expected errors',
    impact: 'Shows error page to user',
    recommendation: 'Use for expected errors, throw for unexpected',
    category: 'behavioral',
  },
  'sveltekit-page-store': {
    title: 'Page store',
    summary: 'Accessing $page store for route data',
    impact: 'SSR compatible, auto-updates on navigation',
    recommendation: 'Verify data is available in current context',
    category: 'behavioral',
  },
  'sveltekit-navigation': {
    title: 'Programmatic navigation',
    summary: 'goto(), invalidate(), or invalidateAll()',
    impact: 'Triggers navigation or data reload',
    recommendation: 'Handle loading states and errors',
    category: 'behavioral',
  },

  // === SSR / ISOMORPHIC ===
  'ssr-browser-api': {
    title: 'Browser API in server',
    summary: 'window/document used in server context',
    impact: 'Crashes on server-side render',
    recommendation: 'Guard with typeof check or use client directive',
    category: 'security',
  },
  'ssr-hydration-date': {
    title: 'Date hydration mismatch',
    summary: 'Date() differs between server and client',
    impact: 'React/Vue hydration warning or mismatch',
    recommendation: 'Pass date from server or initialize in useEffect',
    category: 'behavioral',
  },
  'ssr-hydration-random': {
    title: 'Random hydration mismatch',
    summary: 'Math.random() differs between server and client',
    impact: 'Hydration mismatch warning',
    recommendation: 'Use seeded random or generate client-side only',
    category: 'behavioral',
  },
  'ssr-hydration-uuid': {
    title: 'UUID hydration mismatch',
    summary: 'UUID/nanoid differs between server and client',
    impact: 'Hydration mismatch',
    recommendation: 'Generate on server and pass as prop',
    category: 'behavioral',
  },
  'ssr-conditional-render': {
    title: 'Client-only conditional',
    summary: 'Rendering differs based on isClient/isBrowser',
    impact: 'May cause hydration issues',
    recommendation: 'Use Suspense or dynamic import with ssr:false',
    category: 'behavioral',
  },
  'ssr-env-leakage': {
    title: 'Sensitive env exposure',
    summary: 'Secret env var may leak to client bundle',
    impact: 'Security: secrets exposed in browser',
    recommendation: 'Use server-only imports, API routes for secrets',
    category: 'security',
  },

  // === NEXT.JS SPECIFIC ===
  'next-use-client-position': {
    title: 'use client position',
    summary: '"use client" not at top of file',
    impact: 'Directive may not work correctly',
    recommendation: 'Move "use client" to first line',
    category: 'behavioral',
  },
  'next-server-action': {
    title: 'Server action',
    summary: 'Next.js server action with "use server"',
    impact: 'Runs on server, accessible from client',
    recommendation: 'Validate inputs, check auth, handle errors',
    category: 'behavioral',
  },
  'next-generate-static-params': {
    title: 'Static params generation',
    summary: 'generateStaticParams for dynamic routes',
    impact: 'Affects build time and ISR',
    recommendation: 'Optimize for build performance',
    category: 'behavioral',
  },
  'next-metadata': {
    title: 'Metadata generation',
    summary: 'Page metadata for SEO',
    impact: 'Affects SEO and social sharing',
    recommendation: 'Verify title, description, og tags',
    category: 'behavioral',
  },
  'next-dynamic-no-ssr': {
    title: 'Client-only dynamic import',
    summary: 'Dynamic import with ssr: false',
    impact: 'Component loads only on client',
    recommendation: 'Add loading state for better UX',
    category: 'behavioral',
  },
  'next-route-config': {
    title: 'Route segment config',
    summary: 'Route config (dynamic, revalidate, etc.)',
    impact: 'Affects caching and runtime behavior',
    recommendation: 'Verify cache and revalidation settings',
    category: 'behavioral',
  },

  // === NUXT SPECIFIC ===
  'nuxt-data-fetching': {
    title: 'Nuxt data fetching',
    summary: 'useAsyncData or useFetch hook',
    impact: 'Data fetched on server and client',
    recommendation: 'Handle errors, ensure unique keys',
    category: 'behavioral',
  },
  'nuxt-use-state': {
    title: 'Nuxt useState',
    summary: 'Nuxt shared state across SSR boundary',
    impact: 'State serialized from server to client',
    recommendation: 'Keep state serializable',
    category: 'behavioral',
  },
  'nuxt-plugin': {
    title: 'Nuxt plugin',
    summary: 'Plugin runs on app initialization',
    impact: 'Runs on every request (SSR)',
    recommendation: 'Check SSR compatibility, optimize performance',
    category: 'behavioral',
  },
  'nuxt-middleware': {
    title: 'Nuxt route middleware',
    summary: 'Middleware runs before route navigation',
    impact: 'Can block or redirect navigation',
    recommendation: 'Keep lightweight, verify auth logic',
    category: 'behavioral',
  },
  'nuxt-server-handler': {
    title: 'Nuxt server handler',
    summary: 'Nitro server API handler',
    impact: 'Server-only endpoint',
    recommendation: 'Validate inputs, handle errors',
    category: 'behavioral',
  },
  'nuxt-client-check': {
    title: 'Nuxt client check',
    summary: 'process.client conditional',
    impact: 'Code runs only on client',
    recommendation: 'Verify both branches work correctly',
    category: 'behavioral',
  },
  'nuxt-server-check': {
    title: 'Nuxt server check',
    summary: 'process.server conditional',
    impact: 'Code runs only on server',
    recommendation: 'Verify both branches work correctly',
    category: 'behavioral',
  },

  // === ASTRO SPECIFIC ===
  'astro-glob': {
    title: 'Astro.glob import',
    summary: 'Glob import of multiple files',
    impact: 'All matched files included in bundle',
    recommendation: 'Verify glob pattern is not too broad',
    category: 'behavioral',
  },
  'astro-client-directive': {
    title: 'Client directive',
    summary: 'Component hydration strategy (client:load, etc.)',
    impact: 'Affects when JS loads for component',
    recommendation: 'Choose minimal hydration needed',
    category: 'behavioral',
  },
  'astro-content-collection': {
    title: 'Content collection',
    summary: 'getCollection or getEntry call',
    impact: 'Loads content from collections',
    recommendation: 'Verify type safety and filters',
    category: 'behavioral',
  },
  'astro-props': {
    title: 'Astro props',
    summary: 'Component props access',
    impact: 'Props passed to component',
    recommendation: 'Define Props interface for type safety',
    category: 'behavioral',
  },
  'astro-redirect': {
    title: 'Astro redirect',
    summary: 'Server-side redirect',
    impact: 'User redirected to different URL',
    recommendation: 'Verify destination and status code',
    category: 'behavioral',
  },
  'astro-rewrite': {
    title: 'Astro rewrite',
    summary: 'Server-side URL rewrite',
    impact: 'URL rewritten without redirect',
    recommendation: 'Verify rewrite logic',
    category: 'behavioral',
  },

  // === REACT NATIVE / EXPO ===
  'rn-native-module': {
    title: 'Native module',
    summary: 'Using platform-specific native code',
    impact: 'Requires native linking and setup',
    recommendation: 'Test on both iOS and Android',
    category: 'behavioral',
  },
  'rn-platform-check': {
    title: 'Platform check',
    summary: 'Platform.OS conditional code',
    impact: 'Different behavior per platform',
    recommendation: 'Test both platforms thoroughly',
    category: 'behavioral',
  },
  'rn-platform-select': {
    title: 'Platform.select',
    summary: 'Platform-specific values',
    impact: 'Different values per platform',
    recommendation: 'Verify values work on all platforms',
    category: 'behavioral',
  },
  'rn-dimensions': {
    title: 'Screen dimensions',
    summary: 'Dimensions.get() for screen size',
    impact: 'Value changes on rotation',
    recommendation: 'Use useWindowDimensions hook instead',
    category: 'behavioral',
  },
  'rn-use-dimensions': {
    title: 'useWindowDimensions',
    summary: 'Reactive screen dimensions hook',
    impact: 'Re-renders on dimension change',
    recommendation: 'Memoize dependent calculations',
    category: 'behavioral',
  },
  'rn-safe-area': {
    title: 'Safe area',
    summary: 'Safe area insets handling',
    impact: 'Handles notch and home indicator',
    recommendation: 'Verify on devices with notch',
    category: 'behavioral',
  },
  'rn-navigator': {
    title: 'Navigator',
    summary: 'React Navigation navigator setup',
    impact: 'Defines navigation structure',
    recommendation: 'Verify screen types and params',
    category: 'behavioral',
  },
  'rn-navigation-action': {
    title: 'Navigation action',
    summary: 'Programmatic navigation',
    impact: 'Changes current screen',
    recommendation: 'Verify params and screen exists',
    category: 'behavioral',
  },
  'rn-deep-linking': {
    title: 'Deep linking',
    summary: 'URL scheme handling',
    impact: 'Opens app from external URLs',
    recommendation: 'Test URL schemes on both platforms',
    category: 'behavioral',
  },
  'rn-inline-style': {
    title: 'Inline style',
    summary: 'Inline style object in render',
    impact: 'Creates new object every render',
    recommendation: 'Use StyleSheet.create for performance',
    category: 'style',
  },
  'rn-flatlist-no-key': {
    title: 'FlatList missing keyExtractor',
    summary: 'FlatList without keyExtractor',
    impact: 'Poor list performance and bugs',
    recommendation: 'Add keyExtractor with unique stable keys',
    category: 'behavioral',
  },
  'rn-nested-virtualized': {
    title: 'Nested virtualized list',
    summary: 'FlatList inside ScrollView',
    impact: 'Breaks virtualization, poor performance',
    recommendation: 'Use single FlatList with sections',
    category: 'behavioral',
  },
  'rn-animated': {
    title: 'Animated API',
    summary: 'React Native animation',
    impact: 'Animation performance depends on config',
    recommendation: 'Use useNativeDriver: true when possible',
    category: 'behavioral',
  },
  'rn-reanimated': {
    title: 'Reanimated animation',
    summary: 'Reanimated worklet-based animation',
    impact: 'Runs on UI thread for 60fps',
    recommendation: 'Verify worklet syntax is correct',
    category: 'behavioral',
  },
  'rn-gesture': {
    title: 'Gesture handler',
    summary: 'Touch gesture handling',
    impact: 'Complex interaction logic',
    recommendation: 'Test gesture conflicts and edge cases',
    category: 'behavioral',
  },
  'expo-camera': {
    title: 'Expo Camera',
    summary: 'Camera access via Expo',
    impact: 'Requires camera permission',
    recommendation: 'Handle permission request and denial',
    category: 'behavioral',
  },
  'expo-location': {
    title: 'Expo Location',
    summary: 'GPS location access',
    impact: 'Requires location permission',
    recommendation: 'Handle permission, battery impact',
    category: 'behavioral',
  },
  'expo-notifications': {
    title: 'Expo Notifications',
    summary: 'Push notification handling',
    impact: 'Requires notification permission',
    recommendation: 'Handle permission, test on device',
    category: 'behavioral',
  },
  'expo-router-navigation': {
    title: 'Expo Router navigation',
    summary: 'File-based routing navigation',
    impact: 'Navigates to route path',
    recommendation: 'Verify route paths exist',
    category: 'behavioral',
  },
  'expo-config': {
    title: 'Expo config',
    summary: 'app.json/app.config.js change',
    impact: 'Affects build and native code',
    recommendation: 'May require new build',
    category: 'behavioral',
  },
  'expo-eas': {
    title: 'EAS configuration',
    summary: 'EAS Build or Updates config',
    impact: 'Affects CI/CD and OTA updates',
    recommendation: 'Verify build profiles and channels',
    category: 'behavioral',
  },

  // === ELECTRON / TAURI ===
  'electron-ipc-main': {
    title: 'IPC main handler',
    summary: 'Main process IPC handler',
    impact: 'Receives messages from renderer',
    recommendation: 'Validate all inputs, never trust renderer',
    category: 'security',
  },
  'electron-ipc-renderer': {
    title: 'IPC renderer send',
    summary: 'Renderer sending to main process',
    impact: 'Cross-process communication',
    recommendation: 'Use invoke for responses',
    category: 'behavioral',
  },
  'electron-ipc-sync': {
    title: 'Sync IPC',
    summary: 'sendSync blocks renderer',
    impact: 'Freezes UI until response',
    recommendation: 'Use invoke for async IPC',
    category: 'behavioral',
  },
  'electron-context-bridge': {
    title: 'Context bridge',
    summary: 'API exposed to renderer via preload',
    impact: 'Security boundary for renderer access',
    recommendation: 'Expose minimal necessary API',
    category: 'security',
  },
  'electron-node-integration': {
    title: 'Node integration enabled',
    summary: 'nodeIntegration: true in webPreferences',
    impact: 'Critical security risk',
    recommendation: 'Disable, use preload with contextBridge',
    category: 'security',
  },
  'electron-context-isolation-disabled': {
    title: 'Context isolation disabled',
    summary: 'contextIsolation: false',
    impact: 'Renderer can access Node.js',
    recommendation: 'Enable context isolation',
    category: 'security',
  },
  'electron-web-security-disabled': {
    title: 'Web security disabled',
    summary: 'Same-origin policy disabled',
    impact: 'Critical security vulnerability',
    recommendation: 'Never disable in production',
    category: 'security',
  },
  'electron-remote-module': {
    title: 'Remote module',
    summary: 'Using @electron/remote',
    impact: 'Security risk, deprecated pattern',
    recommendation: 'Use IPC instead',
    category: 'security',
  },
  'electron-shell-open': {
    title: 'Shell openExternal',
    summary: 'Opening external URLs',
    impact: 'Could execute malicious URLs',
    recommendation: 'Validate URL scheme is http/https',
    category: 'security',
  },
  'electron-browser-window': {
    title: 'Browser window',
    summary: 'New BrowserWindow creation',
    impact: 'Window with own security context',
    recommendation: 'Verify webPreferences security',
    category: 'behavioral',
  },
  'electron-app-lifecycle': {
    title: 'App lifecycle',
    summary: 'App quit/exit/relaunch',
    impact: 'Terminates or restarts app',
    recommendation: 'Ensure data is saved',
    category: 'behavioral',
  },
  'electron-auto-updater': {
    title: 'Auto updater',
    summary: 'Automatic update mechanism',
    impact: 'Downloads and installs updates',
    recommendation: 'Verify update server security',
    category: 'security',
  },
  'tauri-command': {
    title: 'Tauri command',
    summary: 'Rust function exposed to frontend',
    impact: 'Backend function callable from JS',
    recommendation: 'Validate inputs, handle errors',
    category: 'behavioral',
  },
  'tauri-invoke': {
    title: 'Tauri invoke',
    summary: 'Calling Tauri command from frontend',
    impact: 'Async call to Rust backend',
    recommendation: 'Handle errors and loading states',
    category: 'behavioral',
  },
  'tauri-event-listen': {
    title: 'Tauri event listen',
    summary: 'Listening to Tauri events',
    impact: 'Subscribes to backend events',
    recommendation: 'Call unlisten on cleanup',
    category: 'behavioral',
  },
  'tauri-event-emit': {
    title: 'Tauri event emit',
    summary: 'Emitting Tauri events',
    impact: 'Sends event to listeners',
    recommendation: 'Verify listeners exist',
    category: 'behavioral',
  },
  'tauri-file-system': {
    title: 'Tauri file system',
    summary: 'File system access via Tauri',
    impact: 'Requires fs allowlist in config',
    recommendation: 'Use minimal required permissions',
    category: 'security',
  },
  'tauri-shell': {
    title: 'Tauri shell',
    summary: 'Shell command execution',
    impact: 'Executes system commands',
    recommendation: 'Validate inputs, use allowlist',
    category: 'security',
  },
  'tauri-http': {
    title: 'Tauri HTTP',
    summary: 'HTTP requests via Tauri',
    impact: 'Bypasses CORS restrictions',
    recommendation: 'Configure scope in tauri.conf.json',
    category: 'behavioral',
  },
  'tauri-updater': {
    title: 'Tauri updater',
    summary: 'App auto-update mechanism',
    impact: 'Downloads and installs updates',
    recommendation: 'Configure update endpoints securely',
    category: 'security',
  },
  'tauri-webview-window': {
    title: 'Tauri window',
    summary: 'New webview window creation',
    impact: 'Opens new window',
    recommendation: 'Verify window configuration',
    category: 'behavioral',
  },

  // === GRAPHQL ===
  'graphql-query-type': {
    title: 'GraphQL Query type',
    summary: 'Query root type definition',
    impact: 'Breaking change for clients',
    recommendation: 'Check schema compatibility',
    category: 'behavioral',
  },
  'graphql-mutation-type': {
    title: 'GraphQL Mutation type',
    summary: 'Mutation root type definition',
    impact: 'Breaking change for clients',
    recommendation: 'Check schema compatibility',
    category: 'behavioral',
  },
  'graphql-subscription-type': {
    title: 'GraphQL Subscription type',
    summary: 'Subscription root type definition',
    impact: 'Affects realtime clients',
    recommendation: 'Verify WebSocket handling',
    category: 'behavioral',
  },
  'graphql-resolver': {
    title: 'GraphQL resolver',
    summary: 'Resolver function for field',
    impact: 'Handles data fetching',
    recommendation: 'Verify auth and validation',
    category: 'behavioral',
  },
  'graphql-query': {
    title: 'GraphQL query resolver',
    summary: 'Query field resolver',
    impact: 'Read operation handler',
    recommendation: 'Verify authorization',
    category: 'behavioral',
  },
  'graphql-mutation': {
    title: 'GraphQL mutation resolver',
    summary: 'Mutation field resolver',
    impact: 'Write operation handler',
    recommendation: 'Validate inputs, verify auth',
    category: 'behavioral',
  },
  'graphql-subscription': {
    title: 'GraphQL subscription resolver',
    summary: 'Subscription field resolver',
    impact: 'Realtime data stream',
    recommendation: 'Handle connection lifecycle',
    category: 'behavioral',
  },
  'graphql-apollo-server': {
    title: 'Apollo Server config',
    summary: 'Apollo Server configuration',
    impact: 'Affects all GraphQL operations',
    recommendation: 'Verify plugins and security',
    category: 'behavioral',
  },
  'graphql-dataloader': {
    title: 'DataLoader',
    summary: 'Batching and caching utility',
    impact: 'Prevents N+1 queries',
    recommendation: 'Verify cache behavior per request',
    category: 'behavioral',
  },
  'graphql-context': {
    title: 'GraphQL context',
    summary: 'Per-request context creation',
    impact: 'Available to all resolvers',
    recommendation: 'Include auth and dataloaders',
    category: 'behavioral',
  },
  'graphql-field-resolver': {
    title: 'Field resolver',
    summary: 'Resolver for nested field',
    impact: 'May cause N+1 without DataLoader',
    recommendation: 'Use DataLoader for related data',
    category: 'behavioral',
  },
  'graphql-directive': {
    title: 'GraphQL directive',
    summary: 'Custom schema directive',
    impact: 'Modifies field/type behavior',
    recommendation: 'Document directive usage',
    category: 'behavioral',
  },
  'graphql-security': {
    title: 'GraphQL security',
    summary: 'Query depth/complexity limiting',
    impact: 'Protects against DoS',
    recommendation: 'Set appropriate limits',
    category: 'security',
  },

  // === REALTIME ===
  'realtime-websocket-server': {
    title: 'WebSocket server',
    summary: 'WebSocket server setup',
    impact: 'Handles persistent connections',
    recommendation: 'Implement auth, rate limiting, heartbeat',
    category: 'behavioral',
  },
  'realtime-socketio': {
    title: 'Socket.io server',
    summary: 'Socket.io real-time server',
    impact: 'Handles rooms and namespaces',
    recommendation: 'Verify auth and room logic',
    category: 'behavioral',
  },
  'realtime-socket-event': {
    title: 'Socket event handler',
    summary: 'Handler for socket event',
    impact: 'Processes client messages',
    recommendation: 'Validate payload, handle errors',
    category: 'behavioral',
  },
  'realtime-socket-emit': {
    title: 'Socket emit',
    summary: 'Broadcasting to sockets',
    impact: 'Sends data to clients',
    recommendation: 'Verify target rooms/clients',
    category: 'behavioral',
  },
  'realtime-sse': {
    title: 'Server-Sent Events',
    summary: 'SSE streaming endpoint',
    impact: 'One-way server to client stream',
    recommendation: 'Handle disconnection, add keep-alive',
    category: 'behavioral',
  },
  'realtime-pubsub': {
    title: 'PubSub',
    summary: 'Publish/Subscribe messaging',
    impact: 'Decoupled message passing',
    recommendation: 'Ensure subscription cleanup',
    category: 'behavioral',
  },
  'realtime-event-leak': {
    title: 'Event listener leak',
    summary: 'Event listener without cleanup',
    impact: 'Memory leak over time',
    recommendation: 'Remove listener on cleanup',
    category: 'behavioral',
  },
  'realtime-rate-limit': {
    title: 'Realtime rate limiting',
    summary: 'Rate limiting for connections',
    impact: 'Prevents abuse',
    recommendation: 'Set per-connection limits',
    category: 'security',
  },
  'realtime-backpressure': {
    title: 'Backpressure handling',
    summary: 'Stream backpressure management',
    impact: 'Prevents memory overflow',
    recommendation: 'Handle drain events',
    category: 'behavioral',
  },

  // === SECURITY (SEC-001 to SEC-024) ===
  'sec-eval': {
    title: 'Dynamic code execution',
    summary: 'eval() or new Function() executes arbitrary code',
    impact: 'Critical security: code injection possible',
    recommendation: 'Never use eval with untrusted input',
    category: 'security',
  },
  'sec-xss-sink': {
    title: 'XSS sink',
    summary: 'innerHTML or HTML injection detected',
    impact: 'Cross-site scripting vulnerability',
    recommendation: 'Use DOMPurify to sanitize, prefer textContent',
    category: 'security',
  },
  'sec-command-injection': {
    title: 'Command injection risk',
    summary: 'Shell command with dynamic input',
    impact: 'Attackers can execute arbitrary commands',
    recommendation: 'Validate inputs, use allowlist',
    category: 'security',
  },
  'sec-hardcoded-secret': {
    title: 'Hardcoded secret',
    summary: 'Credential or API key in source code',
    impact: 'Secrets exposed in repository',
    recommendation: 'Use environment variables or secrets manager',
    category: 'security',
  },
  'sec-sensitive-log': {
    title: 'Sensitive data logged',
    summary: 'Password/token/credential in log output',
    impact: 'Secrets exposed in logs',
    recommendation: 'Redact sensitive fields before logging',
    category: 'security',
  },
  'sec-weak-crypto': {
    title: 'Weak cryptography',
    summary: 'MD5 or SHA1 used for security',
    impact: 'These algorithms are cryptographically broken',
    recommendation: 'Use SHA256, bcrypt, or argon2',
    category: 'security',
  },
  'sec-cors-wildcard': {
    title: 'CORS wildcard origin',
    summary: 'Any origin allowed for requests',
    impact: 'May expose API to unauthorized sites',
    recommendation: 'Specify allowed origins explicitly',
    category: 'security',
  },
  'sec-sql-injection': {
    title: 'SQL injection risk',
    summary: 'Query built with string concatenation',
    impact: 'Database compromise, data theft',
    recommendation: 'Use parameterized queries',
    category: 'security',
  },
  'sec-prototype-pollution': {
    title: 'Prototype pollution risk',
    summary: 'Object.assign with untrusted input',
    impact: 'Can modify Object prototype',
    recommendation: 'Validate input structure, use Object.create(null)',
    category: 'security',
  },
  'sec-ssrf': {
    title: 'SSRF risk',
    summary: 'Fetching URL from user input',
    impact: 'Server-side request forgery',
    recommendation: 'Validate URLs against allowlist',
    category: 'security',
  },
  'sec-unsafe-deserialize': {
    title: 'Unsafe deserialization',
    summary: 'JSON.parse on untrusted input without try/catch',
    impact: 'App crashes on malformed input',
    recommendation: 'Wrap in try/catch, validate schema',
    category: 'security',
  },
  'sec-npm-script': {
    title: 'NPM lifecycle script',
    summary: 'postinstall/preinstall script changed',
    impact: 'Supply chain attack vector',
    recommendation: 'Review script contents carefully',
    category: 'security',
  },

  // === CORRECTNESS (COR-001 to COR-018) ===
  'cor-unhandled-promise': {
    title: 'Unhandled promise',
    summary: 'Promise without await or .then()',
    impact: 'Result is ignored, errors may be silent',
    recommendation: 'Add await or .then()/.catch()',
    category: 'behavioral',
  },
  'cor-swallowed-error': {
    title: 'Swallowed error',
    summary: 'Empty catch block hides errors',
    impact: 'Silent failures, hard to debug',
    recommendation: 'At minimum, log the error',
    category: 'behavioral',
  },
  'cor-any-type': {
    title: 'TypeScript any',
    summary: 'Using any type bypasses type checking',
    impact: 'Type errors not caught at compile time',
    recommendation: 'Use proper types or unknown',
    category: 'style',
  },
  'cor-race-condition': {
    title: 'Potential race condition',
    summary: 'Mutable variable in async context',
    impact: 'Non-deterministic behavior',
    recommendation: 'Use atomic operations or locks',
    category: 'behavioral',
  },
  'cor-interval-no-clear': {
    title: 'Interval without cleanup',
    summary: 'setInterval without clearInterval',
    impact: 'Memory leak, continues after unmount',
    recommendation: 'Store interval ID and clear on cleanup',
    category: 'behavioral',
  },
  'cor-infinite-loop': {
    title: 'Potential infinite loop',
    summary: 'Loop without visible exit condition',
    impact: 'App freezes or consumes all resources',
    recommendation: 'Add max iterations or timeout',
    category: 'behavioral',
  },
  'cor-complex-regex': {
    title: 'Complex regex',
    summary: 'Regex with backtracking risk',
    impact: 'ReDoS: regex can hang on crafted input',
    recommendation: 'Simplify or use regex timeout',
    category: 'behavioral',
  },

  // === MAINTAINABILITY (MAINT-001 to MAINT-016) ===
  'maint-todo-no-ticket': {
    title: 'TODO without ticket',
    summary: 'TODO/FIXME without issue reference',
    impact: 'May be forgotten or unclear ownership',
    recommendation: 'Add ticket number or remove if done',
    category: 'style',
  },
  'maint-commented-code': {
    title: 'Commented-out code',
    summary: 'Dead code left in comments',
    impact: 'Clutter, confusion, outdated code',
    recommendation: 'Remove or convert to actual code',
    category: 'style',
  },
  'maint-magic-numbers': {
    title: 'Magic numbers',
    summary: 'Unexplained numeric constants',
    impact: 'Hard to understand intent',
    recommendation: 'Extract to named constants',
    category: 'style',
  },
  'maint-duplicate-code': {
    title: 'Duplicate code',
    summary: 'Same code pattern repeated',
    impact: 'Maintenance burden, inconsistency risk',
    recommendation: 'Extract to shared function',
    category: 'style',
  },
  'maint-unused-export': {
    title: 'Potentially unused export',
    summary: 'Export not used in same file',
    impact: 'May be dead code if no external usage',
    recommendation: 'Verify external usage or remove',
    category: 'style',
  },
  'maint-vague-error': {
    title: 'Vague error message',
    summary: 'Error with minimal context',
    impact: 'Hard to debug issues in production',
    recommendation: 'Add more detail to error message',
    category: 'style',
  },
  'maint-test-disabled': {
    title: 'Disabled test',
    summary: 'Test marked with .skip or .only',
    impact: 'Test suite may be incomplete',
    recommendation: 'Enable test or remove if obsolete',
    category: 'behavioral',
  },

  // === REACT EXTENDED ===
  'react-stale-closure': {
    title: 'Stale closure risk',
    summary: 'Timer/callback may capture stale state',
    impact: 'Uses old values, not current state',
    recommendation: 'Use ref or add to dependency array',
    category: 'behavioral',
  },
  'react-set-state-unmounted': {
    title: 'setState after unmount risk',
    summary: 'Async setState without unmount check',
    impact: 'Memory leak warning in console',
    recommendation: 'Use AbortController or isMounted check',
    category: 'behavioral',
  },
  'react-index-key': {
    title: 'Index as key',
    summary: 'Using array index as React key',
    impact: 'Bugs with reordering/deletion',
    recommendation: 'Use unique stable ID as key',
    category: 'behavioral',
  },
  'react-derived-state': {
    title: 'Derived state from props',
    summary: 'useState initialized from props',
    impact: 'State won\'t update when props change',
    recommendation: 'Compute from props or use useEffect',
    category: 'behavioral',
  },
  'react-state-mutation': {
    title: 'Direct state mutation',
    summary: 'Mutating state array/object directly',
    impact: 'React won\'t detect change',
    recommendation: 'Use spread operator or immer',
    category: 'behavioral',
  },
  'react-set-state-render': {
    title: 'setState in render',
    summary: 'State update during render phase',
    impact: 'Infinite loop',
    recommendation: 'Move to useEffect or event handler',
    category: 'behavioral',
  },
  'react-context-value-inline': {
    title: 'Inline context value',
    summary: 'Context value object created inline',
    impact: 'All consumers re-render every time',
    recommendation: 'Memoize context value with useMemo',
    category: 'behavioral',
  },
  'react-boundary': {
    title: 'Error/Suspense boundary',
    summary: 'Error boundary or Suspense changed',
    impact: 'Affects error handling',
    recommendation: 'Verify fallback UI is correct',
    category: 'behavioral',
  },
  'react-listener-no-cleanup': {
    title: 'Event listener without cleanup',
    summary: 'addEventListener without removeEventListener',
    impact: 'Memory leak',
    recommendation: 'Return cleanup function from useEffect',
    category: 'behavioral',
  },
  'react-timer-no-cleanup': {
    title: 'Timer without cleanup',
    summary: 'setTimeout/setInterval without clear',
    impact: 'Continues running after unmount',
    recommendation: 'Clear timer in cleanup function',
    category: 'behavioral',
  },
  'react-unstable-prop': {
    title: 'Unstable prop reference',
    summary: 'New object/array created as prop',
    impact: 'Child component re-renders',
    recommendation: 'Memoize with useMemo or extract',
    category: 'behavioral',
  },
  'react-unmemoized-computation': {
    title: 'Unmemoized computation',
    summary: 'Array operation in render path',
    impact: 'Recalculates every render',
    recommendation: 'Wrap in useMemo if expensive',
    category: 'style',
  },
  'next-use-client-not-first': {
    title: '"use client" not at top',
    summary: 'Client directive not on first line',
    impact: 'Directive may not work',
    recommendation: 'Move to first line of file',
    category: 'behavioral',
  },
  'next-router-change': {
    title: 'Next.js router navigation',
    summary: 'Programmatic navigation in Next.js',
    impact: 'Affects routing behavior',
    recommendation: 'Verify route exists and params',
    category: 'behavioral',
  },
  'next-gss-props': {
    title: 'getServerSideProps',
    summary: 'Server-side data fetching',
    impact: 'Runs on every request',
    recommendation: 'Consider getStaticProps if data static',
    category: 'behavioral',
  },
  'next-static-props': {
    title: 'getStaticProps',
    summary: 'Static data fetching at build',
    impact: 'Data may be stale',
    recommendation: 'Use revalidate for ISR',
    category: 'behavioral',
  },

  // === VUE EXTENDED ===
  'vue-reactive-assign': {
    title: 'Reactive object assignment',
    summary: 'Object.assign on reactive may break reactivity',
    impact: 'Changes may not trigger updates',
    recommendation: 'Use spread or individual property assignment',
    category: 'behavioral',
  },
  'vue-props-destructure': {
    title: 'Props destructure without toRefs',
    summary: 'Destructuring props loses reactivity',
    impact: 'Component won\'t update on prop change',
    recommendation: 'Use toRefs(props) first',
    category: 'behavioral',
  },
  'vue-emit-change': {
    title: 'Emit contract change',
    summary: 'Component event emission changed',
    impact: 'Parent handlers may break',
    recommendation: 'Update parent components',
    category: 'behavioral',
  },
  'vue-watch-immediate': {
    title: 'Immediate watch',
    summary: 'Watch runs immediately on mount',
    impact: 'Runs before data may be ready',
    recommendation: 'Handle initial undefined state',
    category: 'behavioral',
  },
  'vue-shallow-reactive': {
    title: 'Shallow reactivity',
    summary: 'Only top-level properties are reactive',
    impact: 'Nested changes not tracked',
    recommendation: 'Use deep reactive or trigger manually',
    category: 'behavioral',
  },
  'vue-to-raw': {
    title: 'toRaw usage',
    summary: 'Reactivity removed from object',
    impact: 'Changes to raw object not tracked',
    recommendation: 'Use for read-only operations',
    category: 'behavioral',
  },
  'vue-trigger-ref': {
    title: 'Manual trigger',
    summary: 'triggerRef forces reactivity update',
    impact: 'Usually indicates design issue',
    recommendation: 'Consider restructuring reactive data',
    category: 'behavioral',
  },
  'vue-effect-scope': {
    title: 'Effect scope',
    summary: 'Grouped reactive effects',
    impact: 'Must be stopped manually',
    recommendation: 'Call scope.stop() on cleanup',
    category: 'behavioral',
  },
  'vue-template-heavy': {
    title: 'Heavy template expression',
    summary: 'Complex logic in template',
    impact: 'Runs on every render',
    recommendation: 'Extract to computed property',
    category: 'style',
  },
  'vue-pinia-store': {
    title: 'Pinia store definition',
    summary: 'Store structure changed',
    impact: 'All consumers affected',
    recommendation: 'Verify consumers are updated',
    category: 'behavioral',
  },
  'vue-store-to-refs': {
    title: 'Store to refs',
    summary: 'storeToRefs preserves reactivity',
    impact: 'Correct pattern for reactive store access',
    recommendation: 'Good practice, keep it',
    category: 'style',
  },
  'vue-pinia-patch': {
    title: 'Store patch',
    summary: '$patch batches state updates',
    impact: 'Multiple changes in single update',
    recommendation: 'Verify all properties are correct',
    category: 'behavioral',
  },
  'vue-pinia-reset': {
    title: 'Store reset',
    summary: '$reset restores initial state',
    impact: 'All state lost',
    recommendation: 'Verify this is intended',
    category: 'behavioral',
  },
  'vue-vuex-mutation': {
    title: 'Vuex mutation',
    summary: 'Vuex state mutation',
    impact: 'State structure change',
    recommendation: 'Verify state shape is correct',
    category: 'behavioral',
  },
  'vue-vuex-action': {
    title: 'Vuex action',
    summary: 'Async Vuex action',
    impact: 'Async state change',
    recommendation: 'Handle loading and errors',
    category: 'behavioral',
  },
  'vue-store-direct-mutation': {
    title: 'Direct store mutation',
    summary: 'Mutating store.state directly',
    impact: 'Vuex devtools won\'t track',
    recommendation: 'Use commit() or $patch()',
    category: 'behavioral',
  },

  // === ANGULAR EXTENDED ===
  'angular-module-imports': {
    title: 'Module imports',
    summary: 'NgModule imports changed',
    impact: 'Affects available dependencies',
    recommendation: 'Verify all needed modules imported',
    category: 'behavioral',
  },
  'angular-module-exports': {
    title: 'Module exports',
    summary: 'NgModule exports changed',
    impact: 'Affects what other modules can use',
    recommendation: 'Verify consumers have access',
    category: 'behavioral',
  },
  'angular-module-providers': {
    title: 'Module providers',
    summary: 'Dependency injection providers changed',
    impact: 'Affects service instances',
    recommendation: 'Verify correct scope (root vs module)',
    category: 'behavioral',
  },
  'angular-provided-in': {
    title: 'Service scope change',
    summary: 'providedIn scope changed',
    impact: 'Service availability affected',
    recommendation: 'Verify consumers can access service',
    category: 'behavioral',
  },
  'angular-module-forroot': {
    title: 'Module forRoot',
    summary: 'Root module configuration changed',
    impact: 'Affects app-wide settings',
    recommendation: 'Verify configuration is correct',
    category: 'behavioral',
  },
  'angular-module-forchild': {
    title: 'Module forChild',
    summary: 'Feature module configuration changed',
    impact: 'Affects lazy-loaded feature',
    recommendation: 'Verify feature module setup',
    category: 'behavioral',
  },
  'angular-route-guard': {
    title: 'Route guard',
    summary: 'Auth/permission guard changed',
    impact: 'Security: access control affected',
    recommendation: 'Security review required',
    category: 'security',
  },
  'angular-route-path': {
    title: 'Route path change',
    summary: 'URL route changed',
    impact: 'Deep links/bookmarks may break',
    recommendation: 'Add redirect from old path',
    category: 'behavioral',
  },
  'angular-lazy-load': {
    title: 'Lazy loading config',
    summary: 'Lazy loading configuration changed',
    impact: 'Affects bundle splitting',
    recommendation: 'Verify chunks are correct size',
    category: 'behavioral',
  },
  'angular-route-redirect': {
    title: 'Route redirect',
    summary: 'Redirect configuration changed',
    impact: 'Navigation flow affected',
    recommendation: 'Verify redirect target exists',
    category: 'behavioral',
  },
  'angular-router-navigate': {
    title: 'Programmatic navigation',
    summary: 'router.navigate() call',
    impact: 'Changes current route',
    recommendation: 'Verify route and params',
    category: 'behavioral',
  },
  'angular-route-params': {
    title: 'Route parameters',
    summary: 'ActivatedRoute params accessed',
    impact: 'Subscribes to route changes',
    recommendation: 'Unsubscribe on destroy',
    category: 'behavioral',
  },
  'angular-resolver': {
    title: 'Route resolver',
    summary: 'Data fetched before route activation',
    impact: 'Blocks navigation until complete',
    recommendation: 'Add loading indicator',
    category: 'behavioral',
  },
  'angular-zone': {
    title: 'Zone manipulation',
    summary: 'NgZone.run or runOutsideAngular',
    impact: 'Affects change detection',
    recommendation: 'Verify updates are detected',
    category: 'behavioral',
  },
  'angular-change-detection': {
    title: 'Change detection strategy',
    summary: 'ChangeDetectionStrategy changed',
    impact: 'Affects when component updates',
    recommendation: 'Verify OnPush compatibility',
    category: 'behavioral',
  },
  'angular-cdr-detectchanges': {
    title: 'Manual detectChanges',
    summary: 'changeDetectorRef.detectChanges()',
    impact: 'Forces synchronous change detection',
    recommendation: 'Prefer markForCheck()',
    category: 'behavioral',
  },
  'angular-cdr-markforcheck': {
    title: 'Manual markForCheck',
    summary: 'changeDetectorRef.markForCheck()',
    impact: 'Marks component for next CD cycle',
    recommendation: 'Usually OK with OnPush',
    category: 'behavioral',
  },
};

/**
 * Get human-readable description for a signal ID
 * Falls back to a generic description if not found
 */
export function getSignalDescription(signalId: string): SignalDescription {
  const desc = signalDescriptions[signalId];
  if (desc) return desc;

  // Fallback: generate from ID
  const title = signalId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title,
    summary: `Signal detected: ${signalId}`,
    impact: 'Review this change carefully',
    recommendation: 'Verify the change is intentional',
    category: 'behavioral',
  };
}

/**
 * Format signals into human-readable grouped output
 * Used by console and markdown formatters
 */
export interface FormattedReason {
  category: 'Behavioral' | 'Style' | 'Security';
  signals: Array<{
    id: string;
    title: string;
    summary: string;
  }>;
  score: number;
}

/**
 * Parse a risk reason string and return structured data
 * Input format: "Category: signal1, signal2 (+score)"
 */
export function parseRiskReason(reason: string): FormattedReason | null {
  const match = reason.match(/^(\w+):\s*(.+?)\s*\(([+-][\d.]+)\)$/);
  if (!match) return null;

  const [, category, signalsPart, scorePart] = match;
  const signalIds = signalsPart.split(',').map((s) => s.trim());

  const signals = signalIds.map((id) => {
    const desc = getSignalDescription(id);
    return {
      id,
      title: desc.title,
      summary: desc.summary,
    };
  });

  return {
    category: category as 'Behavioral' | 'Style' | 'Security',
    signals,
    score: parseFloat(scorePart),
  };
}

/**
 * Format a reason for default console output (single line, human-readable)
 */
export function formatReasonDefault(reason: string): string {
  const parsed = parseRiskReason(reason);
  if (!parsed) return reason;

  const titles = parsed.signals.map((s) => s.title).join('  •  ');
  return `${parsed.category}: ${titles}`;
}

/**
 * Format a reason for detailed output (multi-line with full info)
 */
export function formatReasonDetailed(reason: string): string[] {
  const parsed = parseRiskReason(reason);
  if (!parsed) return [reason];

  return parsed.signals.map((s) => `${s.title} (${s.id}) → ${s.summary}`);
}

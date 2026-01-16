# DiffeSense Detectors

Detectors analyze source code and extract risk signals. DiffeSense uses a layered detector system:

1. **Base Detector** - Generic signals for all JS/TS code (Security, Correctness, Maintainability)
2. **Framework Detectors** - Extend base with framework-specific patterns
3. **Platform Detectors** - SSR, Mobile, Desktop specific patterns

---

## Available Detectors

| Detector | Flag | Auto-detected when |
|----------|------|--------------------|
| Generic | `--detector generic` | Default fallback |
| React | `--detector react` | `.jsx`, `.tsx` files or React imports |
| Vue.js | `--detector vue` | `.vue` files or Vue imports |
| Angular | `--detector angular` | `.component.ts`, `.service.ts`, or `@angular/` imports |
| Svelte | `--detector svelte` | `.svelte` files or SvelteKit patterns |
| Node.js | `--detector node` | `/server/`, `/api/`, `/backend/` paths or Node.js imports |
| SSR | `--detector ssr` | Next.js, Nuxt, Astro, SvelteKit server contexts |
| React Native | `--detector react-native` | `react-native` imports or `.native.` files |
| Electron | `--detector electron` | Electron/Tauri imports or IPC patterns |
| Auto | `--detector auto` | Automatically selects based on file (default) |

---

## Base Detector (Generic)

Works on any JavaScript/TypeScript project. Includes **Security**, **Correctness**, and **Maintainability** signals.

### Security Signals (SEC)

| Signal | Pattern | Severity |
|--------|---------|----------|
| `sec-eval` | eval(), new Function() | CRITICAL |
| `sec-xss-sink` | innerHTML, dangerouslySetInnerHTML | CRITICAL |
| `sec-command-injection` | exec(), spawn() with user input | CRITICAL |
| `sec-hardcoded-secret` | API keys, passwords in code | HIGH |
| `sec-sql-injection` | SQL query with string concat | CRITICAL |
| `sec-ssrf` | fetch() with user-controlled URL | HIGH |
| `sec-prototype-pollution` | Object.assign with untrusted input | HIGH |
| `sec-weak-crypto` | MD5, SHA1 usage | MEDIUM |
| `sec-cors-wildcard` | CORS origin: "*" | MEDIUM |
| `sec-npm-script` | postinstall script changes | HIGH |

### Correctness Signals (COR)

| Signal | Pattern | Severity |
|--------|---------|----------|
| `cor-unhandled-promise` | Promise without await/then | HIGH |
| `cor-swallowed-error` | Empty catch block | HIGH |
| `cor-any-type` | TypeScript `any` usage | MEDIUM |
| `cor-race-condition` | Mutable variable in async | MEDIUM |
| `cor-interval-no-clear` | setInterval without cleanup | HIGH |
| `cor-infinite-loop` | while(true) without exit | HIGH |
| `cor-complex-regex` | ReDoS-prone regex | MEDIUM |

### Maintainability Signals (MAINT)

| Signal | Pattern | Severity |
|--------|---------|----------|
| `maint-todo-no-ticket` | TODO without issue reference | LOW |
| `maint-commented-code` | Commented-out code blocks | LOW |
| `maint-magic-numbers` | Unexplained numeric constants | LOW |
| `maint-duplicate-code` | Repeated code patterns | MEDIUM |
| `maint-vague-error` | Short error messages | LOW |
| `maint-test-disabled` | .skip or .only in tests | MEDIUM |

### Complexity Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `large-file` | > 500 lines | 0.8 |
| `deep-nesting` | Indent level >= 5 | 0.3 |
| `long-function` | > 50 lines | 0.5 |
| `high-params` | >= 5 parameters | 0.3 |

### Side Effect Signals

| Signal | Pattern | Weight |
|--------|---------|--------|
| `network-fetch` | fetch() | 0.5 |
| `network-axios` | axios | 0.5 |
| `network-websocket` | WebSocket | 0.6 |
| `storage-local` | localStorage | 0.4 |
| `timer-interval` | setInterval | 0.4 |
| `process-child` | child_process | 0.6 |
| `fs-sync` | readFileSync, writeFileSync | 0.6 |
| `dom-innerhtml` | innerHTML | 0.5 |

---

## React Detector

Extends base detector with React-specific patterns.

### Hook Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `react-effect-no-deps` | useEffect without dependency array | 0.8 |
| `react-complex-deps` | useEffect with many dependencies | 0.4 |
| `react-callback-no-deps` | useCallback without deps | 0.5 |
| `react-memo-no-deps` | useMemo without deps | 0.5 |
| `react-custom-hooks` | Custom hook usage | 0.2 |

### State Patterns

| Signal | Trigger | Weight |
|--------|---------|--------|
| `react-stale-closure` | Timer using stale state | 0.6 |
| `react-set-state-unmounted` | setState after unmount | 0.5 |
| `react-index-key` | Array index as key | 0.5 |
| `react-derived-state` | useState from props | 0.6 |
| `react-state-mutation` | Direct state mutation | 0.8 |
| `react-set-state-render` | setState in render | 0.9 |
| `react-context-value-inline` | Inline context value | 0.6 |

### Performance Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `react-listener-no-cleanup` | addEventListener without remove | 0.7 |
| `react-timer-no-cleanup` | setTimeout/setInterval without clear | 0.6 |
| `react-unstable-prop` | Inline object/array as prop | 0.4 |
| `react-unmemoized-computation` | map/filter in render | 0.3 |
| `react-inline-styles` | > 3 inline style={{}} | 0.3 |
| `react-inline-handlers` | > 3 inline onClick={() => } | 0.3 |

### Next.js Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `next-use-client-not-first` | "use client" not at top | 0.7 |
| `next-router-change` | router.push/replace | 0.3 |
| `next-gss-props` | getServerSideProps | 0.5 |
| `next-static-props` | getStaticProps | 0.4 |

---

## Vue.js Detector

Extends base detector with Vue-specific patterns.

### Composition API Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `vue-watch-no-cleanup` | watch/watchEffect without cleanup | 0.6 |
| `vue-computed-side-effect` | Side effects in computed | 0.7 |
| `vue-async-mounted` | async onMounted | 0.4 |
| `vue-many-refs` | > 10 ref/reactive calls | 0.4 |
| `vue-composables` | Custom composable usage | 0.2 |

### Reactivity Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `vue-reactive-assign` | Object.assign on reactive | 0.5 |
| `vue-props-destructure` | Destructure props without toRefs | 0.6 |
| `vue-shallow-reactive` | shallowRef/shallowReactive | 0.4 |
| `vue-to-raw` | toRaw() usage | 0.4 |
| `vue-trigger-ref` | triggerRef() usage | 0.5 |

### Store Signals (Pinia/Vuex)

| Signal | Trigger | Weight |
|--------|---------|--------|
| `vue-pinia-store` | defineStore | 0.4 |
| `vue-pinia-patch` | $patch usage | 0.3 |
| `vue-pinia-reset` | $reset usage | 0.4 |
| `vue-vuex-mutation` | Vuex mutation | 0.4 |
| `vue-vuex-action` | Vuex action | 0.3 |
| `vue-store-direct-mutation` | store.state.x = ... | 0.8 |

### Template Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `vue-vfor-vif` | v-for with v-if on same element | 0.5 |
| `vue-template-heavy` | Complex expressions in template | 0.4 |
| `vue-refs-access` | Direct $refs DOM access | 0.4 |

---

## Angular Detector

Extends base detector with Angular-specific patterns.

### Component Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `angular-subscription-leak` | Subscribe without unsubscribe | 0.8 |
| `angular-dom-access` | document., ElementRef, nativeElement | 0.5 |
| `angular-no-onpush` | Large component without OnPush | 0.3 |
| `angular-io-decorator` | @Input/@Output changes | 0.2 |
| `angular-viewchild` | @ViewChild queries | 0.3 |

### Service Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `angular-provided-in` | providedIn scope change | 0.5 |
| `angular-service-state` | Service with BehaviorSubject | 0.4 |
| `angular-http-call` | HTTP client usage | 0.3 |
| `angular-http-no-error` | HTTP without catchError | 0.6 |

### RxJS Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `angular-nested-subscribe` | Nested .subscribe() | 0.7 |
| `angular-public-subject` | Public Subject | 0.5 |
| `angular-share-replay` | shareReplay without refCount | 0.4 |
| `angular-rxjs-switchmap` | switchMap operator | 0.3 |
| `angular-rxjs-combinlatest` | combineLatest usage | 0.4 |

### Module & Routing Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `angular-module-imports` | NgModule imports changed | 0.4 |
| `angular-module-providers` | providers changed | 0.5 |
| `angular-route-guard` | canActivate/canLoad changed | 0.7 |
| `angular-route-path` | Route path changed | 0.5 |
| `angular-lazy-load` | loadChildren/loadComponent | 0.4 |
| `angular-zone` | NgZone manipulation | 0.5 |
| `angular-change-detection` | ChangeDetectionStrategy | 0.5 |

---

## Svelte Detector

Detects Svelte and SvelteKit specific patterns.

### Reactivity Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `svelte-reactive-statement` | $: reactive block | 0.3 |
| `svelte-reactive-side-effect` | Side effect in $: | 0.6 |
| `svelte-bind` | bind: directive | 0.3 |
| `svelte-store-manual-subscription` | .subscribe() without cleanup | 0.5 |

### SvelteKit Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `sveltekit-load` | load function | 0.4 |
| `sveltekit-actions` | Form actions | 0.4 |
| `sveltekit-api-endpoint` | +server.ts endpoint | 0.4 |
| `sveltekit-hook` | hooks.server.ts | 0.5 |

---

## SSR Detector

Detects Server-Side Rendering boundary issues for Next.js, Nuxt, SvelteKit, Astro.

### Browser API Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `ssr-browser-api` | window/document in server | 0.8 |
| `ssr-hydration-date` | Date() in SSR | 0.6 |
| `ssr-hydration-random` | Math.random() in SSR | 0.5 |
| `ssr-env-leakage` | Sensitive env in client bundle | 0.9 |

### Framework-Specific

| Signal | Trigger | Weight |
|--------|---------|--------|
| `next-use-client-position` | "use client" not first line | 0.7 |
| `next-server-action` | "use server" in action | 0.5 |
| `nuxt-data-fetching` | useAsyncData/useFetch | 0.3 |
| `astro-client-directive` | client:load/visible/idle | 0.3 |

---

## Node.js Detector

Extends base detector with Node.js-specific patterns including GraphQL and Realtime.

### I/O Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `node-sync-op` | readFileSync, execSync | 0.5 |
| `node-stream` | .pipe(), createReadStream | 0.4 |
| `node-cluster` | cluster.fork | 0.6 |

### Server Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `node-route` | Express/Fastify route handlers | 0.2 |
| `node-middleware` | app.use(), router.use() | 0.3 |
| `node-auth-middleware` | Auth middleware | 0.7 |
| `node-database-query` | SQL queries | 0.5 |

### GraphQL Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `graphql-query-type` | type Query definition | 0.6 |
| `graphql-mutation` | @Mutation resolver | 0.5 |
| `graphql-dataloader` | DataLoader usage | 0.3 |
| `graphql-field-resolver` | @ResolveField | 0.4 |

### Realtime Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `realtime-websocket-server` | WebSocket.Server | 0.6 |
| `realtime-socketio` | Socket.io server | 0.5 |
| `realtime-sse` | Server-Sent Events | 0.4 |
| `realtime-backpressure` | Backpressure handling | 0.4 |

---

## React Native Detector

Detects React Native and Expo specific patterns.

### Platform Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `rn-native-module` | NativeModules usage | 0.5 |
| `rn-platform-check` | Platform.OS conditional | 0.3 |
| `rn-dimensions` | Dimensions.get() | 0.3 |

### Navigation Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `rn-navigator` | createStackNavigator etc. | 0.4 |
| `rn-navigation-action` | navigation.navigate() | 0.3 |
| `rn-deep-linking` | Linking.addEventListener | 0.5 |

### Performance Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `rn-inline-style` | Inline styles in render | 0.3 |
| `rn-flatlist-no-key` | FlatList without keyExtractor | 0.6 |
| `rn-nested-virtualized` | FlatList in ScrollView | 0.7 |

### Expo Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `expo-camera` | expo-camera usage | 0.4 |
| `expo-location` | expo-location usage | 0.4 |
| `expo-notifications` | Push notifications | 0.5 |

---

## Electron/Tauri Detector

Detects desktop app specific patterns.

### Electron IPC Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `electron-ipc-main` | ipcMain.handle/on | 0.5 |
| `electron-ipc-renderer` | ipcRenderer.send/invoke | 0.4 |
| `electron-context-bridge` | contextBridge.exposeInMainWorld | 0.5 |

### Electron Security Signals

| Signal | Trigger | Severity |
|--------|---------|----------|
| `electron-node-integration` | nodeIntegration: true | CRITICAL |
| `electron-context-isolation-disabled` | contextIsolation: false | CRITICAL |
| `electron-web-security-disabled` | webSecurity: false | CRITICAL |
| `electron-remote-module` | @electron/remote | HIGH |

### Tauri Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `tauri-command` | #[tauri::command] | 0.5 |
| `tauri-invoke` | invoke() calls | 0.4 |
| `tauri-file-system` | @tauri-apps/api/fs | 0.5 |
| `tauri-shell` | Shell command execution | 0.7 |

---

## Detector Selection Priority

When `--detector auto` (default):

1. **Desktop** - Electron/Tauri patterns detected first
2. **Mobile** - React Native imports
3. **SSR** - Server component contexts (Next/Nuxt/Astro)
4. **Framework** - Svelte → Vue → Angular → React
5. **Backend** - Node.js patterns
6. **Generic** - Fallback with Security/Correctness/Maintainability

---

## Signal Categories

All signals belong to one of these categories:

| Category | Description | Examples |
|----------|-------------|----------|
| `security` | Security vulnerabilities | XSS, injection, secrets |
| `behavioral` | Runtime behavior changes | State, async, side effects |
| `style` | Code quality issues | Complexity, naming, dead code |
| `complexity` | Code complexity metrics | Nesting, LOC, cyclomatic |
| `async` | Asynchronous patterns | Promises, timers, events |
| `side-effect` | External interactions | Network, storage, DOM |
| `signature` | API contract changes | Exports, types, props |

---

## Signal Confidence Levels

DiffeSense assigns a confidence level to each signal to reduce noise and false positives.

| Level | Meaning |
|-------|---------|
| `high` | Regex match with clear pattern |
| `medium` | Heuristic with some false positives |
| `low` | Best-effort detection, review recommended |

### Confidence Gate

**Blocking a merge requires BOTH high confidence AND high impact.** This prevents false positives from breaking your CI pipeline.

| Confidence | Impact (Class) | Can Block Merge? | Shown in Default? | Shown in `--details`? |
|------------|----------------|------------------|-------------------|----------------------|
| `high` | critical/behavioral | ✅ Yes | ✅ Yes | ✅ Yes |
| `high` | maintainability | ❌ No | ✅ Yes (advisory) | ✅ Yes |
| `medium` | any | ❌ No | ✅ Yes (advisory) | ✅ Yes |
| `low` | any | ❌ No | ❌ No | ✅ Yes |

**Trust-First Approach:**

Signals without explicit confidence default to `'low'`. This means unknown or legacy signals won't cause unexpected FAILs.

**Default Confidence Assignment:**

- `critical` class signals → `high` confidence
- Security-related signals (auth, password, token, secret, sec-*) → `high` confidence
- `behavioral` class signals → `medium` confidence  
- `maintainability` class signals → `low` confidence

**Example:**

```
# high confidence + high impact = BLOCKING
sec-command-injection (critical class) → Can FAIL

# high confidence + low impact = ADVISORY  
large-file (maintainability class) → Advisory only

# low confidence = FILTERED
unknown-signal → Hidden in default output
```

**Viewing Gate Statistics:**

The summary box shows how many signals were categorized:

```
Signals: 382 blocking, 4615 advisory, 131 filtered
```

- **blocking**: High-confidence + high-impact signals that can cause FAIL
- **advisory**: Signals shown but won't cause FAIL
- **filtered**: Low-confidence signals (hidden in default output)

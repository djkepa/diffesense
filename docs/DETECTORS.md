# DiffeSense Detectors

Detectors analyze source code and extract risk signals. DiffeSense uses a layered detector system:

1. **Base Detector** - Generic signals for all JS/TS code
2. **Framework Detectors** - Extend base with framework-specific patterns

---

## Available Detectors

| Detector | Flag | Auto-detected when |
|----------|------|--------------------|
| Generic | `--detector generic` | Default fallback |
| React | `--detector react` | `.jsx`, `.tsx` files or React imports |
| Vue.js | `--detector vue` | `.vue` files or Vue imports |
| Angular | `--detector angular` | `.component.ts`, `.service.ts`, or `@angular/` imports |
| Node.js | `--detector node` | `/server/`, `/api/`, `/backend/` paths or Node.js imports |
| Auto | `--detector auto` | Automatically selects based on file (default) |

---

## Base Detector (Generic)

Works on any JavaScript/TypeScript project. Detects:

### Complexity Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `large-file` | > 500 lines | 0.8 |
| `large-file` | > 300 lines | 0.4 |
| `deep-nesting` | Indent level >= 5 | 0.3 |
| `long-function` | > 50 lines | 0.5 |
| `high-params` | >= 5 parameters | 0.3 |

### Side Effect Signals

| Signal | Pattern | Weight |
|--------|---------|--------|
| `network` | fetch, axios, XMLHttpRequest, WebSocket | 0.5-0.6 |
| `storage` | localStorage, sessionStorage, indexedDB, fs | 0.4-0.6 |
| `timer` | setTimeout, setInterval | 0.3-0.4 |
| `global` | window., global., globalThis. | 0.3 |
| `process` | process.env, process.exit, child_process | 0.2-0.7 |
| `database` | .query(), .execute(), Prisma operations | 0.5 |
| `dom` | document.getElementById, innerHTML | 0.4-0.5 |
| `logging` | console.log/warn/error | 0.1 |

### Async Signals

| Signal | Pattern | Weight |
|--------|---------|--------|
| `async-await` | async functions | 0.2 per function |
| `promise` | new Promise, .then(), Promise.all | 0.2 |
| `event-handler` | addEventListener, .on(), .once() | 0.3 |
| `callback` | Callback patterns | 0.3 |

### Signature Signals

| Signal | Pattern | Weight |
|--------|---------|--------|
| `export` | export function/class/const | 0.3 |
| `type-export` | export type/interface | 0.2 per type |

---

## React Detector

Extends base detector with React-specific patterns.

### Hook Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `react-effect-no-deps` | useEffect without dependency array | 0.8 |
| `react-complex-deps` | useEffect with many dependencies | 0.4 |
| `react-complex-state` | useState with complex initial value | 0.3 |
| `react-custom-hooks` | Custom hook usage | 0.2 |

### Component Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `react-inline-styles` | > 3 inline style={{}} | 0.3 |
| `react-inline-handlers` | > 3 inline onClick={() => } | 0.3 |
| `react-direct-dom` | document.getElementById in component | 0.6 |
| `react-no-memo` | Large component without React.memo | 0.2 |

---

## Vue.js Detector

Extends base detector with Vue-specific patterns.

### Composition API Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `vue-watch-no-cleanup` | watch/watchEffect without cleanup | 0.6 |
| `vue-computed-side-effect` | Side effects in computed property | 0.7 |
| `vue-async-mounted` | async onMounted | 0.4 |
| `vue-many-refs` | > 10 ref/reactive calls | 0.4 |
| `vue-composables` | Custom composable usage | 0.2 |

### Options API Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `vue-large-data` | data() with > 15 properties | 0.5 |
| `vue-deep-watch` | deep: true in watcher | 0.5 |
| `vue-props-mutation` | Direct props mutation | 0.8 |

### Template Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `vue-vfor-vif` | v-for with v-if on same element | 0.5 |
| `vue-inline-handlers` | > 5 inline @click handlers | 0.3 |
| `vue-refs-access` | Direct $refs DOM access | 0.4 |

---

## Angular Detector

Extends base detector with Angular-specific patterns.

### Component Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `angular-subscription-leak` | Subscribe without unsubscribe | 0.8 |
| `angular-complex-onchanges` | ngOnChanges > 20 lines | 0.5 |
| `angular-dom-access` | document., ElementRef, nativeElement | 0.5 |
| `angular-no-onpush` | Large component without OnPush | 0.3 |
| `angular-many-viewchild` | > 5 ViewChild queries | 0.4 |

### Service Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `angular-service-state` | Service with state (no store) | 0.4 |
| `angular-http-no-error` | HTTP calls without catchError | 0.6 |
| `angular-service-deps` | Root service with > 5 dependencies | 0.4 |

### RxJS Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `angular-nested-subscribe` | Nested .subscribe() calls | 0.7 |
| `angular-public-subject` | Public Subject (not Observable) | 0.5 |
| `angular-long-pipe` | Complex RxJS pipe chain | 0.4 |

---

## Node.js Detector

Extends base detector with Node.js-specific patterns.

### I/O Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `node-sync-op` | readFileSync, writeFileSync, execSync | 0.5 |
| `node-stream` | .pipe(), createReadStream | 0.4 |
| `node-process-event` | process.on('exit'), etc. | 0.4 |
| `node-env-heavy` | > 5 process.env accesses | 0.3 |

### Server Signals

| Signal | Trigger | Weight |
|--------|---------|--------|
| `node-routes` | Express/Koa/Fastify route handlers | 0.2 per route |
| `node-middleware` | app.use(), router.use() | 0.3 |
| `node-database` | SQL queries, .query() | 0.5 |
| `node-orm` | ORM operations (findOne, create, etc.) | 0.4 |

---

## Adding Custom Detectors (Planned)

Future versions will support custom detectors:

```typescript
// custom-detector.ts
import { BaseDetector, Signal } from '@diffesense/cli';

export class MyDetector extends BaseDetector {
  detect(): Signal[] {
    const baseSignals = super.detect();
    return [
      ...baseSignals,
      ...this.detectMyPatterns()
    ];
  }

  private detectMyPatterns(): Signal[] {
    // Custom detection logic
    return [];
  }
}
```

---

## Detector Selection Priority

When `--detector auto` (default):

1. Check file extension (`.vue`, `.jsx`, `.tsx`)
2. Check file path patterns (`/server/`, `/api/`, `.component.ts`)
3. Check import statements (`@angular/`, `react`, `vue`)
4. Fall back to generic detector


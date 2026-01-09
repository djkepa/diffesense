# DiffeSense Architecture

## Project Structure

```
src/
├── analyzers/          # File analysis orchestration
│   ├── index.ts        # Main analyzer
│   └── blastRadius.ts  # Dependency graph analysis
│
├── cli/                # Command-line interface
│   └── dsense.ts       # CLI entry point
│
├── config/             # Configuration system
│   ├── schema.ts       # Zod schemas
│   ├── loader.ts       # Config loading
│   └── index.ts        # Exports
│
├── core/               # Core utilities
│   ├── actions.ts      # Action generation
│   ├── codeowners.ts   # CODEOWNERS parsing
│   ├── determinism.ts  # Determinism checks
│   ├── ignore.ts       # Ignore system
│   ├── signalClasses.ts # Signal classification
│   ├── testRunner.ts   # Test detection
│   └── topN.ts         # Top N selection
│
├── git/                # Git integration
│   ├── diff.ts         # Diff retrieval
│   └── diffParser.ts   # Diff parsing
│
├── output/             # Output formatters
│   └── formatters/
│       ├── dsConsole.ts # Console output
│       ├── dsJson.ts    # JSON output
│       └── dsMarkdown.ts # Markdown output
│
├── patterns/           # Pattern matching
│   ├── registry.ts     # Pattern registry
│   └── index.ts        # Exports
│
├── plugins/            # Plugin system
│   ├── types.ts        # Plugin types
│   ├── loader.ts       # Plugin loader
│   └── index.ts        # Exports
│
├── policy/             # Rule engine
│   ├── engine.ts       # Policy evaluation
│   ├── loader.ts       # Rule loading
│   └── profiles/       # Built-in profiles
│
├── signals/            # Signal detection
│   ├── types.ts        # Signal types
│   ├── index.ts        # Detector orchestration
│   └── detectors/      # Framework detectors
│       ├── base.ts     # Generic JS/TS
│       ├── react.ts    # React patterns
│       ├── vue.ts      # Vue patterns
│       ├── angular.ts  # Angular patterns
│       └── node.ts     # Node.js patterns
│
└── index.ts            # Main export
```

## Data Flow

```
1. CLI Input
   ↓
2. Git Diff Parsing (git/)
   ↓
3. File Analysis (analyzers/)
   ├→ Signal Detection (signals/)
   ├→ Blast Radius (analyzers/blastRadius.ts)
   └→ Actions (core/actions.ts)
   ↓
4. Policy Evaluation (policy/)
   ↓
5. Top N Selection (core/topN.ts)
   ↓
6. Output Formatting (output/)
   ↓
7. CLI Output
```

## Key Concepts

### Signals

Signals are risk indicators detected in code changes. Each signal has:
- **ID**: Unique identifier
- **Class**: critical | behavioral | maintainability
- **Severity**: blocker | warn | info
- **Confidence**: high | medium | low
- **Weight**: 0-1 (contribution to risk score)

### Policy Engine

Rules that map signals to actions:
```typescript
if (signal.id === 'auth-boundary' && file.riskScore > 7) {
  return { severity: 'blocker', actions: ['review', 'test'] }
}
```

### Profiles

Pre-configured rule sets:
- `minimal`: Baseline rules
- `strict`: Stricter thresholds
- `react`: React-optimized
- `vue`: Vue-optimized
- `angular`: Angular-optimized
- `backend`: Node.js backend-optimized

## Type Organization

Types are co-located with their features:
- `signals/types.ts` - Signal-related types
- `policy/engine.ts` - Policy types
- `config/schema.ts` - Config types
- `plugins/types.ts` - Plugin types

This follows the principle of **feature-based organization** rather than type-based.

## Extension Points

### 1. Custom Detectors

Add new signal detectors in `signals/detectors/`:
```typescript
export function detectCustomPattern(content: string): Signal[] {
  // Your detection logic
}
```

### 2. Custom Profiles

Add new profiles in `policy/profiles/`:
```typescript
export const customProfile: RulePreset[] = [
  // Your rules
]
```

### 3. Custom Formatters

Add new formatters in `output/formatters/`:
```typescript
export function formatCustom(result: EvaluationResult): string {
  // Your formatting logic
}
```

### 4. Plugin Packs

External detector packs via `plugins/` system.

## Design Principles

1. **Separation of Concerns**: Each module has a single responsibility
2. **Feature-based Organization**: Group by feature, not by type
3. **Explicit Dependencies**: No circular dependencies
4. **Type Safety**: Full TypeScript coverage
5. **Testability**: Pure functions where possible

## Performance Considerations

- **Lazy Loading**: Detectors loaded on-demand
- **Caching**: Blast radius can be cached
- **Streaming**: Large diffs processed incrementally
- **Parallelization**: File analysis can be parallelized

## Future Improvements

- Move to AST-based detection (higher confidence)
- Add TypeScript path alias resolution
- Implement dependency graph caching
- Add monorepo workspace support


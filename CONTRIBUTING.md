# Contributing to DiffeSense

Thank you for your interest in contributing to DiffeSense!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/djkepa/diffesense.git
cd diffesense

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run in dev mode
npm run dev
```

## Project Structure

```
src/
├── analyzers/       # File analysis logic
├── cli/             # CLI entry point
├── config/          # Configuration handling
├── core/            # Core utilities
├── git/             # Git diff parsing
├── output/          # Output formatters
├── patterns/        # Pattern matching
├── plugins/         # Plugin system
├── policy/          # Rule engine
└── signals/         # Signal detection
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## Code Style

- TypeScript strict mode
- ESLint + Prettier (coming soon)
- Meaningful variable names
- JSDoc for public APIs only

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Areas We Need Help

1. **Framework Patterns** - Improve React/Vue/Angular detection
2. **Test Coverage** - More edge cases
3. **Documentation** - Examples and guides
4. **Bug Fixes** - Check open issues

## Questions?

Open an issue or start a discussion on GitHub.



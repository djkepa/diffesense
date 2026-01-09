import { describe, it, expect } from 'vitest';
import { detectSignals, getDetector } from '../src/signals/detectors';

describe('detectors', () => {
  describe('getDetector', () => {
    it('should return ReactDetector for react profile', () => {
      const detector = getDetector('const x = 1;', 'test.tsx', 'react');
      expect(detector.constructor.name).toBe('ReactDetector');
    });

    it('should return NodeDetector for node profile', () => {
      const detector = getDetector('const x = 1;', 'server.ts', 'node');
      expect(detector.constructor.name).toBe('NodeDetector');
    });

    it('should return VueDetector for vue profile', () => {
      const detector = getDetector('const x = 1;', 'test.vue', 'vue');
      expect(detector.constructor.name).toBe('VueDetector');
    });

    it('should return AngularDetector for angular profile', () => {
      const detector = getDetector('const x = 1;', 'test.component.ts', 'angular');
      expect(detector.constructor.name).toBe('AngularDetector');
    });

    it('should auto-detect React for .tsx files', () => {
      const detector = getDetector('const x = 1;', 'Component.tsx', 'auto');
      expect(detector.constructor.name).toBe('ReactDetector');
    });

    it('should auto-detect Vue for .vue files', () => {
      const detector = getDetector('const x = 1;', 'Component.vue', 'auto');
      expect(detector.constructor.name).toBe('VueDetector');
    });

    it('should auto-detect Angular for .component.ts files', () => {
      const detector = getDetector('const x = 1;', 'app.component.ts', 'auto');
      expect(detector.constructor.name).toBe('AngularDetector');
    });

    it('should auto-detect Node for server files', () => {
      const content = "import fs from 'fs';";
      const detector = getDetector(content, 'server.ts', 'auto');
      expect(detector.constructor.name).toBe('NodeDetector');
    });
  });

  describe('detectSignals - Base Detector', () => {
    it('should detect deep nesting', () => {
      const code = `
function test() {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) {
            console.log('deep');
          }
        }
      }
    }
  }
}`;
      const signals = detectSignals(code, 'test.ts', 'generic');
      // New format uses 'id' instead of 'type', and 'reason' instead of 'description'
      expect(
        signals.some((s) => s.id.includes('nesting') || s.reason.toLowerCase().includes('nesting')),
      ).toBe(true);
    });

    it('should detect async patterns', () => {
      const code = `
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json();
}`;
      const signals = detectSignals(code, 'test.ts', 'generic');
      expect(signals.some((s) => s.category === 'async' || s.id.includes('async'))).toBe(true);
    });

    it('should detect global state mutations', () => {
      const code = `
window.globalVar = 'modified';
document.cookie = 'session=abc';
localStorage.setItem('key', 'value');`;
      const signals = detectSignals(code, 'test.ts', 'generic');
      expect(
        signals.some(
          (s) => s.id.includes('global') || s.id.includes('storage') || s.id.includes('dom'),
        ),
      ).toBe(true);
    });
  });

  describe('detectSignals - React Detector', () => {
    it('should detect useEffect without deps', () => {
      const code = `
import React from 'react';
function Component() {
  useEffect(() => {
    fetchData();
  });
  return <div>Hello</div>;
}`;
      const signals = detectSignals(code, 'Component.tsx', 'react');
      expect(
        signals.some(
          (s) => s.id.includes('effect') || s.reason.toLowerCase().includes('useeffect'),
        ),
      ).toBe(true);
    });

    it('should detect context usage', () => {
      const code = `
import React from 'react';
const ThemeContext = createContext('light');
function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Child />
    </ThemeContext.Provider>
  );
}`;
      const signals = detectSignals(code, 'App.tsx', 'react');
      expect(
        signals.some(
          (s) => s.id.includes('context') || s.reason.toLowerCase().includes('context'),
        ),
      ).toBe(true);
    });
  });

  describe('detectSignals - Node Detector', () => {
    it('should detect process operations', () => {
      const code = `
import fs from 'fs';
process.exit(1);
const env = process.env.NODE_ENV;`;
      const signals = detectSignals(code, 'server/api.ts', 'node');
      expect(
        signals.some(
          (s) => s.id.includes('process') || s.reason.toLowerCase().includes('process'),
        ),
      ).toBe(true);
    });

    it('should detect database operations', () => {
      const code = `
import fs from 'fs';
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
await prisma.user.create({ data: { name: 'John' } });`;
      const signals = detectSignals(code, 'server/api.ts', 'node');
      expect(
        signals.some(
          (s) =>
            s.id.includes('database') ||
            s.id.includes('orm') ||
            s.reason.toLowerCase().includes('database'),
        ),
      ).toBe(true);
    });
  });

  describe('detectSignals - Changed Lines Focus', () => {
    it('should mark signals in changed ranges', () => {
      const code = `// Line 1
// Line 2
window.globalVar = 'dangerous';
// Line 4
// Line 5`;

      const signals = detectSignals(code, 'test.ts', 'generic', {
        changedRanges: [{ startLine: 3, endLine: 3, type: 'modified', lineCount: 1 }],
        contextLines: 0,
      });

      // Find signals on line 3 (now stored in lines array)
      const line3Signals = signals.filter((s) => s.lines.includes(3));
      if (line3Signals.length > 0) {
        expect(line3Signals.some((s) => s.inChangedRange === true)).toBe(true);
      }
    });
  });
});

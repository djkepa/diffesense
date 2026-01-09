import { describe, it, expect } from 'vitest';
import {
  validateManifest,
  createPackRegistry,
  getBuiltinPacks,
  DetectorPackManifest,
  API_VERSION,
} from '../src/plugins';

describe('Plugin System', () => {
  describe('validateManifest', () => {
    it('should validate a valid manifest', () => {
      const manifest = {
        name: '@test/detector-pack',
        version: '1.0.0',
        description: 'Test pack',
        diffesenseVersion: '>=1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [
            {
              id: 'test-detector',
              name: 'Test Detector',
              description: 'A test detector',
              detect: {
                type: 'regex',
                patterns: [],
              },
            },
          ],
        },
      };

      const validated = validateManifest(manifest);

      expect(validated.name).toBe('@test/detector-pack');
      expect(validated.version).toBe('1.0.0');
      expect(validated.diffesense.detectors).toHaveLength(1);
    });

    it('should reject manifest without name', () => {
      const manifest = {
        version: '1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [],
        },
      };

      expect(() => validateManifest(manifest)).toThrow('name');
    });

    it('should reject manifest without version', () => {
      const manifest = {
        name: '@test/pack',
        diffesense: {
          type: 'detector-pack',
          detectors: [],
        },
      };

      expect(() => validateManifest(manifest)).toThrow('version');
    });

    it('should reject manifest without diffesense config', () => {
      const manifest = {
        name: '@test/pack',
        version: '1.0.0',
      };

      expect(() => validateManifest(manifest)).toThrow('diffesense');
    });

    it('should reject manifest with wrong type', () => {
      const manifest = {
        name: '@test/pack',
        version: '1.0.0',
        diffesense: {
          type: 'wrong-type',
          detectors: [],
        },
      };

      expect(() => validateManifest(manifest)).toThrow('detector-pack');
    });

    it('should reject manifest with unsupported apiVersion', () => {
      const manifest = {
        apiVersion: 99, // Unsupported
        name: '@test/pack',
        version: '1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [],
        },
      };

      expect(() => validateManifest(manifest)).toThrow('Unsupported API version');
    });

    it('should accept manifest with valid apiVersion', () => {
      const manifest = {
        apiVersion: API_VERSION,
        name: '@test/pack',
        version: '1.0.0',
        description: 'Test',
        diffesenseVersion: '>=1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [],
        },
      };

      const validated = validateManifest(manifest);
      expect(validated.apiVersion).toBe(API_VERSION);
    });

    it('should reject rule with invalid severity', () => {
      const manifest = {
        name: '@test/pack',
        version: '1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [],
          rules: [
            {
              id: 'test-rule',
              when: { riskGte: 7.0 },
              then: { severity: 'warning' }, // Should be 'warn'
            },
          ],
        },
      };

      expect(() => validateManifest(manifest)).toThrow('severity must be one of');
    });

    it('should accept rule with valid severity', () => {
      const manifest = {
        name: '@test/pack',
        version: '1.0.0',
        description: 'Test',
        diffesenseVersion: '>=1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [],
          rules: [
            {
              id: 'test-rule',
              when: { riskGte: 7.0 },
              then: { severity: 'warn' }, // Correct!
            },
          ],
        },
      };

      const validated = validateManifest(manifest);
      expect(validated.diffesense.rules).toHaveLength(1);
    });

    it('should reject detector without id', () => {
      const manifest = {
        name: '@test/pack',
        version: '1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [
            {
              name: 'Test',
              detect: { type: 'regex', patterns: [] },
            },
          ],
        },
      };

      expect(() => validateManifest(manifest)).toThrow('id');
    });
  });

  describe('PackRegistry', () => {
    it('should create empty registry', () => {
      const registry = createPackRegistry();

      expect(registry.packs.size).toBe(0);
      expect(registry.getAllDetectors()).toHaveLength(0);
      expect(registry.getAllPatterns()).toHaveLength(0);
      expect(registry.getAllRules()).toHaveLength(0);
    });

    it('should return detectors from enabled packs', () => {
      const registry = createPackRegistry();

      const manifest: DetectorPackManifest = {
        name: '@test/pack',
        version: '1.0.0',
        description: 'Test',
        diffesenseVersion: '>=1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [
            {
              id: 'test-detector',
              name: 'Test',
              description: 'Test detector',
              detect: { type: 'regex', patterns: [] },
            },
          ],
        },
      };

      registry.packs.set('@test/pack', {
        manifest,
        source: 'local',
        sourcePath: '/test',
        enabled: true,
      });

      expect(registry.getAllDetectors()).toHaveLength(1);
      expect(registry.getAllDetectors()[0].id).toBe('test-detector');
    });

    it('should not return detectors from disabled packs', () => {
      const registry = createPackRegistry();

      const manifest: DetectorPackManifest = {
        name: '@test/pack',
        version: '1.0.0',
        description: 'Test',
        diffesenseVersion: '>=1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [
            {
              id: 'test-detector',
              name: 'Test',
              description: 'Test detector',
              detect: { type: 'regex', patterns: [] },
            },
          ],
        },
      };

      registry.packs.set('@test/pack', {
        manifest,
        source: 'local',
        sourcePath: '/test',
        enabled: false, // Disabled
      });

      expect(registry.getAllDetectors()).toHaveLength(0);
    });

    it('should return patterns from packs', () => {
      const registry = createPackRegistry();

      const manifest: DetectorPackManifest = {
        name: '@test/pack',
        version: '1.0.0',
        description: 'Test',
        diffesenseVersion: '>=1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [],
          patterns: [
            {
              id: 'test-pattern',
              name: 'Test Pattern',
              description: 'A test pattern',
              matchType: 'regex',
              match: 'test',
              category: 'complexity',
              signalClass: 'maintainability',
              weight: 0.5,
            },
          ],
        },
      };

      registry.packs.set('@test/pack', {
        manifest,
        source: 'local',
        sourcePath: '/test',
        enabled: true,
      });

      expect(registry.getAllPatterns()).toHaveLength(1);
      expect(registry.getAllPatterns()[0].id).toBe('test-pattern');
    });

    it('should return rules from packs', () => {
      const registry = createPackRegistry();

      const manifest: DetectorPackManifest = {
        name: '@test/pack',
        version: '1.0.0',
        description: 'Test',
        diffesenseVersion: '>=1.0.0',
        diffesense: {
          type: 'detector-pack',
          detectors: [],
          rules: [
            {
              id: 'test-rule',
              when: { riskGte: 7.0 },
              then: { severity: 'blocker' },
            },
          ],
        },
      };

      registry.packs.set('@test/pack', {
        manifest,
        source: 'local',
        sourcePath: '/test',
        enabled: true,
      });

      expect(registry.getAllRules()).toHaveLength(1);
      expect(registry.getAllRules()[0].id).toBe('test-rule');
    });
  });

  describe('getBuiltinPacks', () => {
    it('should return builtin packs', () => {
      const packs = getBuiltinPacks();

      expect(packs.length).toBeGreaterThan(0);
      expect(packs.some((p) => p.name.includes('react'))).toBe(true);
      expect(packs.some((p) => p.name.includes('node'))).toBe(true);
    });

    it('should have valid manifest structure', () => {
      const packs = getBuiltinPacks();

      for (const pack of packs) {
        expect(pack.name).toBeDefined();
        expect(pack.version).toBeDefined();
        expect(pack.diffesense.type).toBe('detector-pack');
        expect(Array.isArray(pack.diffesense.detectors)).toBe(true);
      }
    });
  });
});


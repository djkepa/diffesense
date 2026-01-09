import { describe, it, expect } from 'vitest';
import {
  expandRangesWithContext,
  mergeRanges,
  isLineInChangedRange,
  isTrivialChange,
  ChangedRange,
  ChangedFileDetail,
} from '../src/git/diffParser';

describe('diffParser', () => {
  describe('expandRangesWithContext', () => {
    it('should expand ranges with context lines', () => {
      const ranges: ChangedRange[] = [
        { startLine: 10, endLine: 12, type: 'modified', lineCount: 3 },
      ];
      const expanded = expandRangesWithContext(ranges, 3, 100);

      expect(expanded).toHaveLength(1);
      expect(expanded[0].startLine).toBe(7);
      expect(expanded[0].endLine).toBe(15);
    });

    it('should not go below line 1', () => {
      const ranges: ChangedRange[] = [{ startLine: 2, endLine: 3, type: 'added', lineCount: 2 }];
      const expanded = expandRangesWithContext(ranges, 5, 100);

      expect(expanded[0].startLine).toBe(1);
    });

    it('should not exceed total lines', () => {
      const ranges: ChangedRange[] = [
        { startLine: 98, endLine: 100, type: 'modified', lineCount: 3 },
      ];
      const expanded = expandRangesWithContext(ranges, 5, 100);

      expect(expanded[0].endLine).toBe(100);
    });

    it('should return unchanged ranges when contextLines is 0', () => {
      const ranges: ChangedRange[] = [
        { startLine: 10, endLine: 12, type: 'modified', lineCount: 3 },
      ];
      const expanded = expandRangesWithContext(ranges, 0, 100);

      expect(expanded[0].startLine).toBe(10);
      expect(expanded[0].endLine).toBe(12);
    });
  });

  describe('mergeRanges', () => {
    it('should merge overlapping ranges', () => {
      const ranges: ChangedRange[] = [
        { startLine: 1, endLine: 5, type: 'modified', lineCount: 5 },
        { startLine: 3, endLine: 8, type: 'modified', lineCount: 6 },
        { startLine: 15, endLine: 20, type: 'added', lineCount: 6 },
      ];
      const merged = mergeRanges(ranges);

      expect(merged).toHaveLength(2);
      expect(merged[0].startLine).toBe(1);
      expect(merged[0].endLine).toBe(8);
      expect(merged[1].startLine).toBe(15);
      expect(merged[1].endLine).toBe(20);
    });

    it('should merge adjacent ranges', () => {
      const ranges: ChangedRange[] = [
        { startLine: 1, endLine: 5, type: 'modified', lineCount: 5 },
        { startLine: 6, endLine: 10, type: 'modified', lineCount: 5 },
      ];
      const merged = mergeRanges(ranges);

      expect(merged).toHaveLength(1);
      expect(merged[0].startLine).toBe(1);
      expect(merged[0].endLine).toBe(10);
    });

    it('should handle empty array', () => {
      const merged = mergeRanges([]);
      expect(merged).toHaveLength(0);
    });

    it('should handle single range', () => {
      const ranges: ChangedRange[] = [
        { startLine: 5, endLine: 10, type: 'modified', lineCount: 6 },
      ];
      const merged = mergeRanges(ranges);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual(ranges[0]);
    });
  });

  describe('isLineInChangedRange', () => {
    const ranges: ChangedRange[] = [
      { startLine: 5, endLine: 10, type: 'modified', lineCount: 6 },
      { startLine: 20, endLine: 25, type: 'added', lineCount: 6 },
    ];

    it('should return true for lines in range', () => {
      expect(isLineInChangedRange(5, ranges)).toBe(true);
      expect(isLineInChangedRange(7, ranges)).toBe(true);
      expect(isLineInChangedRange(10, ranges)).toBe(true);
      expect(isLineInChangedRange(22, ranges)).toBe(true);
    });

    it('should return false for lines outside range', () => {
      expect(isLineInChangedRange(1, ranges)).toBe(false);
      expect(isLineInChangedRange(4, ranges)).toBe(false);
      expect(isLineInChangedRange(11, ranges)).toBe(false);
      expect(isLineInChangedRange(30, ranges)).toBe(false);
    });
  });

  describe('isTrivialChange', () => {
    it('should detect comment-only changes', () => {
      const detail: ChangedFileDetail = {
        path: 'test.ts',
        status: 'modified',
        ranges: [{ startLine: 1, endLine: 1, type: 'modified', lineCount: 1 }],
        totalLinesChanged: 1,
      };
      const content = '// This is a comment';

      expect(isTrivialChange(detail, content)).toBe(true);
    });

    it('should detect whitespace-only changes', () => {
      const detail: ChangedFileDetail = {
        path: 'test.ts',
        status: 'modified',
        ranges: [{ startLine: 1, endLine: 2, type: 'modified', lineCount: 2 }],
        totalLinesChanged: 2,
      };
      const content = '   \n\t\t';

      expect(isTrivialChange(detail, content)).toBe(true);
    });

    it('should detect import-only changes', () => {
      const detail: ChangedFileDetail = {
        path: 'test.ts',
        status: 'modified',
        ranges: [{ startLine: 1, endLine: 1, type: 'modified', lineCount: 1 }],
        totalLinesChanged: 1,
      };
      const content = "import { foo } from 'bar';";

      expect(isTrivialChange(detail, content)).toBe(true);
    });

    it('should return false for non-trivial changes', () => {
      const detail: ChangedFileDetail = {
        path: 'test.ts',
        status: 'modified',
        ranges: [{ startLine: 1, endLine: 5, type: 'modified', lineCount: 5 }],
        totalLinesChanged: 5,
      };
      const content = `const x = 1;
function foo() {
  return x + 1;
}
export default foo;`;

      expect(isTrivialChange(detail, content)).toBe(false);
    });

    it('should return false for large changes', () => {
      const detail: ChangedFileDetail = {
        path: 'test.ts',
        status: 'modified',
        ranges: [{ startLine: 1, endLine: 10, type: 'modified', lineCount: 10 }],
        totalLinesChanged: 10,
      };
      const content = '// comment\n'.repeat(10);

      expect(isTrivialChange(detail, content)).toBe(false);
    });
  });
});

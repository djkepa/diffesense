/**
 * Signal Detectors Index - Operating Document Compliant
 *
 * Exports all detectors and provides detector selection based on profile.
 * Supports TRUE DIFF ANALYSIS by passing changed ranges to detectors.
 *
 * All detectors produce signals in canonical format (Operating Document Section 5.1)
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector, DetectorOptions } from './base';
import { ReactDetector } from './react';
import { NodeDetector } from './node';
import { VueDetector } from './vue';
import { AngularDetector } from './angular';

export { BaseDetector, DetectorOptions } from './base';
export { ReactDetector } from './react';
export { NodeDetector } from './node';
export { VueDetector } from './vue';
export { AngularDetector } from './angular';
export { PatternDetector, detectWithPatterns, PatternDetectorOptions } from './patternDetector';

export type DetectorProfile = 'generic' | 'react' | 'node' | 'vue' | 'angular' | 'auto';

/**
 * Get appropriate detector for a file
 * @param content - File content
 * @param filePath - File path
 * @param profile - Detector profile to use
 * @param options - Additional options including changed ranges
 * @returns Detector instance
 */
export function getDetector(
  content: string,
  filePath: string,
  profile: DetectorProfile = 'auto',
  options: DetectorOptions = {},
): BaseDetector {
  const { changedRanges, contextLines = 5 } = options;

  switch (profile) {
    case 'react':
      return new ReactDetector(content, filePath, changedRanges, contextLines);

    case 'node':
      return new NodeDetector(content, filePath, changedRanges, contextLines);

    case 'vue':
      return new VueDetector(content, filePath, changedRanges, contextLines);

    case 'angular':
      return new AngularDetector(content, filePath, changedRanges, contextLines);

    case 'auto':
      return autoDetect(content, filePath, options);

    case 'generic':
    default:
      return new BaseDetector(content, filePath, changedRanges, contextLines);
  }
}

/**
 * Auto-detect the appropriate detector based on file characteristics
 * @param content - File content
 * @param filePath - File path
 * @param options - Detector options
 * @returns Detector instance
 */
function autoDetect(
  content: string,
  filePath: string,
  options: DetectorOptions = {},
): BaseDetector {
  const { changedRanges, contextLines = 5 } = options;

  if (filePath.endsWith('.vue')) {
    return new VueDetector(content, filePath, changedRanges, contextLines);
  }
  if (/from\s+['"]vue['"]|from\s+['"]@vue\//.test(content)) {
    return new VueDetector(content, filePath, changedRanges, contextLines);
  }

  if (
    filePath.includes('.component.') ||
    filePath.includes('.service.') ||
    filePath.includes('.directive.') ||
    filePath.includes('.pipe.') ||
    filePath.includes('.module.')
  ) {
    return new AngularDetector(content, filePath, changedRanges, contextLines);
  }
  if (/from\s+['"]@angular\//.test(content)) {
    return new AngularDetector(content, filePath, changedRanges, contextLines);
  }

  if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
    return new ReactDetector(content, filePath, changedRanges, contextLines);
  }
  if (/from\s+['"]react['"]/.test(content)) {
    return new ReactDetector(content, filePath, changedRanges, contextLines);
  }

  if (isNodeContext(content, filePath)) {
    return new NodeDetector(content, filePath, changedRanges, contextLines);
  }

  return new BaseDetector(content, filePath, changedRanges, contextLines);
}

/**
 * Detect signals with appropriate detector
 * @param content - File content
 * @param filePath - File path
 * @param profile - Detector profile
 * @param options - Detector options including changed ranges
 * @returns Detected signals in canonical format
 */
export function detectSignals(
  content: string,
  filePath: string,
  profile: DetectorProfile = 'auto',
  options: DetectorOptions = {},
): Signal[] {
  const detector = getDetector(content, filePath, profile, options);
  return detector.detect();
}

/**
 * Check if file is in Node.js context
 */
function isNodeContext(content: string, filePath: string): boolean {
  if (
    filePath.includes('/server/') ||
    filePath.includes('/api/') ||
    filePath.includes('/backend/') ||
    filePath.includes('/scripts/')
  ) {
    return true;
  }

  const nodeModules = ['fs', 'path', 'http', 'https', 'child_process', 'crypto', 'stream', 'net'];
  for (const mod of nodeModules) {
    if (
      content.includes(`require('${mod}')`) ||
      content.includes(`require("${mod}")`) ||
      content.includes(`from '${mod}'`) ||
      content.includes(`from "${mod}"`)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get detector profile name for a file (useful for display)
 */
export function getDetectorProfileName(content: string, filePath: string): DetectorProfile {
  if (filePath.endsWith('.vue') || /from\s+['"]vue['"]/.test(content)) {
    return 'vue';
  }
  if (
    filePath.includes('.component.') ||
    filePath.includes('.service.') ||
    /from\s+['"]@angular\//.test(content)
  ) {
    return 'angular';
  }
  if (
    filePath.endsWith('.jsx') ||
    filePath.endsWith('.tsx') ||
    /from\s+['"]react['"]/.test(content)
  ) {
    return 'react';
  }
  if (isNodeContext(content, filePath)) {
    return 'node';
  }
  return 'generic';
}

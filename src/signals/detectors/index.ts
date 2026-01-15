/**
 * Signal Detectors Index - Enterprise Edition
 *
 * Supports all major JavaScript/TypeScript ecosystems:
 * - Frontend: React, Vue, Angular, Svelte
 * - SSR/Isomorphic: Next.js, Nuxt, SvelteKit, Astro
 * - Backend: Node.js (Express/Nest/Fastify), GraphQL, BFF, Realtime
 * - Mobile: React Native, Expo
 * - Desktop: Electron, Tauri
 *
 * All detectors produce signals in canonical format (Operating Document Section 5.1)
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector, DetectorOptions } from './base';
import { ReactDetector } from './react';
import { NodeDetector } from './node';
import { VueDetector } from './vue';
import { AngularDetector } from './angular';
import { SvelteDetector } from './svelte';
import { SSRDetector } from './ssr';
import { ReactNativeDetector } from './reactNative';
import { ElectronDetector } from './electron';

export { BaseDetector, DetectorOptions } from './base';
export { ReactDetector } from './react';
export { NodeDetector } from './node';
export { VueDetector } from './vue';
export { AngularDetector } from './angular';
export { SvelteDetector } from './svelte';
export { SSRDetector } from './ssr';
export { ReactNativeDetector } from './reactNative';
export { ElectronDetector } from './electron';
export { PatternDetector, detectWithPatterns, PatternDetectorOptions } from './patternDetector';

export type DetectorProfile =
  | 'generic'
  | 'react'
  | 'node'
  | 'vue'
  | 'angular'
  | 'svelte'
  | 'ssr'
  | 'react-native'
  | 'electron'
  | 'auto';

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

    case 'svelte':
      return new SvelteDetector(content, filePath, changedRanges, contextLines);

    case 'ssr':
      return new SSRDetector(content, filePath, changedRanges, contextLines);

    case 'react-native':
      return new ReactNativeDetector(content, filePath, changedRanges, contextLines);

    case 'electron':
      return new ElectronDetector(content, filePath, changedRanges, contextLines);

    case 'auto':
      return autoDetect(content, filePath, options);

    case 'generic':
    default:
      return new BaseDetector(content, filePath, changedRanges, contextLines);
  }
}

/**
 * Auto-detect the appropriate detector based on file characteristics
 * Priority order matters - more specific detectors first
 */
function autoDetect(
  content: string,
  filePath: string,
  options: DetectorOptions = {},
): BaseDetector {
  const { changedRanges, contextLines = 5 } = options;

  if (isElectronOrTauri(content, filePath)) {
    return new ElectronDetector(content, filePath, changedRanges, contextLines);
  }

  if (isReactNative(content, filePath)) {
    return new ReactNativeDetector(content, filePath, changedRanges, contextLines);
  }

  if (isSSRContext(content, filePath)) {
    return new SSRDetector(content, filePath, changedRanges, contextLines);
  }

  if (filePath.endsWith('.svelte') || isSvelteKit(content, filePath)) {
    return new SvelteDetector(content, filePath, changedRanges, contextLines);
  }

  if (filePath.endsWith('.vue') || /from\s+['"]vue['"]|from\s+['"]@vue\//.test(content)) {
    return new VueDetector(content, filePath, changedRanges, contextLines);
  }

  if (isAngularFile(content, filePath)) {
    return new AngularDetector(content, filePath, changedRanges, contextLines);
  }

  if (isReactFile(content, filePath)) {
    return new ReactDetector(content, filePath, changedRanges, contextLines);
  }

  if (isNodeContext(content, filePath)) {
    return new NodeDetector(content, filePath, changedRanges, contextLines);
  }

  return new BaseDetector(content, filePath, changedRanges, contextLines);
}

/**
 * Detect signals with appropriate detector
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
 * Check if file is in Electron or Tauri context
 */
function isElectronOrTauri(content: string, filePath: string): boolean {
  if (/from\s+['"]electron['"]|require\s*\(\s*['"]electron['"]/.test(content)) {
    return true;
  }
  if (filePath.includes('/main/') && /ipcMain|BrowserWindow/.test(content)) {
    return true;
  }
  if (filePath.includes('preload') && /contextBridge/.test(content)) {
    return true;
  }

  if (/from\s+['"]@tauri-apps\/api['"]/.test(content)) {
    return true;
  }
  if (filePath.endsWith('.rs') && /tauri::/.test(content)) {
    return true;
  }
  if (/tauri\.conf\.json/.test(filePath)) {
    return true;
  }

  return false;
}

/**
 * Check if file is React Native
 */
function isReactNative(content: string, filePath: string): boolean {
  if (/from\s+['"]react-native['"]/.test(content)) {
    return true;
  }
  if (/from\s+['"]expo/.test(content)) {
    return true;
  }
  if (
    filePath.includes('.native.') ||
    filePath.includes('.ios.') ||
    filePath.includes('.android.')
  ) {
    return true;
  }
  return false;
}

/**
 * Check if file is in SSR context (Next.js, Nuxt, SvelteKit, Astro)
 */
function isSSRContext(content: string, filePath: string): boolean {
  if (filePath.includes('/app/') && !/"use client"/.test(content)) {
    if (/page\.(tsx?|jsx?)$/.test(filePath) || /layout\.(tsx?|jsx?)$/.test(filePath)) {
      return true;
    }
  }

  if (/getServerSideProps|getStaticProps/.test(content)) {
    return true;
  }

  if (filePath.includes('/server/') && /defineEventHandler/.test(content)) {
    return true;
  }

  if (
    filePath.includes('+page.server') ||
    filePath.includes('+layout.server') ||
    filePath.includes('+server')
  ) {
    return true;
  }

  if (filePath.endsWith('.astro')) {
    return true;
  }

  if (/['"]use server['"]/.test(content)) {
    return true;
  }

  return false;
}

/**
 * Check if file is SvelteKit specific
 */
function isSvelteKit(content: string, filePath: string): boolean {
  if (
    filePath.includes('+page') ||
    filePath.includes('+layout') ||
    filePath.includes('+server') ||
    filePath.includes('+error')
  ) {
    return true;
  }
  if (/from\s+['"]\$app\//.test(content)) {
    return true;
  }
  return false;
}

/**
 * Check if file is Angular
 */
function isAngularFile(content: string, filePath: string): boolean {
  if (
    filePath.includes('.component.') ||
    filePath.includes('.service.') ||
    filePath.includes('.directive.') ||
    filePath.includes('.pipe.') ||
    filePath.includes('.module.')
  ) {
    return true;
  }
  if (/from\s+['"]@angular\//.test(content)) {
    return true;
  }
  return false;
}

/**
 * Check if file is React
 */
function isReactFile(content: string, filePath: string): boolean {
  if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
    return true;
  }
  if (/from\s+['"]react['"]/.test(content)) {
    return true;
  }
  return false;
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

  const nodeModules = [
    'fs',
    'path',
    'http',
    'https',
    'child_process',
    'crypto',
    'stream',
    'net',
    'os',
    'cluster',
    'worker_threads',
    'express',
    'fastify',
    '@nestjs',
  ];

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
  if (isElectronOrTauri(content, filePath)) {
    return 'electron';
  }
  if (isReactNative(content, filePath)) {
    return 'react-native';
  }
  if (isSSRContext(content, filePath)) {
    return 'ssr';
  }
  if (filePath.endsWith('.svelte') || isSvelteKit(content, filePath)) {
    return 'svelte';
  }
  if (filePath.endsWith('.vue') || /from\s+['"]vue['"]/.test(content)) {
    return 'vue';
  }
  if (isAngularFile(content, filePath)) {
    return 'angular';
  }
  if (isReactFile(content, filePath)) {
    return 'react';
  }
  if (isNodeContext(content, filePath)) {
    return 'node';
  }
  return 'generic';
}

/**
 * Get all available detector profiles
 */
export function getAvailableProfiles(): DetectorProfile[] {
  return [
    'generic',
    'react',
    'node',
    'vue',
    'angular',
    'svelte',
    'ssr',
    'react-native',
    'electron',
    'auto',
  ];
}

/**
 * Get detector description for a profile
 */
export function getProfileDescription(profile: DetectorProfile): string {
  const descriptions: Record<DetectorProfile, string> = {
    generic: 'Base detector for all JavaScript/TypeScript files',
    react: 'React SPA (hooks, components, context)',
    node: 'Node.js backend (Express/Nest/Fastify, GraphQL, API)',
    vue: 'Vue.js (Composition API, Pinia, Vuex)',
    angular: 'Angular (services, components, RxJS)',
    svelte: 'Svelte/SvelteKit (reactivity, stores, load functions)',
    ssr: 'SSR/Isomorphic (Next.js, Nuxt, Astro)',
    'react-native': 'React Native/Expo (mobile)',
    electron: 'Electron/Tauri (desktop)',
    auto: 'Auto-detect based on file content',
  };
  return descriptions[profile];
}

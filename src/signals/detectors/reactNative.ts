/**
 * React Native / Expo Signal Detector
 *
 * Detects mobile-specific patterns including:
 * - Native module usage
 * - Platform-specific code
 * - Navigation patterns
 * - Performance concerns
 * - Expo-specific APIs
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector } from './base';

export class ReactNativeDetector extends BaseDetector {
  private isExpo: boolean;

  constructor(content: string, filePath: string, changedRanges?: ChangedRange[], contextLines = 5) {
    super(content, filePath, changedRanges, contextLines);
    this.isExpo = this.detectExpo();
  }

  detect(): Signal[] {
    const baseSignals = super.detect();

    if (!this.isReactNativeFile()) {
      return baseSignals;
    }

    return [
      ...baseSignals,
      ...this.detectNativeModules(),
      ...this.detectPlatformPatterns(),
      ...this.detectNavigation(),
      ...this.detectPerformanceIssues(),
      ...this.detectExpoPatterns(),
    ];
  }

  private detectExpo(): boolean {
    const { content, filePath } = this.ctx;
    return (
      /from\s+['"]expo/.test(content) ||
      filePath.includes('expo') ||
      /app\.json|app\.config/.test(filePath)
    );
  }

  private isReactNativeFile(): boolean {
    const { content, filePath } = this.ctx;

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
   * Detect native module usage
   */
  private detectNativeModules(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    const nativeModules = [
      { pattern: /NativeModules/, name: 'NativeModules', critical: true },
      { pattern: /requireNativeComponent/, name: 'Native Component', critical: true },
      { pattern: /NativeEventEmitter/, name: 'Native Event Emitter', critical: true },
      { pattern: /TurboModuleRegistry/, name: 'TurboModule', critical: true },
      { pattern: /UIManager/, name: 'UIManager', critical: false },
      { pattern: /LayoutAnimation/, name: 'LayoutAnimation', critical: false },
      { pattern: /Linking/, name: 'Linking', critical: false },
      { pattern: /Alert/, name: 'Alert', critical: false },
      { pattern: /PermissionsAndroid/, name: 'Permissions (Android)', critical: true },
      { pattern: /AccessibilityInfo/, name: 'Accessibility', critical: false },
      { pattern: /AppState/, name: 'AppState', critical: false },
      { pattern: /Keyboard/, name: 'Keyboard', critical: false },
      { pattern: /BackHandler/, name: 'BackHandler', critical: false },
      { pattern: /Vibration/, name: 'Vibration', critical: false },
      { pattern: /Share/, name: 'Share', critical: false },
      { pattern: /Clipboard/, name: 'Clipboard', critical: false },
      { pattern: /DeviceEventEmitter/, name: 'DeviceEventEmitter', critical: false },
      { pattern: /PushNotificationIOS/, name: 'Push Notifications (iOS)', critical: true },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      for (const { pattern, name, critical } of nativeModules) {
        if (pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: 'rn-native-module',
              title: `Native Module: ${name}`,
              category: 'side-effect',
              reason: critical
                ? `${name} requires native integration - verify linking and permissions`
                : `${name} native API - verify platform support`,
              weight: critical ? 0.6 : 0.3,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: critical ? 'behavioral' : 'maintainability',
              confidence: 'high',
              tags: ['react-native', 'native', name.toLowerCase().replace(/\s+/g, '-')],
              evidence: { kind: 'regex', pattern: pattern.source, details: { module: name } },
              actions: critical
                ? [
                    {
                      type: 'mitigation_steps',
                      text: `Verify ${name} setup`,
                      steps: [
                        'Ensure native module is properly linked',
                        'Test on both iOS and Android',
                        'Handle permission requests gracefully',
                        'Provide fallback for unsupported devices',
                      ],
                    },
                  ]
                : undefined,
            }),
          );
          break;
        }
      }
    }

    return signals;
  }

  /**
   * Detect platform-specific patterns
   */
  private detectPlatformPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/Platform\.OS\s*===?\s*['"]/.test(line)) {
        const platform = line.match(/Platform\.OS\s*===?\s*['"](\w+)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: 'rn-platform-check',
            title: 'Platform-Specific Code',
            category: 'side-effect',
            reason: `Platform check for ${platform} - verify behavior on both platforms`,
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'platform', platform || 'os'],
            evidence: { kind: 'regex', pattern: 'Platform.OS' },
          }),
        );
      }

      if (/Platform\.select\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-platform-select',
            title: 'Platform.select Usage',
            category: 'side-effect',
            reason: 'Platform-specific values - test on both iOS and Android',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'platform', 'select'],
            evidence: { kind: 'regex', pattern: 'Platform.select' },
          }),
        );
      }

      if (/Dimensions\.get\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-dimensions',
            title: 'Screen Dimensions',
            category: 'side-effect',
            reason: 'Dimensions may change on rotation - consider useWindowDimensions hook',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'dimensions', 'responsive'],
            evidence: { kind: 'regex', pattern: 'Dimensions.get' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Handle dimension changes',
                steps: [
                  'Use useWindowDimensions hook for reactive updates',
                  'Listen to Dimensions change events if needed',
                  'Test on different screen sizes and orientations',
                ],
              },
            ],
          }),
        );
      }

      if (/useWindowDimensions\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-use-dimensions',
            title: 'useWindowDimensions Hook',
            category: 'side-effect',
            reason: 'Responsive dimensions hook - triggers re-render on rotation',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'hooks', 'dimensions'],
            evidence: { kind: 'regex', pattern: 'useWindowDimensions' },
          }),
        );
      }

      if (/SafeArea(?:View|Provider|Consumer)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-safe-area',
            title: 'Safe Area Handling',
            category: 'side-effect',
            reason: 'Safe area insets - verify notch/home indicator handling',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'safe-area', 'layout'],
            evidence: { kind: 'regex', pattern: 'SafeArea' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect navigation patterns
   */
  private detectNavigation(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    const usesReactNavigation = /from\s+['"]@react-navigation\//.test(content);

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/create\w+Navigator\s*\(/.test(line)) {
        const navType = line.match(/create(\w+)Navigator/)?.[1];
        signals.push(
          this.createSignal({
            id: 'rn-navigator',
            title: `${navType} Navigator`,
            category: 'signature',
            reason: `Navigation structure - verify screen registration and types`,
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'navigation', navType?.toLowerCase() || 'navigator'],
            evidence: { kind: 'regex', pattern: 'createNavigator' },
          }),
        );
      }

      if (/navigation\.(navigate|push|replace|goBack|reset|popToTop)/.test(line)) {
        const action = line.match(/navigation\.(\w+)/)?.[1];
        signals.push(
          this.createSignal({
            id: 'rn-navigation-action',
            title: `Navigation: ${action}`,
            category: 'side-effect',
            reason: 'Navigation action - verify params and screen existence',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'navigation', action?.toLowerCase() || 'action'],
            evidence: { kind: 'regex', pattern: `navigation.${action}` },
          }),
        );
      }

      if (/use(Navigation|Route|FocusEffect|IsFocused)\s*\(/.test(line)) {
        const hook = line.match(/use(\w+)\s*\(/)?.[1];
        signals.push(
          this.createSignal({
            id: `rn-navigation-hook-${hook?.toLowerCase()}`,
            title: `use${hook} Hook`,
            category: 'async',
            reason: `Navigation hook - component will re-render on ${hook?.toLowerCase()} changes`,
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'navigation', 'hooks', hook?.toLowerCase() || 'hook'],
            evidence: { kind: 'regex', pattern: `use${hook}` },
          }),
        );
      }

      if (/linking\s*:\s*\{|Linking\.getInitialURL|Linking\.addEventListener/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-deep-linking',
            title: 'Deep Linking',
            category: 'async',
            reason: 'Deep linking configuration - verify URL scheme and universal links',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'deep-linking', 'urls'],
            evidence: { kind: 'regex', pattern: 'linking|Linking' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Deep linking best practices',
                steps: [
                  'Test URL schemes on both platforms',
                  'Handle missing screens gracefully',
                  'Verify universal links configuration',
                  'Test with app in killed/background state',
                ],
              },
            ],
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect performance issues specific to React Native
   */
  private detectPerformanceIssues(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/style=\{\{/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-inline-style',
            title: 'Inline Style Object',
            category: 'side-effect',
            reason: 'Inline styles create new object on each render - use StyleSheet',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'maintainability',
            confidence: 'high',
            tags: ['react-native', 'performance', 'styles'],
            evidence: { kind: 'regex', pattern: 'style={{' },
          }),
        );
      }

      if (/FlatList/.test(line) && !/keyExtractor/.test(lines.slice(i, i + 5).join('\n'))) {
        signals.push(
          this.createSignal({
            id: 'rn-flatlist-no-key',
            title: 'FlatList Missing keyExtractor',
            category: 'side-effect',
            reason: 'FlatList without keyExtractor causes poor performance',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum, lineNum + 3),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['react-native', 'performance', 'flatlist'],
            evidence: { kind: 'regex', pattern: 'FlatList' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Optimize FlatList',
                steps: [
                  'Add keyExtractor with unique stable keys',
                  'Add getItemLayout for fixed-size items',
                  'Use windowSize to reduce memory usage',
                  'Consider using FlashList for better performance',
                ],
              },
            ],
          }),
        );
      }

      if (/ScrollView/.test(line)) {
        const nextLines = lines.slice(i, i + 20).join('\n');
        if (/FlatList|SectionList|VirtualizedList/.test(nextLines)) {
          signals.push(
            this.createSignal({
              id: 'rn-nested-virtualized',
              title: 'Nested Virtualized List',
              category: 'side-effect',
              reason: 'Nested virtualized lists in ScrollView cause performance issues',
              weight: 0.6,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['react-native', 'performance', 'lists', 'scrollview'],
              evidence: { kind: 'regex', pattern: 'ScrollView.*FlatList' },
            }),
          );
        }
      }

      if (/source=\{\{.*uri:/.test(line) && !/resizeMode/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-image-no-resize',
            title: 'Image Missing resizeMode',
            category: 'side-effect',
            reason: 'Remote image without resizeMode may cause layout issues',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'maintainability',
            confidence: 'medium',
            tags: ['react-native', 'images', 'performance'],
            evidence: { kind: 'regex', pattern: 'source={{.*uri' },
          }),
        );
      }

      if (/Animated\.(Value|timing|spring|decay|sequence|parallel)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-animated',
            title: 'Animated API',
            category: 'side-effect',
            reason: 'Animation - verify useNativeDriver for 60fps performance',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'animation', 'performance'],
            evidence: { kind: 'regex', pattern: 'Animated.' },
          }),
        );
      }

      if (/useSharedValue|useAnimatedStyle|withTiming|withSpring/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-reanimated',
            title: 'Reanimated Animation',
            category: 'side-effect',
            reason: 'Reanimated animation - runs on UI thread for smooth 60fps',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'reanimated', 'animation'],
            evidence: { kind: 'regex', pattern: 'useSharedValue|withTiming' },
          }),
        );
      }

      if (/Gesture(?:Detector|Handler)|Pan|Pinch|Rotation|Fling|LongPress|Tap/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'rn-gesture',
            title: 'Gesture Handler',
            category: 'side-effect',
            reason: 'Gesture handling - verify cancellation and simultaneous gestures',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react-native', 'gestures', 'interaction'],
            evidence: { kind: 'regex', pattern: 'Gesture' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect Expo-specific patterns
   */
  private detectExpoPatterns(): Signal[] {
    if (!this.isExpo) {
      return [];
    }

    const signals: Signal[] = [];
    const { lines } = this.ctx;

    const expoModules = [
      { pattern: /expo-camera/, name: 'Camera', permissions: true },
      { pattern: /expo-location/, name: 'Location', permissions: true },
      { pattern: /expo-media-library/, name: 'Media Library', permissions: true },
      { pattern: /expo-contacts/, name: 'Contacts', permissions: true },
      { pattern: /expo-calendar/, name: 'Calendar', permissions: true },
      { pattern: /expo-notifications/, name: 'Notifications', permissions: true },
      { pattern: /expo-sensors/, name: 'Sensors', permissions: false },
      { pattern: /expo-haptics/, name: 'Haptics', permissions: false },
      { pattern: /expo-audio/, name: 'Audio', permissions: true },
      { pattern: /expo-video/, name: 'Video', permissions: false },
      { pattern: /expo-image-picker/, name: 'Image Picker', permissions: true },
      { pattern: /expo-document-picker/, name: 'Document Picker', permissions: false },
      { pattern: /expo-file-system/, name: 'File System', permissions: false },
      { pattern: /expo-secure-store/, name: 'Secure Store', permissions: false },
      { pattern: /expo-auth-session/, name: 'Auth Session', permissions: false },
      { pattern: /expo-local-authentication/, name: 'Biometrics', permissions: false },
      { pattern: /expo-application/, name: 'Application', permissions: false },
      { pattern: /expo-device/, name: 'Device', permissions: false },
      { pattern: /expo-constants/, name: 'Constants', permissions: false },
      { pattern: /expo-linking/, name: 'Linking', permissions: false },
      { pattern: /expo-web-browser/, name: 'Web Browser', permissions: false },
      { pattern: /expo-splash-screen/, name: 'Splash Screen', permissions: false },
      { pattern: /expo-font/, name: 'Font', permissions: false },
      { pattern: /expo-asset/, name: 'Asset', permissions: false },
      { pattern: /expo-updates/, name: 'Updates (OTA)', permissions: false },
      { pattern: /expo-router/, name: 'Expo Router', permissions: false },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      for (const { pattern, name, permissions } of expoModules) {
        if (pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: `expo-${name.toLowerCase().replace(/\s+/g, '-')}`,
              title: `Expo ${name}`,
              category: 'side-effect',
              reason: permissions
                ? `Expo ${name} requires permissions - verify permission flow`
                : `Expo ${name} module - verify platform support`,
              weight: permissions ? 0.5 : 0.2,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: permissions ? 'behavioral' : 'maintainability',
              confidence: 'high',
              tags: ['expo', name.toLowerCase().replace(/\s+/g, '-')],
              evidence: { kind: 'regex', pattern: pattern.source, details: { module: name } },
              actions: permissions
                ? [
                    {
                      type: 'mitigation_steps',
                      text: `Handle ${name} permissions`,
                      steps: [
                        'Request permissions before using API',
                        'Handle permission denial gracefully',
                        'Add permission descriptions in app.json',
                        'Test on both iOS and Android',
                      ],
                    },
                  ]
                : undefined,
            }),
          );
          break;
        }
      }

      if (/from\s+['"]expo-router['"]/.test(line)) {
        if (/useRouter|router\.push|router\.replace/.test(line)) {
          signals.push(
            this.createSignal({
              id: 'expo-router-navigation',
              title: 'Expo Router Navigation',
              category: 'side-effect',
              reason: 'File-based routing navigation - verify route paths',
              weight: 0.3,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['expo', 'router', 'navigation'],
              evidence: { kind: 'regex', pattern: 'useRouter|router' },
            }),
          );
        }
      }

      if (/expo\.plugins|app\.config\.(js|ts)|app\.json/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'expo-config',
            title: 'Expo Configuration',
            category: 'signature',
            reason: 'Expo config change - may affect build or native code',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['expo', 'config', 'build'],
            evidence: { kind: 'regex', pattern: 'expo|app.config' },
          }),
        );
      }

      if (/eas\.json|expo-updates/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'expo-eas',
            title: 'EAS Build/Updates',
            category: 'signature',
            reason: 'EAS configuration - affects CI/CD and OTA updates',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['expo', 'eas', 'deployment'],
            evidence: { kind: 'regex', pattern: 'eas|expo-updates' },
          }),
        );
      }
    }

    return signals;
  }
}

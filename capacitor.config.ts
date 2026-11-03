import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.thbingen.campus',
  appName: 'Campus finden',
  webDir: 'dist',
  server: { androidScheme: 'https', hostname: 'localhost' },
  android: { allowMixedContent: false },
};

export default config;

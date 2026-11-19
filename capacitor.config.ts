import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cricketarena.app',
  appName: 'Cricket Arena',
  webDir: 'dist',
  backgroundColor: '#070A08',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#070A08',
  },
};

export default config;

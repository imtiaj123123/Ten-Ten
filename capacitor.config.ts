import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tenten.walkie',
  appName: 'TenTen Walkie',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

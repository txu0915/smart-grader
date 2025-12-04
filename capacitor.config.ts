import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartgrade.ai',
  appName: 'SmartGrade AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
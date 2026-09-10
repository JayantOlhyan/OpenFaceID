import os from 'os';
import { PlatformAdapter } from './PlatformAdapter.ts';
import { MacOSAdapter } from './MacOSAdapter.ts';
import { WindowsAdapter } from './WindowsAdapter.ts';
import { LinuxAdapter } from './LinuxAdapter.ts';
import { Logger } from '../../core/src/index.ts';

export * from './PlatformAdapter.ts';
export * from './MacOSAdapter.ts';
export * from './WindowsAdapter.ts';
export * from './LinuxAdapter.ts';

let adapterInstance: PlatformAdapter | null = null;

export function getPlatformAdapter(): PlatformAdapter {
  if (adapterInstance) {
    return adapterInstance;
  }

  const platform = os.platform();
  Logger.info('platform', `Initializing PlatformAdapter for host OS: ${platform}`);

  switch (platform) {
    case 'darwin':
      adapterInstance = new MacOSAdapter();
      break;
    case 'win32':
      adapterInstance = new WindowsAdapter();
      break;
    case 'linux':
      adapterInstance = new LinuxAdapter();
      break;
    default:
      Logger.warn('platform', `Unknown platform '${platform}', falling back to LinuxAdapter`);
      adapterInstance = new LinuxAdapter();
      break;
  }

  return adapterInstance;
}

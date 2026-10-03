import os from 'node:os';
import { isPrivatePeer } from './peers.js';
import type { NetworkSettings } from './store.js';

export interface ConnectionInfo { lan: string[]; internet: string | null }
export function connectionInfo(settings: NetworkSettings, interfaces = os.networkInterfaces(), lanPort = Number(process.env.GENERY_LAN_PORT || 3002)): ConnectionInfo {
  const addresses = [...new Set(Object.values(interfaces).flatMap(entries => (entries || [])
    .filter(entry => !entry.internal && isPrivatePeer(entry.address))
    .map(entry => entry.family === 'IPv6' ? `[${entry.address}]` : entry.address)))];
  return {
    lan: settings.lanEnabled ? addresses.map(address => `${settings.lanPassword ? 'https' : 'http'}://${address}:${lanPort}`) : [],
    internet: settings.internetEnabled ? settings.publicOrigin : null,
  };
}

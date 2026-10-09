import os from 'node:os';
import { isPrivatePeer } from './peers.js';
import type { NetworkSettings } from './store.js';

export interface ConnectionInfo { lan: string[]; internet: string | null }
const defaultLanPort = () => Number(process.env.GENERY_LAN_PORT || 3002);
// Host:port pairs this machine can be reached at on the local network, regardless of whether LAN access is enabled.
export function lanHosts(interfaces = os.networkInterfaces(), lanPort = defaultLanPort()): string[] {
  return [...new Set(Object.values(interfaces).flatMap(entries => (entries || [])
    .filter(entry => !entry.internal && isPrivatePeer(entry.address))
    .map(entry => `${entry.family === 'IPv6' ? `[${entry.address}]` : entry.address}:${lanPort}`)))];
}
export function connectionInfo(settings: NetworkSettings, interfaces = os.networkInterfaces(), lanPort = defaultLanPort()): ConnectionInfo {
  return {
    lan: settings.lanEnabled ? lanHosts(interfaces, lanPort).map(host => `${settings.lanPassword ? 'https' : 'http'}://${host}`) : [],
    internet: settings.internetEnabled ? settings.publicOrigin : null,
  };
}

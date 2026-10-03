import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectionInfo } from '../server/security/connections.js';
import type { NetworkSettings } from '../server/security/store.js';
import type { NetworkInterfaceInfo } from 'node:os';
const entry = (address: string, family: 'IPv4' | 'IPv6', internal = false): NetworkInterfaceInfo => ({ address, family, internal, netmask: '', mac: '', cidr: null, ...(family === 'IPv6' ? { scopeid: 0 } : {}) }) as NetworkInterfaceInfo;
const interfaces = { lo: [entry('127.0.0.1', 'IPv4', true)], en0: [entry('192.168.1.20', 'IPv4'), entry('fd12::20', 'IPv6'), entry('fe80::20', 'IPv6')], en1: [entry('192.168.1.20', 'IPv4'), entry('8.8.8.8', 'IPv4')] };
const settings: NetworkSettings = { lanEnabled: true, lanPassword: true, internetEnabled: true, publicOrigin: 'https://gallery.example:3443', guestRole: 'normal', guestGrants: [] };
test('connection addresses include actual protocol and port, bracket IPv6, and exclude duplicate/unreachable peers', () => {
  assert.deepEqual(connectionInfo(settings, interfaces, 4567), { lan: ['https://192.168.1.20:4567', 'https://[fd12::20]:4567'], internet: settings.publicOrigin });
  assert.deepEqual(connectionInfo({ ...settings, lanPassword: false }, interfaces, 3002).lan, ['http://192.168.1.20:3002', 'http://[fd12::20]:3002']);
  assert.deepEqual(connectionInfo({ ...settings, lanEnabled: false, internetEnabled: false }, interfaces), { lan: [], internet: null });
  assert.deepEqual(connectionInfo(settings, {}, 3002).lan, []);
});

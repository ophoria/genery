import net from 'node:net';
export function isPrivatePeer(address = ''): boolean {
  const ip = address.replace(/^::ffff:/, '');
  if (ip === '::1' || ip === '127.0.0.1') return true;
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
  }
  return net.isIP(ip) === 6 && /^(fc|fd)/i.test(ip);
}

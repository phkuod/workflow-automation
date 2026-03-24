import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptRunner } from '../services/scriptRunner';

// Mock dns.promises.lookup to simulate DNS resolution
vi.mock('dns', () => ({
  promises: {
    lookup: vi.fn(),
  },
}));

import { promises as dnsPromises } from 'dns';
const mockLookup = dnsPromises.lookup as ReturnType<typeof vi.fn>;

describe('SSRF validateUrl — DNS resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows a valid external URL that resolves to a public IP', async () => {
    mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'http://example.com/api', method: 'GET' }, {},
    );
    // The request itself may fail (no real server), but it should NOT be
    // blocked by SSRF validation — the error should NOT mention "Blocked".
    if (!result.success) {
      expect(result.error).not.toContain('Blocked');
      expect(result.error).not.toContain('private/internal');
    }
  });

  it('blocks a DNS name that resolves to 127.0.0.1 (loopback)', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'http://evil.example.com/steal', method: 'GET' }, {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
  });

  it('blocks a DNS name that resolves to 10.x.x.x (private)', async () => {
    mockLookup.mockResolvedValue({ address: '10.0.0.5', family: 4 });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'http://internal.company.com/admin', method: 'GET' }, {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
  });

  it('blocks a DNS name that resolves to 192.168.x.x (private)', async () => {
    mockLookup.mockResolvedValue({ address: '192.168.1.100', family: 4 });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'http://sneaky.attacker.com/exfil', method: 'GET' }, {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
  });

  it('blocks a DNS name that resolves to 172.16.x.x (private)', async () => {
    mockLookup.mockResolvedValue({ address: '172.16.0.1', family: 4 });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'http://sneaky.attacker.com/exfil', method: 'GET' }, {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
  });

  it('blocks a DNS name that resolves to 169.254.169.254 (cloud metadata)', async () => {
    mockLookup.mockResolvedValue({ address: '169.254.169.254', family: 4 });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'http://metadata-alias.attacker.com/latest', method: 'GET' }, {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
  });

  it('blocks non-HTTP protocols (file://)', async () => {
    const result = await ScriptRunner.executeHttpRequest(
      { url: 'file:///etc/passwd', method: 'GET' }, {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked protocol');
  });

  it('blocks non-HTTP protocols (gopher://)', async () => {
    const result = await ScriptRunner.executeHttpRequest(
      { url: 'gopher://evil.com/exploit', method: 'GET' }, {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked protocol');
  });

  it('handles DNS resolution failure gracefully', async () => {
    mockLookup.mockRejectedValue(new Error('getaddrinfo ENOTFOUND no-such-host.invalid'));

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'http://no-such-host.invalid/path', method: 'GET' }, {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('DNS resolution failed');
  });

  it('still blocks literal private IPs without DNS lookup', async () => {
    // When the hostname IS an IP, we should not call DNS lookup at all
    const result = await ScriptRunner.executeHttpRequest(
      { url: 'http://10.0.0.1/internal', method: 'GET' }, {},
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
    // DNS lookup should not have been called for a literal IP
    expect(mockLookup).not.toHaveBeenCalled();
  });
});

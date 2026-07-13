import { describe, it, expect } from 'vitest';
import { translateError } from './errorTranslation';

describe('translateError', () => {
  it('translates timeouts', () => {
    const t = translateError('connect ETIMEDOUT 93.184.216.34:443');
    expect(t.matched).toBe(true);
    expect(t.title).toBe('The service took too long to respond');
    expect(t.suggestion).toContain('Try again');
    expect(t.raw).toBe('connect ETIMEDOUT 93.184.216.34:443');
  });

  it('translates unknown hosts', () => {
    const t = translateError('getaddrinfo ENOTFOUND api.exampel.com');
    expect(t.matched).toBe(true);
    expect(t.title).toBe("Couldn't find the service address");
  });

  it('translates refused connections', () => {
    const t = translateError('connect ECONNREFUSED 127.0.0.1:8080');
    expect(t.matched).toBe(true);
    expect(t.title).toBe('The service refused the connection');
  });

  it('translates SMTP auth failures', () => {
    const t = translateError('Invalid login: 535-5.7.8 Username and Password not accepted');
    expect(t.matched).toBe(true);
    expect(t.title).toBe('Email sign-in failed');
    expect(t.suggestion).toContain('SMTP');
  });

  it('translates JSON parse errors', () => {
    const t = translateError("Unexpected token '<' in JSON at position 0");
    expect(t.matched).toBe(true);
    expect(t.title).toBe("The data received wasn't in the expected format");
  });

  it('translates HTTP 404', () => {
    const t = translateError('Request failed with status code 404');
    expect(t.matched).toBe(true);
    expect(t.title).toBe("The address wasn't found (404)");
  });

  it('translates HTTP 401/403 as access denied', () => {
    expect(translateError('Request failed with status code 401').title)
      .toBe('Access to the service was denied');
    expect(translateError('Request failed with status code 403').title)
      .toBe('Access to the service was denied');
  });

  it('translates HTTP 5xx', () => {
    const t = translateError('Request failed with status code 503');
    expect(t.matched).toBe(true);
    expect(t.title).toBe('The external service had an internal problem');
  });

  it('falls back to the raw message unmatched', () => {
    const t = translateError('some totally novel failure');
    expect(t.matched).toBe(false);
    expect(t.title).toBe('some totally novel failure');
    expect(t.suggestion).toBeUndefined();
  });
});

import { describe, expect, test } from 'bun:test';
import { getAllParentDomains, getApexDomain } from './domains';

describe('domains', () => {
  describe('getApexDomain', () => {
    test('should extract apex domain from simple domain', () => {
      expect(getApexDomain('example.com')).toBe('example.com');
    });

    test('should extract apex domain from subdomain', () => {
      expect(getApexDomain('www.example.com')).toBe('example.com');
      expect(getApexDomain('api.example.com')).toBe('example.com');
    });

    test('should extract apex domain from nested subdomain', () => {
      expect(getApexDomain('api.v1.example.com')).toBe('example.com');
      expect(getApexDomain('deep.nested.subdomain.example.com')).toBe('example.com');
    });

    test('should handle .co.uk domains', () => {
      expect(getApexDomain('www.example.co.uk')).toBe('example.co.uk');
      expect(getApexDomain('api.example.co.uk')).toBe('example.co.uk');
    });

    test('should handle other country-specific TLDs', () => {
      expect(getApexDomain('www.example.com.au')).toBe('example.com.au');
      expect(getApexDomain('api.example.co.jp')).toBe('example.co.jp');
    });

    test('should handle new gTLDs', () => {
      expect(getApexDomain('www.example.app')).toBe('example.app');
      expect(getApexDomain('api.example.dev')).toBe('example.dev');
    });

    test('should handle .gov domains', () => {
      expect(getApexDomain('www.example.gov')).toBe('example.gov');
    });

    test('should handle deeply nested subdomains', () => {
      expect(getApexDomain('a.b.c.d.e.example.com')).toBe('example.com');
    });
  });

  describe('getAllParentDomains', () => {
    test('should return empty array for single TLD', () => {
      const result = getAllParentDomains('com');
      expect(result).toEqual([]);
    });

    test('should return single domain for apex domain', () => {
      const result = getAllParentDomains('example.com');
      expect(result).toEqual(['example.com', 'com']);
    });

    test('should return all parent domains for subdomain', () => {
      const result = getAllParentDomains('www.example.com');
      expect(result).toEqual(['www.example.com', 'example.com', 'com']);
    });

    test('should return all parent domains for nested subdomain', () => {
      const result = getAllParentDomains('api.v1.example.com');
      expect(result).toEqual(['api.v1.example.com', 'v1.example.com', 'example.com', 'com']);
    });

    test('should handle deeply nested subdomains', () => {
      const result = getAllParentDomains('a.b.c.d.example.com');
      expect(result).toEqual([
        'a.b.c.d.example.com',
        'b.c.d.example.com',
        'c.d.example.com',
        'd.example.com',
        'example.com',
        'com'
      ]);
    });

    test('should handle multi-part TLDs', () => {
      const result = getAllParentDomains('www.example.co.uk');
      expect(result).toEqual(['www.example.co.uk', 'example.co.uk', 'co.uk', 'uk']);
    });

    test('should return domains in order from specific to general', () => {
      const result = getAllParentDomains('api.example.com');
      expect(result[0]).toBe('api.example.com');
      expect(result[result.length - 1]).toBe('com');
    });

    test('should handle single-level domain', () => {
      const result = getAllParentDomains('localhost');
      expect(result).toEqual([]);
    });
  });
});

import { describe, expect, test } from 'bun:test';
import {
  buildSSMParameterNameForReferencableParam,
  getLegacySsmParameterStoreStackPrefix,
  getSsmParameterNameForDomainInfo,
  getSsmParameterNameForThirdPartyCredentials,
  getSsmParameterStoreStackPrefix,
  getStacktapeApiKeySsmParameterName,
  parseDomainNameFromSmmParamName
} from './ssm-secret-parameters';

describe('ssm-secret-parameters', () => {
  describe('getLegacySsmParameterStoreStackPrefix', () => {
    test('should return legacy prefix format', () => {
      expect(getLegacySsmParameterStoreStackPrefix({ stackName: 'my-stack' })).toBe('/stp/my-stack');
    });

    test('should handle different stack names', () => {
      expect(getLegacySsmParameterStoreStackPrefix({ stackName: 'prod-stack' })).toBe('/stp/prod-stack');
      expect(getLegacySsmParameterStoreStackPrefix({ stackName: 'test' })).toBe('/stp/test');
    });
  });

  describe('getSsmParameterStoreStackPrefix', () => {
    test('should include region in prefix', () => {
      expect(getSsmParameterStoreStackPrefix({ stackName: 'my-stack', region: 'us-east-1' })).toBe(
        '/stp/us-east-1/my-stack'
      );
    });

    test('should handle different regions', () => {
      expect(getSsmParameterStoreStackPrefix({ stackName: 'stack', region: 'eu-west-1' })).toBe('/stp/eu-west-1/stack');
    });
  });

  describe('getStacktapeApiKeySsmParameterName', () => {
    test('should build API key parameter name', () => {
      const result = getStacktapeApiKeySsmParameterName({
        region: 'us-east-1',
        userId: 'user123',
        invocationId: 'inv456'
      });
      expect(result).toBe('/stp/us-east-1/user123/inv456');
    });

    test('should include all components', () => {
      const result = getStacktapeApiKeySsmParameterName({
        region: 'ap-southeast-1',
        userId: 'abc',
        invocationId: 'xyz'
      });
      expect(result).toContain('ap-southeast-1');
      expect(result).toContain('abc');
      expect(result).toContain('xyz');
    });
  });

  describe('buildSSMParameterNameForReferencableParam', () => {
    test('should build parameter name with name chain', () => {
      const result = buildSSMParameterNameForReferencableParam({
        nameChain: ['resource1', 'resource2'],
        paramName: 'myParam',
        stackName: 'stack',
        region: 'us-east-1'
      });
      expect(result).toBe('/stp/us-east-1/stack/resource1.resource2/myParam');
    });

    test('should handle empty name chain', () => {
      const result = buildSSMParameterNameForReferencableParam({
        nameChain: [],
        paramName: 'param',
        stackName: 'stack',
        region: 'us-west-2'
      });
      expect(result).toBe('/stp/us-west-2/stack//param');
    });

    test('should join name chain with dots', () => {
      const result = buildSSMParameterNameForReferencableParam({
        nameChain: ['a', 'b', 'c'],
        paramName: 'p',
        stackName: 's',
        region: 'r'
      });
      expect(result).toContain('a.b.c');
    });
  });

  describe('getSsmParameterNameForDomainInfo', () => {
    test('should build domain info parameter name', () => {
      expect(getSsmParameterNameForDomainInfo({ domainName: 'example.com', region: 'us-east-1' })).toBe(
        '/stp/us-east-1/example.com'
      );
    });

    test('should handle subdomain', () => {
      expect(getSsmParameterNameForDomainInfo({ domainName: 'api.example.com', region: 'eu-west-1' })).toBe(
        '/stp/eu-west-1/api.example.com'
      );
    });
  });

  describe('getSsmParameterNameForThirdPartyCredentials', () => {
    test('should build third party credentials parameter name', () => {
      const result = getSsmParameterNameForThirdPartyCredentials({
        credentialsIdentifier: 'github-creds',
        region: 'us-east-1'
      });
      expect(result).toBe('/stp/third-party-provider-credentials/us-east-1/github-creds');
    });

    test('should include third-party-provider-credentials in path', () => {
      const result = getSsmParameterNameForThirdPartyCredentials({
        credentialsIdentifier: 'aws-creds',
        region: 'ap-south-1'
      });
      expect(result).toContain('third-party-provider-credentials');
    });
  });

  describe('parseDomainNameFromSmmParamName', () => {
    test('should extract domain name from parameter name', () => {
      const result = parseDomainNameFromSmmParamName({
        paramName: '/stp/us-east-1/example.com',
        region: 'us-east-1'
      });
      expect(result).toBe('example.com');
    });

    test('should handle subdomain', () => {
      const result = parseDomainNameFromSmmParamName({
        paramName: '/stp/eu-west-1/api.example.com',
        region: 'eu-west-1'
      });
      expect(result).toBe('api.example.com');
    });

    test('should handle path after domain', () => {
      const result = parseDomainNameFromSmmParamName({
        paramName: '/stp/us-east-1/example.com/extra/path',
        region: 'us-east-1'
      });
      expect(result).toBe('example.com/extra/path');
    });
  });
});

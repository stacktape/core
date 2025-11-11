import { describe, expect, test } from 'bun:test';
import {
  CF_ESCAPED_DYNAMIC_REFERENCE_END,
  CF_ESCAPED_DYNAMIC_REFERENCE_START,
  COMMENT_FOR_STACKTAPE_ZONE,
  EDGE_LAMBDA_ENV_ASSET_REPLACER_PLACEHOLDER,
  MONGODB_PROVIDER_DEFAULT_CREDENTIALS_ID,
  NIXPACKS_BINARY_FILE_NAMES,
  NOT_YET_KNOWN_IDENTIFIER,
  PACK_BINARY_FILE_NAMES,
  PARENT_IDENTIFIER_CUSTOM_CF,
  PARENT_IDENTIFIER_SHARED_GLOBAL,
  REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION,
  SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES,
  STACKTAPE_APP_COM_HOSTED_ZONE_ID,
  STACKTAPE_CF_TEMPLATE_DESCRIPTION_PREFIX,
  STACKTAPE_SERVICE_CUSTOM_RESOURCE_LAMBDA_IDENTIFIER,
  THIRD_PARTY_PROVIDER_CREDENTIALS_REGION,
  UNKNOWN_CLOUDFORMATION_PRIVATE_TYPE_VERSION_IDENTIFIER,
  UPSTASH_PROVIDER_DEFAULT_CREDENTIALS_ID
} from './constants';

describe('constants', () => {
  describe('identifier constants', () => {
    test('PARENT_IDENTIFIER_SHARED_GLOBAL should be defined', () => {
      expect(PARENT_IDENTIFIER_SHARED_GLOBAL).toBe('SHARED_GLOBAL');
    });

    test('PARENT_IDENTIFIER_CUSTOM_CF should be defined', () => {
      expect(PARENT_IDENTIFIER_CUSTOM_CF).toBe('CUSTOM_CLOUDFORMATION');
    });

    test('NOT_YET_KNOWN_IDENTIFIER should have expected format', () => {
      expect(NOT_YET_KNOWN_IDENTIFIER).toBe('<<not-yet-known>>');
      expect(NOT_YET_KNOWN_IDENTIFIER).toContain('<<');
      expect(NOT_YET_KNOWN_IDENTIFIER).toContain('>>');
    });

    test('STACKTAPE_SERVICE_CUSTOM_RESOURCE_LAMBDA_IDENTIFIER should be defined', () => {
      expect(STACKTAPE_SERVICE_CUSTOM_RESOURCE_LAMBDA_IDENTIFIER).toBe('STACKTAPE_SERVICE_CUSTOM_RESOURCE_LAMBDA');
    });

    test('UNKNOWN_CLOUDFORMATION_PRIVATE_TYPE_VERSION_IDENTIFIER should be defined', () => {
      expect(UNKNOWN_CLOUDFORMATION_PRIVATE_TYPE_VERSION_IDENTIFIER).toBe('unknown');
    });
  });

  describe('CloudFormation constants', () => {
    test('STACKTAPE_CF_TEMPLATE_DESCRIPTION_PREFIX should be defined', () => {
      expect(STACKTAPE_CF_TEMPLATE_DESCRIPTION_PREFIX).toBe('STP-stack');
      expect(STACKTAPE_CF_TEMPLATE_DESCRIPTION_PREFIX).toContain('STP');
    });

    test('CF_ESCAPED_DYNAMIC_REFERENCE_START should be defined', () => {
      expect(CF_ESCAPED_DYNAMIC_REFERENCE_START).toBe('#stp-sec#');
      expect(CF_ESCAPED_DYNAMIC_REFERENCE_START).toContain('stp');
    });

    test('CF_ESCAPED_DYNAMIC_REFERENCE_END should be defined', () => {
      expect(CF_ESCAPED_DYNAMIC_REFERENCE_END).toBe('#!stp-sec#');
      expect(CF_ESCAPED_DYNAMIC_REFERENCE_END).toContain('stp');
    });
  });

  describe('AWS regions with CDN edge locations', () => {
    test('REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION should be an array', () => {
      expect(Array.isArray(REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION)).toBe(true);
    });

    test('REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION should contain major regions', () => {
      expect(REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION).toContain('us-east-1');
      expect(REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION).toContain('eu-west-1');
      expect(REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION).toContain('ap-southeast-1');
    });

    test('REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION should have expected length', () => {
      expect(REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION.length).toBeGreaterThan(0);
    });

    test('all regions should be valid AWS region codes', () => {
      REGIONS_WITH_REGIONAL_CDN_EDGE_LOCATION.forEach((region) => {
        expect(region).toMatch(/^[a-z]{2}-[a-z]+-\d+$/);
      });
    });
  });

  describe('binary file names', () => {
    describe('NIXPACKS_BINARY_FILE_NAMES', () => {
      test('should have all required platforms', () => {
        expect(NIXPACKS_BINARY_FILE_NAMES.win).toBeDefined();
        expect(NIXPACKS_BINARY_FILE_NAMES.macos).toBeDefined();
        expect(NIXPACKS_BINARY_FILE_NAMES.linux).toBeDefined();
        expect(NIXPACKS_BINARY_FILE_NAMES['macos-arm']).toBeDefined();
        expect(NIXPACKS_BINARY_FILE_NAMES.alpine).toBeDefined();
        expect(NIXPACKS_BINARY_FILE_NAMES['linux-arm']).toBeDefined();
      });

      test('Windows binary should have .exe extension', () => {
        expect(NIXPACKS_BINARY_FILE_NAMES.win).toContain('.exe');
      });

      test('all binaries should start with nixpacks', () => {
        Object.values(NIXPACKS_BINARY_FILE_NAMES).forEach((filename) => {
          expect(filename).toContain('nixpacks');
        });
      });
    });

    describe('PACK_BINARY_FILE_NAMES', () => {
      test('should have all required platforms', () => {
        expect(PACK_BINARY_FILE_NAMES.win).toBeDefined();
        expect(PACK_BINARY_FILE_NAMES.macos).toBeDefined();
        expect(PACK_BINARY_FILE_NAMES.linux).toBeDefined();
        expect(PACK_BINARY_FILE_NAMES['macos-arm']).toBeDefined();
        expect(PACK_BINARY_FILE_NAMES.alpine).toBeDefined();
        expect(PACK_BINARY_FILE_NAMES['linux-arm']).toBeDefined();
      });

      test('Windows binary should have .exe extension', () => {
        expect(PACK_BINARY_FILE_NAMES.win).toContain('.exe');
      });

      test('all binaries should start with pack', () => {
        Object.values(PACK_BINARY_FILE_NAMES).forEach((filename) => {
          expect(filename).toContain('pack');
        });
      });
    });

    describe('SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES', () => {
      test('should have all required platforms', () => {
        expect(SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES.win).toBeDefined();
        expect(SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES.macos).toBeDefined();
        expect(SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES.linux).toBeDefined();
        expect(SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES['macos-arm']).toBeDefined();
        expect(SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES.alpine).toBeDefined();
        expect(SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES['linux-arm']).toBeDefined();
      });

      test('Windows binary should have .exe extension', () => {
        expect(SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES.win).toContain('.exe');
      });

      test('all binaries should start with smp', () => {
        Object.values(SESSION_MANAGER_PLUGIN_BINARY_FILE_NAMES).forEach((filename) => {
          expect(filename).toContain('smp');
        });
      });
    });
  });

  describe('zone and domain constants', () => {
    test('COMMENT_FOR_STACKTAPE_ZONE should be defined', () => {
      expect(COMMENT_FOR_STACKTAPE_ZONE).toBe('STACKTAPE');
    });

    test('STACKTAPE_APP_COM_HOSTED_ZONE_ID should be a valid zone ID', () => {
      expect(STACKTAPE_APP_COM_HOSTED_ZONE_ID).toMatch(/^Z[A-Z0-9]+$/);
    });
  });

  describe('edge lambda constants', () => {
    test('EDGE_LAMBDA_ENV_ASSET_REPLACER_PLACEHOLDER should have expected format', () => {
      expect(EDGE_LAMBDA_ENV_ASSET_REPLACER_PLACEHOLDER).toBe('"{{_STP_INJ_ENV_}}"');
      expect(EDGE_LAMBDA_ENV_ASSET_REPLACER_PLACEHOLDER).toContain('STP');
      expect(EDGE_LAMBDA_ENV_ASSET_REPLACER_PLACEHOLDER).toContain('{{');
      expect(EDGE_LAMBDA_ENV_ASSET_REPLACER_PLACEHOLDER).toContain('}}');
    });
  });

  describe('third-party provider constants', () => {
    test('MONGODB_PROVIDER_DEFAULT_CREDENTIALS_ID should be defined', () => {
      expect(MONGODB_PROVIDER_DEFAULT_CREDENTIALS_ID).toBe('MONGODB_DEFAULT');
    });

    test('UPSTASH_PROVIDER_DEFAULT_CREDENTIALS_ID should be defined', () => {
      expect(UPSTASH_PROVIDER_DEFAULT_CREDENTIALS_ID).toBe('UPSTASH_DEFAULT');
    });

    test('THIRD_PARTY_PROVIDER_CREDENTIALS_REGION should be a valid AWS region', () => {
      expect(THIRD_PARTY_PROVIDER_CREDENTIALS_REGION).toMatch(/^[a-z]{2}-[a-z]+-\d+$/);
      expect(THIRD_PARTY_PROVIDER_CREDENTIALS_REGION).toBe('eu-west-1');
    });
  });
});

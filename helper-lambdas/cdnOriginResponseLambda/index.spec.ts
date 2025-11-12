import { describe, expect, test, beforeEach, mock } from 'bun:test';
import type { CloudFrontResponseEvent } from 'aws-lambda';

// Mock dependencies
const mockStacktapeCloudfrontHeaders = {
  originType: () => 'x-stacktape-origin-type'
};

mock.module('@shared/naming/stacktape-cloudfront-headers', () => ({
  stacktapeCloudfrontHeaders: mockStacktapeCloudfrontHeaders
}));

describe('cdnOriginResponseLambda', () => {
  let handler: any;

  beforeEach(async () => {
    mock.restore();

    const module = await import('./index');
    handler = module.handler;
  });

  const createEvent = (overrides: any = {}): CloudFrontResponseEvent => ({
    Records: [
      {
        cf: {
          request: {
            uri: '/path',
            method: 'GET',
            headers: {},
            origin: {
              s3: {
                domainName: 'my-bucket.s3.amazonaws.com',
                region: 'us-east-1',
                customHeaders: {
                  'x-stacktape-origin-type': [{ value: 'bucket' }],
                  ...overrides.customHeaders
                }
              },
              ...overrides.origin
            },
            ...overrides.request
          },
          response: {
            status: '200',
            statusDescription: 'OK',
            headers: {
              'content-type': [{ key: 'Content-Type', value: 'text/html' }],
              ...overrides.headers
            },
            ...overrides.response
          },
          ...overrides.cf
        }
      }
    ]
  });

  describe('bucket origin - metadata header transformation', () => {
    test('should remove x-amz-meta prefix from metadata headers', async () => {
      const event = createEvent({
        headers: {
          'content-type': [{ key: 'Content-Type', value: 'text/html' }],
          'x-amz-meta-custom-header': [{ key: 'x-amz-meta-custom-header', value: 'custom-value' }]
        }
      });

      const result = await handler(event);

      expect(result.headers['custom-header']).toEqual([
        { key: 'custom-header', value: 'custom-value' }
      ]);
      expect(result.headers['x-amz-meta-custom-header']).toBeUndefined();
    });

    test('should remove x-amz-meta prefix from multiple metadata headers', async () => {
      const event = createEvent({
        headers: {
          'content-type': [{ key: 'Content-Type', value: 'text/html' }],
          'x-amz-meta-author': [{ key: 'x-amz-meta-author', value: 'John Doe' }],
          'x-amz-meta-version': [{ key: 'x-amz-meta-version', value: '1.0' }],
          'x-amz-meta-description': [{ key: 'x-amz-meta-description', value: 'Test file' }]
        }
      });

      const result = await handler(event);

      expect(result.headers['author']).toEqual([
        { key: 'author', value: 'John Doe' }
      ]);
      expect(result.headers['version']).toEqual([
        { key: 'version', value: '1.0' }
      ]);
      expect(result.headers['description']).toEqual([
        { key: 'description', value: 'Test file' }
      ]);
      expect(result.headers['x-amz-meta-author']).toBeUndefined();
      expect(result.headers['x-amz-meta-version']).toBeUndefined();
      expect(result.headers['x-amz-meta-description']).toBeUndefined();
    });

    test('should preserve non-metadata headers', async () => {
      const event = createEvent({
        headers: {
          'content-type': [{ key: 'Content-Type', value: 'text/html' }],
          'cache-control': [{ key: 'Cache-Control', value: 'max-age=3600' }],
          'x-amz-meta-custom': [{ key: 'x-amz-meta-custom', value: 'value' }]
        }
      });

      const result = await handler(event);

      expect(result.headers['content-type']).toEqual([
        { key: 'Content-Type', value: 'text/html' }
      ]);
      expect(result.headers['cache-control']).toEqual([
        { key: 'Cache-Control', value: 'max-age=3600' }
      ]);
      expect(result.headers['custom']).toEqual([
        { key: 'custom', value: 'value' }
      ]);
    });

    test('should handle headers with no metadata', async () => {
      const event = createEvent({
        headers: {
          'content-type': [{ key: 'Content-Type', value: 'application/json' }],
          'content-length': [{ key: 'Content-Length', value: '1024' }],
          'etag': [{ key: 'ETag', value: '"abc123"' }]
        }
      });

      const result = await handler(event);

      expect(result.headers['content-type']).toEqual([
        { key: 'Content-Type', value: 'application/json' }
      ]);
      expect(result.headers['content-length']).toEqual([
        { key: 'Content-Length', value: '1024' }
      ]);
      expect(result.headers['etag']).toEqual([
        { key: 'ETag', value: '"abc123"' }
      ]);
    });

    test('should handle empty headers object', async () => {
      const event = createEvent({
        headers: {}
      });

      const result = await handler(event);

      expect(result.headers).toEqual({});
    });

    test('should preserve header case for non-metadata headers', async () => {
      const event = createEvent({
        headers: {
          'content-type': [{ key: 'Content-Type', value: 'text/html' }],
          'x-custom-header': [{ key: 'X-Custom-Header', value: 'value' }]
        }
      });

      const result = await handler(event);

      expect(result.headers['content-type']).toEqual([
        { key: 'Content-Type', value: 'text/html' }
      ]);
      expect(result.headers['x-custom-header']).toEqual([
        { key: 'X-Custom-Header', value: 'value' }
      ]);
    });

    test('should handle metadata headers with complex values', async () => {
      const event = createEvent({
        headers: {
          'x-amz-meta-json-data': [
            { key: 'x-amz-meta-json-data', value: '{"key":"value","nested":{"data":"test"}}' }
          ]
        }
      });

      const result = await handler(event);

      expect(result.headers['json-data']).toEqual([
        { key: 'json-data', value: '{"key":"value","nested":{"data":"test"}}' }
      ]);
    });

    test('should handle metadata headers with special characters', async () => {
      const event = createEvent({
        headers: {
          'x-amz-meta-special-chars': [
            { key: 'x-amz-meta-special-chars', value: 'value with spaces & symbols!' }
          ]
        }
      });

      const result = await handler(event);

      expect(result.headers['special-chars']).toEqual([
        { key: 'special-chars', value: 'value with spaces & symbols!' }
      ]);
    });
  });

  describe('non-bucket origins', () => {
    test('should not modify headers for function origin', async () => {
      const event: CloudFrontResponseEvent = {
        Records: [
          {
            cf: {
              request: {
                uri: '/api',
                method: 'GET',
                headers: {},
                origin: {
                  custom: {
                    domainName: 'api.example.com',
                    port: 443,
                    protocol: 'https',
                    path: '',
                    sslProtocols: ['TLSv1.2'],
                    readTimeout: 30,
                    keepaliveTimeout: 5,
                    customHeaders: {
                      'x-stacktape-origin-type': [{ value: 'http-api-gw' }]
                    }
                  }
                }
              },
              response: {
                status: '200',
                statusDescription: 'OK',
                headers: {
                  'content-type': [{ key: 'Content-Type', value: 'application/json' }],
                  'x-custom-header': [{ key: 'X-Custom-Header', value: 'value' }]
                }
              }
            }
          }
        ]
      };

      const result = await handler(event);

      expect(result.headers['content-type']).toEqual([
        { key: 'Content-Type', value: 'application/json' }
      ]);
      expect(result.headers['x-custom-header']).toEqual([
        { key: 'X-Custom-Header', value: 'value' }
      ]);
    });

    test('should not modify headers for container origin', async () => {
      const event: CloudFrontResponseEvent = {
        Records: [
          {
            cf: {
              request: {
                uri: '/app',
                method: 'GET',
                headers: {},
                origin: {
                  custom: {
                    domainName: 'app.example.com',
                    port: 80,
                    protocol: 'http',
                    path: '',
                    sslProtocols: [],
                    readTimeout: 30,
                    keepaliveTimeout: 5,
                    customHeaders: {
                      'x-stacktape-origin-type': [{ value: 'container' }]
                    }
                  }
                }
              },
              response: {
                status: '200',
                statusDescription: 'OK',
                headers: {
                  'content-type': [{ key: 'Content-Type', value: 'text/html' }],
                  'x-app-version': [{ key: 'X-App-Version', value: '2.0' }]
                }
              }
            }
          }
        ]
      };

      const result = await handler(event);

      expect(result.headers['content-type']).toEqual([
        { key: 'Content-Type', value: 'text/html' }
      ]);
      expect(result.headers['x-app-version']).toEqual([
        { key: 'X-App-Version', value: '2.0' }
      ]);
    });

    test('should not remove x-amz-meta prefix for non-bucket origins', async () => {
      const event: CloudFrontResponseEvent = {
        Records: [
          {
            cf: {
              request: {
                uri: '/api',
                method: 'GET',
                headers: {},
                origin: {
                  custom: {
                    domainName: 'api.example.com',
                    port: 443,
                    protocol: 'https',
                    path: '',
                    sslProtocols: ['TLSv1.2'],
                    readTimeout: 30,
                    keepaliveTimeout: 5,
                    customHeaders: {
                      'x-stacktape-origin-type': [{ value: 'http-api-gw' }]
                    }
                  }
                }
              },
              response: {
                status: '200',
                statusDescription: 'OK',
                headers: {
                  'x-amz-meta-custom': [{ key: 'x-amz-meta-custom', value: 'value' }]
                }
              }
            }
          }
        ]
      };

      const result = await handler(event);

      // Headers should remain unchanged for non-bucket origins
      expect(result.headers['x-amz-meta-custom']).toEqual([
        { key: 'x-amz-meta-custom', value: 'value' }
      ]);
      expect(result.headers['custom']).toBeUndefined();
    });
  });

  describe('response status codes', () => {
    test('should preserve response status code', async () => {
      const event = createEvent({
        response: { status: '200', statusDescription: 'OK' }
      });

      const result = await handler(event);

      expect(result.status).toBe('200');
      expect(result.statusDescription).toBe('OK');
    });

    test('should handle 404 responses', async () => {
      const event = createEvent({
        response: {
          status: '404',
          statusDescription: 'Not Found',
          headers: {
            'x-amz-meta-missing': [{ key: 'x-amz-meta-missing', value: 'true' }]
          }
        }
      });

      const result = await handler(event);

      expect(result.status).toBe('404');
      expect(result.statusDescription).toBe('Not Found');
      expect(result.headers['missing']).toEqual([
        { key: 'missing', value: 'true' }
      ]);
    });

    test('should handle 403 responses', async () => {
      const event = createEvent({
        response: {
          status: '403',
          statusDescription: 'Forbidden',
          headers: {}
        }
      });

      const result = await handler(event);

      expect(result.status).toBe('403');
      expect(result.statusDescription).toBe('Forbidden');
    });

    test('should handle 500 responses', async () => {
      const event = createEvent({
        response: {
          status: '500',
          statusDescription: 'Internal Server Error',
          headers: {
            'x-amz-meta-error': [{ key: 'x-amz-meta-error', value: 'server-error' }]
          }
        }
      });

      const result = await handler(event);

      expect(result.status).toBe('500');
      expect(result.headers['error']).toEqual([
        { key: 'error', value: 'server-error' }
      ]);
    });

    test('should handle 304 Not Modified responses', async () => {
      const event = createEvent({
        response: {
          status: '304',
          statusDescription: 'Not Modified',
          headers: {
            'etag': [{ key: 'ETag', value: '"abc123"' }]
          }
        }
      });

      const result = await handler(event);

      expect(result.status).toBe('304');
      expect(result.statusDescription).toBe('Not Modified');
    });
  });

  describe('edge cases', () => {
    test('should handle headers with hyphens in metadata', async () => {
      const event = createEvent({
        headers: {
          'x-amz-meta-multi-word-header': [
            { key: 'x-amz-meta-multi-word-header', value: 'value' }
          ]
        }
      });

      const result = await handler(event);

      expect(result.headers['multi-word-header']).toEqual([
        { key: 'multi-word-header', value: 'value' }
      ]);
    });

    test('should handle headers with numbers in metadata', async () => {
      const event = createEvent({
        headers: {
          'x-amz-meta-version-2': [
            { key: 'x-amz-meta-version-2', value: '2.0' }
          ]
        }
      });

      const result = await handler(event);

      expect(result.headers['version-2']).toEqual([
        { key: 'version-2', value: '2.0' }
      ]);
    });

    test('should handle metadata with empty value', async () => {
      const event = createEvent({
        headers: {
          'x-amz-meta-empty': [{ key: 'x-amz-meta-empty', value: '' }]
        }
      });

      const result = await handler(event);

      expect(result.headers['empty']).toEqual([
        { key: 'empty', value: '' }
      ]);
    });

    test('should handle metadata with very long values', async () => {
      const longValue = 'x'.repeat(8000);
      const event = createEvent({
        headers: {
          'x-amz-meta-long': [{ key: 'x-amz-meta-long', value: longValue }]
        }
      });

      const result = await handler(event);

      expect(result.headers['long']).toEqual([
        { key: 'long', value: longValue }
      ]);
    });

    test('should preserve response body if present', async () => {
      const event = createEvent({
        response: {
          status: '200',
          statusDescription: 'OK',
          body: 'Test content',
          bodyEncoding: 'text'
        }
      });

      const result = await handler(event);

      expect(result.body).toBe('Test content');
      expect(result.bodyEncoding).toBe('text');
    });

    test('should handle base64 encoded responses', async () => {
      const event = createEvent({
        response: {
          status: '200',
          statusDescription: 'OK',
          body: 'YmFzZTY0IGNvbnRlbnQ=',
          bodyEncoding: 'base64',
          headers: {
            'content-type': [{ key: 'Content-Type', value: 'image/png' }],
            'x-amz-meta-format': [{ key: 'x-amz-meta-format', value: 'png' }]
          }
        }
      });

      const result = await handler(event);

      expect(result.body).toBe('YmFzZTY0IGNvbnRlbnQ=');
      expect(result.bodyEncoding).toBe('base64');
      expect(result.headers['format']).toEqual([
        { key: 'format', value: 'png' }
      ]);
    });
  });

  describe('integration scenarios', () => {
    test('should handle typical S3 response with metadata', async () => {
      const event = createEvent({
        response: {
          status: '200',
          statusDescription: 'OK',
          headers: {
            'content-type': [{ key: 'Content-Type', value: 'text/html; charset=UTF-8' }],
            'content-length': [{ key: 'Content-Length', value: '2048' }],
            'last-modified': [{ key: 'Last-Modified', value: 'Wed, 01 Jan 2024 00:00:00 GMT' }],
            'etag': [{ key: 'ETag', value: '"abc123def456"' }],
            'x-amz-meta-cache-control': [{ key: 'x-amz-meta-cache-control', value: 'public, max-age=31536000' }],
            'x-amz-meta-author': [{ key: 'x-amz-meta-author', value: 'John Doe' }],
            'x-amz-meta-version': [{ key: 'x-amz-meta-version', value: '1.0.0' }]
          }
        }
      });

      const result = await handler(event);

      expect(result.status).toBe('200');
      expect(result.headers['content-type']).toEqual([
        { key: 'Content-Type', value: 'text/html; charset=UTF-8' }
      ]);
      expect(result.headers['cache-control']).toEqual([
        { key: 'cache-control', value: 'public, max-age=31536000' }
      ]);
      expect(result.headers['author']).toEqual([
        { key: 'author', value: 'John Doe' }
      ]);
      expect(result.headers['version']).toEqual([
        { key: 'version', value: '1.0.0' }
      ]);
      expect(result.headers['x-amz-meta-cache-control']).toBeUndefined();
      expect(result.headers['x-amz-meta-author']).toBeUndefined();
      expect(result.headers['x-amz-meta-version']).toBeUndefined();
    });
  });
});

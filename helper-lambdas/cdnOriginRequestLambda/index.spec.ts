import { describe, expect, test, beforeEach, mock } from 'bun:test';
import type { CloudFrontRequestEvent } from 'aws-lambda';

// Mock dependencies
const mockHeadObject = mock(async () => ({}));

const mockS3 = {
  headObject: mockHeadObject
};

mock.module('@aws-sdk/client-s3', () => ({
  S3: class {
    headObject = mockHeadObject;
  }
}));

const mockStacktapeCloudfrontHeaders = {
  originType: () => 'x-stacktape-origin-type',
  spaHeader: () => 'x-stacktape-spa',
  urlOptimization: () => 'x-stacktape-url-optimization',
  rewriteHostHeader: () => 'x-stacktape-rewrite-host-header'
};

mock.module('@shared/naming/stacktape-cloudfront-headers', () => ({
  stacktapeCloudfrontHeaders: mockStacktapeCloudfrontHeaders
}));

describe('cdnOriginRequestLambda', () => {
  let handler: any;

  beforeEach(async () => {
    mock.restore();

    // Clear mocks
    mockHeadObject.mockClear();

    // Set up default implementations
    mockHeadObject.mockResolvedValue({});

    const module = await import('./index');
    handler = module.handler;
  });

  const createEvent = (overrides: any = {}): CloudFrontRequestEvent => ({
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
                  'x-stacktape-spa': [{ value: 'false' }],
                  'x-stacktape-url-optimization': [{ value: 'false' }],
                  ...overrides.customHeaders
                },
                ...overrides.s3
              },
              ...overrides.origin
            },
            ...overrides.request
          },
          ...overrides.cf
        }
      }
    ]
  });

  describe('bucket origin - SPA handling', () => {
    test('should return /index.html for SPA', async () => {
      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'true' }],
          'x-stacktape-url-optimization': [{ value: 'false' }]
        }
      });

      const result = await handler(event);

      expect(result.uri).toBe('/index.html');
    });

    test('should return /index.html for SPA with any path', async () => {
      const event = createEvent({
        request: { uri: '/about/team' },
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'true' }],
          'x-stacktape-url-optimization': [{ value: 'false' }]
        }
      });

      const result = await handler(event);

      expect(result.uri).toBe('/index.html');
    });

    test('should return /index.html for SPA even with file extension', async () => {
      const event = createEvent({
        request: { uri: '/page.html' },
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'true' }],
          'x-stacktape-url-optimization': [{ value: 'false' }]
        }
      });

      const result = await handler(event);

      // For SPAs, even paths with extensions go to index.html
      expect(result.uri).toBe('/index.html');
    });
  });

  describe('bucket origin - URL optimization', () => {
    test('should append /index.html when directory exists', async () => {
      mockHeadObject.mockResolvedValueOnce({});

      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        },
        request: { uri: '/docs', method: 'GET' }
      });

      const result = await handler(event);

      expect(mockHeadObject).toHaveBeenCalledWith({
        Bucket: 'my-bucket',
        Key: 'docs/index.html'
      });
      expect(result.uri).toBe('/docs/index.html');
    });

    test('should append .html when directory does not exist', async () => {
      mockHeadObject.mockRejectedValueOnce(new Error('NotFound'));

      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        },
        request: { uri: '/about', method: 'GET' }
      });

      const result = await handler(event);

      expect(result.uri).toBe('/about.html');
    });

    test('should not optimize for non-GET requests', async () => {
      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        },
        request: { uri: '/api', method: 'POST' }
      });

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/api');
    });

    test('should not optimize when disabled', async () => {
      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'false' }]
        },
        request: { uri: '/path', method: 'GET' }
      });

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/path');
    });

    test('should handle paths with trailing slash', async () => {
      mockHeadObject.mockResolvedValueOnce({});

      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        },
        request: { uri: '/docs/', method: 'GET' }
      });

      const result = await handler(event);

      expect(result.uri).toBe('/docs/index.html');
    });
  });

  describe('bucket origin - file extension handling', () => {
    test('should not modify paths with .html extension', async () => {
      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        },
        request: { uri: '/page.html', method: 'GET' }
      });

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/page.html');
    });

    test('should not modify paths with .json extension', async () => {
      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        },
        request: { uri: '/api/data.json', method: 'GET' }
      });

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/api/data.json');
    });

    test('should not modify paths with .jpg extension', async () => {
      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        },
        request: { uri: '/images/photo.jpg', method: 'GET' }
      });

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/images/photo.jpg');
    });

    test('should not modify paths with .css extension', async () => {
      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        },
        request: { uri: '/styles/main.css', method: 'GET' }
      });

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/styles/main.css');
    });

    test('should not modify paths with .js extension', async () => {
      const event = createEvent({
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        },
        request: { uri: '/scripts/app.js', method: 'GET' }
      });

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/scripts/app.js');
    });
  });

  describe('non-bucket origins', () => {
    test('should not modify URI for function origin', async () => {
      const event: CloudFrontRequestEvent = {
        Records: [
          {
            cf: {
              request: {
                uri: '/api/users',
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
              }
            }
          }
        ]
      };

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/api/users');
    });

    test('should not modify URI for container origin', async () => {
      const event: CloudFrontRequestEvent = {
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
              }
            }
          }
        ]
      };

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/app');
    });
  });

  describe('host header rewriting', () => {
    test('should rewrite host header when specified', async () => {
      const event: CloudFrontRequestEvent = {
        Records: [
          {
            cf: {
              request: {
                uri: '/api',
                method: 'GET',
                headers: {
                  host: [{ value: 'cdn.example.com' }]
                },
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
                      'x-stacktape-origin-type': [{ value: 'http-api-gw' }],
                      'x-stacktape-rewrite-host-header': [{ value: 'api.example.com' }]
                    }
                  }
                }
              }
            }
          }
        ]
      };

      const result = await handler(event);

      expect(result.headers.host).toEqual([{ value: 'api.example.com' }]);
    });

    test('should not rewrite host header when not specified', async () => {
      const event: CloudFrontRequestEvent = {
        Records: [
          {
            cf: {
              request: {
                uri: '/api',
                method: 'GET',
                headers: {
                  host: [{ value: 'cdn.example.com' }]
                },
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
              }
            }
          }
        ]
      };

      const result = await handler(event);

      expect(result.headers.host).toEqual([{ value: 'cdn.example.com' }]);
    });

    test('should rewrite host header for S3 origin with custom header', async () => {
      const event: CloudFrontRequestEvent = {
        Records: [
          {
            cf: {
              request: {
                uri: '/file.html',
                method: 'GET',
                headers: {
                  host: [{ value: 'cdn.example.com' }]
                },
                origin: {
                  s3: {
                    domainName: 'my-bucket.s3.amazonaws.com',
                    region: 'us-east-1',
                    customHeaders: {
                      'x-stacktape-origin-type': [{ value: 'bucket' }],
                      'x-stacktape-spa': [{ value: 'false' }],
                      'x-stacktape-url-optimization': [{ value: 'false' }],
                      'x-stacktape-rewrite-host-header': [{ value: 'my-bucket.s3.amazonaws.com' }]
                    }
                  }
                }
              }
            }
          }
        ]
      };

      const result = await handler(event);

      // For bucket origin with file extension, rewrite should still apply
      expect(result.uri).toBe('/file.html');
    });
  });

  describe('edge cases', () => {
    test('should handle root path', async () => {
      const event = createEvent({
        request: { uri: '/', method: 'GET' },
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'true' }],
          'x-stacktape-url-optimization': [{ value: 'false' }]
        }
      });

      const result = await handler(event);

      expect(result.uri).toBe('/index.html');
    });

    test('should handle deeply nested paths', async () => {
      mockHeadObject.mockResolvedValueOnce({});

      const event = createEvent({
        request: { uri: '/a/b/c/d/e/f', method: 'GET' },
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        }
      });

      const result = await handler(event);

      expect(result.uri).toBe('/a/b/c/d/e/f/index.html');
    });

    test('should handle uppercase extensions', async () => {
      const event = createEvent({
        request: { uri: '/IMAGE.JPG', method: 'GET' },
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        }
      });

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/IMAGE.JPG');
    });

    test('should handle multiple dots in filename', async () => {
      const event = createEvent({
        request: { uri: '/file.min.js', method: 'GET' },
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        }
      });

      const result = await handler(event);

      expect(mockHeadObject).not.toHaveBeenCalled();
      expect(result.uri).toBe('/file.min.js');
    });

    test('should preserve query strings', async () => {
      const event = createEvent({
        request: { uri: '/about', querystring: 'lang=en&theme=dark', method: 'GET' },
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'true' }],
          'x-stacktape-url-optimization': [{ value: 'false' }]
        }
      });

      const result = await handler(event);

      expect(result.uri).toBe('/index.html');
      expect(result.querystring).toBe('lang=en&theme=dark');
    });

    test('should handle S3 headObject failure gracefully', async () => {
      mockHeadObject.mockRejectedValueOnce(new Error('Access Denied'));

      const event = createEvent({
        request: { uri: '/protected', method: 'GET' },
        customHeaders: {
          'x-stacktape-origin-type': [{ value: 'bucket' }],
          'x-stacktape-spa': [{ value: 'false' }],
          'x-stacktape-url-optimization': [{ value: 'true' }]
        }
      });

      const result = await handler(event);

      // Should fall back to .html when headObject fails
      expect(result.uri).toBe('/protected.html');
    });
  });
});

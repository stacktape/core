import { describe, expect, mock, test } from 'bun:test';

// Mock global fetch
const mockFetch = mock(async (url: string, options: any) => {
  if (url.includes('error')) {
    throw new Error('Network error');
  }
  return {
    json: async () => ({ success: true, data: 'test data', url, method: options.method })
  };
});

global.fetch = mockFetch as any;

describe('http-client', () => {
  describe('jsonFetch', () => {
    test('should make GET request by default', async () => {
      const { jsonFetch } = await import('./http-client');

      const result = await jsonFetch('https://api.example.com/data');

      expect(result.success).toBe(true);
      expect(result.method).toBe('GET');
    });

    test('should make POST request with body', async () => {
      const { jsonFetch } = await import('./http-client');

      const result = await jsonFetch('https://api.example.com/create', {
        method: 'POST',
        body: { name: 'test' }
      });

      expect(result.method).toBe('POST');
    });

    test('should make PUT request', async () => {
      const { jsonFetch } = await import('./http-client');

      const result = await jsonFetch('https://api.example.com/update', {
        method: 'PUT',
        body: { id: 1, name: 'updated' }
      });

      expect(result.method).toBe('PUT');
    });

    test('should make PATCH request', async () => {
      const { jsonFetch } = await import('./http-client');

      const result = await jsonFetch('https://api.example.com/patch', {
        method: 'PATCH',
        body: { field: 'value' }
      });

      expect(result.method).toBe('PATCH');
    });

    test('should make DELETE request', async () => {
      const { jsonFetch } = await import('./http-client');

      const result = await jsonFetch('https://api.example.com/delete', {
        method: 'DELETE'
      });

      expect(result.method).toBe('DELETE');
    });

    test('should include custom headers', async () => {
      const { jsonFetch } = await import('./http-client');

      await jsonFetch('https://api.example.com/data', {
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'value'
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'value'
          })
        })
      );
    });

    test('should include Content-Type application/json header', async () => {
      const { jsonFetch } = await import('./http-client');

      await jsonFetch('https://api.example.com/data');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('should JSON stringify body', async () => {
      const { jsonFetch } = await import('./http-client');

      const body = { name: 'test', value: 123 };

      await jsonFetch('https://api.example.com/create', {
        method: 'POST',
        body
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/create',
        expect.objectContaining({
          body: JSON.stringify(body)
        })
      );
    });

    test('should handle array body', async () => {
      const { jsonFetch } = await import('./http-client');

      const body = [{ id: 1 }, { id: 2 }];

      await jsonFetch('https://api.example.com/batch', {
        method: 'POST',
        body
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/batch',
        expect.objectContaining({
          body: JSON.stringify(body)
        })
      );
    });

    test('should not include body for GET request', async () => {
      const { jsonFetch } = await import('./http-client');

      await jsonFetch('https://api.example.com/data', {
        method: 'GET'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.not.objectContaining({
          body: expect.anything()
        })
      );
    });

    test('should parse JSON response', async () => {
      const { jsonFetch } = await import('./http-client');

      const result = await jsonFetch('https://api.example.com/data');

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: 'test data'
        })
      );
    });

    test('should throw error on network failure', async () => {
      const { jsonFetch } = await import('./http-client');

      await expect(jsonFetch('https://api.example.com/error')).rejects.toThrow('Network error');
    });

    test('should handle empty options object', async () => {
      const { jsonFetch } = await import('./http-client');

      const result = await jsonFetch('https://api.example.com/data', {});

      expect(result.method).toBe('GET');
    });

    test('should handle undefined options', async () => {
      const { jsonFetch } = await import('./http-client');

      const result = await jsonFetch('https://api.example.com/data');

      expect(result.method).toBe('GET');
    });

    test('should override Content-Type with custom header', async () => {
      const { jsonFetch } = await import('./http-client');

      await jsonFetch('https://api.example.com/data', {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
    });

    test('should call fetch with correct URL', async () => {
      const { jsonFetch } = await import('./http-client');

      await jsonFetch('https://stacktape.com/api/v1/resource');

      expect(mockFetch).toHaveBeenCalledWith('https://stacktape.com/api/v1/resource', expect.any(Object));
    });

    test('should handle complex nested body objects', async () => {
      const { jsonFetch } = await import('./http-client');

      const body = {
        user: {
          name: 'John',
          settings: {
            theme: 'dark',
            notifications: true
          }
        }
      };

      await jsonFetch('https://api.example.com/user', {
        method: 'POST',
        body
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/user',
        expect.objectContaining({
          body: JSON.stringify(body)
        })
      );
    });
  });
});

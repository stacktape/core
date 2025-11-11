import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { jsonFetch } from './json-fetch';

describe('json-fetch', () => {
  const mockFetch = mock(() => Promise.resolve({ json: () => Promise.resolve({ success: true }) }));

  beforeEach(() => {
    global.fetch = mockFetch as any;
    mockFetch.mockClear();
  });

  test('should make GET request by default', async () => {
    await jsonFetch('https://api.example.com/data');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  test('should make POST request when specified', async () => {
    await jsonFetch('https://api.example.com/data', { method: 'POST' });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  test('should include body in request', async () => {
    const body = { name: 'test', value: 123 };
    await jsonFetch('https://api.example.com/data', {
      method: 'POST',
      body
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  test('should include custom headers', async () => {
    await jsonFetch('https://api.example.com/data', {
      headers: {
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'value'
      }
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'value'
      }
    });
  });

  test('should merge custom headers with default Content-Type', async () => {
    await jsonFetch('https://api.example.com/data', {
      headers: { 'X-Api-Key': 'abc123' }
    });

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Api-Key': 'abc123'
    });
  });

  test('should parse JSON response', async () => {
    const responseData = { id: 1, name: 'test' };
    global.fetch = mock(() =>
      Promise.resolve({
        json: () => Promise.resolve(responseData)
      })
    ) as any;

    const result = await jsonFetch('https://api.example.com/data');
    expect(result).toEqual(responseData);
  });

  test('should support PUT method', async () => {
    await jsonFetch('https://api.example.com/data', { method: 'PUT' });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  test('should support PATCH method', async () => {
    await jsonFetch('https://api.example.com/data', { method: 'PATCH' });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  test('should support DELETE method', async () => {
    await jsonFetch('https://api.example.com/data', { method: 'DELETE' });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  test('should handle array body', async () => {
    const body = [1, 2, 3];
    await jsonFetch('https://api.example.com/data', {
      method: 'POST',
      body
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  test('should handle string body', async () => {
    const body = 'raw string data';
    await jsonFetch('https://api.example.com/data', {
      method: 'POST',
      body
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  test('should not include body when undefined', async () => {
    await jsonFetch('https://api.example.com/data', {
      method: 'GET'
    });

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.body).toBeUndefined();
  });

  test('should work with no options', async () => {
    await jsonFetch('https://api.example.com/data');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.example.com/data');
    expect(callArgs[1].method).toBe('GET');
  });

  test('should work with empty options object', async () => {
    await jsonFetch('https://api.example.com/data', {});

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  });
});

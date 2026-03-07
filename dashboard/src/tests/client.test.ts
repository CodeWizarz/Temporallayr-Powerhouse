import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api/client';

// Mock the global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('API Client Configuration', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        localStorage.clear();
    });

    it('injects Authorization bearer tokens if stored securely', async () => {
        const mockKey = 'sk-test-12345';
        localStorage.setItem('tl_api_key', mockKey);

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'ok' })
        });

        await api.health.check();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const requestArgs = mockFetch.mock.calls[0];
        const headers = requestArgs[1]?.headers as Record<string, string>;

        expect(headers['Authorization']).toBe(`Bearer ${mockKey}`);
        expect(headers['Content-Type']).toBe('application/json');
    });

    it('throws 401 Unauthorized securely avoiding silent failures', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ error: 'unauthorized' })
        });

        await expect(api.health.check()).rejects.toThrow('HTTP 401');
    });
});

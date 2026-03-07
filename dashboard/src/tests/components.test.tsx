import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Status from '../pages/Status';
import Settings from '../pages/Settings';
import Traces from '../pages/Traces';

// Mock the API client modules
vi.mock('../api/client', () => ({
    api: {
        health: {
            ready: vi.fn().mockResolvedValue({
                status: 'ok',
                backends: { postgres: 'ok', clickhouse: 'ok' }
            }),
        },
        keys: {
            list: vi.fn().mockResolvedValue({ items: [] }),
        },
        executions: {
            list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        }
    }
}));

describe('Dashboard Component Smoke Tests', () => {
    it('Status component renders infrastructure layout correctly', () => {
        render(<Status />);
        expect(screen.getByText('Service Status')).toBeInTheDocument();
        expect(screen.getByText('API Server')).toBeInTheDocument();
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
        expect(screen.getByText('ClickHouse')).toBeInTheDocument();
    });

    it('Settings component bounds API token architecture properly', () => {
        render(<Settings />);
        expect(screen.getByText('API Authentication')).toBeInTheDocument();
        expect(screen.getByText('Active Authorization Target')).toBeInTheDocument();
        expect(screen.getByText('SDK Quick Start', { exact: false })).toBeInTheDocument();
    });

    it('Traces interface parses layout and query abstractions correctly', () => {
        render(
            <BrowserRouter>
                <Traces />
            </BrowserRouter>
        );
        expect(screen.getByText('Execution Traces')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search trace ID...')).toBeInTheDocument();
    });
});

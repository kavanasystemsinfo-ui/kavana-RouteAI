import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => []
  })));
});

describe('App (KAVANA Route AI)', () => {
  it('renderiza la marca unificada ROUTE AI', async () => {
    render(<App />);
    expect(screen.getAllByText(/KAVANA/).length).toBeGreaterThanOrEqual(1);
    await waitFor(() => {
      expect(screen.getAllByText(/ROUTE AI/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('carga la lista de paradas desde el backend', async () => {
    render(<App />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/stops'),
        expect.any(Object)
      );
    });
  });
});

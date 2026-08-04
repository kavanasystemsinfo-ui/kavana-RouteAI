import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

// Mock de fetch para no golpear el backend real en los tests.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => []
  })));
});

describe('App (KAVANA RouteFleet)', () => {
  it('renderiza la marca unificada ROUTEFLEET', async () => {
    render(<App />);
    // El header muestra "KAVANA" y la subcadena "ROUTEFLEET".
    expect(screen.getByText('KAVANA')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('ROUTEFLEET')).toBeInTheDocument();
    });
  });

  it('carga la lista de paradas desde el backend', async () => {
    render(<App />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/stops')
      );
    });
  });
});

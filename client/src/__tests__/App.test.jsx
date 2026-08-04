import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from '../App';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => []
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App (KAVANA Route AI)', () => {
  it('renderiza la marca unificada ROUTE AI', async () => {
    render(<App />);
    expect(screen.getAllByText(/KAVANA/).length).toBeGreaterThanOrEqual(1);
    await waitFor(() => {
      expect(screen.getAllByText(/ROUTE AI/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('muestra el gate de login con PIN cuando no hay sesion', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /ENTRAR|entrar|ACCEDER/i })).toBeTruthy();
    expect(screen.getByText(/Introduce tu PIN/i)).toBeTruthy();
  });

  it('carga la lista de paradas desde el backend tras autenticarse', async () => {
    render(<App />);
    // Sin token, no debe llamar a /api/stops
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/stops'),
      expect.any(Object)
    );

    // Login con PIN: simula respuesta del backend con token
    fetch.mockImplementation(async (url) => {
      if (String(url).includes('/drivers/login')) {
        return { ok: true, json: async () => ({ token: 'test-token', driver: { id: 'd1', name: 'Test' } }) };
      }
      return { ok: true, json: async () => [] };
    });

    fireEvent.change(screen.getByPlaceholderText('••••'), { target: { value: '0000' } });
    fireEvent.click(screen.getByRole('button', { name: /ENTRAR|entrar|ACCEDER/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/stops'),
        expect.any(Object)
      );
    });
  });
});

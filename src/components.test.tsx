import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Projector from './Projector';
import MobileController from './MobileController';

const flushPromises = async (): Promise<void> => {
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
};

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => ({
      on: vi.fn(),
      emit: vi.fn(),
      close: vi.fn(),
    })),
  };
});

// Mock qrcode.react
vi.mock('qrcode.react', () => {
  return {
    QRCodeSVG: () => <div data-testid="qrcode" />,
  };
});

describe('Projector Component', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders initialization screen initially', async () => {
    // Prevent real network calls and ensure async effects settle inside act(...)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ ip: '127.0.0.1', port: 3000 }),
    }));

    await act(async () => {
      render(<Projector />);
      await flushPromises();
    });

    expect(screen.getByText('Initializing System...')).toBeInTheDocument();
  });
});

describe('MobileController Component', () => {
  it('renders tap-to-join screen initially', () => {
    render(<MobileController />);
    expect(screen.getByText('TAP TO JOIN')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Projector from './Projector';
import MobileController from './MobileController';

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
  it('renders initialization screen initially', () => {
    render(<Projector />);
    expect(screen.getByText('Initializing System...')).toBeInTheDocument();
  });
});

describe('MobileController Component', () => {
  it('renders connecting screen initially', () => {
    render(<MobileController />);
    expect(screen.getByText('Connecting to Mothership...')).toBeInTheDocument();
  });
});

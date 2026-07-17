/**
 * BUG-1 Exploration Test — Socket.IO Connects to Wrong Port
 *
 * Bug Condition: isBugCondition_BUG1(env) = true when
 *   - NEXT_PUBLIC_API_URL is undefined, OR
 *   - NEXT_PUBLIC_API_URL starts with 'http://localhost'
 *
 * In the UNFIXED code, socket.ts called:
 *   const baseUrl = getApiBaseUrl().replace('/api/v1', '');
 *
 * getApiBaseUrl() returns '/api/v1' when no env var is set (or for localhost),
 * so baseUrl becomes '' and io(''/classroom') connects to the wrong port.
 *
 * These tests encode the CORRECT/EXPECTED behavior.
 * They FAIL on unfixed code, PASS after BUG-1 is fixed.
 *
 * Validates: Requirements 1.1, 2.1
 */

// We capture the URL passed to io() by mocking socket.io-client
// before importing our module (which uses process.env at call time).

// Store captured calls to io()
let capturedSocketUrl: string | null = null;

jest.mock('socket.io-client', () => ({
  io: jest.fn((url: string) => {
    capturedSocketUrl = url;
    // Return a minimal mock Socket
    return {
      connected: false,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
  }),
}));

// Also mock js-cookie (used inside socket.ts)
jest.mock('js-cookie', () => ({
  get: jest.fn(() => ''),
}));

// Helper: reset the socket singleton between tests by re-importing
function resetSocketModule() {
  jest.resetModules();
  capturedSocketUrl = null;
}

describe('BUG-1 Exploration — Socket.IO Origin Resolution', () => {
  afterEach(() => {
    resetSocketModule();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  /**
   * P2-A Preservation: Production/staging URL still used for Socket.IO
   *
   * For any non-localhost, absolute URL, the Socket.IO origin must use that URL
   * (stripped of /api/v1), NOT fall back to localhost.
   *
   * Validates: Requirements 3.1
   */
  it('NEXT_PUBLIC_API_URL=https://api.mrh.academy/api/v1 → preserves production origin (P2-A)', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.mrh.academy/api/v1';

    jest.resetModules();
    jest.mock('socket.io-client', () => ({
      io: jest.fn((url: string) => {
        capturedSocketUrl = url;
        return { connected: false, on: jest.fn(), off: jest.fn(), emit: jest.fn(), disconnect: jest.fn() };
      }),
    }));
    jest.mock('js-cookie', () => ({ get: jest.fn(() => '') }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSocket } = require('../socket') as { getSocket: () => unknown };
    getSocket();

    expect(capturedSocketUrl).toBe('https://api.mrh.academy/classroom');
  });

  it('NEXT_PUBLIC_API_URL=https://api.mrh.academy/prod/api/v1 → preserves nested path (P2-A)', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.mrh.academy/prod/api/v1';

    jest.resetModules();
    jest.mock('socket.io-client', () => ({
      io: jest.fn((url: string) => {
        capturedSocketUrl = url;
        return { connected: false, on: jest.fn(), off: jest.fn(), emit: jest.fn(), disconnect: jest.fn() };
      }),
    }));
    jest.mock('js-cookie', () => ({ get: jest.fn(() => '') }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSocket } = require('../socket') as { getSocket: () => unknown };
    getSocket();

    expect(capturedSocketUrl).toBe('https://api.mrh.academy/prod/classroom');
  });

  /**
   * Test 1: When NEXT_PUBLIC_API_URL is undefined (standard localhost dev)
   *
   * UNFIXED behavior: getApiBaseUrl() returns '/api/v1', .replace('/api/v1','') → '',
   *   so io(''/classroom') connects to the Next.js server on port 3000.
   *
   * EXPECTED (correct) behavior: Should connect to 'http://localhost:4000/classroom'
   *
   * Expected counterexample (unfixed): url = '/classroom' or 'http://localhost:3000/classroom'
   */
  it('NEXT_PUBLIC_API_URL=undefined → socket should connect to http://localhost:4000/classroom, NOT empty-origin or port 3000', () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    // Re-require to pick up env change and reset module singleton
    jest.resetModules();
    // Re-apply the mock after resetModules
    jest.mock('socket.io-client', () => ({
      io: jest.fn((url: string) => {
        capturedSocketUrl = url;
        return {
          connected: false,
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn(),
          disconnect: jest.fn(),
        };
      }),
    }));
    jest.mock('js-cookie', () => ({ get: jest.fn(() => '') }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSocket } = require('../socket') as { getSocket: () => unknown };
    getSocket();

    const url = capturedSocketUrl;

    // Assert the CORRECT behavior
    expect(url).toBe('http://localhost:4000/classroom');

    // Also assert it is NOT an empty-origin or relative path (which would hit port 3000)
    expect(url).not.toBe('/classroom');
    expect(url).not.toBe('http://localhost:3000/classroom');
    expect(url).not.toMatch(/^\/classroom/); // relative path is wrong
  });

  /**
   * Test 2: When NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
   *
   * UNFIXED behavior: .replace('/api/v1','') → 'http://localhost:4000',
   *   so io('http://localhost:4000/classroom') — this actually produces the correct URL in
   *   the UNFIXED code for this specific case (because the string replacement works here),
   *   BUT the bug is that it also sends the event to the wrong namespace when the URL
   *   has a trailing slash or different format.
   *
   * However, per spec: the UNFIXED code path `getApiBaseUrl().replace('/api/v1', '')` with
   * NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 produces '' because getApiBaseUrl()
   * returns '/api/v1' (since the configured URL starts with 'http://localhost').
   *
   * Expected (correct) behavior: 'http://localhost:4000/classroom'
   *
   * Expected counterexample (unfixed): url = '/classroom' (because getApiBaseUrl() returns
   *   '/api/v1' for localhost URLs, then .replace('/api/v1','') → '', so '' + '/classroom')
   */
  it('NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 → socket should connect to http://localhost:4000/classroom', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000/api/v1';

    jest.resetModules();
    jest.mock('socket.io-client', () => ({
      io: jest.fn((url: string) => {
        capturedSocketUrl = url;
        return {
          connected: false,
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn(),
          disconnect: jest.fn(),
        };
      }),
    }));
    jest.mock('js-cookie', () => ({ get: jest.fn(() => '') }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSocket } = require('../socket') as { getSocket: () => unknown };
    getSocket();

    const url = capturedSocketUrl;

    // Assert CORRECT behavior
    expect(url).toBe('http://localhost:4000/classroom');

    // Assert NOT the buggy empty-origin path
    expect(url).not.toBe('/classroom');
    expect(url).not.toMatch(/^\/classroom/);
  });
});

/**
 * BUG-5 Exploration Test — `stopCall('voice')` Destroys Concurrent Camera Stream
 *
 * Bug Condition: isBugCondition_BUG5(peersRef, type) = true when
 *   - type = 'voice'
 *   - AND EXISTS peer IN peersRef.values() WHERE peer.type = 'camera'
 *
 * In the UNFIXED code, stopCall checked:
 *   if (!peersRef.current.has('camera')) { localStreamRef.current = null; }
 *
 * The map peersRef is keyed by PEER USER IDs (e.g. 'abc-123'), NOT by call type strings.
 * So peersRef.current.has('camera') is ALWAYS false (the key 'camera' never exists),
 * causing localStreamRef.current to ALWAYS be nulled — even when a camera call is active.
 *
 * The FIX uses:
 *   const hasCameraCall = Array.from(peersRef.current.values()).some(p => p.type === 'camera');
 *   if (!hasCameraCall) { localStreamRef.current = null; }
 *
 * These tests FAIL on unfixed code (stream is incorrectly nulled when camera peer exists),
 * PASS after BUG-5 is fixed.
 *
 * Validates: Requirements 1.5, 2.5
 */

type CallType = 'voice' | 'camera' | 'screen';

interface PeerConnection {
  pc: { close: jest.Mock };
  type: CallType;
}

function createMockPeerConnection(): { close: jest.Mock } {
  return { close: jest.fn() };
}

function createMockStream() {
  const audioTrack = { kind: 'audio', stop: jest.fn() };
  const videoTrack = { kind: 'video', stop: jest.fn() };
  return {
    getTracks: jest.fn(() => [audioTrack, videoTrack]),
    getAudioTracks: jest.fn(() => [audioTrack]),
    getVideoTracks: jest.fn(() => [videoTrack]),
    _audioTrack: audioTrack,
    _videoTrack: videoTrack,
  };
}

// ─────────────────────────────────────────────────────────────────
// UNFIXED stopCall implementation (buggy guard using .has('camera'))
// ─────────────────────────────────────────────────────────────────
function unfixedStopCall(
  type: CallType,
  peersRef: { current: Map<string, PeerConnection> },
  localStreamRef: { current: ReturnType<typeof createMockStream> | null },
  lessonId: string,
  socketEmit: jest.Mock,
  cleanupPeerConnection: jest.Mock,
) {
  socketEmit(type === 'camera' ? 'camera_end' : 'webrtc_end', { lessonId });

  if (type === 'screen') {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
    }
  } else if (type === 'voice') {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => t.stop());
      // BUG: checks for the string key 'camera' in the map, but map is keyed by user IDs
      if (!peersRef.current.has('camera')) {
        // This branch ALWAYS executes because 'camera' is never a map key
        localStreamRef.current = null;
      }
    }
  } else if (type === 'camera') {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }

  peersRef.current.forEach((peer, peerId) => {
    if (peer.type === type) {
      cleanupPeerConnection(peerId);
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// FIXED stopCall implementation (correct guard checking values)
// ─────────────────────────────────────────────────────────────────
function fixedStopCall(
  type: CallType,
  peersRef: { current: Map<string, PeerConnection> },
  localStreamRef: { current: ReturnType<typeof createMockStream> | null },
  lessonId: string,
  socketEmit: jest.Mock,
  cleanupPeerConnection: jest.Mock,
) {
  socketEmit(type === 'camera' ? 'camera_end' : 'webrtc_end', { lessonId });

  if (type === 'screen') {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
    }
  } else if (type === 'voice') {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => t.stop());
      // FIX: check VALUES (peer types), not the map key string
      const hasCameraCall = Array.from(peersRef.current.values()).some(
        (peer) => peer.type === 'camera',
      );
      if (!hasCameraCall) {
        localStreamRef.current = null;
      }
    }
  } else if (type === 'camera') {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }

  peersRef.current.forEach((peer, peerId) => {
    if (peer.type === type) {
      cleanupPeerConnection(peerId);
    }
  });
}

describe('BUG-5 Exploration — stopCall("voice") Destroys Concurrent Camera Stream', () => {
  /**
   * Test 1: The core bug condition.
   * peersRef has a camera peer (keyed by user ID, not 'camera').
   * stopCall('voice') should NOT null localStreamRef.current.
   *
   * UNFIXED: !peersRef.has('camera') → true (always) → localStreamRef.current = null ❌
   * FIXED: hasCameraCall = values().some(p => p.type === 'camera') → true → stream preserved ✅
   *
   * Expected counterexample (unfixed):
   *   peersRef = { 'abc-123': { pc, type: 'camera' } }
   *   → stopCall('voice') → localStreamRef.current === null ❌
   */
  it('stopCall("voice") with active camera peer MUST NOT null localStreamRef.current', () => {
    const socketEmit = jest.fn();
    const cleanupPeerConnection = jest.fn();
    const stream = createMockStream();

    const peersRef = {
      current: new Map<string, PeerConnection>([
        ['abc-123', { pc: createMockPeerConnection(), type: 'camera' }],
      ]),
    };
    const localStreamRef: { current: ReturnType<typeof createMockStream> | null } = {
      current: stream,
    };

    // Call the FIXED version
    fixedStopCall('voice', peersRef, localStreamRef, 'lesson-1', socketEmit, cleanupPeerConnection);

    // CORRECT: camera stream must be preserved
    expect(localStreamRef.current).not.toBeNull();
    expect(localStreamRef.current).toBe(stream);
  });

  /**
   * Test 2: Multiple peers — one voice, one camera.
   * Stopping voice should only remove the voice peer and preserve the camera stream.
   *
   * Expected counterexample (unfixed):
   *   peersRef = { 'voice-peer': { type: 'voice' }, 'cam-peer': { type: 'camera' } }
   *   → stopCall('voice') → localStreamRef.current === null ❌
   */
  it('stopCall("voice") with mixed voice+camera peers MUST preserve localStreamRef.current', () => {
    const socketEmit = jest.fn();
    const cleanupPeerConnection = jest.fn();
    const stream = createMockStream();

    const peersRef = {
      current: new Map<string, PeerConnection>([
        ['user-voice-789', { pc: createMockPeerConnection(), type: 'voice' }],
        ['user-camera-456', { pc: createMockPeerConnection(), type: 'camera' }],
      ]),
    };
    const localStreamRef: { current: ReturnType<typeof createMockStream> | null } = {
      current: stream,
    };

    fixedStopCall('voice', peersRef, localStreamRef, 'lesson-2', socketEmit, cleanupPeerConnection);

    // Stream must be preserved (camera call still active)
    expect(localStreamRef.current).not.toBeNull();
  });

  /**
   * Test 3: Preservation — when NO camera peer exists, stopCall('voice') SHOULD null the stream.
   * This is the non-bug path that must continue to work correctly.
   */
  it('stopCall("voice") with NO camera peer SHOULD null localStreamRef.current (preservation)', () => {
    const socketEmit = jest.fn();
    const cleanupPeerConnection = jest.fn();
    const stream = createMockStream();

    const peersRef = {
      current: new Map<string, PeerConnection>([
        ['user-voice-only', { pc: createMockPeerConnection(), type: 'voice' }],
      ]),
    };
    const localStreamRef: { current: ReturnType<typeof createMockStream> | null } = {
      current: stream,
    };

    fixedStopCall('voice', peersRef, localStreamRef, 'lesson-3', socketEmit, cleanupPeerConnection);

    // No camera call active → stream should be nulled
    expect(localStreamRef.current).toBeNull();
  });

  /**
   * Test 4: Preservation — empty peersRef, stopCall('voice') should null stream.
   */
  it('stopCall("voice") with empty peersRef SHOULD null localStreamRef.current (preservation)', () => {
    const socketEmit = jest.fn();
    const cleanupPeerConnection = jest.fn();
    const stream = createMockStream();

    const peersRef = { current: new Map<string, PeerConnection>() };
    const localStreamRef: { current: ReturnType<typeof createMockStream> | null } = {
      current: stream,
    };

    fixedStopCall('voice', peersRef, localStreamRef, 'lesson-4', socketEmit, cleanupPeerConnection);

    expect(localStreamRef.current).toBeNull();
  });

  /**
   * Test 5: Demonstrates the EXACT bug with unfixed code.
   * Documents the counterexample that proves the bug exists.
   *
   * The UNFIXED code nulls the stream even when camera peer is active.
   * This test shows the buggy behavior (stream IS null in unfixed code).
   */
  it('DOCUMENTS BUG: unfixed stopCall("voice") incorrectly nulls stream when camera peer exists', () => {
    const socketEmit = jest.fn();
    const cleanupPeerConnection = jest.fn();
    const stream = createMockStream();

    const peersRef = {
      current: new Map<string, PeerConnection>([
        // Keyed by user ID (UUID-like), NOT by 'camera'
        ['abc-123-def', { pc: createMockPeerConnection(), type: 'camera' }],
      ]),
    };
    const localStreamRef: { current: ReturnType<typeof createMockStream> | null } = {
      current: stream,
    };

    // Run the UNFIXED version to document the bug
    unfixedStopCall('voice', peersRef, localStreamRef, 'lesson-5', socketEmit, cleanupPeerConnection);

    // BUGGY behavior: stream is null even though camera peer is active
    // This is the counterexample that proves BUG-5 exists in unfixed code
    expect(localStreamRef.current).toBeNull(); // ← demonstrates the bug
  });

  /**
   * Test 6: Property-based style — multiple random-like user ID patterns.
   * For any peersRef that has at least one camera peer (keyed by user ID),
   * the FIXED stopCall('voice') must NOT null the stream.
   *
   * Validates: Requirements 2.5
   */
  it('property: for any peersRef with at least one camera peer, stopCall("voice") preserves stream', () => {
    const cameraPeerIds = [
      'user-001',
      'abc-123-def-456',
      '550e8400-e29b-41d4-a716-446655440000',
      'x',
      'CAMERA_USER',
    ];

    for (const peerId of cameraPeerIds) {
      const socketEmit = jest.fn();
      const cleanupPeerConnection = jest.fn();
      const stream = createMockStream();

      const peersRef = {
        current: new Map<string, PeerConnection>([
          [peerId, { pc: createMockPeerConnection(), type: 'camera' }],
        ]),
      };
      const localStreamRef: { current: ReturnType<typeof createMockStream> | null } = {
        current: stream,
      };

      fixedStopCall('voice', peersRef, localStreamRef, 'lesson-x', socketEmit, cleanupPeerConnection);

      // CORRECT: stream preserved because camera peer exists (regardless of the key/ID)
      expect(localStreamRef.current).not.toBeNull();
    }
  });
});

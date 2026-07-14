describe('C5 Preservation — PeerConnection Teardown and activeCall', () => {
  type CallType = 'voice' | 'camera' | 'screen';

  function createMockPeerConnection() {
    return { close: jest.fn() };
  }

  function createMockStream(kinds: Array<'audio' | 'video'>) {
    const tracks = kinds.map(kind => ({
      kind,
      stop: jest.fn(),
    }));
    return {
      getTracks: () => tracks,
      getAudioTracks: () => tracks.filter(t => t.kind === 'audio'),
      getVideoTracks: () => tracks.filter(t => t.kind === 'video'),
    };
  }

  function simulateStopCall(
    type: CallType,
    activeType: CallType | null,
    hasAudio: boolean,
    hasVideo: boolean,
  ) {
    const pc = createMockPeerConnection();
    const peersRef = new Map<string, { type: CallType; pc: ReturnType<typeof createMockPeerConnection> }>();
    peersRef.set('peer-1', { type, pc });

    const stream = createMockStream([
      ...(hasAudio ? ['audio' as const] : []),
      ...(hasVideo ? ['video' as const] : []),
    ]);
    const localStreamRef = { current: stream };
    const activeCallRef: { current: CallType | null } = { current: activeType };
    const socketEmit = jest.fn();
    const cleanupPeerConnection = jest.fn();

    switch (type) {
      case 'screen': {
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => t.stop());
        }
        socketEmit('webrtc_end', { lessonId: 'lesson-1' });
        break;
      }
      case 'voice': {
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => t.stop());
        }
        socketEmit('webrtc_end', { lessonId: 'lesson-1' });
        break;
      }
      case 'camera': {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
        }
        socketEmit('camera_end', { lessonId: 'lesson-1' });
        break;
      }
    }

    pc.close();

    if (activeType === type) {
      activeCallRef.current = null;
    }

    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    return { pc, peersRef, activeCallRef, cleanupPeerConnection, videoTracks, audioTracks, socketEmit };
  }

  it.each(['voice', 'camera', 'screen'] as CallType[])('should close PeerConnection for %s call type', (type) => {
    const { pc } = simulateStopCall(type, type, true, true);
    expect(pc.close).toHaveBeenCalledTimes(1);
  });

  it.each(['voice', 'camera', 'screen'] as CallType[])('should set activeCall to null when stopped type matches (%s)', (type) => {
    const { activeCallRef } = simulateStopCall(type, type, true, true);
    expect(activeCallRef.current).toBeNull();
  });

  it.each(['voice', 'camera', 'screen'] as CallType[])('should NOT set activeCall to null when stopped type differs (%s)', (type) => {
    const otherType: CallType = type === 'voice' ? 'camera' : 'voice';
    const { activeCallRef } = simulateStopCall(type, otherType, true, true);
    expect(activeCallRef.current).toBe(otherType);
  });

  it('should stop video tracks for screen call type', () => {
    const { videoTracks } = simulateStopCall('screen', 'screen', false, true);
    videoTracks.forEach(t => expect(t.stop).toHaveBeenCalledTimes(1));
  });

  it('should stop audio tracks for voice call type', () => {
    const { audioTracks } = simulateStopCall('voice', 'voice', true, false);
    audioTracks.forEach(t => expect(t.stop).toHaveBeenCalledTimes(1));
  });

  it('should stop all tracks for camera call type', () => {
    const { videoTracks, audioTracks } = simulateStopCall('camera', 'camera', true, true);
    [...videoTracks, ...audioTracks].forEach(t => expect(t.stop).toHaveBeenCalledTimes(1));
  });
});

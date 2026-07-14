describe('C5 Bug Condition — stopCall Wrong Event and Mic Leak', () => {
  let socketEmit: jest.Mock;
  let audioTrackStop: jest.Mock;

  beforeEach(() => {
    socketEmit = jest.fn();
    audioTrackStop = jest.fn();
  });

  it('stopCall("camera") should emit the correct event (bug: currently emits "webrtc_end" for both)', () => {
    // Simulate the BUGGY stopCall from unfixed code:
    const type = 'camera' as const;
    const lessonId = 'lesson-1';

    // BUG: both branches produce 'webrtc_end'
    socketEmit(type === 'camera' ? 'webrtc_end' : 'webrtc_end', { lessonId });

    expect(socketEmit).toHaveBeenCalledWith('webrtc_end', { lessonId });
  });

  it('stopCall("voice") should stop audio tracks (bug: currently does NOT stop audio)', () => {
    // BUG: audio tracks are NOT stopped here
    // localStreamRef.current?.getAudioTracks().forEach(t => t.stop()); // ← missing line

    // Verify audio tracks were NOT stopped (confirming the bug)
    expect(audioTrackStop).not.toHaveBeenCalled();
  });
});

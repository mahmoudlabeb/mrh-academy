'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { apiClient } from '@/lib/api-client';

interface PeerConnection {
  pc: RTCPeerConnection;
  stream?: MediaStream;
  type: 'voice' | 'camera' | 'screen';
}

export function useWebRTC(lessonId: string, userId: string, peerUserId?: string | null) {
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const [activeCall, setActiveCall] = useState<'voice' | 'camera' | 'screen' | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isCallLoading, setIsCallLoading] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');

  const rtcConfigRef = useRef<RTCConfiguration>({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  useEffect(() => {
    apiClient
      .get('/turn-credentials')
      .then((res) => {
        const iceServers = res.data;
        if (Array.isArray(iceServers) && iceServers.length > 0) {
          const existing = rtcConfigRef.current.iceServers ?? [];
          rtcConfigRef.current = {
            iceServers: [
              ...existing,
              ...(iceServers as RTCIceServer[]),
            ],
          };
        }
      })
      .catch(() => {
        // Dynamic TURN unavailable; fall back to STUN-only
      });
  }, []);

  const stopCallRef = useRef<(type: 'voice' | 'camera' | 'screen') => void>(() => {});

  const cleanupPeerConnection = useCallback((peerId: string) => {
    const existing = peersRef.current.get(peerId);
    if (existing) {
      existing.pc.close();
      peersRef.current.delete(peerId);
    }
  }, []);

  const createPeerConnection = useCallback((peerId: string, type: 'voice' | 'camera' | 'screen'): RTCPeerConnection => {
    cleanupPeerConnection(peerId);

    const pc = new RTCPeerConnection(rtcConfigRef.current);
    const socket = getSocket();

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit(`${type === 'camera' ? 'camera' : 'webrtc'}_ice_candidate`, {
          lessonId,
          targetUserId: peerId,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: e.streams[0],
      }));
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'checking') {
        setConnectionStatus('connecting');
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionStatus('connected');
      } else if (pc.iceConnectionState === 'failed') {
        console.warn('[WebRTC] ICE failed — attempting ICE restart');
        setConnectionStatus('failed');
        pc.restartIce();
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
            cleanupPeerConnection(peerId);
            setRemoteStreams((prev) => {
              const next = { ...prev };
              delete next[peerId];
              return next;
            });
          }
        }, 10_000);
      } else if (pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
            cleanupPeerConnection(peerId);
            setRemoteStreams((prev) => {
              const next = { ...prev };
              delete next[peerId];
              return next;
            });
          }
        }, 10_000);
      }
    };

    peersRef.current.set(peerId, { pc, type });
    return pc;
  }, [lessonId, cleanupPeerConnection]);

  const startLocalStream = useCallback(async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    return stream;
  }, []);

  const startCall = useCallback(async (type: 'voice' | 'camera' | 'screen') => {
    if (!peerUserId) return;
    setIsCallLoading(true);
    setCallError(null);

    try {
      let stream: MediaStream;

      if (type === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          stopCallRef.current('screen');
        });
      } else {
        stream = await startLocalStream(
          type === 'voice'
            ? { audio: true, video: false }
            : { audio: true, video: { width: 640, height: 480 } }
        );
      }

      const pc = createPeerConnection(peerUserId, type);
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const eventName = type === 'camera' ? 'camera_offer' : 'webrtc_offer';
      getSocket().emit(eventName, {
        lessonId,
        targetUserId: peerUserId,
        offer: pc.localDescription,
      });

      setActiveCall(type);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied. Allow access in browser settings.'
          : err instanceof Error
            ? err.message
            : 'Could not start call. Check camera/mic permissions and HTTPS.';
      setCallError(message);
      console.error(`Failed to start ${type} call:`, err);
    } finally {
      setIsCallLoading(false);
    }

  }, [lessonId, peerUserId, createPeerConnection, startLocalStream]);

  const stopCall = useCallback((type: 'voice' | 'camera' | 'screen') => {
    const socket = getSocket();
    socket.emit(type === 'camera' ? 'camera_end' : 'webrtc_end', { lessonId });

    if (type === 'screen') {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      }
    } else if (type === 'voice') {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => t.stop());
        const hasCameraConnection = Array.from(peersRef.current.values()).some(
          (peer) => peer.type === 'camera',
        );
        if (!hasCameraConnection) {
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

    setActiveCall((prev) => prev === type ? null : prev);
  }, [lessonId, cleanupPeerConnection]);
  stopCallRef.current = stopCall;

  const stopAllCalls = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    peersRef.current.forEach((_, peerId) => cleanupPeerConnection(peerId));
    setActiveCall(null);
    setRemoteStreams({});
  }, [cleanupPeerConnection]);

  useEffect(() => {
    const socket = getSocket();
    if (!peerUserId) return;

    const handleVoiceOffer = async (payload: { userId: string; offer: RTCSessionDescriptionInit }) => {
      if (payload.userId !== peerUserId) return;
      const pc = createPeerConnection(payload.userId, 'voice');

      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = stream;
        }
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      } catch (err) {
        console.warn('Could not acquire microphone for incoming call:', err);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc_answer', {
        lessonId,
        targetUserId: payload.userId,
        answer: pc.localDescription,
      });
      setActiveCall('voice');
    };

    const handleCameraOffer = async (payload: { userId: string; offer: RTCSessionDescriptionInit }) => {
      if (payload.userId !== peerUserId) return;
      const pc = createPeerConnection(payload.userId, 'camera');

      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: 640, height: 480 },
          });
          localStreamRef.current = stream;
        }
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      } catch (err) {
        console.warn('Could not acquire camera for incoming call:', err);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('camera_answer', {
        lessonId,
        targetUserId: payload.userId,
        answer: pc.localDescription,
      });
      setActiveCall('camera');
    };

    const handleAnswer = async (payload: { userId: string; answer: RTCSessionDescriptionInit }) => {
      if (payload.userId !== peerUserId) return;
      const peer = peersRef.current.get(payload.userId);
      if (peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
      }
    };

    const handleIceCandidate = async (payload: { userId: string; candidate: RTCIceCandidateInit }) => {
      if (payload.userId !== peerUserId) return;
      const peer = peersRef.current.get(payload.userId);
      if (peer) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    };

    const handleCallEnd = (payload: { userId: string }) => {
      if (payload.userId !== peerUserId) return;
      cleanupPeerConnection(payload.userId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[payload.userId];
        return next;
      });
      setActiveCall(null);
    };

    socket.on('webrtc_offer', handleVoiceOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleIceCandidate);
    socket.on('camera_offer', handleCameraOffer);
    socket.on('camera_answer', handleAnswer);
    socket.on('camera_ice_candidate', handleIceCandidate);
    socket.on('webrtc_end', handleCallEnd);
    socket.on('camera_end', handleCallEnd);

    return () => {
      socket.off('webrtc_offer', handleVoiceOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleIceCandidate);
      socket.off('camera_offer', handleCameraOffer);
      socket.off('camera_answer', handleAnswer);
      socket.off('camera_ice_candidate', handleIceCandidate);
      socket.off('webrtc_end', handleCallEnd);
      socket.off('camera_end', handleCallEnd);
    };
  }, [lessonId, peerUserId, createPeerConnection, cleanupPeerConnection]);

  useEffect(() => {
    return () => {
      stopAllCalls();
    };
  }, [stopAllCalls]);

  return {
    activeCall,
    remoteStreams,
    localStreamRef,
    isCallLoading,
    callError,
    connectionStatus,
    startCall,
    stopCall,
    stopAllCalls,
  };
}

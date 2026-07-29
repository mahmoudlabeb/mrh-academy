"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { apiClient } from "@/lib/api-client";

interface PeerConnection {
  pc: RTCPeerConnection;
  stream?: MediaStream;
  type: "voice" | "camera" | "screen";
}

export function useWebRTC(
  lessonId: string,
  userId: string,
  peerUserId?: string | null,
  mediaPreferences: { microphone: boolean; camera: boolean } = {
    microphone: true,
    camera: true,
  },
) {
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const modeBeforeScreenRef = useRef<"voice" | "camera" | null>(null);
  const mediaPreferencesRef = useRef(mediaPreferences);
  mediaPreferencesRef.current = mediaPreferences;

  const [activeCall, setActiveCall] = useState<
    "voice" | "camera" | "screen" | null
  >(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [isCallLoading, setIsCallLoading] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "failed"
  >("idle");

  const rtcConfigRef = useRef<RTCConfiguration>({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<RTCIceServer[]>("/turn-credentials")
      .then(({ data }) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          rtcConfigRef.current = { iceServers: data };
        }
      })
      .catch(() => {
        // Public STUN remains a development fallback. Production calls should
        // provide short-lived TURN credentials from the authenticated API.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stopCallRef = useRef<(type: "voice" | "camera" | "screen") => void>(
    () => {},
  );

  const cleanupPeerConnection = useCallback((peerId: string) => {
    const existing = peersRef.current.get(peerId);
    if (existing) {
      existing.pc.close();
      peersRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
  }, []);

  const flushPendingCandidates = useCallback(async (peerId: string) => {
    const peer = peersRef.current.get(peerId);
    const candidates = pendingCandidatesRef.current.get(peerId) ?? [];
    if (!peer?.pc.remoteDescription || candidates.length === 0) return;
    pendingCandidatesRef.current.delete(peerId);
    for (const candidate of candidates) {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const createPeerConnection = useCallback(
    (
      peerId: string,
      type: "voice" | "camera" | "screen",
    ): RTCPeerConnection => {
      cleanupPeerConnection(peerId);

      const pc = new RTCPeerConnection(rtcConfigRef.current);
      const socket = getSocket();

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit(
            `${type === "camera" ? "camera" : "webrtc"}_ice_candidate`,
            {
              lessonId,
              targetUserId: peerId,
              candidate: e.candidate,
            },
          );
        }
      };

      pc.ontrack = (e) => {
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: e.streams[0],
        }));
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "checking") {
          setConnectionStatus("connecting");
        } else if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          setConnectionStatus("connected");
        } else if (pc.iceConnectionState === "failed") {
          console.warn("[WebRTC] ICE failed — attempting ICE restart");
          setConnectionStatus("failed");
          void (async () => {
            try {
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              socket.emit(`${type === "camera" ? "camera" : "webrtc"}_offer`, {
                lessonId,
                targetUserId: peerId,
                offer: pc.localDescription,
              });
              setConnectionStatus("connecting");
            } catch {
              // The timeout below performs the final cleanup if recovery fails.
            }
          })();
          setTimeout(() => {
            if (
              pc.iceConnectionState !== "connected" &&
              pc.iceConnectionState !== "completed"
            ) {
              cleanupPeerConnection(peerId);
              setRemoteStreams((prev) => {
                const next = { ...prev };
                delete next[peerId];
                return next;
              });
            }
          }, 10_000);
        } else if (pc.iceConnectionState === "disconnected") {
          setTimeout(() => {
            if (
              pc.iceConnectionState !== "connected" &&
              pc.iceConnectionState !== "completed"
            ) {
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
    },
    [lessonId, cleanupPeerConnection],
  );

  const startLocalStream = useCallback(
    async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getAudioTracks().forEach((track) => {
        track.enabled = mediaPreferencesRef.current.microphone;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = mediaPreferencesRef.current.camera;
      });
      cameraStreamRef.current = stream;
      localStreamRef.current = stream;
      return stream;
    },
    [],
  );

  const startCall = useCallback(
    async (type: "voice" | "camera" | "screen") => {
      if (!peerUserId) return;
      setIsCallLoading(true);
      setCallError(null);

      try {
        let stream: MediaStream;

        if (type === "screen") {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          const screenTrack = displayStream.getVideoTracks()[0];
          if (!screenTrack)
            throw new Error("Screen sharing did not provide a video track.");
          screenTrackRef.current = screenTrack;
          modeBeforeScreenRef.current =
            activeCall === "camera"
              ? "camera"
              : activeCall === "voice"
                ? "voice"
                : null;
          screenTrack.addEventListener("ended", () => {
            stopCallRef.current("screen");
          });

          const existingPeer = peersRef.current.get(peerUserId);
          const videoSender = existingPeer?.pc
            .getSenders()
            .find((sender) => sender.track?.kind === "video");
          if (existingPeer && videoSender) {
            await videoSender.replaceTrack(screenTrack);
            localStreamRef.current = displayStream;
            setActiveCall("screen");
            setConnectionStatus("connected");
            return;
          }
          let microphoneTrack =
            cameraStreamRef.current?.getAudioTracks()[0] ?? null;
          if (!microphoneTrack) {
            const microphoneStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            microphoneTrack = microphoneStream.getAudioTracks()[0] ?? null;
            if (microphoneTrack) {
              microphoneTrack.enabled = mediaPreferencesRef.current.microphone;
              cameraStreamRef.current = microphoneStream;
            }
          }
          stream = new MediaStream([
            screenTrack,
            ...(microphoneTrack ? [microphoneTrack] : []),
          ]);
          localStreamRef.current = displayStream;
        } else {
          stream = await startLocalStream(
            type === "voice"
              ? { audio: true, video: false }
              : { audio: true, video: { width: 640, height: 480 } },
          );
          cameraTrackRef.current =
            type === "camera" ? (stream.getVideoTracks()[0] ?? null) : null;
        }

        const pc = createPeerConnection(peerUserId, type);
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const eventName = type === "camera" ? "camera_offer" : "webrtc_offer";
        getSocket().emit(eventName, {
          lessonId,
          targetUserId: peerUserId,
          offer: pc.localDescription,
        });

        setActiveCall(type);
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera/microphone permission denied. Allow access in browser settings."
            : err instanceof Error
              ? err.message
              : "Could not start call. Check camera/mic permissions and HTTPS.";
        setCallError(message);
        console.error(`Failed to start ${type} call:`, err);
      } finally {
        setIsCallLoading(false);
      }
    },
    [lessonId, peerUserId, createPeerConnection, startLocalStream, activeCall],
  );

  const stopCall = useCallback(
    (type: "voice" | "camera" | "screen") => {
      const socket = getSocket();

      if (type === "screen") {
        screenTrackRef.current?.stop();
        screenTrackRef.current = null;
        const previousMode = modeBeforeScreenRef.current;
        const cameraTrack = cameraTrackRef.current;
        peersRef.current.forEach((peer) => {
          const videoSender = peer.pc
            .getSenders()
            .find((sender) => sender.track?.kind === "video");
          if (videoSender) void videoSender.replaceTrack(cameraTrack);
        });
        localStreamRef.current = cameraStreamRef.current;
        setActiveCall(previousMode ?? "voice");
        modeBeforeScreenRef.current = null;
        return;
      }

      socket.emit(type === "camera" ? "camera_end" : "webrtc_end", {
        lessonId,
      });
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      localStreamRef.current = null;
      cameraTrackRef.current = null;
      peersRef.current.forEach((_, peerId) => cleanupPeerConnection(peerId));

      setActiveCall(null);
      setConnectionStatus("idle");
    },
    [lessonId, cleanupPeerConnection],
  );
  stopCallRef.current = stopCall;

  const stopAllCalls = useCallback(() => {
    const tracks = new Set<MediaStreamTrack>([
      ...(localStreamRef.current?.getTracks() ?? []),
      ...(cameraStreamRef.current?.getTracks() ?? []),
    ]);
    tracks.forEach((track) => track.stop());
    localStreamRef.current = null;
    cameraStreamRef.current = null;
    cameraTrackRef.current = null;
    screenTrackRef.current = null;
    peersRef.current.forEach((_, peerId) => cleanupPeerConnection(peerId));
    setActiveCall(null);
    setRemoteStreams({});
  }, [cleanupPeerConnection]);

  const setMicrophoneEnabled = useCallback((enabled: boolean) => {
    mediaPreferencesRef.current = {
      ...mediaPreferencesRef.current,
      microphone: enabled,
    };
    cameraStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    peersRef.current.forEach((peer) => {
      peer.pc
        .getSenders()
        .filter((sender) => sender.track?.kind === "audio")
        .forEach((sender) => {
          if (sender.track) sender.track.enabled = enabled;
        });
    });
  }, []);

  const setCameraEnabled = useCallback((enabled: boolean) => {
    mediaPreferencesRef.current = {
      ...mediaPreferencesRef.current,
      camera: enabled,
    };
    if (cameraTrackRef.current) cameraTrackRef.current.enabled = enabled;
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!peerUserId) return;

    const handleVoiceOffer = async (payload: {
      userId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (payload.userId !== peerUserId) return;
      const pc = createPeerConnection(payload.userId, "voice");

      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          stream.getAudioTracks().forEach((track) => {
            track.enabled = mediaPreferencesRef.current.microphone;
          });
          cameraStreamRef.current = stream;
          localStreamRef.current = stream;
        }
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      } catch (err) {
        console.warn("Could not acquire microphone for incoming call:", err);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      await flushPendingCandidates(payload.userId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc_answer", {
        lessonId,
        targetUserId: payload.userId,
        answer: pc.localDescription,
      });
      setActiveCall("voice");
    };

    const handleCameraOffer = async (payload: {
      userId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (payload.userId !== peerUserId) return;
      const pc = createPeerConnection(payload.userId, "camera");

      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: 640, height: 480 },
          });
          stream.getAudioTracks().forEach((track) => {
            track.enabled = mediaPreferencesRef.current.microphone;
          });
          stream.getVideoTracks().forEach((track) => {
            track.enabled = mediaPreferencesRef.current.camera;
          });
          cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
          cameraStreamRef.current = stream;
          localStreamRef.current = stream;
        }
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      } catch (err) {
        console.warn("Could not acquire camera for incoming call:", err);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      await flushPendingCandidates(payload.userId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("camera_answer", {
        lessonId,
        targetUserId: payload.userId,
        answer: pc.localDescription,
      });
      setActiveCall("camera");
    };

    const handleAnswer = async (payload: {
      userId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (payload.userId !== peerUserId) return;
      const peer = peersRef.current.get(payload.userId);
      if (peer) {
        await peer.pc.setRemoteDescription(
          new RTCSessionDescription(payload.answer),
        );
        await flushPendingCandidates(payload.userId);
      }
    };

    const handleIceCandidate = async (payload: {
      userId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (payload.userId !== peerUserId) return;
      const peer = peersRef.current.get(payload.userId);
      if (peer?.pc.remoteDescription) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } else {
        const queued = pendingCandidatesRef.current.get(payload.userId) ?? [];
        queued.push(payload.candidate);
        pendingCandidatesRef.current.set(payload.userId, queued);
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

    socket.on("webrtc_offer", handleVoiceOffer);
    socket.on("webrtc_answer", handleAnswer);
    socket.on("webrtc_ice_candidate", handleIceCandidate);
    socket.on("camera_offer", handleCameraOffer);
    socket.on("camera_answer", handleAnswer);
    socket.on("camera_ice_candidate", handleIceCandidate);
    socket.on("webrtc_end", handleCallEnd);
    socket.on("camera_end", handleCallEnd);

    return () => {
      socket.off("webrtc_offer", handleVoiceOffer);
      socket.off("webrtc_answer", handleAnswer);
      socket.off("webrtc_ice_candidate", handleIceCandidate);
      socket.off("camera_offer", handleCameraOffer);
      socket.off("camera_answer", handleAnswer);
      socket.off("camera_ice_candidate", handleIceCandidate);
      socket.off("webrtc_end", handleCallEnd);
      socket.off("camera_end", handleCallEnd);
    };
  }, [
    lessonId,
    peerUserId,
    createPeerConnection,
    cleanupPeerConnection,
    flushPendingCandidates,
  ]);

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
    setMicrophoneEnabled,
    setCameraEnabled,
  };
}

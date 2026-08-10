import { useCallback, useEffect, useRef, useState } from "react";

import { wsClient } from "@/lib/wsClient";
import { useAuthStore } from "@/stores/authStore";
import type { LiveParticipant, LiveParticipantStatus } from "@/types/liveMeeting";

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: import.meta.env.VITE_STUN_URL || "stun:stun.l.google.com:19302" }];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME || undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
    });
  }
  return servers;
}

export function useMeetingCall(meetingId: string) {
  const me = useAuthStore((state) => state.user);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [joinStatus, setJoinStatus] = useState<LiveParticipantStatus | "idle">("idle");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [meetingStartedSignal, setMeetingStartedSignal] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const outboundVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const joinedRef = useRef(false);
  const joinStatusRef = useRef<LiveParticipantStatus | "idle">("idle");

  const updateJoinStatus = useCallback((status: LiveParticipantStatus | "idle") => {
    joinStatusRef.current = status;
    setJoinStatus(status);
  }, []);

  const prepareMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support camera and microphone access.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    localStreamRef.current = stream;
    outboundVideoTrackRef.current = stream.getVideoTracks()[0] ?? null;
    setLocalStream(stream);
    setMicEnabled(stream.getAudioTracks().some((track) => track.enabled));
    setCameraEnabled(stream.getVideoTracks().some((track) => track.enabled));
    return stream;
  }, []);

  const closePeer = useCallback((userId: string) => {
    const peer = peersRef.current.get(userId);
    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.close();
      peersRef.current.delete(userId);
    }
    pendingIceRef.current.delete(userId);
    setRemoteStreams((current) => {
      if (!current[userId]) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
  }, []);

  const createPeer = useCallback(
    (userId: string) => {
      const existing = peersRef.current.get(userId);
      if (existing) return existing;

      const peer = new RTCPeerConnection({ iceServers: buildIceServers() });
      peersRef.current.set(userId, peer);

      const local = localStreamRef.current;
      local?.getAudioTracks().forEach((track) => peer.addTrack(track, local));
      const videoTrack = outboundVideoTrackRef.current;
      if (videoTrack && local) peer.addTrack(videoTrack, screenStreamRef.current ?? local);

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        wsClient.send({
          type: "ice-candidate",
          meeting_id: meetingId,
          target_user_id: userId,
          candidate: event.candidate.toJSON(),
        });
      };

      peer.ontrack = (event) => {
        const incoming = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStreams((current) => ({ ...current, [userId]: incoming }));
      };

      peer.onconnectionstatechange = () => {
        if (["failed", "closed"].includes(peer.connectionState)) closePeer(userId);
      };

      return peer;
    },
    [closePeer, meetingId]
  );

  const flushPendingIce = useCallback(async (userId: string, peer: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(userId) ?? [];
    for (const candidate of queued) {
      await peer.addIceCandidate(candidate);
    }
    pendingIceRef.current.delete(userId);
  }, []);

  const makeOffer = useCallback(
    async (userId: string) => {
      if (userId === me?.id || joinStatusRef.current !== "admitted") return;
      const peer = createPeer(userId);
      if (peer.signalingState !== "stable") return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      wsClient.send({
        type: "webrtc-offer",
        meeting_id: meetingId,
        target_user_id: userId,
        sdp: offer,
      });
    },
    [createPeer, me?.id, meetingId]
  );

  const joinMeeting = useCallback(async () => {
    setError(null);
    try {
      await prepareMedia();
      const connected = await wsClient.waitUntilConnected();
      if (!connected) throw new Error("Could not connect to the realtime meeting service.");
      joinedRef.current = true;
      wsClient.send({ type: "meeting-join", meeting_id: meetingId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the meeting.");
      throw err;
    }
  }, [meetingId, prepareMedia]);

  const leaveMeeting = useCallback(() => {
    if (joinedRef.current) {
      wsClient.send({ type: "meeting-leave", meeting_id: meetingId });
      joinedRef.current = false;
    }
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    pendingIceRef.current.clear();
    setRemoteStreams({});
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    updateJoinStatus("idle");
  }, [meetingId, updateJoinStatus]);

  const toggleMic = useCallback(() => {
    const next = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicEnabled(next);
    wsClient.send({
      type: "media-state",
      meeting_id: meetingId,
      mic_enabled: next,
      camera_enabled: cameraEnabled,
      screen_sharing: screenSharing,
    });
  }, [cameraEnabled, meetingId, micEnabled, screenSharing]);

  const toggleCamera = useCallback(() => {
    const next = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCameraEnabled(next);
    wsClient.send({
      type: "media-state",
      meeting_id: meetingId,
      mic_enabled: micEnabled,
      camera_enabled: next,
      screen_sharing: screenSharing,
    });
  }, [cameraEnabled, meetingId, micEnabled, screenSharing]);

  const stopScreenShare = useCallback(async () => {
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    if (cameraTrack) {
      await Promise.all(
        Array.from(peersRef.current.values()).map(async (peer) => {
          const sender = peer.getSenders().find((item) => item.track?.kind === "video");
          if (sender) await sender.replaceTrack(cameraTrack);
        })
      );
      outboundVideoTrackRef.current = cameraTrack;
    }
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
    wsClient.send({
      type: "media-state",
      meeting_id: meetingId,
      mic_enabled: micEnabled,
      camera_enabled: cameraEnabled,
      screen_sharing: false,
    });
  }, [cameraEnabled, meetingId, micEnabled]);

  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen sharing isn't supported by this browser.");
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;

      await Promise.all(
        Array.from(peersRef.current.values()).map(async (peer) => {
          const sender = peer.getSenders().find((item) => item.track?.kind === "video");
          if (sender) await sender.replaceTrack(screenTrack);
        })
      );

      screenStreamRef.current = display;
      outboundVideoTrackRef.current = screenTrack;
      setScreenStream(display);
      setScreenSharing(true);
      screenTrack.onended = () => { void stopScreenShare(); };
      wsClient.send({
        type: "media-state",
        meeting_id: meetingId,
        mic_enabled: micEnabled,
        camera_enabled: cameraEnabled,
        screen_sharing: true,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      setError("Couldn't start screen sharing.");
    }
  }, [cameraEnabled, meetingId, micEnabled, stopScreenShare]);

  const admit = useCallback(
    (userId: string) => wsClient.send({ type: "meeting-admit", meeting_id: meetingId, user_id: userId }),
    [meetingId]
  );

  const deny = useCallback(
    (userId: string) => wsClient.send({ type: "meeting-deny", meeting_id: meetingId, user_id: userId }),
    [meetingId]
  );

  useEffect(() => {
    const replaceParticipants = (next: LiveParticipant[]) => setParticipants(next);
    const upsertParticipant = (participant: LiveParticipant) => {
      setParticipants((current) => {
        const exists = current.some((item) => item.user_id === participant.user_id);
        return exists
          ? current.map((item) => (item.user_id === participant.user_id ? { ...item, ...participant } : item))
          : [...current, participant];
      });
    };

    const unsubscribers = [
      wsClient.on("__connected", () => {
        if (joinedRef.current) wsClient.send({ type: "meeting-join", meeting_id: meetingId });
      }),

      wsClient.on("meeting.joined", async (data) => {
        if (data.meeting_id !== meetingId) return;
        const status = data.status as LiveParticipantStatus;
        updateJoinStatus(status);
        const snapshot = (data.participants as LiveParticipant[]) ?? [];
        replaceParticipants(snapshot);
        if (status === "admitted") {
          for (const participant of snapshot) {
            if (participant.user_id !== me?.id && participant.status === "admitted") {
              await makeOffer(participant.user_id);
            }
          }
        }
      }),

      wsClient.on("meeting.admitted", async (data) => {
        if (data.meeting_id !== meetingId) return;
        updateJoinStatus("admitted");
        const snapshot = (data.participants as LiveParticipant[]) ?? [];
        replaceParticipants(snapshot);
        for (const participant of snapshot) {
          if (participant.user_id !== me?.id && participant.status === "admitted") {
            await makeOffer(participant.user_id);
          }
        }
      }),

      wsClient.on("meeting.denied", (data) => {
        if (data.meeting_id !== meetingId) return;
        updateJoinStatus("denied");
        setError("The host did not admit you to this meeting.");
      }),

      wsClient.on("meeting.participant.updated", (data) => {
        if (data.meeting_id !== meetingId) return;
        upsertParticipant(data.participant as LiveParticipant);
      }),

      wsClient.on("meeting.participant.left", (data) => {
        if (data.meeting_id !== meetingId) return;
        const userId = data.user_id as string;
        setParticipants((current) => current.filter((item) => item.user_id !== userId));
        closePeer(userId);
      }),

      wsClient.on("meeting.media_state", (data) => {
        if (data.meeting_id !== meetingId) return;
        const userId = data.user_id as string;
        setParticipants((current) =>
          current.map((item) =>
            item.user_id === userId
              ? {
                  ...item,
                  mic_enabled: data.mic_enabled as boolean,
                  camera_enabled: data.camera_enabled as boolean,
                  screen_sharing: data.screen_sharing as boolean,
                }
              : item
          )
        );
      }),

      wsClient.on("webrtc.offer", async (data) => {
        if (data.meeting_id !== meetingId) return;
        const fromUserId = data.from_user_id as string;
        const peer = createPeer(fromUserId);
        await peer.setRemoteDescription(data.sdp as RTCSessionDescriptionInit);
        await flushPendingIce(fromUserId, peer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        wsClient.send({
          type: "webrtc-answer",
          meeting_id: meetingId,
          target_user_id: fromUserId,
          sdp: answer,
        });
      }),

      wsClient.on("webrtc.answer", async (data) => {
        if (data.meeting_id !== meetingId) return;
        const fromUserId = data.from_user_id as string;
        const peer = createPeer(fromUserId);
        await peer.setRemoteDescription(data.sdp as RTCSessionDescriptionInit);
        await flushPendingIce(fromUserId, peer);
      }),

      wsClient.on("webrtc.ice_candidate", async (data) => {
        if (data.meeting_id !== meetingId) return;
        const fromUserId = data.from_user_id as string;
        const candidate = data.candidate as RTCIceCandidateInit;
        const peer = createPeer(fromUserId);
        if (peer.remoteDescription) {
          await peer.addIceCandidate(candidate);
        } else {
          const queue = pendingIceRef.current.get(fromUserId) ?? [];
          pendingIceRef.current.set(fromUserId, [...queue, candidate]);
        }
      }),

      wsClient.on("meeting.started", (data) => {
        if (data.meeting_id === meetingId) setMeetingStartedSignal((value) => value + 1);
      }),

      wsClient.on("meeting.ended", (data) => {
        if (data.meeting_id !== meetingId) return;
        setMeetingEnded(true);
        peersRef.current.forEach((peer) => peer.close());
        peersRef.current.clear();
        setRemoteStreams({});
      }),

      wsClient.on("error", (data) => {
        const code = data.code as string | undefined;
        if (!code?.startsWith("meeting_") && !["invitation_required", "signal_not_allowed", "invalid_signal"].includes(code ?? "")) {
          return;
        }
        setError((data.message as string) || "Meeting connection error.");
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [closePeer, createPeer, flushPendingIce, makeOffer, me?.id, meetingId, updateJoinStatus]);

  useEffect(() => {
    return () => {
      if (joinedRef.current) wsClient.send({ type: "meeting-leave", meeting_id: meetingId });
      peersRef.current.forEach((peer) => peer.close());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [meetingId]);

  return {
    localStream,
    screenStream,
    remoteStreams,
    participants,
    joinStatus,
    micEnabled,
    cameraEnabled,
    screenSharing,
    error,
    meetingEnded,
    meetingStartedSignal,
    prepareMedia,
    joinMeeting,
    leaveMeeting,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    admit,
    deny,
  };
}

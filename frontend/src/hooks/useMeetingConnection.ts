import { useEffect, useRef } from 'react';
import { useMeetingStore, type Participant, type ChatMessage } from '@/store/useMeetingStore';
import { initSocket } from '@/lib/socket';

type RoomState = {
  meetingId: string;
  title: string;
  startedAt: number;
  participants: Participant[];
  messages: Array<Omit<ChatMessage, 'id' | 'isOwn'>>;
};

/**
 * Connects the authenticated socket once the meeting store is 'active',
 * mirrors server events into the store, and tears everything down on leave.
 *
 * The server is authoritative for identity, host status, title and start
 * time; this hook never sends a role and never trusts one from the client.
 */
export function useMeetingConnection() {
  const status = useMeetingStore((s) => s.status);
  const meetingId = useMeetingStore((s) => s.meetingId);
  const hasConnected = useRef(false);

  useEffect(() => {
    if (status !== 'active') return;
    if (hasConnected.current) return;
    hasConnected.current = true;

    const socket = initSocket();
    socket.connect();

    const store = () => useMeetingStore.getState();

    const onConnect = () => {
      // Always read the LATEST local participant so a reconnect re-sends
      // current mute/camera state rather than a stale snapshot.
      const s = store();
      const localUser = s.participants.find((p) => p.id === s.localUserId);
      if (localUser && s.meetingId) {
        socket.emit('join-room', s.meetingId, localUser);
      }
    };

    const onConnectError = (err: Error) => {
      if (err.message === 'UNAUTHORIZED') {
        store().leaveMeeting();
        window.location.replace('/login');
      }
    };

    const onRoomState = (state: RoomState) => {
      const s = store();
      s.setRoomInfo({ title: state.title, startedAt: state.startedAt });

      // Sync our own record (isHost comes from the server, never the client)
      const me = state.participants.find((p) => p.id === s.localUserId);
      if (me && s.localUserId) {
        s.updateParticipant(s.localUserId, { isHost: me.isHost, socketId: me.socketId });
      }

      const current = store().participants;
      state.participants
        .filter((p) => p.id !== s.localUserId)
        .forEach((p) => {
          const existing = current.find((cp) => cp.id === p.id);
          if (!existing) store().addParticipant(p);
          else store().updateParticipant(p.id, p);
        });

      if (Array.isArray(state.messages) && state.messages.length) {
        store().loadHistory(state.messages);
      }
    };

    const onJoinError = (payload: { code: string; message: string }) => {
      console.warn('[Socket] join refused:', payload.code, payload.message);
      const id = store().meetingId;
      store().leaveMeeting();
      // The lobby re-validates against the API and shows the right message.
      window.location.replace(id ? `/meet/${id}` : '/dashboard');
    };

    const onUserJoined = (user: Participant) => {
      const s = store();
      if (user.id === s.localUserId) return;
      if (s.participants.some((p) => p.id === user.id)) {
        s.updateParticipant(user.id, user);
        return;
      }
      s.addParticipant(user);
      s.addEvent({ type: 'join', message: `${user.name} joined the meeting` });
    };

    const onUserLeft = (userId: string) => {
      const p = store().participants.find((x) => x.id === userId);
      if (p) {
        store().removeParticipant(userId);
        store().addEvent({ type: 'leave', message: `${p.name} left the meeting` });
      }
    };

    const onChatMessage = (msg: Omit<ChatMessage, 'id' | 'isOwn'>) => {
      store().receiveMessage(msg);
    };

    const onMediaToggled = (userId: string, mediaState: Partial<Participant>) => {
      store().updateParticipant(userId, mediaState);
    };

    const onKicked = (payload?: { banned?: boolean }) => {
      store().leaveMeeting();
      window.location.replace(payload?.banned ? '/meeting/ended?reason=removed-blocked' : '/meeting/ended?reason=removed');
    };

    const onDuplicateSession = () => {
      store().leaveMeeting();
      window.location.replace('/meeting/ended?reason=duplicate');
    };

    const onForceMedia = (action: 'mute' | 'video-off') => {
      const s = store();
      if (action === 'mute' && !s.localIsMuted) {
        s.toggleMic();
        s.addEvent({ type: 'info', message: 'The host muted your microphone' });
      } else if (action === 'video-off' && !s.localIsVideoOff) {
        s.toggleVideo();
        s.addEvent({ type: 'info', message: 'The host turned off your camera' });
      }
    };

    /** Host called "End for everyone" (or the meeting was ended via the API). */
    const onMeetingEnded = () => {
      store().leaveMeeting();
      // Full reload tears down peer connections and local tracks;
      // replace() keeps the dead meeting out of history.
      window.location.replace('/meeting/ended');
    };

    const onActionError = (payload: { code: string; message: string }) => {
      store().addEvent({ type: 'info', message: payload.message });
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('room-state', onRoomState);
    socket.on('join-error', onJoinError);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('chat-message', onChatMessage);
    socket.on('media-toggled', onMediaToggled);
    socket.on('kicked', onKicked);
    socket.on('duplicate-session', onDuplicateSession);
    socket.on('force-media', onForceMedia);
    socket.on('meeting-ended', onMeetingEnded);
    socket.on('end-meeting-error', onActionError);
    socket.on('action-error', onActionError);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('room-state', onRoomState);
      socket.off('join-error', onJoinError);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('chat-message', onChatMessage);
      socket.off('media-toggled', onMediaToggled);
      socket.off('kicked', onKicked);
      socket.off('duplicate-session', onDuplicateSession);
      socket.off('force-media', onForceMedia);
      socket.off('meeting-ended', onMeetingEnded);
      socket.off('end-meeting-error', onActionError);
      socket.off('action-error', onActionError);
      socket.disconnect();
      hasConnected.current = false;
    };
  }, [status, meetingId]);
}

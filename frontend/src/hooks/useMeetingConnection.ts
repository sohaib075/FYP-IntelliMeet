import { useEffect, useRef, useCallback } from 'react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { initSocket, getSocket } from '@/lib/socket';

export function useMeetingConnection() {
  const store = useMeetingStore();
  const hasConnected = useRef(false);

  useEffect(() => {
    if (store.status !== 'active') return;
    if (hasConnected.current) return;
    hasConnected.current = true;

    const socket = initSocket();
    socket.connect();

    const localUser = store.participants.find(p => p.id === store.localUserId);

    const onConnect = () => {
      if (localUser && store.meetingId) {
        socket.emit('join-room', store.meetingId, localUser);
      }
    };

    const onRoomState = (state: any) => {
      const currentParticipants = useMeetingStore.getState().participants;
      
      // Sync local participant settings (like isHost) from server state
      const me = state.participants.find((p: any) => p.id === store.localUserId);
      if (me && store.localUserId) {
        useMeetingStore.getState().updateParticipant(store.localUserId, { isHost: me.isHost });
      }

      const others = state.participants.filter((p: any) => p.id !== store.localUserId);
      others.forEach((p: any) => {
        const existing = currentParticipants.find(cp => cp.id === p.id);
        if (!existing) {
          useMeetingStore.getState().addParticipant(p);
        } else {
          useMeetingStore.getState().updateParticipant(p.id, p);
        }
      });
    };

    const onUserJoined = (user: any) => {
      useMeetingStore.getState().addParticipant(user);
      useMeetingStore.getState().addEvent({ type: 'join', message: `${user.name} joined the meeting` });
    };

    const onUserLeft = (userId: string) => {
      const p = useMeetingStore.getState().participants.find(p => p.id === userId);
      if (p) {
        useMeetingStore.getState().removeParticipant(userId);
        useMeetingStore.getState().addEvent({ type: 'leave', message: `${p.name} left the meeting` });
      }
    };

    const onChatMessage = (msg: any) => {
      useMeetingStore.getState().receiveMessage(msg);
    };

    const onMediaToggled = (userId: string, mediaState: any) => {
      useMeetingStore.getState().updateParticipant(userId, mediaState);
    };

    const onKicked = () => {
      useMeetingStore.getState().leaveMeeting();
      window.location.href = '/meeting/ended';
    };

    const onForceMedia = (action: 'mute' | 'video-off') => {
      const state = useMeetingStore.getState();
      if (action === 'mute' && !state.localIsMuted) {
        state.toggleMic();
      } else if (action === 'video-off' && !state.localIsVideoOff) {
        state.toggleVideo();
      }
    };

    /**
     * Received when the host calls "End Call for Everyone".
     * All participants (including the host, if still in the room) get this.
     * We must: stop all local tracks, close peer connections, reset store,
     * and redirect to the ended page.
     */
    const onMeetingEnded = (_payload: { meetingId: string; endedBy: string }) => {
      // The MeetingRoomPage listens to this via its own effect — but we also
      // handle cleanup here at the connection layer so the redirect always fires
      // even if the component has been unmounted or the store already reset.
      useMeetingStore.getState().leaveMeeting();
      // Use replace so the user can't navigate back into a dead meeting
      window.location.replace('/meeting/ended');
    };

    const onEndMeetingError = (payload: { message: string }) => {
      console.error('[Socket] end-meeting rejected:', payload.message);
      // The MeetingRoomPage can surface this as a toast/alert if needed
    };

    socket.on('connect', onConnect);
    socket.on('room-state', onRoomState);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('chat-message', onChatMessage);
    socket.on('media-toggled', onMediaToggled);
    socket.on('kicked', onKicked);
    socket.on('force-media', onForceMedia);
    socket.on('meeting-ended', onMeetingEnded);
    socket.on('end-meeting-error', onEndMeetingError);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('room-state', onRoomState);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('chat-message', onChatMessage);
      socket.off('media-toggled', onMediaToggled);
      socket.off('kicked', onKicked);
      socket.off('force-media', onForceMedia);
      socket.off('meeting-ended', onMeetingEnded);
      socket.off('end-meeting-error', onEndMeetingError);
      socket.disconnect();
      hasConnected.current = false;
    };
  }, [store.status, store.meetingId]);
}

import { useEffect, useRef } from 'react';
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
      const others = state.participants.filter((p: any) => p.id !== store.localUserId);
      
      others.forEach((p: any) => {
        if (!currentParticipants.find(cp => cp.id === p.id)) {
          useMeetingStore.getState().addParticipant(p);
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

    socket.on('connect', onConnect);
    socket.on('room-state', onRoomState);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('chat-message', onChatMessage);
    socket.on('media-toggled', onMediaToggled);

    return () => {
      socket.off('connect', onConnect);
      socket.off('room-state', onRoomState);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('chat-message', onChatMessage);
      socket.off('media-toggled', onMediaToggled);
      socket.disconnect();
      hasConnected.current = false;
    };
  }, [store.status, store.meetingId]);
}

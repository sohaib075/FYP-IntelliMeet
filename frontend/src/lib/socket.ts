import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';

let socket: Socket | null = null;

const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      // ignore — fall through to the location-based default
    }
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

/**
 * Lazily create the singleton socket. The JWT is supplied through the
 * handshake `auth` callback so a token refreshed after a re-login is
 * picked up on the next (re)connect without recreating the socket.
 */
export const initSocket = (url?: string) => {
  if (!socket) {
    const finalUrl = url || getSocketUrl();
    socket = io(finalUrl, {
      autoConnect: false,
      auth: (cb) => cb({ token: useAuthStore.getState().token }),
    });
  }
  return socket;
};

export const getSocket = () => socket;

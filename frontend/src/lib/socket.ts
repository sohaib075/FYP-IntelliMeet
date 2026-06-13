import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      return `${url.protocol}//${url.host}`;
    } catch (e) {
      // ignore
    }
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

export const initSocket = (url?: string) => {
  if (!socket) {
    const finalUrl = url || getSocketUrl();
    console.log(`[Socket] Initializing socket on URL: ${finalUrl}`);
    socket = io(finalUrl, { autoConnect: false });
  }
  return socket;
};

export const getSocket = () => socket;


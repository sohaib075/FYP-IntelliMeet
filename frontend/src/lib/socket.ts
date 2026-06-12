import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = (url = 'http://localhost:3001') => {
  if (!socket) {
    socket = io(url, { autoConnect: false });
  }
  return socket;
};

export const getSocket = () => socket;

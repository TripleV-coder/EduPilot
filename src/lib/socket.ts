/**
 * Socket.IO Client Configuration
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io({
      path: '/api/socket',
      autoConnect: false, // Only connect when needed
    });
  }
  return socket;
};

export const connectSocket = (userId?: string, role?: string) => {
  const socket = getSocket();

  if (!socket.connected) {
    socket.connect();

    if (userId && role) {
      socket.emit('authenticate', { userId, role });
    }
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect();
  }
};

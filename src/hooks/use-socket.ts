/**
 * React Hook for Socket.IO
 */

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket';
import { logger } from '@/lib/utils/logger';

interface UseSocketOptions {
  autoConnect?: boolean;
  userId?: string;
  role?: string;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const { autoConnect = false, userId, role } = options;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = getSocket();
    setSocket(socketInstance);

    const onConnect = () => {
      logger.info('Socket.IO connected:', { socketId: socketInstance.id });
      setIsConnected(true);
    };

    const onDisconnect = () => {
      logger.info('Socket.IO disconnected');
      setIsConnected(false);
    };

    const onError = (error: Error) => {
      logger.error('Socket.IO error:', error);
    };

    // Attach event listeners
    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('error', onError);

    // Auto-connect if requested
    if (autoConnect) {
      connectSocket(userId, role);
    }

    // Cleanup
    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.off('error', onError);

      if (autoConnect) {
        disconnectSocket();
      }
    };
  }, [autoConnect, userId, role]);

  return {
    socket,
    isConnected,
    connect: () => connectSocket(userId, role),
    disconnect: disconnectSocket,
  };
};

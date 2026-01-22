/**
 * Socket.IO Server for EduPilot
 * Real-time notifications, messaging, and live updates
 */

const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// Store connected users
const connectedUsers = new Map();

// PID file for single instance check
const PID_FILE = path.join(__dirname, '.edupilot.pid');

// Declare httpServer outside to make it accessible in signal handlers
let httpServer;

// Check if another instance is running
function checkExistingInstance() {
  if (fs.existsSync(PID_FILE)) {
    try {
      const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
      // Check if process is still running
      try {
        process.kill(oldPid, 0);
        console.log(`⚠️  Another instance might be running (PID: ${oldPid})`);
        console.log('   If this is an error, delete .edupilot.pid and try again.\n');
      } catch {
        // Process not running, stale PID file
        console.log('🧹 Cleaning up stale PID file...');
        fs.unlinkSync(PID_FILE);
      }
    } catch {
      // Ignore errors reading PID file
    }
  }
  // Write current PID
  fs.writeFileSync(PID_FILE, process.pid.toString());
}

// Cleanup PID file
function cleanupPidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

checkExistingInstance();

app.prepare().then(() => {
  httpServer = createServer(handler);

  const io = new Server(httpServer, {
    cors: {
      origin: dev ? 'http://localhost:3000' : process.env.NEXT_PUBLIC_APP_URL,
      credentials: true,
    },
    path: '/api/socket',
  });

  // Store io globally for graceful shutdown
  global.io = io;

  // Socket.IO Connection Handler
  io.on('connection', (socket) => {
    // Suppress connection logs in production to reduce noise
    if (dev) {
      console.log(`✅ Client connected: ${socket.id}`);
    }

    // User Authentication
    socket.on('authenticate', (data) => {
      const { userId, role } = data;
      socket.userId = userId;
      socket.role = role;

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Join role-specific room
      socket.join(`role:${role}`);

      // Store user connection
      connectedUsers.set(userId, {
        socketId: socket.id,
        role,
        connectedAt: new Date(),
      });

      if (dev) {
        console.log(`🔐 User authenticated: ${userId} (${role})`);
      }

      // Emit online status
      io.emit('user:online', { userId, role });
    });

    // Notifications
    socket.on('notification:send', (data) => {
      const { targetUserId, notification } = data;
      io.to(`user:${targetUserId}`).emit('notification:received', notification);
      if (dev) {
        console.log(`📬 Notification sent to user: ${targetUserId}`);
      }
    });

    // Broadcast to role
    socket.on('notification:broadcast', (data) => {
      const { targetRole, notification } = data;
      io.to(`role:${targetRole}`).emit('notification:received', notification);
      if (dev) {
        console.log(`📢 Notification broadcast to role: ${targetRole}`);
      }
    });

    // Real-time Messages
    socket.on('message:send', (data) => {
      const { recipientId, message } = data;
      io.to(`user:${recipientId}`).emit('message:received', {
        ...message,
        senderId: socket.userId,
      });
      if (dev) {
        console.log(`💬 Message sent from ${socket.userId} to ${recipientId}`);
      }
    });

    // Typing Indicators
    socket.on('message:typing', (data) => {
      const { recipientId } = data;
      io.to(`user:${recipientId}`).emit('message:typing', {
        userId: socket.userId,
      });
    });

    socket.on('message:stop-typing', (data) => {
      const { recipientId } = data;
      io.to(`user:${recipientId}`).emit('message:stop-typing', {
        userId: socket.userId,
      });
    });

    // Grade Updates
    socket.on('grade:updated', (data) => {
      const { studentId, grade } = data;

      // Notify student
      io.to(`user:${studentId}`).emit('grade:new', grade);

      // Notify parents
      if (grade.parentIds && grade.parentIds.length > 0) {
        grade.parentIds.forEach(parentId => {
          io.to(`user:${parentId}`).emit('grade:new', grade);
        });
      }

      if (dev) {
        console.log(`📊 Grade updated for student: ${studentId}`);
      }
    });

    // Attendance Updates
    socket.on('attendance:updated', (data) => {
      const { studentId, attendance } = data;

      // Notify student
      io.to(`user:${studentId}`).emit('attendance:new', attendance);

      // Notify parents
      if (attendance.parentIds && attendance.parentIds.length > 0) {
        attendance.parentIds.forEach(parentId => {
          io.to(`user:${parentId}`).emit('attendance:new', attendance);
        });
      }

      if (dev) {
        console.log(`📅 Attendance updated for student: ${studentId}`);
      }
    });

    // Announcement Broadcast
    socket.on('announcement:new', (data) => {
      const { targetAudience, announcement } = data;

      if (targetAudience === 'ALL') {
        io.emit('announcement:received', announcement);
      } else if (Array.isArray(targetAudience)) {
        targetAudience.forEach(role => {
          io.to(`role:${role}`).emit('announcement:received', announcement);
        });
      }

      if (dev) {
        console.log(`📣 Announcement broadcast to: ${targetAudience}`);
      }
    });

    // Online Users Count
    socket.on('users:get-online', (callback) => {
      const onlineUsers = Array.from(connectedUsers.entries()).map(([userId, data]) => ({
        userId,
        role: data.role,
        connectedAt: data.connectedAt,
      }));

      callback(onlineUsers);
    });

    // Disconnect Handler
    socket.on('disconnect', () => {
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        io.emit('user:offline', { userId: socket.userId });
        if (dev) {
          console.log(`❌ User disconnected: ${socket.userId}`);
        }
      }
      if (dev) {
        console.log(`❌ Client disconnected: ${socket.id}`);
      }
    });

    // Error Handler
    socket.on('error', (error) => {
      console.error(`🔴 Socket error:`, error);
    });
  });

  let currentPort = port;

  const tryListen = () => {
    httpServer
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`⚠️  Port ${currentPort} is in use, trying ${currentPort + 1}...`);
          currentPort += 1;
          setTimeout(tryListen, 1000);
        } else {
          console.error('🔴 Server error:', err);
          process.exit(1);
        }
      })
      .listen(currentPort, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎓 EduPilot Server Started Successfully! 🚀              ║
║                                                            ║
║   📡 Next.js:      http://${hostname}:${currentPort}              ║
║   🔌 Socket.IO:    http://${hostname}:${currentPort}/api/socket   ║
║   🌍 Environment:  ${dev ? 'Development 🛠️' : 'Production 🏭'}                   ║
║   👥 Online Users: 0                                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
        `);
        console.log('✅ Ready to accept connections...\n');
      });
  };

  tryListen();
});

// Graceful shutdown
let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\n🛑 ${signal}: Initiating graceful shutdown...`);

  try {
    // Notify connected users
    if (global.io) {
      console.log('🔌 Notifying clients...');
      global.io.emit('server:shutdown', { message: 'Server is shutting down' });
    }

    // Close all Socket.IO connections
    if (global.io) {
      console.log('🔌 Closing Socket.IO connections...');
      global.io.disconnectSockets(true);
    }

    // Close HTTP server
    if (httpServer) {
      console.log('📡 Closing HTTP server...');
      await new Promise((resolve) => {
        httpServer.close((err) => {
          if (err) {
            console.warn('⚠️  HTTP server close warning:', err.message);
          }
          resolve();
        });
      });
    }

    // Cleanup PID file
    cleanupPidFile();

    console.log('✅ Graceful shutdown completed\n');
    process.exit(0);
  } catch (error) {
    console.error('🔴 Error during shutdown:', error);
    cleanupPidFile();
    process.exit(1);
  }
};

// Force shutdown after timeout
const FORCE_SHUTDOWN_TIMEOUT = 10000;
let forceShutdownTimer;

const forceShutdown = () => {
  clearTimeout(forceShutdownTimer);
  console.log('\n⚠️  Forcing shutdown...');
  cleanupPidFile();
  process.exit(1);
};

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
  forceShutdownTimer = setTimeout(forceShutdown, FORCE_SHUTDOWN_TIMEOUT);
});

process.on('SIGINT', () => {
  shutdown('SIGINT');
  forceShutdownTimer = setTimeout(forceShutdown, FORCE_SHUTDOWN_TIMEOUT);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🔴 Uncaught Exception:', error);
  cleanupPidFile();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle exit event
process.on('exit', () => {
  cleanupPidFile();
});

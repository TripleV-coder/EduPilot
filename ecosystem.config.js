/**
 * PM2 Ecosystem Configuration for EduPilot
 * Production-ready process management
 */

module.exports = {
  apps: [
    {
      name: 'edupilot',
      script: './server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOSTNAME: 'localhost',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',

        // AI Configuration
        AI_MODEL_PATH: './models',
        AI_CACHE_DIR: './.ai-cache',
        AI_ENABLE_RATE_LIMITING: 'true',
        AI_MAX_CONCURRENT_REQUESTS: '10',
        AI_STREAMING_ENABLED: 'true',
        AI_LOG_LEVEL: 'info',
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      merge_logs: true,

      // Advanced features
      autorestart: true,
      watch: false, // Set to true for development
      max_memory_restart: '1G',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Cluster mode settings
      instance_var: 'INSTANCE_ID',

      // Monitoring
      min_uptime: '10s',
      max_restarts: 10,

      // Source map support
      source_map_support: true,

      // Crash handling
      exp_backoff_restart_delay: 100,
    },
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/edupilot.git',
      path: '/var/www/edupilot',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production..."',
      'post-deploy-local': 'echo "Deployment completed!"',
    },
    staging: {
      user: 'deploy',
      host: ['staging-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-repo/edupilot.git',
      path: '/var/www/edupilot-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
    },
  },
};

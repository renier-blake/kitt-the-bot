module.exports = {
  apps: [
    {
      name: 'kitt-bridge',
      script: 'npm',
      args: 'run bridge:start',
      cwd: '/Users/renierbleeker/Projects/KITT V1',
      env: {
        NODE_ENV: 'production',
      },
      // Auto-restart
      watch: false,
      autorestart: true,
      max_restarts: 10,
      // Logging
      log_file: 'logs/bridge-combined.log',
      out_file: 'logs/bridge-out.log',
      error_file: 'logs/bridge-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};

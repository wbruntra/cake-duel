module.exports = {
  apps: [
    {
      name: 'cake-duel-backend',
      script: 'index.ts',
      interpreter: 'bun',
      cwd: __dirname,
      watch: false,
      env: {
        NODE_ENV: 'production',
        // Must match app_port in ansible/host_vars and the waker entry.
        PORT: 12033,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/backend-error.log',
      out_file: 'logs/backend-out.log',
      merge_logs: true,
    },
  ],
}

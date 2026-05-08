module.exports = {
  apps: [
    {
      name: 'cake-duel-backend',
      script: 'bun',
      args: 'run index.ts',
      cwd: __dirname,
      interpreter: 'none',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/backend-error.log',
      out_file: 'logs/backend-out.log',
      merge_logs: true,
    },
  ],
}

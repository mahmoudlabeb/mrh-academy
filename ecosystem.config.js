module.exports = {
  apps: [
    {
      name: 'mrh-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      max_memory_restart: '512M',
      error_file: '/dev/stderr',
      out_file: '/dev/stdout',
      merge_logs: true,
    },
    {
      name: 'mrh-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '512M',
      error_file: '/dev/stderr',
      out_file: '/dev/stdout',
      merge_logs: true,
    },
  ],
};

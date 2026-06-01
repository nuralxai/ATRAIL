module.exports = {
  apps: [
    {
      name: "atrail-api",
      script: "bash",
      args: "-c 'npx tsx src/index.ts'",
      cwd: "/home/ubuntu/atrail/apps/api",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,       // wait 3s before restarting
      max_restarts: 20,          // give up after 20 rapid crashes
      min_uptime: "10s",         // must stay up 10s to count as stable
      env: {
        NODE_ENV: "production",
      },
      error_file: "/home/ubuntu/.pm2/logs/atrail-api-error.log",
      out_file: "/home/ubuntu/.pm2/logs/atrail-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "atrail-web",
      script: "bash",
      args: "-c 'npx next start -p 3002'",
      cwd: "/home/ubuntu/atrail/apps/web",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
      },
      error_file: "/home/ubuntu/.pm2/logs/atrail-web-error.log",
      out_file: "/home/ubuntu/.pm2/logs/atrail-web-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};

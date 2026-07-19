module.exports = {
  apps: [
    {
      name: "contraventions-api",
      script: "server.js",
      cwd: __dirname,
      instances: 1, // passer à "max" pour du mode cluster (plusieurs cœurs) si besoin
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};

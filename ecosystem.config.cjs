module.exports = {
  apps: [
    {
      name: "Gadson-erp",
      script: ".output/server/index.mjs",
      cwd: __dirname,
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      MONGODB_URI: "mongodb+srv://raneaniket23_db_user:rbWgRsLGj7MwIWAi@erp.bscccpk.mongodb.net/?appName=ERP",
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: 3022,
      },
    },
  ],
};

// PM2 only forwards variables defined in `env` to the app process.
const app = module.exports.apps[0];
if (!app.MONGODB_URI) {
  throw new Error("Set MONGODB_URI in this PM2 ecosystem config.");
}
app.env.MONGODB_URI = app.MONGODB_URI;
delete app.MONGODB_URI;
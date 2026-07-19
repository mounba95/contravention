const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "contraventions_dev",
  database: process.env.PGDATABASE || "contraventions_db"
});

module.exports = pool;

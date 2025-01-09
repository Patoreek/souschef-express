import pkg from "pg";
const { Pool } = pkg;

// Database connection configuration
const pool = new Pool({
  user: "patrickminda", // Your PostgreSQL username
  host: "localhost", // Your database host (e.g., localhost)
  database: "souschef", // Your database name
  password: "", // Your PostgreSQL password
  port: 5432, // Default PostgreSQL port
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to the database:", err.stack);
  } else {
    console.log("Connected to the database");
    release();
  }
});

export default pool;

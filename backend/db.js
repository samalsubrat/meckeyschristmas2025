const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'meckeys_christmas',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initialize database tables
async function initDB() {
    const connection = await pool.getConnection();
    try {
        // Create users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create hero table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS hero (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title TEXT NOT NULL,
                subtitle TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create sections table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS sections (
                id VARCHAR(255) PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create spotlight_data table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS spotlight_data (
                id INT AUTO_INCREMENT PRIMARY KEY,
                section_id VARCHAR(255),
                title VARCHAR(255) NOT NULL,
                subtext TEXT,
                image TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
            )
        `);

        // Create grid_data table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS grid_data (
                id INT AUTO_INCREMENT PRIMARY KEY,
                section_id VARCHAR(255),
                title VARCHAR(255) NOT NULL,
                grid_columns INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
            )
        `);

        // Create products table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                grid_id INT,
                name VARCHAR(255) NOT NULL,
                old_price DECIMAL(10,2),
                new_price DECIMAL(10,2),
                image TEXT,
                link TEXT,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (grid_id) REFERENCES grid_data(id) ON DELETE CASCADE
            )
        `);

        // Check if link column exists, add if not (for existing databases)
        try {
            await connection.execute(`ALTER TABLE products ADD COLUMN link TEXT`);
        } catch (e) {
            // Column already exists, ignore error
        }

        // Insert default hero if not exists
        const [heroRows] = await connection.execute('SELECT COUNT(*) as count FROM hero');
        if (heroRows[0].count === 0) {
            await connection.execute(
                'INSERT INTO hero (title, subtitle) VALUES (?, ?)',
                ['Precision meets \nPerfection.', 'Upgrade your workspace with our limited winter collection.']
            );
        }

        // Insert default admin user if not exists
        const [adminRows] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE username = ?', ['admin']);
        if (adminRows[0].count === 0) {
            const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await connection.execute(
                'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                ['admin', hashedPassword, 'admin']
            );
            console.log('Default admin user created (username: admin)');
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { pool, initDB };

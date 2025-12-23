const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

// Initialize database tables
async function initDB() {
    try {
        // Create users table
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create hero table
        await sql`
            CREATE TABLE IF NOT EXISTS hero (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                subtitle TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create sections table
        await sql`
            CREATE TABLE IF NOT EXISTS sections (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create spotlight_data table
        await sql`
            CREATE TABLE IF NOT EXISTS spotlight_data (
                id SERIAL PRIMARY KEY,
                section_id TEXT REFERENCES sections(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                subtext TEXT,
                image TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create grid_data table
        await sql`
            CREATE TABLE IF NOT EXISTS grid_data (
                id SERIAL PRIMARY KEY,
                section_id TEXT REFERENCES sections(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                grid_columns INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create products table
        await sql`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                grid_id INTEGER REFERENCES grid_data(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                old_price DECIMAL(10,2),
                new_price DECIMAL(10,2),
                image TEXT,
                link TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Add link column if it doesn't exist (for existing databases)
        await sql`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS link TEXT
        `;

        // Insert default hero if not exists
        const heroExists = await sql`SELECT COUNT(*) as count FROM hero`;
        if (heroExists[0].count === '0') {
            await sql`
                INSERT INTO hero (title, subtitle) 
                VALUES ('Precision meets \nPerfection.', 'Upgrade your workspace with our limited winter collection.')
            `;
        }

        // Insert default admin user if not exists
        const adminExists = await sql`SELECT COUNT(*) as count FROM users WHERE username = 'admin'`;
        if (adminExists[0].count === '0') {
            const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await sql`
                INSERT INTO users (username, password_hash, role) 
                VALUES ('admin', ${hashedPassword}, 'admin')
            `;
            console.log('Default admin user created (username: admin)');
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

module.exports = { sql, initDB };

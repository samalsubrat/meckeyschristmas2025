const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'meckeys-christmas-sale-2025-secret-key';

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// ==================== AUTH MIDDLEWARE ====================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Find user
        const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Change password
app.put('/api/auth/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Get current user
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== HERO ====================

// Get hero data
app.get('/api/hero', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM hero LIMIT 1');
        if (rows.length === 0) {
            return res.json({ title: '', subtitle: '' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching hero:', error);
        res.status(500).json({ error: 'Failed to fetch hero data' });
    }
});

// Update hero data (protected)
app.put('/api/hero', authenticateToken, async (req, res) => {
    try {
        const { title, subtitle } = req.body;
        await pool.execute(
            'UPDATE hero SET title = ?, subtitle = ? WHERE id = 1',
            [title, subtitle]
        );
        const [rows] = await pool.execute('SELECT * FROM hero WHERE id = 1');
        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating hero:', error);
        res.status(500).json({ error: 'Failed to update hero data' });
    }
});

// ==================== SECTIONS ====================

// Get all sections with their data
app.get('/api/sections', async (req, res) => {
    try {
        const [sections] = await pool.execute('SELECT * FROM sections ORDER BY sort_order ASC');

        const fullSections = await Promise.all(sections.map(async (section) => {
            if (section.type === 'spotlight') {
                const [data] = await pool.execute(
                    'SELECT * FROM spotlight_data WHERE section_id = ?',
                    [section.id]
                );
                return {
                    id: section.id,
                    type: section.type,
                    data: data[0] || { title: '', subtext: '', image: '' }
                };
            } else if (section.type === 'grid') {
                const [gridData] = await pool.execute(
                    'SELECT * FROM grid_data WHERE section_id = ?',
                    [section.id]
                );
                let products = [];
                if (gridData[0]) {
                    const [productRows] = await pool.execute(
                        'SELECT * FROM products WHERE grid_id = ? ORDER BY sort_order ASC',
                        [gridData[0].id]
                    );
                    products = productRows;
                }

                return {
                    id: section.id,
                    type: section.type,
                    data: {
                        title: gridData[0]?.title || '',
                        gridColumns: gridData[0]?.grid_columns || 0,
                        products: products.map(p => ({
                            id: p.id,
                            name: p.name,
                            oldPrice: parseFloat(p.old_price),
                            newPrice: parseFloat(p.new_price),
                            image: p.image,
                            link: p.link || '#'
                        }))
                    }
                };
            }
            return section;
        }));

        res.json(fullSections);
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({ error: 'Failed to fetch sections' });
    }
});

// Get complete page data (hero + sections)
app.get('/api/page-data', async (req, res) => {
    try {
        // Get hero
        const [heroRows] = await pool.execute('SELECT * FROM hero LIMIT 1');
        
        // Get sections
        const [sections] = await pool.execute('SELECT * FROM sections ORDER BY sort_order ASC');

        const fullSections = await Promise.all(sections.map(async (section) => {
            if (section.type === 'spotlight') {
                const [data] = await pool.execute(
                    'SELECT * FROM spotlight_data WHERE section_id = ?',
                    [section.id]
                );
                return {
                    id: section.id,
                    type: section.type,
                    data: data[0] ? {
                        title: data[0].title,
                        subtext: data[0].subtext,
                        image: data[0].image
                    } : { title: '', subtext: '', image: '' }
                };
            } else if (section.type === 'grid') {
                const [gridData] = await pool.execute(
                    'SELECT * FROM grid_data WHERE section_id = ?',
                    [section.id]
                );
                let products = [];
                if (gridData[0]) {
                    const [productRows] = await pool.execute(
                        'SELECT * FROM products WHERE grid_id = ? ORDER BY sort_order ASC',
                        [gridData[0].id]
                    );
                    products = productRows;
                }

                return {
                    id: section.id,
                    type: section.type,
                    data: {
                        title: gridData[0]?.title || '',
                        gridColumns: gridData[0]?.grid_columns || 0,
                        products: products.map(p => ({
                            id: p.id,
                            name: p.name,
                            oldPrice: parseFloat(p.old_price),
                            newPrice: parseFloat(p.new_price),
                            image: p.image,
                            link: p.link || '#'
                        }))
                    }
                };
            }
            return section;
        }));

        res.json({
            hero: heroRows[0] || { title: '', subtitle: '' },
            sections: fullSections
        });
    } catch (error) {
        console.error('Error fetching page data:', error);
        res.status(500).json({ error: 'Failed to fetch page data' });
    }
});

// Create a new section (protected)
app.post('/api/sections', authenticateToken, async (req, res) => {
    try {
        const { type } = req.body;
        const sectionId = 'sec_' + Date.now();
        
        // Get max sort order
        const [maxRows] = await pool.execute('SELECT COALESCE(MAX(sort_order), 0) as max FROM sections');
        const sortOrder = parseInt(maxRows[0].max) + 1;

        // Insert section
        await pool.execute(
            'INSERT INTO sections (id, type, sort_order) VALUES (?, ?, ?)',
            [sectionId, type, sortOrder]
        );

        // Insert default data based on type
        if (type === 'spotlight') {
            await pool.execute(
                'INSERT INTO spotlight_data (section_id, title, subtext, image) VALUES (?, ?, ?, ?)',
                [sectionId, 'New Spotlight', 'Description here', 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=1600&q=80']
            );
        } else if (type === 'grid') {
            const [gridResult] = await pool.execute(
                'INSERT INTO grid_data (section_id, title, grid_columns) VALUES (?, ?, ?)',
                [sectionId, 'New Collection', 0]
            );
            
            // Add a default product
            await pool.execute(
                'INSERT INTO products (grid_id, name, old_price, new_price, image, link, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [gridResult.insertId, 'New Product', 100, 99, 'https://via.placeholder.com/400', '#', 0]
            );
        }

        res.json({ id: sectionId, type, message: 'Section created successfully' });
    } catch (error) {
        console.error('Error creating section:', error);
        res.status(500).json({ error: 'Failed to create section' });
    }
});

// Update section order (protected)
app.put('/api/sections/reorder', authenticateToken, async (req, res) => {
    try {
        const { sections } = req.body; // Array of { id, sort_order }
        
        for (const section of sections) {
            await pool.execute(
                'UPDATE sections SET sort_order = ? WHERE id = ?',
                [section.sort_order, section.id]
            );
        }
        
        res.json({ message: 'Sections reordered successfully' });
    } catch (error) {
        console.error('Error reordering sections:', error);
        res.status(500).json({ error: 'Failed to reorder sections' });
    }
});

// Delete section (protected)
app.delete('/api/sections/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM sections WHERE id = ?', [id]);
        res.json({ message: 'Section deleted successfully' });
    } catch (error) {
        console.error('Error deleting section:', error);
        res.status(500).json({ error: 'Failed to delete section' });
    }
});

// ==================== SPOTLIGHT ====================

// Update spotlight data (protected)
app.put('/api/spotlight/:sectionId', authenticateToken, async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { title, subtext, image } = req.body;
        
        await pool.execute(
            'UPDATE spotlight_data SET title = ?, subtext = ?, image = ? WHERE section_id = ?',
            [title, subtext, image, sectionId]
        );
        
        const [rows] = await pool.execute('SELECT * FROM spotlight_data WHERE section_id = ?', [sectionId]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating spotlight:', error);
        res.status(500).json({ error: 'Failed to update spotlight' });
    }
});

// ==================== GRID ====================

// Update grid data (protected)
app.put('/api/grid/:sectionId', authenticateToken, async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { title, gridColumns } = req.body;
        
        await pool.execute(
            'UPDATE grid_data SET title = ?, grid_columns = ? WHERE section_id = ?',
            [title, gridColumns, sectionId]
        );
        
        const [rows] = await pool.execute('SELECT * FROM grid_data WHERE section_id = ?', [sectionId]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating grid:', error);
        res.status(500).json({ error: 'Failed to update grid' });
    }
});

// ==================== PRODUCTS ====================

// Add product to grid (protected)
app.post('/api/grid/:sectionId/products', authenticateToken, async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { name, oldPrice, newPrice, image, link } = req.body;
        
        // Get grid_id
        const [gridRows] = await pool.execute('SELECT id FROM grid_data WHERE section_id = ?', [sectionId]);
        if (gridRows.length === 0) {
            return res.status(404).json({ error: 'Grid not found' });
        }
        
        // Get max sort order
        const [maxRows] = await pool.execute(
            'SELECT COALESCE(MAX(sort_order), 0) as max FROM products WHERE grid_id = ?',
            [gridRows[0].id]
        );
        const sortOrder = parseInt(maxRows[0].max) + 1;
        
        const [result] = await pool.execute(
            'INSERT INTO products (grid_id, name, old_price, new_price, image, link, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [gridRows[0].id, name, oldPrice, newPrice, image, link || '#', sortOrder]
        );
        
        const [newProduct] = await pool.execute('SELECT * FROM products WHERE id = ?', [result.insertId]);
        
        res.json({
            id: newProduct[0].id,
            name: newProduct[0].name,
            oldPrice: parseFloat(newProduct[0].old_price),
            newPrice: parseFloat(newProduct[0].new_price),
            image: newProduct[0].image,
            link: newProduct[0].link || '#'
        });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// Update product (protected)
app.put('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, oldPrice, newPrice, image, link } = req.body;
        
        await pool.execute(
            'UPDATE products SET name = ?, old_price = ?, new_price = ?, image = ?, link = ? WHERE id = ?',
            [name, oldPrice, newPrice, image, link || '#', id]
        );
        
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
        
        res.json({
            id: rows[0].id,
            name: rows[0].name,
            oldPrice: parseFloat(rows[0].old_price),
            newPrice: parseFloat(rows[0].new_price),
            image: rows[0].image,
            link: rows[0].link || '#'
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product (protected)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM products WHERE id = ?', [id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ==================== SAVE ALL DATA ====================

// Save complete page data (from CMS) (protected)
app.post('/api/save-all', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { hero, sections } = req.body;

        await connection.beginTransaction();

        // Update hero
        await connection.execute(
            'UPDATE hero SET title = ?, subtitle = ? WHERE id = 1',
            [hero.title, hero.subtitle]
        );

        // Delete existing sections (cascade will delete related data)
        await connection.execute('DELETE FROM sections');

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            
            // Insert section
            await connection.execute(
                'INSERT INTO sections (id, type, sort_order) VALUES (?, ?, ?)',
                [section.id, section.type, i]
            );

            if (section.type === 'spotlight') {
                await connection.execute(
                    'INSERT INTO spotlight_data (section_id, title, subtext, image) VALUES (?, ?, ?, ?)',
                    [section.id, section.data.title, section.data.subtext, section.data.image]
                );
            } else if (section.type === 'grid') {
                const [gridResult] = await connection.execute(
                    'INSERT INTO grid_data (section_id, title, grid_columns) VALUES (?, ?, ?)',
                    [section.id, section.data.title, section.data.gridColumns || 0]
                );

                for (let j = 0; j < section.data.products.length; j++) {
                    const product = section.data.products[j];
                    await connection.execute(
                        'INSERT INTO products (grid_id, name, old_price, new_price, image, link, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [gridResult.insertId, product.name, product.oldPrice, product.newPrice, product.image, product.link || '#', j]
                    );
                }
            }
        }

        await connection.commit();
        res.json({ message: 'All data saved successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error saving all data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    } finally {
        connection.release();
    }
});

// ==================== START SERVER ====================

// Initialize DB on first request (for serverless)
let dbInitialized = false;
app.use(async (req, res, next) => {
    if (!dbInitialized) {
        try {
            await initDB();
            dbInitialized = true;
        } catch (error) {
            console.error('DB initialization error:', error);
        }
    }
    next();
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    initDB().then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📡 API available at http://localhost:${PORT}/api`);
        });
    }).catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

// Export for Vercel serverless
module.exports = app;

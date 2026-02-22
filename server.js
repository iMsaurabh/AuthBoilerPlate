const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const organizationsRoutes = require('./routes/organizations');

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'Auth Boilerplate API is running!' });
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationsRoutes);


// Import middleware
const { authenticateToken } = require('./middleware/auth');

// Protected route example
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        // req.userId is set by the middleware
        const result = await pool.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [req.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
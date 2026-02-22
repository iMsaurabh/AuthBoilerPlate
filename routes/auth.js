const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');

// Add these imports at the top if not already there
const crypto = require('crypto');

// SIGNUP
router.post('/signup', async (req, res) => {
    const { email, password, name } = req.body;

    try {
        // 1. Validate input
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password should be minimum 6 characters' });
        }

        // 2. Check if user already exists
        const userList = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userList.rows.length > 0) {
            return res.status(400).json({ error: 'Email is already registered' });
        }

        // 3. Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // 4. Create user
        const insertUser = await pool.query(`
            INSERT INTO users(email, password_hash, name) 
            VALUES($1, $2, $3) 
            RETURNING *
        `, [email, password_hash, name]);

        const userId = insertUser.rows[0].id;

        // 5. Generate tokens
        const accessToken = generateAccessToken(userId);
        const refreshToken = generateRefreshToken(userId);

        // 6. Store refresh token in database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await pool.query(`
            INSERT INTO refresh_tokens(user_id, token, expires_at) 
            VALUES($1, $2, $3)
        `, [userId, refreshToken, expiresAt]);

        // 7. Return tokens and user info
        res.status(201).json({
            accessToken,
            refreshToken,
            user: {
                id: userId,
                email,
                name
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Signup failed' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // 2. Find user by email
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = userResult.rows[0];

        // 3. Compare password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // 4. Generate tokens
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // 5. Store refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await pool.query(`
            INSERT INTO refresh_tokens(user_id, token, expires_at) 
            VALUES($1, $2, $3)
        `, [user.id, refreshToken, expiresAt]);

        // 6. Return tokens and user info
        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// REFRESH TOKEN
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
    }

    try {
        // 1. Verify refresh token
        const { verifyRefreshToken } = require('../utils/jwt');
        const decoded = verifyRefreshToken(refreshToken);

        if (!decoded) {
            return res.status(403).json({ error: 'Invalid refresh token' });
        }

        // 2. Check if refresh token exists in database and hasn't expired
        const tokenResult = await pool.query(`
            SELECT * FROM refresh_tokens 
            WHERE token = $1 AND user_id = $2 AND expires_at > NOW()
        `, [refreshToken, decoded.userId]);

        if (tokenResult.rows.length === 0) {
            return res.status(403).json({ error: 'Refresh token expired or invalid' });
        }

        // 3. Generate new access token
        const newAccessToken = generateAccessToken(decoded.userId);

        // 4. Optionally generate new refresh token (for security)
        const newRefreshToken = generateRefreshToken(decoded.userId);

        // 5. Replace old refresh token with new one
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
        await pool.query(`
            INSERT INTO refresh_tokens(user_id, token, expires_at) 
            VALUES($1, $2, $3)
        `, [decoded.userId, newRefreshToken, expiresAt]);

        // 6. Return new tokens
        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });

    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// LOGOUT
router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;

    try {
        // If refresh token provided, try to delete it
        if (refreshToken) {
            await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
        }

        // Always return success - user is "logged out"
        res.json({ message: 'Logged out successfully' });

    } catch (error) {
        console.error('Logout error:', error);
        // Even if database fails, still return success
        // Client-side should clear tokens regardless
        res.json({ message: 'Logged out successfully' });
    }
});



// REQUEST PASSWORD RESET
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Find user
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        // Always return success (don't reveal if email exists)
        if (userResult.rows.length === 0) {
            return res.json({ message: 'If email exists, reset instructions sent' });
        }

        const user = userResult.rows[0];

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date();
        resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

        // Save reset token
        await pool.query(`
            UPDATE users 
            SET reset_token = $1, reset_token_expires = $2 
            WHERE id = $3
        `, [resetToken, resetExpires, user.id]);

        // In real app, send email here
        console.log('Password reset token for', email, ':', resetToken);
        console.log('Reset URL: http://localhost:3000/reset-password?token=' + resetToken);

        res.json({
            message: 'If email exists, reset instructions sent',
            // For testing only - remove in production
            resetToken: resetToken
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // Find user with valid reset token
        const userResult = await pool.query(`
            SELECT * FROM users 
            WHERE reset_token = $1 AND reset_token_expires > NOW()
        `, [token]);

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const user = userResult.rows[0];

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update password and clear reset token
        await pool.query(`
            UPDATE users 
            SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
            WHERE id = $2
        `, [passwordHash, user.id]);

        // Invalidate all refresh tokens (force re-login on all devices)
        await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

        res.json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
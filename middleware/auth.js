const { verifyAccessToken } = require('../utils/jwt');

function authenticateToken(req, res, next) {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Add user ID to request
    req.userId = decoded.userId;
    next();
}

module.exports = { authenticateToken };
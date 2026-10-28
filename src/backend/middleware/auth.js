import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db';
export function authenticateToken(req, res, next) {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null)
        || req.cookies?.token;
    if (!token) {
        res.status(401).json({ success: false, error: 'Authentication token missing. Please log in.' });
        return;
    }
    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        const user = db.prepare(`
      SELECT id, email, display_name, role, referral_code, referrer_user_id, referral_count, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(decoded.userId);
        if (!user) {
            res.status(401).json({ success: false, error: 'User account not found or deactivated.' });
            return;
        }
        req.user = user;
        next();
    }
    catch (err) {
        res.status(403).json({ success: false, error: 'Invalid or expired session token.' });
    }
}
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Access denied: Admin authorization required.' });
        return;
    }
    next();
}

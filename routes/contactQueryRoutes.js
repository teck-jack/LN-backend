const express = require('express');
const router = express.Router();
const {
    submitQuery,
    getAllQueries,
    getQueryById,
    getUserQueries,
    updateQueryStatus,
    assignQuery,
    addResponse,
    deleteQuery
} = require('../controllers/contactQueryController');

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

// Public route - no authentication required
// But we'll use a modified protect middleware that doesn't fail if no token
router.post('/submit', async (req, res, next) => {
    // Try to authenticate, but don't fail if no token
    let token;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const User = require('../models/User');
            const config = require('../config/config');

            const decoded = jwt.verify(token, config.jwtSecret);
            req.user = await User.findById(decoded.id).select('-password');
        } catch (err) {
            // Token invalid, but that's okay for this endpoint
            req.user = null;
        }
    }

    next();
}, submitQuery);

// Protected routes - require authentication
router.get('/queries/my-queries', protect, getUserQueries);
router.get('/queries', protect, authorize('admin', 'employee'), getAllQueries);
router.get('/queries/:id', protect, getQueryById);
router.put('/queries/:id/status', protect, authorize('admin', 'employee'), updateQueryStatus);
router.put('/queries/:id/assign', protect, authorize('admin', 'employee'), assignQuery);
router.post('/queries/:id/response', protect, authorize('admin', 'employee'), addResponse);
router.delete('/queries/:id', protect, authorize('admin'), deleteQuery);

module.exports = router;

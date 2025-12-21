const express = require('express');
const router = express.Router();
const {
    getAuditLogs,
    exportAuditLogs,
    getEntityHistory
} = require('../controllers/auditLogController');
const { protect, authorize } = require('../middleware/auth');

// All routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

router.get('/', getAuditLogs);
router.get('/export', exportAuditLogs);
router.get('/entity/:entityType/:entityId', getEntityHistory);

module.exports = router;

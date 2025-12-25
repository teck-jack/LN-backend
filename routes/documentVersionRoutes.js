const express = require('express');
const router = express.Router();
const {
    uploadVersion,
    getVersionHistory,
    downloadVersion,
    deleteVersion,
    restoreVersion,
    verifyDocument,
    uploadMiddleware,
    getDocumentStatus
} = require('../controllers/documentVersionController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Upload new version
router.post('/upload', uploadMiddleware, uploadVersion);

// Get version history
router.get('/:caseId/:documentType/versions', getVersionHistory);

// Download specific version
router.get('/version/:versionId/download', downloadVersion);

// Delete version (admin/employee only)
router.delete('/version/:versionId', deleteVersion);

// Restore previous version (admin/employee only)
router.post('/version/:versionId/restore', restoreVersion);

// Verify document (admin/employee only)
router.put('/version/:versionId/verify', verifyDocument);

// Get document status for a case
router.get('/:caseId/status', getDocumentStatus);

module.exports = router;

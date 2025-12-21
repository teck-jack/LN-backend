const express = require('express');
const router = express.Router();
const {
    addInternalNote,
    getInternalNotes,
    updateInternalNote,
    deleteInternalNote
} = require('../controllers/internalNoteController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);
router.use(authorize('admin', 'employee'));

// Case-specific internal notes
router.route('/cases/:caseId/internal-notes')
    .get(getInternalNotes)
    .post(addInternalNote);

// Individual note operations
router.route('/internal-notes/:noteId')
    .put(updateInternalNote)
    .delete(deleteInternalNote);

module.exports = router;

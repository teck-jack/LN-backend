const express = require('express');
const router = express.Router();
const {
    createCannedResponse,
    getCannedResponses,
    getCannedResponsesByCategory,
    getPopularResponses,
    updateCannedResponse,
    deleteCannedResponse,
    useCannedResponse
} = require('../controllers/cannedResponseController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);
router.use(authorize('admin', 'employee'));

router.route('/')
    .get(getCannedResponses)
    .post(createCannedResponse);

router.get('/popular', getPopularResponses);
router.get('/category/:category', getCannedResponsesByCategory);

router.route('/:id')
    .put(updateCannedResponse)
    .delete(deleteCannedResponse);

router.post('/:id/use', useCannedResponse);

module.exports = router;

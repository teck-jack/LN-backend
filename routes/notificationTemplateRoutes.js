const express = require('express');
const router = express.Router();
const {
    createTemplate,
    getTemplates,
    getTemplateById,
    updateTemplate,
    deleteTemplate,
    testTemplate
} = require('../controllers/notificationTemplateController');
const { protect, authorize } = require('../middleware/auth');

// All routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

router.route('/')
    .get(getTemplates)
    .post(createTemplate);

router.route('/:id')
    .get(getTemplateById)
    .put(updateTemplate)
    .delete(deleteTemplate);

router.post('/:id/test', testTemplate);

module.exports = router;

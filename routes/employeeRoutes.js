const express = require('express');
const {
  getDashboard,
  getAssignedCases,
  getCase,
  updateCaseStatus,
  addNote,
  uploadDocument,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getProfile,
  updateProfile
} = require('../controllers/employeeController');
const { employeeAuth } = require('../middleware/employeeAuth');

const router = express.Router();

router.use(employeeAuth);

router.get('/dashboard', getDashboard);
router.get('/cases', getAssignedCases);
router.get('/cases/:id', getCase);
router.put('/cases/:id/status', updateCaseStatus);
router.post('/cases/:id/notes', addNote);
router.post('/cases/:id/documents', uploadDocument);
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationAsRead);
router.put('/notifications/read-all', markAllNotificationsAsRead);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

module.exports = router;
const express = require('express');
const {
  getDashboard,
  getUsers,
  getUser,
  createUser,
  createEmployee,
  updateEmployee,
  createAgent,
  updateAgent,
  getCases,
  getCase,
  assignCase,
  autoAssignCases,
  createService,
  updateService,
  getServices,
  getReports,
  getRequiredDocuments,
  addNote,
  getTimeline,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = require('../controllers/adminController');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

router.use(adminAuth);

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.post('/users', createUser);
router.get('/users/:id', getUser);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);
router.post('/agents', createAgent);
router.put('/agents/:id', updateAgent);
router.get('/cases', getCases);
router.get('/cases/:id', getCase);
router.get('/cases/:id/required-documents', getRequiredDocuments);
router.post('/cases/:id/notes', addNote);
router.get('/cases/:id/timeline', getTimeline);
router.put('/cases/:id/assign', assignCase);
router.post('/cases/auto-assign', autoAssignCases);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.get('/services', getServices);
router.get('/reports', getReports);

// Notification routes
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationAsRead);
router.put('/notifications/read-all', markAllNotificationsAsRead);

module.exports = router;
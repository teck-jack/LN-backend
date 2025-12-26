const express = require('express');
const {
  getDashboard,
  getOnboardedUsers,
  createEndUser,
  getServices,
  getServiceById,
  getReports,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = require('../controllers/agentController');
const { agentAuth } = require('../middleware/agentAuth');

const router = express.Router();

router.use(agentAuth);

router.get('/dashboard', getDashboard);
router.get('/users', getOnboardedUsers);
router.post('/users', createEndUser);
router.get('/services', getServices);
router.get('/services/:id', getServiceById);

router.get('/reports', getReports);

// Notification routes
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationAsRead);
router.put('/notifications/read-all', markAllNotificationsAsRead);

module.exports = router;
const express = require('express');
const {
  getDashboard,
  getServices,
  getService,
  createPaymentOrder,
  verifyPayment,
  getCases,
  getCase,
  addNote,
  uploadDocument,
  getPayments,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getProfile,
  updateProfile
} = require('../controllers/endUserController');
const { endUserAuth } = require('../middleware/endUserAuth');

const router = express.Router();

router.use(endUserAuth);

router.get('/dashboard', getDashboard);
router.get('/services', getServices);
router.get('/services/:id', getService);
router.post('/payment/create-order', createPaymentOrder);
router.post('/payment/verify', verifyPayment);
router.get('/cases', getCases);
router.get('/cases/:id', getCase);
router.post('/cases/:id/notes', addNote);
router.post('/cases/:id/documents', uploadDocument);
router.get('/payments', getPayments);
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationAsRead);
router.put('/notifications/read-all', markAllNotificationsAsRead);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

module.exports = router;
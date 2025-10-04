const express = require('express');
const {
  getDashboard,
  getUsers,
  getUser,
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
  getReports
} = require('../controllers/adminController');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

router.use(adminAuth);

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);
router.post('/agents', createAgent);
router.put('/agents/:id', updateAgent);
router.get('/cases', getCases);
router.get('/cases/:id', getCase);
router.put('/cases/:id/assign', assignCase);
router.post('/cases/auto-assign', autoAssignCases);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.get('/services', getServices);
router.get('/reports', getReports);

module.exports = router;
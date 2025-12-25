const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./utils/errorHandler');
const cors = require('cors');

// Load env vars
dotenv.config({ path: './.env' });

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true, // Often needed when using cookies or authorization headers
}));


// Route files
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const agentRoutes = require('./routes/agentRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const endUserRoutes = require('./routes/endUserRoutes');
// 🆕 NEW ROUTES FOR SRS
const workflowRoutes = require('./routes/workflowRoutes');
const documentVersionRoutes = require('./routes/documentVersionRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const notificationTemplateRoutes = require('./routes/notificationTemplateRoutes');
const internalNoteRoutes = require('./routes/internalNoteRoutes');
const cannedResponseRoutes = require('./routes/cannedResponseRoutes');
const contactQueryRoutes = require('./routes/contactQueryRoutes');

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/enduser', endUserRoutes);
// 🆕 NEW ROUTE MOUNTS
app.use('/api/admin/workflow-templates', workflowRoutes);
app.use('/api/documents', documentVersionRoutes);
app.use('/api/admin/audit-logs', auditLogRoutes);
app.use('/api/admin/notification-templates', notificationTemplateRoutes);
app.use('/api/employee', internalNoteRoutes);
app.use('/api/employee/canned-responses', cannedResponseRoutes);
app.use('/api/contact', contactQueryRoutes);


// Health check route
app.get('/', (req, res) => {
  res.send('Service Management API is running...');
});

// Error handler (must be after routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

// 🆕 Setup cron jobs for SLA monitoring
const cron = require('node-cron');
const { updateAllSLAStatuses } = require('./services/slaService');

// Run SLA status check every hour
cron.schedule('0 * * * *', async () => {
  console.log('🔄 Running SLA status update...');
  await updateAllSLAStatuses();
});

console.log('✅ SLA monitoring cron job scheduled (runs every hour)');

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`❌ Error: ${err.message}`);
  server.close(() => process.exit(1));
});

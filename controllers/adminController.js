const User = require('../models/User');
const Service = require('../models/Service');
const Case = require('../models/Case');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const DocumentVersion = require('../models/DocumentVersion');
const constants = require('../utils/constants');
const { calculateEmployeeWorkload } = require('../utils/helpers');

// @desc    Get admin dashboard
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboard = async (req, res, next) => {
  try {
    // Get total users by source
    const totalUsersBySource = await User.aggregate([
      {
        $match: { role: constants.USER_ROLES.END_USER }
      },
      {
        $group: {
          _id: '$sourceTag',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total cases by status
    const totalCasesByStatus = await Case.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get employees with workload
    const employees = await User.find({ role: constants.USER_ROLES.EMPLOYEE });
    const employeesWithWorkload = [];

    for (const employee of employees) {
      const assignedCases = await Case.find({ employeeId: employee._id });
      const workload = calculateEmployeeWorkload(assignedCases);

      employeesWithWorkload.push({
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        workload
      });
    }

    // Get agents with performance
    const agents = await User.find({ role: constants.USER_ROLES.AGENT });
    const agentsWithPerformance = [];

    for (const agent of agents) {
      const onboardedUsers = await User.find({ agentId: agent._id });
      const completedCases = await Case.find({
        endUserId: { $in: onboardedUsers.map(u => u._id) },
        status: constants.CASE_STATUS.COMPLETED
      });

      agentsWithPerformance.push({
        _id: agent._id,
        name: agent.name,
        email: agent.email,
        onboardedUsers: onboardedUsers.length,
        completedCases: completedCases.length
      });
    }

    // Get revenue stats
    const payments = await Payment.find({ status: 'completed' });
    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          paymentDate: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsersBySource,
        totalCasesByStatus,
        employees: employeesWithWorkload,
        agents: agentsWithPerformance,
        revenue: {
          total: totalRevenue,
          monthly: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const { role, sourceTag, page = 1, limit = 10 } = req.query;

    const query = {};
    if (role) query.role = role;
    if (sourceTag) query.sourceTag = sourceTag;

    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      },
      data: users
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single user
// @route   GET /api/admin/users/:id
// @access  Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create user
// @route   POST /api/admin/users
// @access  Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: role || constants.USER_ROLES.END_USER,
      sourceTag: 'admin_direct'
    });

    // Create welcome notification
    await Notification.create({
      recipientId: user._id,
      type: constants.NOTIFICATION_TYPES.IN_APP,
      title: 'Welcome',
      message: 'Your account has been created successfully.',
      relatedCaseId: null
    });

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create employee
// @route   POST /api/admin/employees
// @access  Private/Admin
exports.createEmployee = async (req, res, next) => {
  try {
    const { name, email, password, phone, assignedModules } = req.body;

    // Create employee
    const employee = await User.create({
      name,
      email,
      password,
      phone,
      role: constants.USER_ROLES.EMPLOYEE,
      assignedModules
    });

    // Create notification for the new employee
    await Notification.create({
      recipientId: employee._id,
      type: constants.NOTIFICATION_TYPES.IN_APP,
      title: 'Welcome to the Team',
      message: 'Your account has been created successfully. You can now start processing cases.',
      relatedCaseId: null
    });

    res.status(201).json({
      success: true,
      data: employee
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update employee
// @route   PUT /api/admin/employees/:id
// @access  Private/Admin
exports.updateEmployee = async (req, res, next) => {
  try {
    const { name, email, phone, assignedModules, isActive } = req.body;

    const employee = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, assignedModules, isActive },
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create agent
// @route   POST /api/admin/agents
// @access  Private/Admin
exports.createAgent = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    // Create agent
    const agent = await User.create({
      name,
      email,
      password,
      phone,
      role: constants.USER_ROLES.AGENT
    });

    // Create notification for the new agent
    await Notification.create({
      recipientId: agent._id,
      type: constants.NOTIFICATION_TYPES.IN_APP,
      title: 'Welcome to the Team',
      message: 'Your account has been created successfully. You can now start onboarding users.',
      relatedCaseId: null
    });

    res.status(201).json({
      success: true,
      data: agent
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update agent
// @route   PUT /api/admin/agents/:id
// @access  Private/Admin
exports.updateAgent = async (req, res, next) => {
  try {
    const { name, email, phone, isActive } = req.body;

    const agent = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, isActive },
      { new: true, runValidators: true }
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all cases
// @route   GET /api/admin/cases
// @access  Private/Admin
exports.getCases = async (req, res, next) => {
  try {
    const { status, employeeId, agentId, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (employeeId) query.employeeId = employeeId;

    // If agentId is provided, find cases for users onboarded by that agent
    if (agentId) {
      const onboardedUsers = await User.find({ agentId });
      query.endUserId = { $in: onboardedUsers.map(u => u._id) };
    }

    const cases = await Case.find(query)
      .populate('endUserId', 'name email phone')
      .populate('employeeId', 'name email')
      .populate('serviceId', 'name type')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Case.countDocuments(query);

    res.status(200).json({
      success: true,
      count: cases.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      },
      data: cases
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single case
// @route   GET /api/admin/cases/:id
// @access  Private/Admin
exports.getCase = async (req, res, next) => {
  try {
    const caseItem = await Case.findById(req.params.id)
      .populate('endUserId', 'name email phone')
      .populate('employeeId', 'name email')
      .populate('serviceId', 'name type processSteps documentsRequired')
      .populate('notes.createdBy', 'name role');

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    res.status(200).json({
      success: true,
      data: caseItem
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Assign case to employee
// @route   PUT /api/admin/cases/:id/assign
// @access  Private/Admin
exports.assignCase = async (req, res, next) => {
  try {
    const { employeeId } = req.body;

    const caseItem = await Case.findById(req.params.id);
    const employee = await User.findById(employeeId);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    if (!employee || employee.role !== constants.USER_ROLES.EMPLOYEE) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Update case
    caseItem.employeeId = employeeId;
    caseItem.assignedAt = Date.now();
    await caseItem.save();

    // Create notification for employee
    await Notification.create({
      recipientId: employeeId,
      type: constants.NOTIFICATION_TYPES.IN_APP,
      title: 'New Case Assigned',
      message: `A new case (${caseItem.caseId}) has been assigned to you.`,
      relatedCaseId: caseItem._id
    });

    res.status(200).json({
      success: true,
      data: caseItem
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Auto assign cases
// @route   POST /api/admin/cases/auto-assign
// @access  Private/Admin
exports.autoAssignCases = async (req, res, next) => {
  try {
    // Get all unassigned cases
    const unassignedCases = await Case.find({ employeeId: null });

    // Get all active employees
    const employees = await User.find({
      role: constants.USER_ROLES.EMPLOYEE,
      isActive: true
    });

    if (unassignedCases.length === 0 || employees.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No cases to assign or no employees available'
      });
    }

    // Calculate current workload for each employee
    const employeesWithWorkload = [];
    for (const employee of employees) {
      const assignedCases = await Case.find({ employeeId: employee._id });
      const workload = calculateEmployeeWorkload(assignedCases);

      employeesWithWorkload.push({
        _id: employee._id,
        workload: workload.total
      });
    }

    // Sort employees by workload (ascending)
    employeesWithWorkload.sort((a, b) => a.workload - b.workload);

    // Assign cases to employees with least workload
    const assignedCases = [];
    for (let i = 0; i < unassignedCases.length; i++) {
      const caseItem = unassignedCases[i];
      const employeeIndex = i % employeesWithWorkload.length;
      const employeeId = employeesWithWorkload[employeeIndex]._id;

      caseItem.employeeId = employeeId;
      caseItem.assignedAt = Date.now();
      await caseItem.save();

      // Create notification for employee
      await Notification.create({
        recipientId: employeeId,
        type: constants.NOTIFICATION_TYPES.IN_APP,
        title: 'New Case Assigned',
        message: `A new case (${caseItem.caseId}) has been assigned to you.`,
        relatedCaseId: caseItem._id
      });

      assignedCases.push(caseItem);
    }

    res.status(200).json({
      success: true,
      count: assignedCases.length,
      data: assignedCases
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create service
// @route   POST /api/admin/services
// @access  Private/Admin
exports.createService = async (req, res, next) => {
  try {
    const service = await Service.create(req.body);

    res.status(201).json({
      success: true,
      data: service
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update service
// @route   PUT /api/admin/services/:id
// @access  Private/Admin
exports.updateService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all services
// @route   GET /api/admin/services
// @access  Private/Admin
exports.getServices = async (req, res, next) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get reports
// @route   GET /api/admin/reports
// @access  Private/Admin
exports.getReports = async (req, res, next) => {
  try {
    const { type, startDate, endDate } = req.query;

    let matchQuery = {};
    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    let reportData = {};

    switch (type) {
      case 'revenue':
        reportData = await Payment.aggregate([
          { $match: { ...matchQuery, status: 'completed' } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);
        break;

      case 'cases':
        reportData = await Case.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);
        break;

      case 'agent-performance':
        const agents = await User.find({ role: constants.USER_ROLES.AGENT });

        for (const agent of agents) {
          const onboardedUsers = await User.find({ agentId: agent._id });
          const completedCases = await Case.find({
            endUserId: { $in: onboardedUsers.map(u => u._id) },
            status: constants.CASE_STATUS.COMPLETED,
            ...matchQuery
          });

          reportData.push({
            agent: {
              _id: agent._id,
              name: agent.name,
              email: agent.email
            },
            onboardedUsers: onboardedUsers.length,
            completedCases: completedCases.length,
            conversionRate: onboardedUsers.length > 0
              ? Math.round((completedCases.length / onboardedUsers.length) * 100)
              : 0
          });
        }
        break;

      case 'employee-performance':
        const employees = await User.find({ role: constants.USER_ROLES.EMPLOYEE });

        for (const employee of employees) {
          const assignedCases = await Case.find({
            employeeId: employee._id,
            ...matchQuery
          });

          reportData.push({
            employee: {
              _id: employee._id,
              name: employee.name,
              email: employee.email
            },
            totalCases: assignedCases.length,
            completedCases: assignedCases.filter(c => c.status === constants.CASE_STATUS.COMPLETED).length,
            avgCompletionTime: assignedCases.length > 0
              ? Math.round(assignedCases
                .filter(c => c.status === constants.CASE_STATUS.COMPLETED && c.completedAt && c.assignedAt)
                .reduce((sum, c) => sum + (c.completedAt - c.assignedAt), 0) /
                assignedCases.filter(c => c.status === constants.CASE_STATUS.COMPLETED && c.completedAt && c.assignedAt).length / (1000 * 60 * 60 * 24))
              : 0
          });
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report type'
        });
    }

    res.status(200).json({
      success: true,
      data: reportData
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get required documents for a case with upload status
// @route   GET /api/admin/cases/:id/required-documents
// @access  Private/Admin
exports.getRequiredDocuments = async (req, res, next) => {
  try {
    const caseItem = await Case.findById(req.params.id)
      .populate('serviceId');

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    const service = caseItem.serviceId;

    // Check if service has documentsRequired defined
    if (!service.documentsRequired || service.documentsRequired.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No required documents defined for this service'
      });
    }

    // Get document status using the static method
    const documentStatus = await DocumentVersion.getDocumentStatus(
      caseItem._id,
      service.documentsRequired
    );

    res.status(200).json({
      success: true,
      count: documentStatus.length,
      data: documentStatus
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add note to case
// @route   POST /api/admin/cases/:id/notes
// @access  Private/Admin
exports.addNote = async (req, res, next) => {
  try {
    const { text } = req.body;

    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Add note
    caseItem.notes.push({
      text,
      createdBy: req.user.id
    });

    await caseItem.save();

    // Create notification for end user
    const service = await Service.findById(caseItem.serviceId);

    await Notification.create({
      recipientId: caseItem.endUserId,
      type: constants.NOTIFICATION_TYPES.IN_APP,
      title: 'New Note Added',
      message: `An admin has added a note to your case for ${service.name}.`,
      relatedCaseId: caseItem._id
    });

    res.status(200).json({
      success: true,
      data: caseItem
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get case timeline
// @route   GET /api/admin/cases/:id/timeline
// @access  Private/Admin
exports.getTimeline = async (req, res, next) => {
  try {
    const ActivityTimeline = require('../models/ActivityTimeline');

    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    const timeline = await ActivityTimeline.getTimeline(caseItem._id, false, req.query);

    res.status(200).json({
      success: true,
      count: timeline.length,
      data: timeline
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get notifications
// @route   GET /api/admin/notifications
// @access  Private/Admin
exports.getNotifications = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { page = 1, limit = 10, isRead } = req.query;

    const query = { recipientId: adminId };
    if (isRead !== undefined) query.isRead = isRead === 'true';

    const notifications = await Notification.find(query)
      .populate('relatedCaseId', 'caseId')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      count: notifications.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      },
      data: notifications
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/admin/notifications/:id/read
// @access  Private/Admin
exports.markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Check if notification belongs to current admin
    if (notification.recipientId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this notification'
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/admin/notifications/read-all
// @access  Private/Admin
exports.markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const adminId = req.user.id;

    await Notification.updateMany(
      { recipientId: adminId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (err) {
    next(err);
  }
};

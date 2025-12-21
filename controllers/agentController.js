const User = require('../models/User');
const Case = require('../models/Case');
const Service = require('../models/Service');
const Notification = require('../models/Notification');
const constants = require('../utils/constants');
const { calculateAgentPerformance } = require('../utils/helpers');

// @desc    Get agent dashboard
// @route   GET /api/agent/dashboard
// @access  Private/Agent
exports.getDashboard = async (req, res, next) => {
  try {
    const agentId = req.user.id;
    
    // Get onboarded users
    const onboardedUsers = await User.find({ agentId });
    
    // Get completed cases for onboarded users
    const completedCases = await Case.find({
      endUserId: { $in: onboardedUsers.map(u => u._id) },
      status: constants.CASE_STATUS.COMPLETED
    });
    
    // Get cases in progress for onboarded users
    const inProgressCases = await Case.find({
      endUserId: { $in: onboardedUsers.map(u => u._id) },
      status: constants.CASE_STATUS.IN_PROGRESS
    });
    
    // Calculate performance metrics
    const performance = {
      onboardedUsers: onboardedUsers.length,
      completedCases: completedCases.length,
      inProgressCases: inProgressCases.length,
      conversionRate: calculateAgentPerformance(onboardedUsers.length, completedCases.length)
    };
    
    // Get monthly stats
    const currentMonth = new Date();
    currentMonth.setDate(1);
    
    const monthlyOnboarded = await User.find({
      agentId,
      createdAt: { $gte: currentMonth }
    });
    
    const monthlyCompleted = await Case.find({
      endUserId: { $in: onboardedUsers.map(u => u._id) },
      status: constants.CASE_STATUS.COMPLETED,
      completedAt: { $gte: currentMonth }
    });
    
    res.status(200).json({
      success: true,
      data: {
        performance,
        monthlyStats: {
          onboarded: monthlyOnboarded.length,
          completed: monthlyCompleted.length
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get onboarded users
// @route   GET /api/agent/users
// @access  Private/Agent
exports.getOnboardedUsers = async (req, res, next) => {
  try {
    const agentId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { agentId };
    
    // Get onboarded users
    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(query);
    
    // Get case status for each user
    const usersWithCaseStatus = [];
    
    for (const user of users) {
      const cases = await Case.find({ endUserId: user._id });
      
      let caseStatus = 'no_case';
      if (cases.length > 0) {
        const latestCase = cases.sort((a, b) => b.createdAt - a.createdAt)[0];
        caseStatus = latestCase.status;
      }
      
      usersWithCaseStatus.push({
        ...user.toObject(),
        caseStatus
      });
    }
    
    res.status(200).json({
      success: true,
      count: usersWithCaseStatus.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      },
      data: usersWithCaseStatus
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create end user
// @route   POST /api/agent/users
// @access  Private/Agent
exports.createEndUser = async (req, res, next) => {
  try {
    const agentId = req.user.id;
    const { name, email, password, phone, serviceId } = req.body;
    
    // Create end user
    const endUser = await User.create({
      name,
      email,
      password,
      phone,
      role: constants.USER_ROLES.END_USER,
      sourceTag: constants.SOURCE_TAGS.AGENT,
      agentId
    });
    
    // Create notification for admin
    const admins = await User.find({ role: constants.USER_ROLES.ADMIN });
    
    for (const admin of admins) {
      await Notification.create({
        recipientId: admin._id,
        type: constants.NOTIFICATION_TYPES.IN_APP,
        title: 'New User Registration',
        message: `A new user ${name} has been registered by agent ${req.user.name}.`,
        relatedCaseId: null
      });
    }
    
    // If serviceId is provided, create a case
    let caseItem = null;
    if (serviceId) {
      const service = await Service.findById(serviceId);
      
      if (service) {
        caseItem = await Case.create({
          caseId: `CASE-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`.toUpperCase(),
          endUserId: endUser._id,
          serviceId,
          status: constants.CASE_STATUS.NEW
        });
        
        // Create notification for admin about new case
        for (const admin of admins) {
          await Notification.create({
            recipientId: admin._id,
            type: constants.NOTIFICATION_TYPES.IN_APP,
            title: 'New Case Created',
            message: `A new case (${caseItem.caseId}) has been created for user ${name}.`,
            relatedCaseId: caseItem._id
          });
        }
      }
    }
    
    res.status(201).json({
      success: true,
      data: {
        user: endUser,
        case: caseItem
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get services for onboarding
// @route   GET /api/agent/services
// @access  Private/Agent
exports.getServices = async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (err) {
    next(err);
  }
};

// ✅ @desc    Get single service details by ID
// ✅ @route   GET /api/agent/services/:id
// ✅ @access  Private/Agent
exports.getServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID format'
      });
    }

    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
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
exports.getReports = async (req, res, next) => {
  try {
    const agentId = req.user.id;
    const { startDate, endDate } = req.query;

    const dateQuery = {};

    if (startDate && endDate && !isNaN(new Date(startDate)) && !isNaN(new Date(endDate))) {
      dateQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get onboarded users in the date range (if any)
    const onboardedUsers = await User.find({
      agentId,
      ...dateQuery
    });

    const allOnboardedUsers = await User.find({ agentId });

    // ✅ Only apply date range if valid, otherwise skip filter
    const caseDateFilter =
      startDate && endDate && !isNaN(new Date(startDate)) && !isNaN(new Date(endDate))
        ? {
            completedAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        : {};

    const completedCases = await Case.find({
      endUserId: { $in: allOnboardedUsers.map(u => u._id) },
      status: constants.CASE_STATUS.COMPLETED,
      ...caseDateFilter
    });
    
    // Get monthly stats for the last 6 months
    const monthlyStats = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);
      
      const monthlyOnboarded = await User.find({
        agentId,
        createdAt: {
          $gte: month,
          $lt: nextMonth
        }
      });
      
      const monthlyCompleted = await Case.find({
        endUserId: { $in: allOnboardedUsers.map(u => u._id) },
        status: constants.CASE_STATUS.COMPLETED,
        completedAt: {
          $gte: month,
          $lt: nextMonth
        }
      });
      
      monthlyStats.push({
        month: month.toLocaleString('default', { month: 'short', year: 'numeric' }),
        onboarded: monthlyOnboarded.length,
        completed: monthlyCompleted.length
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          onboardedUsers: onboardedUsers.length,
          completedCases: completedCases.length,
          conversionRate: calculateAgentPerformance(onboardedUsers.length, completedCases.length)
        },
        monthlyStats
      }
    });
  } catch (err) {
    next(err);
  }
};





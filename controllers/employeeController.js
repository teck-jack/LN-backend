const User = require('../models/User');
const Case = require('../models/Case');
const Service = require('../models/Service');
const Notification = require('../models/Notification');
const DocumentVersion = require('../models/DocumentVersion');
const constants = require('../utils/constants');
const { calculateEmployeeWorkload } = require('../utils/helpers');

// @desc    Get employee dashboard
// @route   GET /api/employee/dashboard
// @access  Private/Employee
exports.getDashboard = async (req, res, next) => {
  try {
    const employeeId = req.user.id;

    // Get assigned cases
    const assignedCases = await Case.find({ employeeId });

    // Calculate workload
    const workload = calculateEmployeeWorkload(assignedCases);

    // Get recent cases
    const recentCases = await Case.find({ employeeId })
      .populate('endUserId', 'name email')
      .populate('serviceId', 'name type')
      .sort({ updatedAt: -1 })
      .limit(5);

    // Get unread notifications
    const unreadNotifications = await Notification.find({
      recipientId: employeeId,
      isRead: false
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        workload,
        recentCases,
        unreadNotifications: unreadNotifications.length
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get assigned cases
// @route   GET /api/employee/cases
// @access  Private/Employee
exports.getAssignedCases = async (req, res, next) => {
  try {
    const employeeId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { employeeId };
    if (status) query.status = status;

    const cases = await Case.find(query)
      .populate('endUserId', 'name email phone')
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
// @route   GET /api/employee/cases/:id
// @access  Private/Employee
exports.getCase = async (req, res, next) => {
  try {
    const caseItem = await Case.findById(req.params.id)
      .populate('endUserId', 'name email phone')
      .populate('serviceId', 'name type processSteps documentsRequired')
      .populate('employeeId', 'name email')
      .populate('workflowTemplate')
      .populate('notes.createdBy', 'name role');

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if case is assigned to current employee
    if (caseItem.employeeId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this case'
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

// @desc    Update case status
// @route   PUT /api/employee/cases/:id/status
// @access  Private/Employee
exports.updateCaseStatus = async (req, res, next) => {
  try {
    const { status, currentStep } = req.body;

    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if case is assigned to current employee
    if (caseItem.employeeId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this case'
      });
    }

    // Update case
    caseItem.status = status || caseItem.status;
    caseItem.currentStep = currentStep !== undefined ? currentStep : caseItem.currentStep;

    if (status === constants.CASE_STATUS.COMPLETED) {
      caseItem.completedAt = Date.now();
    }

    await caseItem.save();

    // Create notification for end user
    const service = await Service.findById(caseItem.serviceId);
    const statusText = status === constants.CASE_STATUS.COMPLETED
      ? 'completed'
      : status === constants.CASE_STATUS.IN_PROGRESS
        ? 'updated'
        : 'started';

    await Notification.create({
      recipientId: caseItem.endUserId,
      type: constants.NOTIFICATION_TYPES.IN_APP,
      title: `Case ${statusText}`,
      message: `Your case for ${service ? service.name : 'Service'} has been ${statusText}.`,
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

// @desc    Add note to case
// @route   POST /api/employee/cases/:id/notes
// @access  Private/Employee
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

    // Check if case is assigned to current employee
    if (caseItem.employeeId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this case'
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
      message: `A new note has been added to your case for ${service ? service.name : 'Service'}.`,
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

// @desc    Upload document for case
// @route   POST /api/employee/cases/:id/documents
// @access  Private/Employee
exports.uploadDocument = async (req, res, next) => {
  try {
    // This would typically use multer for file upload
    // For simplicity, we'll assume the file has been uploaded and we have the URL
    const { name, url } = req.body;

    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if case is assigned to current employee
    if (caseItem.employeeId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this case'
      });
    }

    // Add document
    caseItem.documents.push({
      name,
      url,
      uploadedBy: req.user.id
    });

    await caseItem.save();

    // Create notification for end user
    const service = await Service.findById(caseItem.serviceId);

    await Notification.create({
      recipientId: caseItem.endUserId,
      type: constants.NOTIFICATION_TYPES.IN_APP,
      title: 'Document Uploaded',
      message: `A document has been uploaded to your case for ${service ? service.name : 'Service'}.`,
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

// @desc    Get notifications
// @route   GET /api/employee/notifications
// @access  Private/Employee
exports.getNotifications = async (req, res, next) => {
  try {
    const employeeId = req.user.id;
    const { page = 1, limit = 10, isRead } = req.query;

    const query = { recipientId: employeeId };
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
// @route   PUT /api/employee/notifications/:id/read
// @access  Private/Employee
exports.markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Check if notification belongs to current employee
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
// @route   PUT /api/employee/notifications/read-all
// @access  Private/Employee
exports.markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const employeeId = req.user.id;

    await Notification.updateMany(
      { recipientId: employeeId, isRead: false },
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

// @desc    Get employee profile
// @route   GET /api/employee/profile
// @access  Private/Employee
exports.getProfile = async (req, res, next) => {
  try {
    const employee = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update employee profile
// @route   PUT /api/employee/profile
// @access  Private/Employee
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;

    const employee = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, phone },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update checklist progress
// @route   PUT /api/employee/cases/:id/checklist
// @access  Private/Employee
exports.updateChecklistProgress = async (req, res, next) => {
  try {
    const { stepId, itemId, isCompleted } = req.body;

    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if case is assigned to current employee
    if (caseItem.employeeId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this case'
      });
    }

    // Initialize checklistProgress if it doesn't exist
    if (!caseItem.checklistProgress) {
      caseItem.checklistProgress = [];
    }

    const existingIndex = caseItem.checklistProgress.findIndex(
      p => p.stepId.toString() === stepId && p.itemId.toString() === itemId
    );

    if (existingIndex > -1) {
      // Update existing
      caseItem.checklistProgress[existingIndex].isCompleted = isCompleted;
      caseItem.checklistProgress[existingIndex].completedAt = isCompleted ? Date.now() : null;
      caseItem.checklistProgress[existingIndex].completedBy = isCompleted ? req.user.id : null;
    } else {
      // Add new
      caseItem.checklistProgress.push({
        stepId,
        itemId,
        isCompleted,
        completedAt: isCompleted ? Date.now() : null,
        completedBy: isCompleted ? req.user.id : null
      });
    }

    await caseItem.save();

    // Update last activity
    await caseItem.updateActivity();

    res.status(200).json({
      success: true,
      data: caseItem
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get required documents for a case with upload status
// @route   GET /api/employee/cases/:id/required-documents
// @access  Private/Employee
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

    // Check if case is assigned to current employee (admins can access any case)
    // Handle both populated and non-populated employeeId
    if (req.user.role !== 'admin') {
      const employeeIdStr = caseItem.employeeId?._id ? caseItem.employeeId._id.toString() : caseItem.employeeId?.toString();
      if (employeeIdStr !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this case'
        });
      }
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

// @desc    Get case timeline
// @route   GET /api/employee/cases/:id/timeline
// @access  Private/Employee
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

    // Check if case is assigned to current employee (admins can access any case)
    // Handle both populated and non-populated employeeId
    if (req.user.role !== 'admin') {
      const employeeIdStr = caseItem.employeeId?._id ? caseItem.employeeId._id.toString() : caseItem.employeeId?.toString();
      if (employeeIdStr !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this case'
        });
      }
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


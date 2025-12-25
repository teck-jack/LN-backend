const User = require('../models/User');
const ActivityTimeline = require('../models/ActivityTimeline');
const Case = require('../models/Case');
const Service = require('../models/Service');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const { createOrder, verifyPayment } = require('../services/paymentService');
const constants = require('../utils/constants');

// @desc    Get end user dashboard
// @route   GET /api/enduser/dashboard
// @access  Private/End User
exports.getDashboard = async (req, res, next) => {
  try {
    const endUserId = req.user.id;

    // Get user's cases
    const cases = await Case.find({ endUserId })
      .populate('serviceId', 'name type')
      .sort({ updatedAt: -1 });

    // Get unread notifications
    const unreadNotifications = await Notification.find({
      recipientId: endUserId,
      isRead: false
    }).sort({ createdAt: -1 });

    // Get payment history
    const payments = await Payment.find({
      caseId: { $in: cases.map(c => c._id) },
      status: 'completed'
    }).sort({ paymentDate: -1 }).limit(5);

    res.status(200).json({
      success: true,
      data: {
        cases,
        unreadNotifications: unreadNotifications.length,
        recentPayments: payments
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get services
// @route   GET /api/enduser/services
// @access  Private/End User
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

// @desc    Get single service
// @route   GET /api/enduser/services/:id
// @access  Private/End User
exports.getService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

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

// @desc    Create payment order
// @route   POST /api/enduser/payment/create-order
// @access  Private/End User
exports.createPaymentOrder = async (req, res, next) => {
  try {
    const { serviceId } = req.body;

    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    // Create order with Razorpay
    const { isTestMode } = req.body;
    const order = await createOrder(service.price, isTestMode);

    res.status(200).json({
      success: true,
      data: {
        order,
        service
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify payment and create case
// @route   POST /api/enduser/payment/verify
// @access  Private/End User
exports.verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      serviceId
    } = req.body;

    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    // Verify payment
    const { isTestMode } = req.body;
    const isValid = await verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    }, isTestMode);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment'
      });
    }

    // Create case
    const caseItem = await Case.create({
      caseId: `CASE-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`.toUpperCase(),
      endUserId: req.user.id,
      serviceId,
      status: constants.CASE_STATUS.NEW,
      deadline: new Date(Date.now() + (service.slaHours || 24) * 60 * 60 * 1000)
    });

    // Create payment record
    const payment = await Payment.create({
      caseId: caseItem._id,
      amount: service.price,
      transactionId: razorpay_payment_id,
      paymentMethod: 'razorpay',
      status: 'completed'
    });

    // Create notification for admin
    const admins = await User.find({ role: constants.USER_ROLES.ADMIN });

    for (const admin of admins) {
      await Notification.create({
        recipientId: admin._id,
        type: constants.NOTIFICATION_TYPES.IN_APP,
        title: 'New Case Created',
        message: `A new case (${caseItem.caseId}) has been created for service ${service.name}.`,
        relatedCaseId: caseItem._id
      });
    }

    // Create notification for end user
    await Notification.create({
      recipientId: req.user.id,
      type: constants.NOTIFICATION_TYPES.IN_APP,
      title: 'Case Created',
      message: `Your case for ${service.name} has been created successfully.`,
      relatedCaseId: caseItem._id
    });

    res.status(201).json({
      success: true,
      data: {
        case: caseItem,
        payment
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's cases
// @route   GET /api/enduser/cases
// @access  Private/End User
exports.getCases = async (req, res, next) => {
  try {
    const endUserId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { endUserId };
    if (status) query.status = status;

    const cases = await Case.find(query)
      .populate('serviceId', 'name type')
      .populate('employeeId', 'name email')
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
// @route   GET /api/enduser/cases/:id
// @access  Private/End User
exports.getCase = async (req, res, next) => {
  try {
    const caseItem = await Case.findById(req.params.id)
      .populate('serviceId', 'name type processSteps')
      .populate('employeeId', 'name email')
      .populate('notes.createdBy', 'name role');

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if case belongs to current user
    if (caseItem.endUserId.toString() !== req.user.id) {
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

// @desc    Add note to case
// @route   POST /api/enduser/cases/:id/notes
// @access  Private/End User
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

    // Check if case belongs to current user
    if (caseItem.endUserId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this case'
      });
    }

    // Add note with required createdBy field
    caseItem.notes.push({
      text,
      createdBy: req.user.id  // Add the current user as the creator
    });

    // Save the case with the new note
    await caseItem.save();

    // Update last activity timestamp
    await caseItem.updateActivity();

    // Return the updated case
    res.status(201).json({
      success: true,
      data: caseItem
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload document for case
// @route   POST /api/enduser/cases/:id/documents
// @access  Private/End User
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

    // Check if case belongs to current user
    if (caseItem.endUserId.toString() !== req.user.id) {
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

    // Create notification for assigned employee
    if (caseItem.employeeId) {
      const service = await Service.findById(caseItem.serviceId);

      await Notification.create({
        recipientId: caseItem.employeeId,
        type: constants.NOTIFICATION_TYPES.IN_APP,
        title: 'Document Uploaded',
        message: `A document has been uploaded to case ${caseItem.caseId} for ${service.name}.`,
        relatedCaseId: caseItem._id
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

// @desc    Get payment history
// @route   GET /api/enduser/payments
// @access  Private/End User
exports.getPayments = async (req, res, next) => {
  try {
    const endUserId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // Get user's cases
    const cases = await Case.find({ endUserId });

    const payments = await Payment.find({
      caseId: { $in: cases.map(c => c._id) }
    })
      .populate('caseId', 'caseId')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ paymentDate: -1 });

    const total = await Payment.countDocuments({
      caseId: { $in: cases.map(c => c._id) }
    });

    res.status(200).json({
      success: true,
      count: payments.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      },
      data: payments
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get notifications
// @route   GET /api/enduser/notifications
// @access  Private/End User
exports.getNotifications = async (req, res, next) => {
  try {
    const endUserId = req.user.id;
    const { page = 1, limit = 10, isRead } = req.query;

    const query = { recipientId: endUserId };
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
// @route   PUT /api/enduser/notifications/:id/read
// @access  Private/End User
exports.markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Check if notification belongs to current user
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
// @route   PUT /api/enduser/notifications/read-all
// @access  Private/End User
exports.markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const endUserId = req.user.id;

    await Notification.updateMany(
      { recipientId: endUserId, isRead: false },
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

// @desc    Get user profile
// @route   GET /api/enduser/profile
// @access  Private/End User
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile
// @route   PUT /api/enduser/profile
// @access  Private/End User
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, phone },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get case timeline
// @route   GET /api/enduser/cases/:id/timeline
// @access  Private/End User
exports.getTimeline = async (req, res, next) => {
  try {
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if case belongs to current user
    if (caseItem.endUserId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this case'
      });
    }

    const timeline = await ActivityTimeline.getTimeline(caseItem._id, true, req.query);

    res.status(200).json({
      success: true,
      count: timeline.length,
      data: timeline
    });
  } catch (err) {
    next(err);
  }
};
const NotificationTemplate = require('../models/NotificationTemplate');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

// @desc    Create notification template
// @route   POST /api/admin/notification-templates
// @access  Private/Admin
exports.createTemplate = async (req, res, next) => {
    try {
        const {
            name,
            description,
            type,
            eventTrigger,
            title,
            body,
            variables,
            targetRoles,
            priority,
            actionButton,
            icon
        } = req.body;

        const template = await NotificationTemplate.create({
            name,
            description,
            type,
            eventTrigger,
            title,
            body,
            variables,
            targetRoles,
            priority,
            actionButton,
            icon,
            createdBy: req.user.id
        });

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'create',
            entityType: 'NotificationTemplate',
            entityId: template._id,
            entityName: template.name,
            description: `Created notification template: ${template.name}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'medium'
        });

        res.status(201).json({
            success: true,
            data: template
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all notification templates
// @route   GET /api/admin/notification-templates
// @access  Private/Admin
exports.getTemplates = async (req, res, next) => {
    try {
        const { type, eventTrigger, isActive, page = 1, limit = 20 } = req.query;

        const query = {};
        if (type) query.type = type;
        if (eventTrigger) query.eventTrigger = eventTrigger;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const templates = await NotificationTemplate.find(query)
            .populate('createdBy', 'name email')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await NotificationTemplate.countDocuments(query);

        res.status(200).json({
            success: true,
            count: templates.length,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            },
            data: templates
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single notification template
// @route   GET /api/admin/notification-templates/:id
// @access  Private/Admin
exports.getTemplateById = async (req, res, next) => {
    try {
        const template = await NotificationTemplate.findById(req.params.id)
            .populate('createdBy', 'name email');

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Notification template not found'
            });
        }

        res.status(200).json({
            success: true,
            data: template
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update notification template
// @route   PUT /api/admin/notification-templates/:id
// @access  Private/Admin
exports.updateTemplate = async (req, res, next) => {
    try {
        const oldTemplate = await NotificationTemplate.findById(req.params.id);

        if (!oldTemplate) {
            return res.status(404).json({
                success: false,
                error: 'Notification template not found'
            });
        }

        const template = await NotificationTemplate.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'update',
            entityType: 'NotificationTemplate',
            entityId: template._id,
            entityName: template.name,
            description: `Updated notification template: ${template.name}`,
            changes: {
                before: oldTemplate.toObject(),
                after: template.toObject()
            },
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'medium'
        });

        res.status(200).json({
            success: true,
            data: template
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete notification template
// @route   DELETE /api/admin/notification-templates/:id
// @access  Private/Admin
exports.deleteTemplate = async (req, res, next) => {
    try {
        const template = await NotificationTemplate.findById(req.params.id);

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Notification template not found'
            });
        }

        // Soft delete
        template.isActive = false;
        await template.save();

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'delete',
            entityType: 'NotificationTemplate',
            entityId: template._id,
            entityName: template.name,
            description: `Deleted notification template: ${template.name}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'high'
        });

        res.status(200).json({
            success: true,
            message: 'Notification template deleted successfully'
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Test notification template
// @route   POST /api/admin/notification-templates/:id/test
// @access  Private/Admin
exports.testTemplate = async (req, res, next) => {
    try {
        const template = await NotificationTemplate.findById(req.params.id);

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Notification template not found'
            });
        }

        const { testData } = req.body;

        // Render template with test data
        const rendered = template.render(testData || {});

        // Send test notification to admin
        await Notification.create({
            recipientId: req.user.id,
            type: 'IN_APP',
            title: `[TEST] ${rendered.title}`,
            message: rendered.body,
            priority: rendered.priority,
            metadata: {
                isTest: true,
                templateId: template._id
            }
        });

        res.status(200).json({
            success: true,
            message: 'Test notification sent',
            data: rendered
        });
    } catch (err) {
        next(err);
    }
};

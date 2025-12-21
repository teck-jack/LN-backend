const WorkflowTemplate = require('../models/WorkflowTemplate');
const Service = require('../models/Service');
const AuditLog = require('../models/AuditLog');

// @desc    Create workflow template
// @route   POST /api/admin/workflow-templates
// @access  Private/Admin
exports.createTemplate = async (req, res, next) => {
    try {
        const { name, description, serviceType, steps, metadata } = req.body;

        // Check if service exists
        const service = await Service.findById(serviceType);
        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'Service not found'
            });
        }

        // Create template
        const template = await WorkflowTemplate.create({
            name,
            description,
            serviceType,
            steps,
            metadata,
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
            entityType: 'WorkflowTemplate',
            entityId: template._id,
            entityName: template.name,
            description: `Created workflow template: ${template.name}`,
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

// @desc    Get all workflow templates
// @route   GET /api/admin/workflow-templates
// @access  Private/Admin
exports.getTemplates = async (req, res, next) => {
    try {
        const { serviceType, isActive, page = 1, limit = 20 } = req.query;

        const query = {};
        if (serviceType) query.serviceType = serviceType;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const templates = await WorkflowTemplate.find(query)
            .populate('serviceType', 'name type')
            .populate('createdBy', 'name email')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await WorkflowTemplate.countDocuments(query);

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

// @desc    Get single workflow template
// @route   GET /api/admin/workflow-templates/:id
// @access  Private/Admin
exports.getTemplateById = async (req, res, next) => {
    try {
        const template = await WorkflowTemplate.findById(req.params.id)
            .populate('serviceType', 'name type description')
            .populate('createdBy', 'name email');

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Workflow template not found'
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

// @desc    Update workflow template
// @route   PUT /api/admin/workflow-templates/:id
// @access  Private/Admin
exports.updateTemplate = async (req, res, next) => {
    try {
        const oldTemplate = await WorkflowTemplate.findById(req.params.id);

        if (!oldTemplate) {
            return res.status(404).json({
                success: false,
                error: 'Workflow template not found'
            });
        }

        const template = await WorkflowTemplate.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('serviceType', 'name type');

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'update',
            entityType: 'WorkflowTemplate',
            entityId: template._id,
            entityName: template.name,
            description: `Updated workflow template: ${template.name}`,
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

// @desc    Delete workflow template (soft delete)
// @route   DELETE /api/admin/workflow-templates/:id
// @access  Private/Admin
exports.deleteTemplate = async (req, res, next) => {
    try {
        const template = await WorkflowTemplate.findById(req.params.id);

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Workflow template not found'
            });
        }

        // Soft delete by setting isActive to false
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
            entityType: 'WorkflowTemplate',
            entityId: template._id,
            entityName: template.name,
            description: `Deleted workflow template: ${template.name}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'high'
        });

        res.status(200).json({
            success: true,
            message: 'Workflow template deleted successfully'
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Clone workflow template
// @route   POST /api/admin/workflow-templates/:id/clone
// @access  Private/Admin
exports.cloneTemplate = async (req, res, next) => {
    try {
        const originalTemplate = await WorkflowTemplate.findById(req.params.id);

        if (!originalTemplate) {
            return res.status(404).json({
                success: false,
                error: 'Workflow template not found'
            });
        }

        // Create new template with cloned data
        const clonedTemplate = await WorkflowTemplate.create({
            name: `${originalTemplate.name} (Copy)`,
            description: originalTemplate.description,
            serviceType: originalTemplate.serviceType,
            steps: originalTemplate.steps,
            metadata: {
                ...originalTemplate.metadata,
                version: '1.0',
                tags: [...(originalTemplate.metadata?.tags || []), 'cloned']
            },
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
            entityType: 'WorkflowTemplate',
            entityId: clonedTemplate._id,
            entityName: clonedTemplate.name,
            description: `Cloned workflow template from: ${originalTemplate.name}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                sourceTemplateId: originalTemplate._id
            },
            severity: 'medium'
        });

        res.status(201).json({
            success: true,
            data: clonedTemplate
        });
    } catch (err) {
        next(err);
    }
};

const CannedResponse = require('../models/CannedResponse');
const AuditLog = require('../models/AuditLog');

// @desc    Create canned response
// @route   POST /api/employee/canned-responses
// @access  Private (Admin/Employee)
exports.createCannedResponse = async (req, res, next) => {
    try {
        const { title, content, category, variables, isGlobal, tags } = req.body;

        // Only admin can create global responses
        if (isGlobal && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Only admins can create global canned responses'
            });
        }

        const cannedResponse = await CannedResponse.create({
            title,
            content,
            category,
            variables,
            isGlobal: isGlobal || false,
            tags,
            createdBy: {
                userId: req.user.id,
                name: req.user.name,
                role: req.user.role
            }
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
            entityType: 'CannedResponse',
            entityId: cannedResponse._id,
            entityName: cannedResponse.title,
            description: `Created canned response: ${cannedResponse.title}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'low'
        });

        res.status(201).json({
            success: true,
            data: cannedResponse
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get canned responses
// @route   GET /api/employee/canned-responses
// @access  Private (Admin/Employee)
exports.getCannedResponses = async (req, res, next) => {
    try {
        const { category, isGlobal, page = 1, limit = 50 } = req.query;

        const query = {
            isActive: true,
            $or: [
                { isGlobal: true },
                { 'createdBy.userId': req.user.id }
            ]
        };

        if (category) query.category = category;
        if (isGlobal !== undefined) query.isGlobal = isGlobal === 'true';

        const responses = await CannedResponse.find(query)
            .populate('createdBy.userId', 'name email')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ usageCount: -1, createdAt: -1 });

        const total = await CannedResponse.countDocuments(query);

        res.status(200).json({
            success: true,
            count: responses.length,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            },
            data: responses
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get canned responses by category
// @route   GET /api/employee/canned-responses/category/:category
// @access  Private (Admin/Employee)
exports.getCannedResponsesByCategory = async (req, res, next) => {
    try {
        const { category } = req.params;

        const responses = await CannedResponse.getByCategory(category, req.user.id);

        res.status(200).json({
            success: true,
            count: responses.length,
            data: responses
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get popular canned responses
// @route   GET /api/employee/canned-responses/popular
// @access  Private (Admin/Employee)
exports.getPopularResponses = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;

        const responses = await CannedResponse.getPopular(parseInt(limit));

        res.status(200).json({
            success: true,
            count: responses.length,
            data: responses
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update canned response
// @route   PUT /api/employee/canned-responses/:id
// @access  Private (Admin/Creator)
exports.updateCannedResponse = async (req, res, next) => {
    try {
        const response = await CannedResponse.findById(req.params.id);

        if (!response) {
            return res.status(404).json({
                success: false,
                error: 'Canned response not found'
            });
        }

        // Check authorization
        const isAuthorized =
            req.user.role === 'admin' ||
            response.createdBy.userId.toString() === req.user.id;

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to update this canned response'
            });
        }

        const { title, content, category, variables, isGlobal, tags } = req.body;

        // Only admin can make responses global
        if (isGlobal && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Only admins can make canned responses global'
            });
        }

        const oldResponse = response.toObject();

        if (title) response.title = title;
        if (content) response.content = content;
        if (category) response.category = category;
        if (variables) response.variables = variables;
        if (isGlobal !== undefined) response.isGlobal = isGlobal;
        if (tags) response.tags = tags;

        await response.save();

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'update',
            entityType: 'CannedResponse',
            entityId: response._id,
            entityName: response.title,
            description: `Updated canned response: ${response.title}`,
            changes: {
                before: oldResponse,
                after: response.toObject()
            },
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'low'
        });

        res.status(200).json({
            success: true,
            data: response
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete canned response
// @route   DELETE /api/employee/canned-responses/:id
// @access  Private (Admin/Creator)
exports.deleteCannedResponse = async (req, res, next) => {
    try {
        const response = await CannedResponse.findById(req.params.id);

        if (!response) {
            return res.status(404).json({
                success: false,
                error: 'Canned response not found'
            });
        }

        // Check authorization
        const isAuthorized =
            req.user.role === 'admin' ||
            response.createdBy.userId.toString() === req.user.id;

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to delete this canned response'
            });
        }

        // Soft delete
        response.isActive = false;
        await response.save();

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'delete',
            entityType: 'CannedResponse',
            entityId: response._id,
            entityName: response.title,
            description: `Deleted canned response: ${response.title}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'low'
        });

        res.status(200).json({
            success: true,
            message: 'Canned response deleted successfully'
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Use canned response (increment usage count)
// @route   POST /api/employee/canned-responses/:id/use
// @access  Private (Admin/Employee)
exports.useCannedResponse = async (req, res, next) => {
    try {
        const response = await CannedResponse.findById(req.params.id);

        if (!response) {
            return res.status(404).json({
                success: false,
                error: 'Canned response not found'
            });
        }

        await response.incrementUsage();

        res.status(200).json({
            success: true,
            data: response
        });
    } catch (err) {
        next(err);
    }
};

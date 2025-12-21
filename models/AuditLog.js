const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'agent', 'employee', 'end_user'],
            required: true
        }
    },
    action: {
        type: String,
        required: true,
        enum: [
            'create',
            'read',
            'update',
            'delete',
            'assign',
            'unassign',
            'approve',
            'reject',
            'login',
            'logout',
            'upload',
            'download',
            'export',
            'import',
            'send',
            'receive',
            'other'
        ]
    },
    entityType: {
        type: String,
        required: true,
        enum: [
            'User',
            'Case',
            'Service',
            'Payment',
            'Notification',
            'WorkflowTemplate',
            'DocumentVersion',
            'InternalNote',
            'CannedResponse',
            'NotificationTemplate',
            'Settings',
            'Other'
        ]
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    entityName: {
        type: String, // Human-readable name of the entity
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    changes: {
        before: {
            type: mongoose.Schema.Types.Mixed
        },
        after: {
            type: mongoose.Schema.Types.Mixed
        },
        fields: [{
            field: String,
            oldValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed
        }]
    },
    metadata: {
        ipAddress: {
            type: String,
            trim: true
        },
        userAgent: {
            type: String,
            trim: true
        },
        location: {
            type: String,
            trim: true
        },
        deviceType: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'unknown'],
            default: 'unknown'
        }
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    status: {
        type: String,
        enum: ['success', 'failure', 'pending'],
        default: 'success'
    },
    errorMessage: {
        type: String,
        trim: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false } // Only need createdAt for audit logs
});

// Indexes for efficient queries
auditLogSchema.index({ 'user.userId': 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });
auditLogSchema.index({ 'user.role': 1, createdAt: -1 });

// TTL index to auto-delete old logs after 2 years (optional)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years in seconds

// Static method to create audit log entry
auditLogSchema.statics.log = async function (logData) {
    try {
        const log = new this(logData);
        await log.save();
        return log;
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw error to prevent audit logging from breaking the main operation
        return null;
    }
};

// Static method to get logs with filters
auditLogSchema.statics.getLogs = function (filters = {}, options = {}) {
    const {
        userId,
        action,
        entityType,
        entityId,
        startDate,
        endDate,
        severity,
        role,
        page = 1,
        limit = 50
    } = { ...filters, ...options };

    const query = {};

    if (userId) query['user.userId'] = userId;
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (severity) query.severity = severity;
    if (role) query['user.role'] = role;

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    return this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
};

// Static method to get entity history
auditLogSchema.statics.getEntityHistory = function (entityType, entityId) {
    return this.find({ entityType, entityId })
        .sort({ createdAt: -1 })
        .lean();
};

module.exports = mongoose.model('AuditLog', auditLogSchema);

const mongoose = require('mongoose');

const activityTimelineSchema = new mongoose.Schema({
    caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case',
        required: [true, 'Case ID is required'],
        index: true
    },
    eventType: {
        type: String,
        required: true,
        enum: [
            'case_created',
            'case_assigned',
            'status_changed',
            'document_uploaded',
            'document_verified',
            'document_rejected',
            'payment_received',
            'note_added',
            'internal_note_added',
            'checklist_updated',
            'reminder_set',
            'sla_warning',
            'sla_breach',
            'case_completed',
            'case_reopened',
            'communication_sent',
            'other'
        ]
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    performedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        name: {
            type: String
        },
        role: {
            type: String,
            enum: ['admin', 'agent', 'employee', 'end_user', 'system']
        }
    },
    metadata: {
        oldValue: {
            type: mongoose.Schema.Types.Mixed
        },
        newValue: {
            type: mongoose.Schema.Types.Mixed
        },
        documentType: {
            type: String
        },
        documentVersion: {
            type: Number
        },
        paymentAmount: {
            type: Number
        },
        checklistItem: {
            type: String
        },
        additionalInfo: {
            type: mongoose.Schema.Types.Mixed
        }
    },
    isVisibleToUser: {
        type: Boolean,
        default: true // If false, only visible to admin/employee
    },
    icon: {
        type: String,
        trim: true // Icon name for frontend display
    },
    color: {
        type: String,
        enum: ['blue', 'green', 'yellow', 'red', 'gray', 'purple'],
        default: 'blue'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

// Indexes for efficient queries
activityTimelineSchema.index({ caseId: 1, createdAt: -1 });
activityTimelineSchema.index({ eventType: 1, createdAt: -1 });
activityTimelineSchema.index({ isVisibleToUser: 1, caseId: 1 });
activityTimelineSchema.index({ 'performedBy.userId': 1 });

// Static method to create timeline event
activityTimelineSchema.statics.createEvent = async function (eventData) {
    try {
        const event = new this(eventData);
        await event.save();
        return event;
    } catch (error) {
        console.error('Failed to create timeline event:', error);
        return null;
    }
};

// Static method to get timeline for a case
activityTimelineSchema.statics.getTimeline = function (caseId, userView = false, options = {}) {
    const { page = 1, limit = 50, eventType } = options;

    const query = { caseId };

    if (userView) {
        query.isVisibleToUser = true;
    }

    if (eventType) {
        query.eventType = eventType;
    }

    const skip = (page - 1) * limit;

    return this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('performedBy.userId', 'name email')
        .lean();
};

// Helper method to generate description based on event type
activityTimelineSchema.statics.generateDescription = function (eventType, data) {
    const descriptions = {
        case_created: `Case created by ${data.userName}`,
        case_assigned: `Case assigned to ${data.assigneeName}`,
        status_changed: `Status changed from "${data.oldStatus}" to "${data.newStatus}"`,
        document_uploaded: `${data.documentType} uploaded (Version ${data.version})`,
        document_verified: `${data.documentType} verified by ${data.verifierName}`,
        document_rejected: `${data.documentType} rejected: ${data.reason}`,
        payment_received: `Payment of ₹${data.amount} received`,
        note_added: `Note added by ${data.userName}`,
        internal_note_added: `Internal note added by ${data.userName}`,
        checklist_updated: `Checklist item "${data.itemName}" marked as ${data.status}`,
        reminder_set: `Reminder set for ${data.reminderDate}`,
        sla_warning: `SLA warning: ${data.hoursRemaining} hours remaining`,
        sla_breach: `SLA breached`,
        case_completed: `Case completed by ${data.userName}`,
        case_reopened: `Case reopened by ${data.userName}`,
        communication_sent: `Message sent to ${data.recipientName}`
    };

    return descriptions[eventType] || 'Activity recorded';
};

// Helper method to get icon and color based on event type
activityTimelineSchema.statics.getEventStyle = function (eventType) {
    const styles = {
        case_created: { icon: 'plus-circle', color: 'blue' },
        case_assigned: { icon: 'user-check', color: 'blue' },
        status_changed: { icon: 'refresh-cw', color: 'purple' },
        document_uploaded: { icon: 'upload', color: 'blue' },
        document_verified: { icon: 'check-circle', color: 'green' },
        document_rejected: { icon: 'x-circle', color: 'red' },
        payment_received: { icon: 'dollar-sign', color: 'green' },
        note_added: { icon: 'message-square', color: 'blue' },
        internal_note_added: { icon: 'lock', color: 'gray' },
        checklist_updated: { icon: 'check-square', color: 'green' },
        reminder_set: { icon: 'bell', color: 'yellow' },
        sla_warning: { icon: 'alert-triangle', color: 'yellow' },
        sla_breach: { icon: 'alert-circle', color: 'red' },
        case_completed: { icon: 'check-circle', color: 'green' },
        case_reopened: { icon: 'rotate-ccw', color: 'yellow' },
        communication_sent: { icon: 'send', color: 'blue' }
    };

    return styles[eventType] || { icon: 'circle', color: 'gray' };
};

module.exports = mongoose.model('ActivityTimeline', activityTimelineSchema);

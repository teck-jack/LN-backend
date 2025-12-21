const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Template name is required'],
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['app'], // Only app notifications for now, email/sms in future
        default: 'app'
    },
    eventTrigger: {
        type: String,
        required: true,
        enum: [
            'case_created',
            'case_assigned',
            'case_status_changed',
            'document_uploaded',
            'document_verified',
            'document_rejected',
            'payment_received',
            'payment_failed',
            'sla_warning',
            'sla_breach',
            'case_completed',
            'case_reopened',
            'note_added',
            'reminder',
            'custom'
        ]
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    body: {
        type: String,
        required: [true, 'Body is required'],
        trim: true,
        maxlength: [500, 'Body cannot exceed 500 characters']
    },
    variables: [{
        name: {
            type: String,
            required: true
        },
        placeholder: {
            type: String,
            required: true // e.g., {{userName}}, {{caseId}}
        },
        description: {
            type: String
        },
        example: {
            type: String
        }
    }],
    targetRoles: [{
        type: String,
        enum: ['admin', 'agent', 'employee', 'end_user']
    }],
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    actionButton: {
        label: {
            type: String,
            trim: true
        },
        url: {
            type: String,
            trim: true
        }
    },
    icon: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
notificationTemplateSchema.index({ eventTrigger: 1, isActive: 1 });
notificationTemplateSchema.index({ type: 1, isActive: 1 });
notificationTemplateSchema.index({ targetRoles: 1 });

// Method to render template with actual values
notificationTemplateSchema.methods.render = function (data) {
    let renderedTitle = this.title;
    let renderedBody = this.body;
    let renderedUrl = this.actionButton?.url || '';

    // Replace all variables with actual values
    this.variables.forEach(variable => {
        const value = data[variable.name] || variable.example || '';
        const regex = new RegExp(variable.placeholder.replace(/[{}]/g, '\\$&'), 'g');

        renderedTitle = renderedTitle.replace(regex, value);
        renderedBody = renderedBody.replace(regex, value);
        renderedUrl = renderedUrl.replace(regex, value);
    });

    return {
        title: renderedTitle,
        body: renderedBody,
        actionButton: this.actionButton ? {
            label: this.actionButton.label,
            url: renderedUrl
        } : null,
        priority: this.priority,
        icon: this.icon
    };
};

// Method to increment usage count
notificationTemplateSchema.methods.incrementUsage = async function () {
    this.usageCount += 1;
    this.lastUsedAt = new Date();
    await this.save();
};

// Static method to get template by event trigger
notificationTemplateSchema.statics.getByEvent = function (eventTrigger, targetRole = null) {
    const query = {
        eventTrigger,
        isActive: true
    };

    if (targetRole) {
        query.targetRoles = targetRole;
    }

    return this.findOne(query);
};

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);

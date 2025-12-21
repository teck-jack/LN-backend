const mongoose = require('mongoose');

const cannedResponseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    content: {
        type: String,
        required: [true, 'Content is required'],
        trim: true,
        maxlength: [2000, 'Content cannot exceed 2000 characters']
    },
    category: {
        type: String,
        required: true,
        enum: [
            'greeting',
            'document_request',
            'status_update',
            'clarification',
            'approval',
            'rejection',
            'closing',
            'follow_up',
            'general'
        ],
        default: 'general'
    },
    variables: [{
        name: {
            type: String,
            required: true
        },
        placeholder: {
            type: String,
            required: true
        },
        description: {
            type: String
        }
    }],
    createdBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'employee'],
            required: true
        }
    },
    isGlobal: {
        type: Boolean,
        default: false // If true, available to all employees; if false, only to creator
    },
    isActive: {
        type: Boolean,
        default: true
    },
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsedAt: {
        type: Date
    },
    tags: [{
        type: String,
        trim: true
    }]
}, {
    timestamps: true
});

// Indexes for efficient queries
cannedResponseSchema.index({ category: 1, isActive: 1 });
cannedResponseSchema.index({ 'createdBy.userId': 1 });
cannedResponseSchema.index({ isGlobal: 1, isActive: 1 });
cannedResponseSchema.index({ usageCount: -1 }); // For sorting by popularity

// Method to increment usage count
cannedResponseSchema.methods.incrementUsage = async function () {
    this.usageCount += 1;
    this.lastUsedAt = new Date();
    await this.save();
};

// Static method to get popular responses
cannedResponseSchema.statics.getPopular = function (limit = 10) {
    return this.find({ isActive: true })
        .sort({ usageCount: -1 })
        .limit(limit)
        .select('title content category usageCount');
};

// Static method to get responses by category
cannedResponseSchema.statics.getByCategory = function (category, userId = null) {
    const query = {
        category,
        isActive: true,
        $or: [
            { isGlobal: true },
            { 'createdBy.userId': userId }
        ]
    };

    return this.find(query).sort({ usageCount: -1 });
};

module.exports = mongoose.model('CannedResponse', cannedResponseSchema);

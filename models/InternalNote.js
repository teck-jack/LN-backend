const mongoose = require('mongoose');

const internalNoteSchema = new mongoose.Schema({
    caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case',
        required: [true, 'Case ID is required'],
        index: true
    },
    author: {
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
    content: {
        type: String,
        required: [true, 'Note content is required'],
        trim: true,
        maxlength: [5000, 'Note content cannot exceed 5000 characters']
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    editHistory: [{
        editedAt: {
            type: Date,
            required: true
        },
        previousContent: {
            type: String,
            required: true
        }
    }],
    isPinned: {
        type: Boolean,
        default: false
    },
    tags: [{
        type: String,
        trim: true
    }],
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

// Indexes for efficient queries
internalNoteSchema.index({ caseId: 1, createdAt: -1 });
internalNoteSchema.index({ 'author.userId': 1 });
internalNoteSchema.index({ isPinned: 1, createdAt: -1 });

// Pre-save middleware to track edits
internalNoteSchema.pre('save', function (next) {
    if (this.isModified('content') && !this.isNew) {
        this.isEdited = true;
    }
    next();
});

// Method to add edit to history
internalNoteSchema.methods.addEditHistory = function (previousContent) {
    this.editHistory.push({
        editedAt: new Date(),
        previousContent: previousContent
    });
    // Keep only last 10 edits
    if (this.editHistory.length > 10) {
        this.editHistory = this.editHistory.slice(-10);
    }
};

module.exports = mongoose.model('InternalNote', internalNoteSchema);

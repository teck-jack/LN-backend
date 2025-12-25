const mongoose = require('mongoose');

const ContactQuerySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email'
        ]
    },
    phone: {
        type: String,
        required: [true, 'Please provide a phone number'],
        trim: true
    },
    query: {
        type: String,
        required: [true, 'Please provide your query'],
        trim: true
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        default: null
    },
    userRole: {
        type: String,
        enum: ['admin', 'agent', 'employee', 'end_user', 'guest', null],
        default: 'guest'
    },
    status: {
        type: String,
        enum: ['new', 'in_progress', 'resolved', 'closed'],
        default: 'new'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    assignedTo: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        default: null
    },
    responses: [{
        responderId: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: true
        },
        responderName: {
            type: String,
            required: true
        },
        responderRole: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Update the updatedAt timestamp before saving
ContactQuerySchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Virtual for assigned employee details
ContactQuerySchema.virtual('assignedEmployee', {
    ref: 'User',
    localField: 'assignedTo',
    foreignField: '_id',
    justOne: true
});

// Virtual for user details
ContactQuerySchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
});

module.exports = mongoose.model('ContactQuery', ContactQuerySchema);

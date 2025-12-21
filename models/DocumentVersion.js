const mongoose = require('mongoose');

const documentVersionSchema = new mongoose.Schema({
    caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case',
        required: [true, 'Case ID is required']
    },
    documentType: {
        type: String,
        required: [true, 'Document type is required'],
        trim: true,
    },
    version: {
        type: Number,
        required: true,
        default: 1
    },
    fileUrl: {
        type: String,
        required: [true, 'File URL is required']
    },
    cloudinaryPublicId: {
        type: String, // For Cloudinary file management
        required: true
    },
    uploadedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        userRole: {
            type: String,
            enum: ['admin', 'agent', 'employee', 'end_user'],
            required: true
        }
    },
    status: {
        type: String,
        enum: ['active', 'superseded', 'deleted'],
        default: 'active'
    },
    metadata: {
        originalFileName: {
            type: String,
            required: true
        },
        fileSize: {
            type: Number, // in bytes
            required: true
        },
        mimeType: {
            type: String,
            required: true
        },
        format: {
            type: String // pdf, jpg, png, etc.
        }
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
documentVersionSchema.index({ caseId: 1, documentType: 1, version: -1 });
documentVersionSchema.index({ caseId: 1, status: 1 });
documentVersionSchema.index({ 'uploadedBy.userId': 1 });

// Method to get latest version number for a document type
documentVersionSchema.statics.getLatestVersion = async function (caseId, documentType) {
    const latestDoc = await this.findOne({ caseId, documentType })
        .sort({ version: -1 })
        .select('version');
    return latestDoc ? latestDoc.version : 0;
};

// Method to mark previous versions as superseded
documentVersionSchema.methods.markPreviousAsSuperseded = async function () {
    await this.constructor.updateMany(
        {
            caseId: this.caseId,
            documentType: this.documentType,
            version: { $lt: this.version },
            status: 'active'
        },
        {
            $set: { status: 'superseded' }
        }
    );
};

module.exports = mongoose.model('DocumentVersion', documentVersionSchema);

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

// Method to get document status for a case based on required document names
documentVersionSchema.statics.getDocumentStatus = async function (caseId, documentsRequired) {
    const DocumentVersion = this;

    // Get all active documents for this case
    const uploadedDocuments = await DocumentVersion.find({
        caseId,
        status: 'active'
    })
        .populate('uploadedBy.userId', 'name email')
        .populate('verifiedBy', 'name email')
        .sort({ version: -1 });

    // Create a map of document types to their latest versions
    const documentMap = {};
    uploadedDocuments.forEach(doc => {
        if (!documentMap[doc.documentType]) {
            documentMap[doc.documentType] = doc;
        }
    });

    // Build status array based on required document names
    const statusArray = documentsRequired.map(docName => {
        const uploadedDoc = documentMap[docName];

        return {
            documentName: docName,
            isUploaded: !!uploadedDoc,
            latestVersion: uploadedDoc ? {
                version: uploadedDoc.version,
                fileUrl: uploadedDoc.fileUrl,
                uploadedAt: uploadedDoc.createdAt,
                uploadedBy: uploadedDoc.uploadedBy,
                verificationStatus: uploadedDoc.verificationStatus,
                verifiedBy: uploadedDoc.verifiedBy,
                verifiedAt: uploadedDoc.verifiedAt,
                rejectionReason: uploadedDoc.rejectionReason,
                metadata: uploadedDoc.metadata
            } : null
        };
    });

    return statusArray;
};

module.exports = mongoose.model('DocumentVersion', documentVersionSchema);

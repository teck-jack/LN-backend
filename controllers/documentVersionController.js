const DocumentVersion = require('../models/DocumentVersion');
const Case = require('../models/Case');
const ActivityTimeline = require('../models/ActivityTimeline');
const AuditLog = require('../models/AuditLog');
const cloudinary = require('../config/cloudinary'); // We'll create this config file
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'case-documents',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
        resource_type: 'auto'
    }
});

const upload = multer({ storage: storage });

// @desc    Upload new document version
// @route   POST /api/documents/upload
// @access  Private (Employee/End User)
exports.uploadVersion = async (req, res, next) => {
    try {
        const { caseId, documentType, notes } = req.body;

        // Check if case exists
        const caseItem = await Case.findById(caseId).populate('serviceId');
        if (!caseItem) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }

        // Check authorization
        const isEndUser = req.user.role === 'end_user' && caseItem.endUserId.toString() === req.user.id;
        const isEmployee = req.user.role === 'employee' && caseItem.employeeId?.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isEndUser && !isEmployee && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to upload documents for this case'
            });
        }

        // Validate document type against service's required documents
        const service = caseItem.serviceId;
        if (service.documentsRequired && service.documentsRequired.length > 0) {
            if (!service.documentsRequired.includes(documentType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid document type. Allowed documents for this service are: ${service.documentsRequired.join(', ')}`,
                    allowedDocuments: service.documentsRequired
                });
            }
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Please upload a file'
            });
        }

        // Get latest version number
        const latestVersion = await DocumentVersion.getLatestVersion(caseId, documentType);

        // Create document version
        const documentVersion = await DocumentVersion.create({
            caseId,
            documentType,
            version: latestVersion + 1,
            fileUrl: req.file.path,
            cloudinaryPublicId: req.file.filename,
            uploadedBy: {
                userId: req.user.id,
                userRole: req.user.role
            },
            metadata: {
                originalFileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                format: req.file.format
            },
            notes
        });

        // Mark previous versions as superseded
        await documentVersion.markPreviousAsSuperseded();

        // Create timeline event
        await ActivityTimeline.createEvent({
            caseId,
            eventType: 'document_uploaded',
            title: 'Document Uploaded',
            description: ActivityTimeline.generateDescription('document_uploaded', {
                documentType,
                version: documentVersion.version,
                userName: req.user.name
            }),
            performedBy: {
                userId: req.user.id,
                name: req.user.name,
                role: req.user.role
            },
            metadata: {
                documentType,
                documentVersion: documentVersion.version
            },
            isVisibleToUser: true,
            ...ActivityTimeline.getEventStyle('document_uploaded')
        });

        // Update case last activity
        await caseItem.updateActivity();

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'upload',
            entityType: 'DocumentVersion',
            entityId: documentVersion._id,
            entityName: `${documentType} v${documentVersion.version}`,
            description: `Uploaded ${documentType} version ${documentVersion.version} for case ${caseItem.caseId}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                caseId: caseItem._id
            },
            severity: 'low'
        });

        res.status(201).json({
            success: true,
            data: documentVersion
        });
    } catch (err) {
        console.error('Document upload error:', err);
        next(err);
    }
};

// @desc    Get version history for a document
// @route   GET /api/documents/:caseId/:documentType/versions
// @access  Private
exports.getVersionHistory = async (req, res, next) => {
    try {
        const { caseId, documentType } = req.params;

        // Check if case exists and user has access
        const caseItem = await Case.findById(caseId);
        if (!caseItem) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }

        const isAuthorized =
            req.user.role === 'admin' ||
            (req.user.role === 'end_user' && caseItem.endUserId.toString() === req.user.id) ||
            (req.user.role === 'employee' && caseItem.employeeId?.toString() === req.user.id);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view this case'
            });
        }

        const versions = await DocumentVersion.find({ caseId, documentType })
            .populate('uploadedBy.userId', 'name email')
            .populate('verifiedBy', 'name email')
            .sort({ version: -1 });

        res.status(200).json({
            success: true,
            count: versions.length,
            data: versions
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Download specific version
// @route   GET /api/documents/version/:versionId/download
// @access  Private
exports.downloadVersion = async (req, res, next) => {
    try {
        const version = await DocumentVersion.findById(req.params.versionId);

        if (!version) {
            return res.status(404).json({
                success: false,
                error: 'Document version not found'
            });
        }

        // Check authorization
        const caseItem = await Case.findById(version.caseId);
        const isAuthorized =
            req.user.role === 'admin' ||
            (req.user.role === 'end_user' && caseItem.endUserId.toString() === req.user.id) ||
            (req.user.role === 'employee' && caseItem.employeeId?.toString() === req.user.id);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to download this document'
            });
        }

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'download',
            entityType: 'DocumentVersion',
            entityId: version._id,
            entityName: `${version.documentType} v${version.version}`,
            description: `Downloaded ${version.documentType} version ${version.version}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'low'
        });

        res.status(200).json({
            success: true,
            data: {
                fileUrl: version.fileUrl,
                fileName: version.metadata.originalFileName
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete document version
// @route   DELETE /api/documents/version/:versionId
// @access  Private (Admin/Employee)
exports.deleteVersion = async (req, res, next) => {
    try {
        const version = await DocumentVersion.findById(req.params.versionId);

        if (!version) {
            return res.status(404).json({
                success: false,
                error: 'Document version not found'
            });
        }

        // Only admin or assigned employee can delete
        const caseItem = await Case.findById(version.caseId);
        const isAuthorized =
            req.user.role === 'admin' ||
            (req.user.role === 'employee' && caseItem.employeeId?.toString() === req.user.id);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to delete this document'
            });
        }

        // Soft delete
        version.status = 'deleted';
        await version.save();

        // Delete from Cloudinary
        await cloudinary.uploader.destroy(version.cloudinaryPublicId);

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'delete',
            entityType: 'DocumentVersion',
            entityId: version._id,
            entityName: `${version.documentType} v${version.version}`,
            description: `Deleted ${version.documentType} version ${version.version}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'medium'
        });

        res.status(200).json({
            success: true,
            message: 'Document version deleted successfully'
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Restore previous version as current
// @route   POST /api/documents/version/:versionId/restore
// @access  Private (Admin/Employee)
exports.restoreVersion = async (req, res, next) => {
    try {
        const oldVersion = await DocumentVersion.findById(req.params.versionId);

        if (!oldVersion) {
            return res.status(404).json({
                success: false,
                error: 'Document version not found'
            });
        }

        // Only admin or assigned employee can restore
        const caseItem = await Case.findById(oldVersion.caseId);
        const isAuthorized =
            req.user.role === 'admin' ||
            (req.user.role === 'employee' && caseItem.employeeId?.toString() === req.user.id);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to restore this document'
            });
        }

        // Get latest version number
        const latestVersion = await DocumentVersion.getLatestVersion(
            oldVersion.caseId,
            oldVersion.documentType
        );

        // Create new version with old file
        const restoredVersion = await DocumentVersion.create({
            caseId: oldVersion.caseId,
            documentType: oldVersion.documentType,
            version: latestVersion + 1,
            fileUrl: oldVersion.fileUrl,
            cloudinaryPublicId: oldVersion.cloudinaryPublicId,
            uploadedBy: {
                userId: req.user.id,
                userRole: req.user.role
            },
            metadata: {
                ...oldVersion.metadata,
                restoredFrom: oldVersion.version
            },
            notes: `Restored from version ${oldVersion.version}`
        });

        // Mark previous versions as superseded
        await restoredVersion.markPreviousAsSuperseded();

        // Create timeline event
        await ActivityTimeline.createEvent({
            caseId: oldVersion.caseId,
            eventType: 'document_uploaded',
            title: 'Document Restored',
            description: `Restored ${oldVersion.documentType} from version ${oldVersion.version}`,
            performedBy: {
                userId: req.user.id,
                name: req.user.name,
                role: req.user.role
            },
            metadata: {
                documentType: oldVersion.documentType,
                documentVersion: restoredVersion.version,
                restoredFrom: oldVersion.version
            },
            isVisibleToUser: false,
            ...ActivityTimeline.getEventStyle('document_uploaded')
        });

        res.status(201).json({
            success: true,
            data: restoredVersion
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Verify document
// @route   PUT /api/documents/version/:versionId/verify
// @access  Private (Admin/Employee)
exports.verifyDocument = async (req, res, next) => {
    try {
        const { verificationStatus, rejectionReason } = req.body;

        const version = await DocumentVersion.findById(req.params.versionId);

        if (!version) {
            return res.status(404).json({
                success: false,
                error: 'Document version not found'
            });
        }

        // Only admin or assigned employee can verify
        const caseItem = await Case.findById(version.caseId);
        const isAuthorized =
            req.user.role === 'admin' ||
            (req.user.role === 'employee' && caseItem.employeeId?.toString() === req.user.id);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to verify this document'
            });
        }

        version.verificationStatus = verificationStatus;
        version.verifiedBy = req.user.id;
        version.verifiedAt = new Date();
        if (rejectionReason) {
            version.rejectionReason = rejectionReason;
        }
        await version.save();

        // Create timeline event
        const eventType = verificationStatus === 'verified' ? 'document_verified' : 'document_rejected';
        await ActivityTimeline.createEvent({
            caseId: version.caseId,
            eventType,
            title: verificationStatus === 'verified' ? 'Document Verified' : 'Document Rejected',
            description: ActivityTimeline.generateDescription(eventType, {
                documentType: version.documentType,
                verifierName: req.user.name,
                reason: rejectionReason
            }),
            performedBy: {
                userId: req.user.id,
                name: req.user.name,
                role: req.user.role
            },
            metadata: {
                documentType: version.documentType,
                documentVersion: version.version,
                verificationStatus,
                rejectionReason
            },
            isVisibleToUser: true,
            ...ActivityTimeline.getEventStyle(eventType)
        });

        res.status(200).json({
            success: true,
            data: version
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get document status for a case
// @route   GET /api/documents/:caseId/status
// @access  Private
exports.getDocumentStatus = async (req, res, next) => {
    try {
        const { caseId } = req.params;

        // Check if case exists and user has access
        const caseItem = await Case.findById(caseId).populate('serviceId');
        if (!caseItem) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }

        const isAuthorized =
            req.user.role === 'admin' ||
            (req.user.role === 'end_user' && caseItem.endUserId.toString() === req.user.id) ||
            (req.user.role === 'employee' && caseItem.employeeId?.toString() === req.user.id);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view this case'
            });
        }

        const service = caseItem.serviceId;

        // Check if service has documentsRequired
        if (!service.documentsRequired || service.documentsRequired.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No required documents defined for this service'
            });
        }

        // Get document status
        const documentStatus = await DocumentVersion.getDocumentStatus(
            caseId,
            service.documentsRequired
        );

        // Calculate summary statistics
        const totalDocuments = documentStatus.length;
        const uploadedDocuments = documentStatus.filter(doc => doc.isUploaded).length;
        const verified = documentStatus.filter(doc => doc.isUploaded && doc.latestVersion.verificationStatus === 'verified').length;
        const pending = documentStatus.filter(doc => doc.isUploaded && doc.latestVersion.verificationStatus === 'pending').length;
        const rejected = documentStatus.filter(doc => doc.isUploaded && doc.latestVersion.verificationStatus === 'rejected').length;

        res.status(200).json({
            success: true,
            data: documentStatus,
            summary: {
                totalDocuments,
                uploadedDocuments,
                verified,
                pending,
                rejected,
                allDocumentsUploaded: uploadedDocuments === totalDocuments
            }
        });
    } catch (err) {
        next(err);
    }
};

// Export multer upload middleware
exports.uploadMiddleware = upload.single('file');

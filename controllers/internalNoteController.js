const InternalNote = require('../models/InternalNote');
const Case = require('../models/Case');
const ActivityTimeline = require('../models/ActivityTimeline');
const AuditLog = require('../models/AuditLog');

// @desc    Add internal note to case
// @route   POST /api/employee/cases/:caseId/internal-notes
// @access  Private (Admin/Employee)
exports.addInternalNote = async (req, res, next) => {
    try {
        const { content, tags, mentions } = req.body;
        const { caseId } = req.params;

        // Check if case exists
        const caseItem = await Case.findById(caseId);
        if (!caseItem) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }

        // Check authorization (admin or assigned employee)
        const isAuthorized =
            req.user.role === 'admin' ||
            (req.user.role === 'employee' && caseItem.employeeId?.toString() === req.user.id);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to add notes to this case'
            });
        }

        // Create internal note
        const note = await InternalNote.create({
            caseId,
            author: {
                userId: req.user.id,
                name: req.user.name,
                role: req.user.role
            },
            content,
            tags,
            mentions
        });

        // Create timeline event (not visible to end user)
        await ActivityTimeline.createEvent({
            caseId,
            eventType: 'internal_note_added',
            title: 'Internal Note Added',
            description: `Internal note added by ${req.user.name}`,
            performedBy: {
                userId: req.user.id,
                name: req.user.name,
                role: req.user.role
            },
            isVisibleToUser: false,
            ...ActivityTimeline.getEventStyle('internal_note_added')
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
            action: 'create',
            entityType: 'InternalNote',
            entityId: note._id,
            description: `Added internal note to case ${caseItem.caseId}`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                caseId: caseItem._id
            },
            severity: 'low'
        });

        res.status(201).json({
            success: true,
            data: note
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get internal notes for a case
// @route   GET /api/employee/cases/:caseId/internal-notes
// @access  Private (Admin/Employee)
exports.getInternalNotes = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { page = 1, limit = 20, isPinned } = req.query;

        // Check if case exists
        const caseItem = await Case.findById(caseId);
        if (!caseItem) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }

        // Check authorization
        const isAuthorized =
            req.user.role === 'admin' ||
            (req.user.role === 'employee' && caseItem.employeeId?.toString() === req.user.id);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view notes for this case'
            });
        }

        const query = { caseId };
        if (isPinned !== undefined) {
            query.isPinned = isPinned === 'true';
        }

        const notes = await InternalNote.find(query)
            .populate('author.userId', 'name email')
            .populate('mentions', 'name email')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ isPinned: -1, createdAt: -1 });

        const total = await InternalNote.countDocuments(query);

        res.status(200).json({
            success: true,
            count: notes.length,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            },
            data: notes
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update internal note
// @route   PUT /api/employee/internal-notes/:noteId
// @access  Private (Admin/Note Author)
exports.updateInternalNote = async (req, res, next) => {
    try {
        const { content, tags, mentions, isPinned } = req.body;
        const note = await InternalNote.findById(req.params.noteId);

        if (!note) {
            return res.status(404).json({
                success: false,
                error: 'Internal note not found'
            });
        }

        // Check authorization (admin or note author)
        const isAuthorized =
            req.user.role === 'admin' ||
            note.author.userId.toString() === req.user.id;

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to update this note'
            });
        }

        // Save previous content for edit history
        if (content && content !== note.content) {
            note.addEditHistory(note.content);
        }

        // Update fields
        if (content) note.content = content;
        if (tags) note.tags = tags;
        if (mentions) note.mentions = mentions;
        if (isPinned !== undefined) note.isPinned = isPinned;

        await note.save();

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'update',
            entityType: 'InternalNote',
            entityId: note._id,
            description: `Updated internal note`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'low'
        });

        res.status(200).json({
            success: true,
            data: note
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete internal note
// @route   DELETE /api/employee/internal-notes/:noteId
// @access  Private (Admin/Note Author)
exports.deleteInternalNote = async (req, res, next) => {
    try {
        const note = await InternalNote.findById(req.params.noteId);

        if (!note) {
            return res.status(404).json({
                success: false,
                error: 'Internal note not found'
            });
        }

        // Check authorization
        const isAuthorized =
            req.user.role === 'admin' ||
            note.author.userId.toString() === req.user.id;

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to delete this note'
            });
        }

        await note.deleteOne();

        // Log audit
        await AuditLog.log({
            user: {
                userId: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            },
            action: 'delete',
            entityType: 'InternalNote',
            entityId: note._id,
            description: `Deleted internal note`,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            },
            severity: 'medium'
        });

        res.status(200).json({
            success: true,
            message: 'Internal note deleted successfully'
        });
    } catch (err) {
        next(err);
    }
};

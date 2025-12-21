const AuditLog = require('../models/AuditLog');

// @desc    Get audit logs with filters
// @route   GET /api/admin/audit-logs
// @access  Private/Admin
exports.getAuditLogs = async (req, res, next) => {
    try {
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
        } = req.query;

        const logs = await AuditLog.getLogs(
            { userId, action, entityType, entityId, startDate, endDate, severity, role },
            { page, limit }
        );

        const total = await AuditLog.countDocuments(
            AuditLog.getLogs({ userId, action, entityType, entityId, startDate, endDate, severity, role }, {})
        );

        res.status(200).json({
            success: true,
            count: logs.length,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            },
            data: logs
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Export audit logs to CSV
// @route   GET /api/admin/audit-logs/export
// @access  Private/Admin
exports.exportAuditLogs = async (req, res, next) => {
    try {
        const {
            userId,
            action,
            entityType,
            startDate,
            endDate,
            severity,
            role,
            format = 'csv'
        } = req.query;

        const logs = await AuditLog.getLogs(
            { userId, action, entityType, startDate, endDate, severity, role },
            { page: 1, limit: 10000 } // Max 10k records for export
        );

        if (format === 'csv') {
            // Convert to CSV
            const csv = convertToCSV(logs);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
            res.status(200).send(csv);
        } else {
            // Return JSON
            res.status(200).json({
                success: true,
                count: logs.length,
                data: logs
            });
        }
    } catch (err) {
        next(err);
    }
};

// @desc    Get entity history
// @route   GET /api/admin/audit-logs/entity/:entityType/:entityId
// @access  Private/Admin
exports.getEntityHistory = async (req, res, next) => {
    try {
        const { entityType, entityId } = req.params;

        const history = await AuditLog.getEntityHistory(entityType, entityId);

        res.status(200).json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (err) {
        next(err);
    }
};

// Helper function to convert logs to CSV
function convertToCSV(logs) {
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Entity Type', 'Entity Name', 'Description', 'IP Address', 'Severity', 'Status'];

    const rows = logs.map(log => [
        new Date(log.createdAt).toISOString(),
        log.user.name,
        log.user.role,
        log.action,
        log.entityType,
        log.entityName || '',
        log.description,
        log.metadata?.ipAddress || '',
        log.severity,
        log.status
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
}

module.exports = exports;

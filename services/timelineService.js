const ActivityTimeline = require('../models/ActivityTimeline');

/**
 * Get activity timeline for a case
 * @param {ObjectId} caseId - Case ID
 * @param {Boolean} userView - If true, only return events visible to end user
 * @param {Object} options - Pagination and filter options
 * @returns {Array} Timeline events
 */
exports.getTimeline = async (caseId, userView = false, options = {}) => {
    try {
        const timeline = await ActivityTimeline.getTimeline(caseId, userView, options);
        return timeline;
    } catch (error) {
        console.error('Error getting timeline:', error);
        return [];
    }
};

/**
 * Create a timeline event
 * @param {Object} eventData - Event data
 * @returns {Object} Created event
 */
exports.createEvent = async (eventData) => {
    try {
        const event = await ActivityTimeline.createEvent(eventData);
        return event;
    } catch (error) {
        console.error('Error creating timeline event:', error);
        return null;
    }
};

/**
 * Log case status change
 * @param {Object} caseItem - Case document
 * @param {String} oldStatus - Previous status
 * @param {String} newStatus - New status
 * @param {Object} user - User who made the change
 */
exports.logStatusChange = async (caseItem, oldStatus, newStatus, user) => {
    try {
        await ActivityTimeline.createEvent({
            caseId: caseItem._id,
            eventType: 'status_changed',
            title: 'Status Updated',
            description: ActivityTimeline.generateDescription('status_changed', {
                oldStatus,
                newStatus
            }),
            performedBy: {
                userId: user.id,
                name: user.name,
                role: user.role
            },
            metadata: {
                oldValue: oldStatus,
                newValue: newStatus
            },
            isVisibleToUser: true,
            ...ActivityTimeline.getEventStyle('status_changed')
        });
    } catch (error) {
        console.error('Error logging status change:', error);
    }
};

/**
 * Log case assignment
 * @param {Object} caseItem - Case document
 * @param {Object} employee - Employee assigned
 * @param {Object} user - User who made the assignment
 */
exports.logCaseAssignment = async (caseItem, employee, user) => {
    try {
        await ActivityTimeline.createEvent({
            caseId: caseItem._id,
            eventType: 'case_assigned',
            title: 'Case Assigned',
            description: ActivityTimeline.generateDescription('case_assigned', {
                assigneeName: employee.name
            }),
            performedBy: {
                userId: user.id,
                name: user.name,
                role: user.role
            },
            metadata: {
                newValue: employee.name,
                employeeId: employee._id
            },
            isVisibleToUser: true,
            ...ActivityTimeline.getEventStyle('case_assigned')
        });
    } catch (error) {
        console.error('Error logging case assignment:', error);
    }
};

/**
 * Log payment received
 * @param {Object} caseItem - Case document
 * @param {Number} amount - Payment amount
 */
exports.logPaymentReceived = async (caseItem, amount) => {
    try {
        await ActivityTimeline.createEvent({
            caseId: caseItem._id,
            eventType: 'payment_received',
            title: 'Payment Received',
            description: ActivityTimeline.generateDescription('payment_received', {
                amount
            }),
            performedBy: {
                userId: null,
                name: 'System',
                role: 'system'
            },
            metadata: {
                paymentAmount: amount
            },
            isVisibleToUser: true,
            ...ActivityTimeline.getEventStyle('payment_received')
        });
    } catch (error) {
        console.error('Error logging payment:', error);
    }
};

/**
 * Log checklist item completion
 * @param {Object} caseItem - Case document
 * @param {String} itemName - Checklist item name
 * @param {String} status - completed/incomplete
 * @param {Object} user - User who updated the item
 */
exports.logChecklistUpdate = async (caseItem, itemName, status, user) => {
    try {
        await ActivityTimeline.createEvent({
            caseId: caseItem._id,
            eventType: 'checklist_updated',
            title: 'Checklist Updated',
            description: ActivityTimeline.generateDescription('checklist_updated', {
                itemName,
                status
            }),
            performedBy: {
                userId: user.id,
                name: user.name,
                role: user.role
            },
            metadata: {
                checklistItem: itemName,
                newValue: status
            },
            isVisibleToUser: false,
            ...ActivityTimeline.getEventStyle('checklist_updated')
        });
    } catch (error) {
        console.error('Error logging checklist update:', error);
    }
};

/**
 * Log case completion
 * @param {Object} caseItem - Case document
 * @param {Object} user - User who completed the case
 */
exports.logCaseCompletion = async (caseItem, user) => {
    try {
        await ActivityTimeline.createEvent({
            caseId: caseItem._id,
            eventType: 'case_completed',
            title: 'Case Completed',
            description: ActivityTimeline.generateDescription('case_completed', {
                userName: user.name
            }),
            performedBy: {
                userId: user.id,
                name: user.name,
                role: user.role
            },
            isVisibleToUser: true,
            ...ActivityTimeline.getEventStyle('case_completed')
        });
    } catch (error) {
        console.error('Error logging case completion:', error);
    }
};

/**
 * Log case reopening
 * @param {Object} caseItem - Case document
 * @param {Object} user - User who reopened the case
 */
exports.logCaseReopen = async (caseItem, user) => {
    try {
        await ActivityTimeline.createEvent({
            caseId: caseItem._id,
            eventType: 'case_reopened',
            title: 'Case Reopened',
            description: ActivityTimeline.generateDescription('case_reopened', {
                userName: user.name
            }),
            performedBy: {
                userId: user.id,
                name: user.name,
                role: user.role
            },
            isVisibleToUser: true,
            ...ActivityTimeline.getEventStyle('case_reopened')
        });
    } catch (error) {
        console.error('Error logging case reopen:', error);
    }
};

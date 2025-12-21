const Case = require('../models/Case');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const Notification = require('../models/Notification');
const NotificationTemplate = require('../models/NotificationTemplate');
const ActivityTimeline = require('../models/ActivityTimeline');

/**
 * Calculate SLA deadline based on workflow template
 * @param {ObjectId} workflowTemplateId - Workflow template ID
 * @param {Date} startDate - Start date (usually case creation or assignment date)
 * @returns {Date} SLA deadline
 */
exports.calculateSLADeadline = async (workflowTemplateId, startDate = new Date()) => {
    try {
        const template = await WorkflowTemplate.findById(workflowTemplateId);

        if (!template) {
            return null;
        }

        const durationInHours = template.totalEstimatedDuration || 0;
        const deadline = new Date(startDate);
        deadline.setHours(deadline.getHours() + durationInHours);

        return deadline;
    } catch (error) {
        console.error('Error calculating SLA deadline:', error);
        return null;
    }
};

/**
 * Check SLA status for a case
 * @param {Object} caseItem - Case document
 * @returns {String} SLA status: on_time, at_risk, breached, not_set
 */
exports.checkSLAStatus = (caseItem) => {
    if (!caseItem.slaDeadline) {
        return 'not_set';
    }

    const now = new Date();
    const deadline = new Date(caseItem.slaDeadline);
    const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

    if (now > deadline) {
        return 'breached';
    } else if (hoursRemaining <= 24) {
        return 'at_risk';
    } else {
        return 'on_time';
    }
};

/**
 * Update SLA status for all active cases
 * This should be run as a cron job
 */
exports.updateAllSLAStatuses = async () => {
    try {
        const activeCases = await Case.find({
            status: { $nin: ['completed', 'closed', 'cancelled'] },
            slaDeadline: { $ne: null }
        });

        let updatedCount = 0;
        const alerts = [];

        for (const caseItem of activeCases) {
            const oldStatus = caseItem.slaStatus;
            const newStatus = exports.checkSLAStatus(caseItem);

            if (oldStatus !== newStatus) {
                caseItem.slaStatus = newStatus;
                await caseItem.save();
                updatedCount++;

                // Send alerts for at-risk and breached cases
                if (newStatus === 'at_risk' || newStatus === 'breached') {
                    alerts.push({
                        caseId: caseItem._id,
                        caseNumber: caseItem.caseId,
                        status: newStatus,
                        deadline: caseItem.slaDeadline
                    });

                    // Create timeline event
                    await ActivityTimeline.createEvent({
                        caseId: caseItem._id,
                        eventType: newStatus === 'at_risk' ? 'sla_warning' : 'sla_breach',
                        title: newStatus === 'at_risk' ? 'SLA Warning' : 'SLA Breached',
                        description: ActivityTimeline.generateDescription(
                            newStatus === 'at_risk' ? 'sla_warning' : 'sla_breach',
                            {
                                hoursRemaining: newStatus === 'at_risk'
                                    ? Math.round((new Date(caseItem.slaDeadline) - new Date()) / (1000 * 60 * 60))
                                    : 0
                            }
                        ),
                        performedBy: {
                            userId: null,
                            name: 'System',
                            role: 'system'
                        },
                        isVisibleToUser: false,
                        ...ActivityTimeline.getEventStyle(newStatus === 'at_risk' ? 'sla_warning' : 'sla_breach')
                    });

                    // Send notification to assigned employee
                    if (caseItem.employeeId) {
                        const template = await NotificationTemplate.getByEvent(
                            newStatus === 'at_risk' ? 'sla_warning' : 'sla_breach',
                            'employee'
                        );

                        if (template) {
                            const rendered = template.render({
                                caseId: caseItem.caseId,
                                hoursRemaining: newStatus === 'at_risk'
                                    ? Math.round((new Date(caseItem.slaDeadline) - new Date()) / (1000 * 60 * 60))
                                    : 0
                            });

                            await Notification.create({
                                recipientId: caseItem.employeeId,
                                type: 'IN_APP',
                                title: rendered.title,
                                message: rendered.body,
                                priority: rendered.priority,
                                relatedCaseId: caseItem._id
                            });

                            await template.incrementUsage();
                        }
                    }
                }
            }
        }

        console.log(`✅ SLA Status Update: ${updatedCount} cases updated, ${alerts.length} alerts sent`);
        return { updatedCount, alerts };
    } catch (error) {
        console.error('❌ Error updating SLA statuses:', error);
        return { updatedCount: 0, alerts: [], error: error.message };
    }
};

/**
 * Get cases with SLA breaches or at risk
 * @param {String} status - Filter by SLA status (at_risk or breached)
 * @returns {Array} Cases
 */
exports.getSLAAlerts = async (status = null) => {
    try {
        const query = {
            status: { $nin: ['completed', 'closed', 'cancelled'] }
        };

        if (status) {
            query.slaStatus = status;
        } else {
            query.slaStatus = { $in: ['at_risk', 'breached'] };
        }

        const cases = await Case.find(query)
            .populate('endUserId', 'name email phone')
            .populate('employeeId', 'name email')
            .populate('serviceId', 'name type')
            .sort({ slaDeadline: 1 });

        return cases;
    } catch (error) {
        console.error('Error getting SLA alerts:', error);
        return [];
    }
};

/**
 * Initialize SLA for a case based on workflow template
 * @param {Object} caseItem - Case document
 */
exports.initializeCaseSLA = async (caseItem) => {
    try {
        if (!caseItem.workflowTemplateId) {
            return;
        }

        const deadline = await exports.calculateSLADeadline(
            caseItem.workflowTemplateId,
            caseItem.assignedAt || caseItem.createdAt
        );

        if (deadline) {
            caseItem.slaDeadline = deadline;
            caseItem.slaStatus = 'on_time';

            // Calculate human-readable estimated resolution time
            const template = await WorkflowTemplate.findById(caseItem.workflowTemplateId);
            if (template) {
                const days = Math.ceil(template.totalEstimatedDuration / 24);
                caseItem.estimatedResolutionTime = `${days} business day${days > 1 ? 's' : ''}`;
            }

            await caseItem.save();
        }
    } catch (error) {
        console.error('Error initializing case SLA:', error);
    }
};

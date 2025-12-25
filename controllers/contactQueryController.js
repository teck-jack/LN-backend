const ContactQuery = require('../models/ContactQuery');
const User = require('../models/User');

// @desc    Submit a contact query (public endpoint)
// @route   POST /api/contact/submit
// @access  Public (but checks if user is authenticated)
exports.submitQuery = async (req, res) => {
    try {
        const { name, email, phone, query } = req.body;

        // Validate required fields
        if (!name || !email || !phone || !query) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all required fields: name, email, phone, and query'
            });
        }

        // Create query object
        const queryData = {
            name,
            email,
            phone,
            query,
            userRole: 'guest',
            userId: null
        };

        // If user is authenticated, capture their info
        if (req.user) {
            queryData.userId = req.user._id;
            queryData.userRole = req.user.role;
        }

        const contactQuery = await ContactQuery.create(queryData);

        // Notify all admins about the new query
        const Notification = require('../models/Notification');
        const constants = require('../utils/constants');

        // Find all admins
        const admins = await User.find({ role: constants.USER_ROLES.ADMIN });

        // Create notification for each admin
        const notificationPromises = admins.map(admin =>
            Notification.create({
                recipientId: admin._id,
                type: constants.NOTIFICATION_TYPES.IN_APP,
                title: 'New Contact Query',
                message: `New query received from ${name}: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`,
                relatedCaseId: null
            })
        );

        await Promise.all(notificationPromises);

        res.status(201).json({
            success: true,
            data: contactQuery,
            message: 'Your query has been submitted successfully. We will get back to you soon!'
        });
    } catch (error) {
        console.error('Error submitting contact query:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit query. Please try again later.'
        });
    }
};

// @desc    Get all contact queries with filtering and pagination
// @route   GET /api/contact/queries
// @access  Private (Admin/Employee)
exports.getAllQueries = async (req, res) => {
    try {
        const { status, priority, assignedTo, search, page = 1, limit = 10 } = req.query;

        // Build filter object
        const filter = {};

        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (assignedTo) filter.assignedTo = assignedTo;

        // Search by name or email
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get queries with population
        const queries = await ContactQuery.find(filter)
            .populate('userId', 'name email role')
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await ContactQuery.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: queries,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch queries'
        });
    }
};

// @desc    Get single contact query by ID
// @route   GET /api/contact/queries/:id
// @access  Private (Admin/Employee/Query Owner)
exports.getQueryById = async (req, res) => {
    try {
        const query = await ContactQuery.findById(req.params.id)
            .populate('userId', 'name email phone role')
            .populate('assignedTo', 'name email')
            .populate('responses.responderId', 'name email role');

        if (!query) {
            return res.status(404).json({
                success: false,
                error: 'Query not found'
            });
        }

        // Check if user has permission to view this query
        const isOwner = req.user && query.userId && query.userId._id.toString() === req.user._id.toString();
        const isAdminOrEmployee = req.user && ['admin', 'employee'].includes(req.user.role);

        if (!isOwner && !isAdminOrEmployee) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view this query'
            });
        }

        res.status(200).json({
            success: true,
            data: query
        });
    } catch (error) {
        console.error('Error fetching query:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch query'
        });
    }
};

// @desc    Get queries submitted by the authenticated user
// @route   GET /api/contact/queries/my-queries
// @access  Private
exports.getUserQueries = async (req, res) => {
    try {
        const queries = await ContactQuery.find({ userId: req.user._id })
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: queries
        });
    } catch (error) {
        console.error('Error fetching user queries:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch your queries'
        });
    }
};

// @desc    Update query status
// @route   PUT /api/contact/queries/:id/status
// @access  Private (Admin/Employee)
exports.updateQueryStatus = async (req, res) => {
    try {
        const { status, priority } = req.body;

        const updateData = {};
        if (status) updateData.status = status;
        if (priority) updateData.priority = priority;

        const query = await ContactQuery.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('assignedTo', 'name email');

        if (!query) {
            return res.status(404).json({
                success: false,
                error: 'Query not found'
            });
        }

        res.status(200).json({
            success: true,
            data: query,
            message: 'Query updated successfully'
        });
    } catch (error) {
        console.error('Error updating query status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update query'
        });
    }
};

// @desc    Assign query to an employee
// @route   PUT /api/contact/queries/:id/assign
// @access  Private (Admin/Employee)
exports.assignQuery = async (req, res) => {
    try {
        const { employeeId } = req.body;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an employee ID'
            });
        }

        // Verify employee exists and has correct role
        const employee = await User.findById(employeeId);
        if (!employee || !['employee', 'admin'].includes(employee.role)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid employee ID'
            });
        }

        const query = await ContactQuery.findByIdAndUpdate(
            req.params.id,
            {
                assignedTo: employeeId,
                status: 'in_progress' // Auto-update status when assigned
            },
            { new: true, runValidators: true }
        ).populate('assignedTo', 'name email');

        if (!query) {
            return res.status(404).json({
                success: false,
                error: 'Query not found'
            });
        }

        res.status(200).json({
            success: true,
            data: query,
            message: 'Query assigned successfully'
        });
    } catch (error) {
        console.error('Error assigning query:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to assign query'
        });
    }
};

// @desc    Add a response to a query
// @route   POST /api/contact/queries/:id/response
// @access  Private (Admin/Employee)
exports.addResponse = async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a response message'
            });
        }

        const query = await ContactQuery.findById(req.params.id);

        if (!query) {
            return res.status(404).json({
                success: false,
                error: 'Query not found'
            });
        }

        // Add response
        query.responses.push({
            responderId: req.user._id,
            responderName: req.user.name,
            responderRole: req.user.role,
            message,
            timestamp: new Date()
        });

        await query.save();

        // Populate the query for response
        await query.populate('userId', 'name email phone role');
        await query.populate('assignedTo', 'name email');

        res.status(200).json({
            success: true,
            data: query,
            message: 'Response added successfully'
        });
    } catch (error) {
        console.error('Error adding response:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add response'
        });
    }
};

// @desc    Delete a contact query
// @route   DELETE /api/contact/queries/:id
// @access  Private (Admin only)
exports.deleteQuery = async (req, res) => {
    try {
        const query = await ContactQuery.findById(req.params.id);

        if (!query) {
            return res.status(404).json({
                success: false,
                error: 'Query not found'
            });
        }

        await query.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Query deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting query:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete query'
        });
    }
};

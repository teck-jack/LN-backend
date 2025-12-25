const { protect, authorize } = require('./auth');

exports.employeeAuth = (req, res, next) => {
  protect(req, res, () => {
    // Allow both employees and admins to access employee routes
    authorize('employee', 'admin')(req, res, next);
  });
};

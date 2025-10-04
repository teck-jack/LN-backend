const { protect, authorize } = require('./auth');

exports.employeeAuth = (req, res, next) => {
  protect(req, res, () => {
    authorize('employee')(req, res, next);
  });
};
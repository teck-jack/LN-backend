const { protect, authorize } = require('./auth');

exports.adminAuth = (req, res, next) => {
  protect(req, res, () => {
    authorize('admin')(req, res, next);
  });
};
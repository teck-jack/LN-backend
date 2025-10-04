const { protect, authorize } = require('./auth');

exports.endUserAuth = (req, res, next) => {
  protect(req, res, () => {
    authorize('end_user')(req, res, next);
  });
};
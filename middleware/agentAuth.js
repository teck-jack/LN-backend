const { protect, authorize } = require('./auth');

exports.agentAuth = (req, res, next) => {
  protect(req, res, () => {
    authorize('agent')(req, res, next);
  });
};
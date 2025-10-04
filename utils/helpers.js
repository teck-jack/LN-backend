const generateCaseId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 5);
  return `CASE-${timestamp}-${randomStr}`.toUpperCase();
};

const calculateAgentPerformance = (onboardedUsers, completedCases) => {
  if (onboardedUsers === 0) return 0;
  return Math.round((completedCases / onboardedUsers) * 100);
};

const calculateEmployeeWorkload = (assignedCases) => {
  const newCases = assignedCases.filter(c => c.status === 'new').length;
  const inProgressCases = assignedCases.filter(c => c.status === 'in_progress').length;
  return {
    total: assignedCases.length,
    new: newCases,
    inProgress: inProgressCases,
    completed: assignedCases.filter(c => c.status === 'completed').length
  };
};

module.exports = {
  generateCaseId,
  calculateAgentPerformance,
  calculateEmployeeWorkload
};
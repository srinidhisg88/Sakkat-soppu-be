const AuditLog = require('../models/auditLog.model');

async function logAudit({ req, action, entityType, entityId, before, after, meta }) {
  try {
    const actorId = req?.user?.id || req?.user?._id;
    const actorRole = req?.user?.role || 'user';
    if (!actorId) return; // skip if no actor
    await AuditLog.create({ actorId, actorRole, action, entityType, entityId, before, after, meta });
  } catch (err) {
    // Do not block main flow on logging failures
    // eslint-disable-next-line no-console
    console.error('Audit log failed', err);
  }
}

module.exports = { logAudit };

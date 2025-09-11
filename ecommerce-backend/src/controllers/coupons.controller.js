const Coupon = require('../models/coupon.model');
const { logAudit } = require('../services/audit.service');

exports.listCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 20, active, q } = req.query;
    const filter = {};
    if (active === 'true') filter.isActive = true;
    if (active === 'false') filter.isActive = false;
    if (q) filter.code = new RegExp(q, 'i');
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [data, total] = await Promise.all([
      Coupon.find(filter).sort('-createdAt').skip((p-1)*l).limit(l).lean(),
      Coupon.countDocuments(filter)
    ]);

    res.status(200).json({ data, page: p, limit: l, total, totalPages: Math.ceil(total / l) });
  } catch (e) {
    res.status(500).json({ message: 'Error listing coupons' });
  }
};

exports.getCoupon = async (req, res) => {
  try {
    const c = await Coupon.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ message: 'Coupon not found' });
    res.status(200).json(c);
  } catch (e) {
    res.status(500).json({ message: 'Error fetching coupon' });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const payload = { ...req.body, code: String(req.body.code || '').toUpperCase(), createdBy: req.user.id };
    const c = await Coupon.create(payload);
    logAudit({ req, action: 'COUPON_CREATE', entityType: 'coupon', entityId: c._id, before: null, after: c.toObject(), meta: {} });
    res.status(201).json({ message: 'Coupon created', coupon: c });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ message: 'Coupon code already exists' });
    res.status(500).json({ message: 'Error creating coupon' });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const before = await Coupon.findById(req.params.id);
    if (!before) return res.status(404).json({ message: 'Coupon not found' });
    const update = { ...req.body };
    if (update.code) update.code = String(update.code).toUpperCase();
    const after = await Coupon.findByIdAndUpdate(req.params.id, update, { new: true });
    logAudit({ req, action: 'COUPON_UPDATE', entityType: 'coupon', entityId: after._id, before: before.toObject(), after: after.toObject(), meta: {} });
    res.status(200).json({ message: 'Coupon updated', coupon: after });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ message: 'Coupon code already exists' });
    res.status(500).json({ message: 'Error updating coupon' });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const before = await Coupon.findById(req.params.id);
    if (!before) return res.status(404).json({ message: 'Coupon not found' });
    await Coupon.findByIdAndDelete(req.params.id);
    logAudit({ req, action: 'COUPON_DELETE', entityType: 'coupon', entityId: before._id, before: before.toObject(), after: null, meta: {} });
    res.status(200).json({ message: 'Coupon deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Error deleting coupon' });
  }
};

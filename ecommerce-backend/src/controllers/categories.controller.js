const Category = require('../models/category.model');
const { logAudit } = require('../services/audit.service');

const slugify = (name) => String(name || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

exports.listPublic = async (req, res) => {
  try {
    const items = await Category.find().sort('name').lean();
    res.status(200).json({ data: items });
  } catch (e) {
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

exports.adminList = async (req, res) => {
  try {
    const { page = 1, limit = 50, q } = req.query;
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const filter = q ? { name: new RegExp(q, 'i') } : {};
    const [data, total] = await Promise.all([
      Category.find(filter).sort('name').skip((p-1)*l).limit(l).lean(),
      Category.countDocuments(filter),
    ]);
    res.status(200).json({ data, page: p, limit: l, total, totalPages: Math.ceil(total/l) });
  } catch (e) {
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

exports.create = async (req, res) => {
  try {
  const { name } = req.body;
    const slug = slugify(name);
  const c = await Category.create({ name, slug });
    logAudit({ req, action: 'CATEGORY_CREATE', entityType: 'category', entityId: c._id, before: null, after: c.toObject(), meta: {} });
    res.status(201).json({ message: 'Category created', category: c });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ message: 'Category already exists' });
    res.status(500).json({ message: 'Error creating category' });
  }
};

exports.update = async (req, res) => {
  try {
    const before = await Category.findById(req.params.id);
    if (!before) return res.status(404).json({ message: 'Category not found' });
  const payload = { name: req.body.name };
    if (payload.name) payload.slug = slugify(payload.name);
    const after = await Category.findByIdAndUpdate(req.params.id, payload, { new: true });
    logAudit({ req, action: 'CATEGORY_UPDATE', entityType: 'category', entityId: after._id, before: before.toObject(), after: after.toObject(), meta: {} });
    res.status(200).json({ message: 'Category updated', category: after });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ message: 'Category already exists' });
    res.status(500).json({ message: 'Error updating category' });
  }
};

exports.remove = async (req, res) => {
  try {
    const before = await Category.findById(req.params.id);
    if (!before) return res.status(404).json({ message: 'Category not found' });
    await Category.findByIdAndDelete(req.params.id);
    logAudit({ req, action: 'CATEGORY_DELETE', entityType: 'category', entityId: before._id, before: before.toObject(), after: null, meta: {} });
    res.status(200).json({ message: 'Category deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Error deleting category' });
  }
};

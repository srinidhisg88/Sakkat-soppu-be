const User = require('../models/user.model');

// GET /api/users/profile
exports.getProfile = async (req, res) => {
  try {
    // req.user is a full user doc from authenticate middleware
    const user = req.user;
    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      latitude: user.latitude ?? null,
      longitude: user.longitude ?? null,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (e) {
    return res.status(500).json({ message: 'Error fetching profile' });
  }
};

// PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'address', 'latitude', 'longitude'];
    const updates = {};
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        if (k === 'address') {
          // Build address object with defaults
          updates.address = {
            houseNo: req.body.address.houseNo || '',
            landmark: req.body.address.landmark || '',
            area: req.body.address.area || '',
            city: req.body.address.city || 'Mysore',
            state: req.body.address.state || 'Karnataka',
            pincode: req.body.address.pincode || '',
          };
        } else {
          updates[k] = req.body[k];
        }
      }
    }

    // Prevent email/role updates here
    delete updates.email;
    delete updates.role;

    const updated = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true })
      .select('-password');
    if (!updated) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      address: updated.address,
      latitude: updated.latitude ?? null,
      longitude: updated.longitude ?? null,
      role: updated.role,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    console.log(e)
    return res.status(500).json({ message: 'Error updating profile' });
  }
};

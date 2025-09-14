const cloudinary = require('cloudinary').v2;
const config = require('../config/index');
let CloudinaryStorage;
let multer;
try {
  CloudinaryStorage = require('multer-storage-cloudinary').CloudinaryStorage || require('multer-storage-cloudinary');
  multer = require('multer');
} catch (err) {
  // optional dependency might be missing in dev/test environments
  CloudinaryStorage = null;
  multer = null;
}

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

// Allowed MIME types per requirement
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const isImage = (m) => ALLOWED_IMAGE_MIME.has(String(m).toLowerCase());
const isVideo = (m) => /^video\//i.test(String(m));

let upload = null;
if (CloudinaryStorage && multer) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const mimetype = file.mimetype || '';
      if (!isImage(mimetype) && !isVideo(mimetype)) {
        // Unsupported media type: this will be handled by fileFilter too
        return { folder: 'SakkatSoppu/products/other' };
      }
      if (isImage(mimetype)) {
        return {
          folder: 'SakkatSoppu/products/images',
          resource_type: 'image',
          allowed_formats: ['jpeg', 'jpg', 'png', 'webp'],
          overwrite: false,
        };
      }
      // video
      return {
        folder: 'SakkatSoppu/products/videos',
        resource_type: 'video',
        overwrite: false,
      };
    },
  });

  // Enforce MIME allow list only; no limits on size/count for now
  const fileFilter = (req, file, cb) => {
    const ok = isImage(file.mimetype) || isVideo(file.mimetype);
    if (!ok) {
      const err = new Error('Unsupported media type');
      err.statusCode = 415;
      return cb(err, false);
    }
    cb(null, true);
  };

  upload = multer({ storage, fileFilter });
}

const uploadImage = (req, res, next) => {
  if (!upload) {
    return next(new Error('Image upload not configured. Install multer-storage-cloudinary and set CLOUDINARY_* env vars.'));
  }
  upload.single('image')(req, res, (error) => {
    if (error) return next(error);
    next();
  });
};

// helper to create multer.fields middleware for multiple file fields like images/videos
const uploadFields = (fields) => {
  
  if (!upload) {
    return (req, res, next) => next(new Error('File upload not configured. Install multer-storage-cloudinary and set CLOUDINARY_* env vars.'));
  }
  return upload.fields(fields);
};

// Helper to upload a local file path directly via cloudinary.uploader (used by controllers)
const cloudinaryUpload = async (filePath) => {
  if (!filePath) throw new Error('No file path provided');
  const result = await cloudinary.uploader.upload(filePath, { folder: 'SakkatSoppu/products/images', resource_type: 'image' });
  return result.secure_url || result.url;
};

// Best-effort deletion by public_id
const deleteAsset = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    // log only; do not throw to avoid breaking API flow
    try { console.error('Cloudinary delete failed', publicId, resourceType, e.message); } catch (_) {}
  }
};

module.exports = {
  uploadImage,
  cloudinary,
  cloudinaryUpload,
  uploadFields,
  deleteAsset,
};
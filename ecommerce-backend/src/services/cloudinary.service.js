const cloudinary = require('cloudinary').v2;
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

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let upload = null;
if (CloudinaryStorage && multer) {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
  folder: 'ecommerce',
  allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov'],
    },
  });
  upload = multer({ storage });
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
  const result = await cloudinary.uploader.upload(filePath, { folder: 'SakkatSoppu' });
  return result.secure_url || result.url;
};

module.exports = {
  uploadImage,
  cloudinary,
  cloudinaryUpload,
  uploadFields,
};
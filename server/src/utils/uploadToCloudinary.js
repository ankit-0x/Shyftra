// server/src/utils/uploadToCloudinary.js
import cloudinary from "../config/cloudinary.js";

// Cloudinary's upload_stream is callback-based; wrapping it in a Promise
// lets our route handlers use clean async/await instead.
export function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}
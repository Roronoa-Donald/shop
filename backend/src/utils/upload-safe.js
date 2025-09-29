// backend/src/utils/upload-safe.js
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pump = promisify(pipeline);

/**
 * Save a readable stream into a temporary file first, then rename atomically.
 * partStream: readable stream (ex: part.file)
 * dir: directory absolute path
 * filename: final filename (basename with extension)
 * returns absolute final path
 */
async function saveUploadedFile(partStream, dir, filename) {
  fs.mkdirSync(dir, { recursive: true });
  const tmpName = `${filename}.tmp-${Date.now()}`;
  const tmpPath = path.join(dir, tmpName);
  const finalPath = path.join(dir, filename);

  // write to tmp and await completion
  await pump(partStream, fs.createWriteStream(tmpPath));

  // ensure non-zero
  const stats = fs.statSync(tmpPath);
  if (!stats || stats.size === 0) {
    fs.unlinkSync(tmpPath);
    throw new Error('Uploaded file empty after write');
  }

  // atomic rename
  fs.renameSync(tmpPath, finalPath);
  return finalPath;
}

module.exports = { saveUploadedFile };

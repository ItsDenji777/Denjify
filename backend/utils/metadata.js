import { parseFile } from 'music-metadata';

export async function extractMetadata(filePath) {
  try {
    const metadata = await parseFile(filePath);
    const common = metadata.common;
    const format = metadata.format;

    let pictureData = null;
    let pictureFormat = null;

    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      pictureFormat = pic.format || 'image/jpeg';
      pictureData = pic.data;  // Buffer
    }

    return {
      title: common.title || null,
      artist: common.artist || null,
      album: common.album || null,
      genre: common.genre?.[0] || null,
      trackNumber: common.track?.no || null,
      discNumber: common.disk?.no || null,
      year: common.year || null,
      durationSeconds: Math.round(format.duration || 0),
      pictureData,
      pictureFormat,
    };
  } catch (err) {
    console.error(`Error reading metadata for ${filePath}:`, err.message);
    return null;
  }
}
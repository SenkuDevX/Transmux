import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import fs from 'fs';
import { logger } from '../utils/logger';
import { TEMP_DIR } from '../utils/constants';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadResult {
  publicId: string;
  secureUrl: string;
  format: string;
  bytes: number;
}

export async function uploadToCloudinary(
  filePath: string,
  options: {
    folder?: string;
    tags?: string[];
    resourceType?: 'video' | 'image' | 'raw';
    publicId?: string;
  } = {}
): Promise<UploadResult> {
  const {
    folder = 'converted-media',
    tags = ['temp', 'expires_1h'],
    resourceType = 'video',
    publicId,
  } = options;

  const timestamp = Date.now();
  const safePublicId = publicId || `job_${timestamp}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        tags: [...tags, `created_${timestamp}`],
        resource_type: resourceType,
        public_id: safePublicId,
        overwrite: true,
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error) {
          logger.error('Cloudinary upload error', error);
          reject(new Error(`Upload failed: ${error.message}`));
          return;
        }
        if (!result) {
          reject(new Error('Upload failed: no result'));
          return;
        }

        logger.info(`Uploaded to Cloudinary: ${result.secure_url}`);
        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(uploadStream);

    readStream.on('error', (err) => {
      logger.error('Read stream error during upload', err);
      reject(err);
    });
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
    });
    logger.info(`Deleted from Cloudinary: ${publicId}`, result);
  } catch (err: any) {
    logger.error(`Failed to delete ${publicId} from Cloudinary`, err);
    throw err;
  }
}

export async function deleteMultipleFromCloudinary(publicIds: string[]): Promise<void> {
  if (publicIds.length === 0) return;

  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: 'video',
    });
    logger.info(`Bulk deleted from Cloudinary: ${publicIds.length} files`, result);
  } catch (err: any) {
    logger.error('Failed to bulk delete from Cloudinary', err);
  }
}

export async function getCloudinaryResourceInfo(publicId: string): Promise<any> {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'video',
    });
    return result;
  } catch (err: any) {
    return null;
  }
}

export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export function getResourceType(format: string): 'video' | 'image' | 'raw' {
  const audioFormats = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'aiff', 'wma', 'amr'];
  const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];

  if (audioFormats.includes(format.toLowerCase())) return 'raw';
  if (imageFormats.includes(format.toLowerCase())) return 'image';
  return 'video';
}

export function cleanTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Cleaned temp file: ${filePath}`);
    }
  } catch (err) {
    logger.error(`Failed to clean temp file: ${filePath}`, err);
  }
}

export function cleanAllTempFiles(): void {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;

    const files = fs.readdirSync(TEMP_DIR);
    let cleaned = 0;

    for (const file of files) {
      const filePath = `${TEMP_DIR}/${file}`;
      try {
        fs.unlinkSync(filePath);
        cleaned++;
      } catch {
        // ignore individual file errors
      }
    }

    logger.info(`Cleaned ${cleaned} temp files`);
  } catch (err) {
    logger.error('Failed to clean temp files', err);
  }
}
import { BadRequestException } from '@nestjs/common';
import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import { constants } from 'fs';
import * as fs from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import sharp, { type OutputInfo } from 'sharp';
import { promisify } from 'util';

const execPromise = promisify(exec);

/** Used by {@link compressImage} output; propagated into Prisma from {@link FileService.create}. */
export type MulterImageDimensions = Express.Multer.File & {
  image_width?: number;
  image_height?: number;
};

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/heic',
  'image/heif',
  'image/png',
  'image/webp',
  'video/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/webm',
]);

const MAX_IMG_WIDTH = 3000;
const MAX_IMG_HEIGHT = 3000;

/** `failOn: 'none'` tolerates malformed EXIF / truncated metadata some mobile exports produce. */
function resizeInsideBox(file_path: string) {
  return sharp(file_path, { failOn: 'none' })
    .rotate()
    .resize(MAX_IMG_WIDTH, MAX_IMG_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    });
}

export function assignImageOutputMeta(
  file: Express.Multer.File,
  output: Buffer,
  info: OutputInfo,
) {
  file.size = output.length;
  const enriched = file as MulterImageDimensions;
  enriched.image_width = info.width;
  enriched.image_height = info.height;
}

export function fileNameFormatter(
  req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, filename: string) => void,
) {
  const name = file.originalname.split('.')[0];
  const extension = extname(file.originalname);
  const randomName = Array(32)
    .fill(null)
    .map(() => Math.round(Math.random() * 16).toString(16))
    .join('');
  cb(null, `${name}-${randomName}${extension}`);
}

export function fileFilter(
  req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(
      new BadRequestException(
        `Unsupported file type. Allowed types are: ${Array.from(
          allowedMimeTypes,
        ).join(', ')}`,
      ),
      false,
    );
  }
  cb(null, true);
}

export async function compressFiles(
  files: Array<Express.Multer.File>,
): Promise<Array<Express.Multer.File>> {
  await Promise.all(files.map(compressFile));
  return files;
}

export async function compressFile(file: Express.Multer.File) {
  if (file.mimetype.startsWith('image/')) {
    await compressImage(file);
  } else if (file.mimetype.startsWith('video/')) {
    // await compressVideo(file);
  } else if (file.mimetype.startsWith('audio/')) {
    await saveAudio(file);
  }
}

export async function compressImage(file: Express.Multer.File) {
  await fs.access(file.path);

  const subtype = file.mimetype.split('/')[1]?.toLowerCase() ?? '';

  try {
    let result: { data: Buffer; info: OutputInfo };

    if (subtype === 'heic' || subtype === 'heif') {
      result = await resizeInsideBox(file.path)
        .jpeg({ mozjpeg: true, quality: 80 })
        .toBuffer({ resolveWithObject: true });

      const dir = dirname(file.path);
      const stem = basename(file.filename, extname(file.filename));
      const new_filename = `${stem}.jpg`;
      const new_path = join(dir, new_filename);

      await fs.unlink(file.path);
      await fs.writeFile(new_path, result.data);

      file.path = new_path;
      file.filename = new_filename;
      file.mimetype = 'image/jpeg';
      assignImageOutputMeta(file, result.data, result.info);
      return;
    }

    switch (subtype) {
      case 'jpeg':
      case 'jpg':
        result = await resizeInsideBox(file.path)
          .jpeg({ quality: 80 })
          .toBuffer({ resolveWithObject: true });
        break;
      case 'png':
        result = await resizeInsideBox(file.path)
          .png({ compressionLevel: 9 })
          .toBuffer({ resolveWithObject: true });
        break;
      case 'webp':
        result = await resizeInsideBox(file.path)
          .webp({ quality: 80 })
          .toBuffer({ resolveWithObject: true });
        break;
      default:
        throw new BadRequestException(
          `Unsupported image format for compression: ${subtype}`,
        );
    }

    await fs.writeFile(file.path, result.data);
    assignImageOutputMeta(file, result.data, result.info);
  } catch (err) {
    if (err instanceof BadRequestException) throw err;

    console.error(`Error compressing image ${file.originalname}:`, err);
    throw new BadRequestException(
      `Could not process this image (${file.originalname}). It may be corrupt or use an unsupported encoding.`,
    );
  }
}

export async function compressVideo(file: Express.Multer.File) {
  const uniqueId = randomUUID();
  const outputPath = `${file.path}_${uniqueId}_compressed.mp4`;
  try {
    const command = `ffmpeg -i "${file.path}" -vcodec libx264 -crf 28 -preset veryfast -movflags +faststart "${outputPath}"`;
    await execPromise(command); // Execute FFmpeg
    await fs.unlink(file.path);
    await fs.rename(outputPath, file.path);

    const fileExtension = extname(file.originalname);
    const newFileName = `${file.originalname.split('.')[0]}_${uniqueId}${fileExtension}`;

    file.path = join(dirname(file.path), newFileName);
    file.filename = newFileName;

    console.log(`Compressed video: ${file.originalname}`);
  } catch (error) {
    console.error(`Error compressing video ${file.originalname}:`, error);

    if (error instanceof Error && (error as any).stderr) {
      console.error('FFmpeg stderr:', (error as any).stderr);
    }
    await fs.access(outputPath, constants.F_OK);
    await fs.unlink(outputPath);
  }
}

export async function saveAudio(file: Express.Multer.File) {
  // Renamed function
  try {
    const uniqueId = randomUUID();
    const fileExtension = extname(file.originalname);
    const newFileName = `${file.originalname.split('.')[0]}_${uniqueId}${fileExtension}`;
    const newFilePath = join(dirname(file.path), newFileName);

    await fs.rename(file.path, newFilePath); // Move/Rename the file

    // Update the file object
    file.path = newFilePath;
    file.filename = newFileName;

    console.log(`Saved audio: ${file.originalname} as ${newFileName}`);
  } catch (error) {
    console.error(`Error saving audio ${file.originalname}:`, error);
    throw error; // Re-throw for proper error handling in calling functions
  }
}

export async function compressAudio(file: Express.Multer.File) {
  const old_file_name = file.filename;
  const unique_id = randomUUID();
  const output_path = `${file.path}_${unique_id}_compressed.mp3`;

  try {
    // const command = `ffmpeg -i "${file.path}" -vn -ar 44100 -ab 128k -c:a libmp3lame "${output_path}"`;
    // await execPromise(command);

    await fs.unlink(file.path);
    await fs.rename(output_path, file.path);

    file.path = join(dirname(file.path), old_file_name);
    file.filename = old_file_name;

    console.log(`Compressed audio: ${file.originalname}`);
  } catch (error) {
    console.error(`Error compressing audio ${file.originalname}:`, error);
    if (error instanceof Error && (error as any).stderr) {
      console.error('FFmpeg stderr:', (error as any).stderr);
    }

    await fs.access(output_path, constants.F_OK);
    await fs.unlink(output_path);
  }
}

import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import { constants } from 'fs';
import * as fs from 'fs/promises';
import { dirname, extname, join } from 'path';
import sharp from 'sharp';
import { promisify } from 'util';

const execPromise = promisify(exec);

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
  try {
    let compressedImageBuffer: Buffer;

    const format = file.mimetype.split('/')[1]?.toLowerCase();
    const image = sharp(file.path);
    const metadata = await image.metadata();

    const maxWidth = 3000;
    const maxHeight = 3000;
    let width = metadata.width;
    let height = metadata.height;

    if (width > maxWidth || height > maxHeight) {
      if (width > height) {
        height = Math.round((maxHeight / maxWidth) * width);
        width = maxWidth;
      } else {
        width = Math.round((maxWidth / maxHeight) * height);
        height = maxHeight;
      }
    }

    switch (format) {
      case 'jpeg':
      case 'jpg':
        compressedImageBuffer = await image
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();
        break;
      case 'png':
        compressedImageBuffer = await image
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 9 })
          .toBuffer();
        break;
      case 'webp':
        compressedImageBuffer = await image
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toBuffer();
        break;

      default:
        console.warn(
          `Unsupported image format ${format} for compression. Skipping compression for ${file.originalname}`,
        );
        return;
    }

    await fs.writeFile(file.path, compressedImageBuffer);
  } catch (error) {
    console.error(`Error compressing image ${file.originalname}:`, error);
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

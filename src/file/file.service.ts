import {
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { File as FileModel, FileType, Prisma, Status } from '@prisma/client';
import { constants, createReadStream } from 'fs';
import * as fs from 'fs/promises';
import { join } from 'path';
import { UserService } from 'src/user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFileDto } from './dto/update-file.dto';

@Injectable()
export class FileService {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

  private readonly logger = new Logger();

  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async handleCron() {
    this.logger.log('remove orphaned files every day at 11pm');

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);

    const pendingFiles = await this.prisma.file.findMany({
      where: {
        status: Status.PENDING,
        created_at: {
          lt: twentyFourHoursAgo,
        },
      },
    });
    await this.deleteFilesAndRecords(pendingFiles);
  }

  private async deleteFilesAndRecords(files: Array<FileModel>) {
    for (const file of files) {
      try {
        await fs.unlink(file.path);
        console.log(`File deleted from storage: ${file.path}`);

        // 2. Delete (or update) the database record
        await this.prisma.file.update({
          where: { id: file.id, status: Status.PENDING },
          data: { status: Status.DELETED },
        });
      } catch (error) {
        console.error(`Error deleting file ${file.path}:`, error);
      }
    }
  }

  private mimeToFileType(mimetype: string): FileType {
    const type = mimetype.split('/')[0].toUpperCase();
    switch (type) {
      case 'IMAGE':
        return FileType.IMAGE;
      case 'VIDEO':
        return FileType.VIDEO;
      case 'AUDIO':
        return FileType.AUDIO;
      case 'TEXT':
      case 'APPLICATION':
        return FileType.DOCUMENT;
      default:
        return FileType.DOCUMENT;
    }
  }

  async create(
    files: Array<Express.Multer.File>,
    email: string,
    folder: string,
  ): Promise<string[]> {
    const user = await this.userService.findUser(email);
    const saved_files: string[] = [];

    for (const file of files) {
      const savedFile = await this.prisma.file.create({
        data: {
          filename: file.filename,
          originalname: file.originalname,
          path: join(process.env.FILE_BASE_URL, folder, file.filename),
          url: join(process.env.FILE_BASE_URL, folder, file.filename),
          mimetype: file.mimetype,
          size: file.size,
          status: Status.PENDING,
          type: this.mimeToFileType(file.mimetype),
          owner: {
            connect: { id: user.id },
          },
        } as Prisma.FileCreateInput,
      });
      saved_files.push(savedFile.id);
    }

    return saved_files;
  }

  async getFilesUrls(
    fileIds: string[],
  ): Promise<{ url: string; type: string }[]> {
    return await Promise.all(
      fileIds.map(async (fileId) => {
        const file = await this.prisma.file.findUnique({
          where: {
            id: fileId,
            status: { in: [Status.PENDING, Status.UPLOADED] },
          },
        });

        if (!file) {
          throw new NotFoundException('File not found');
        }

        return { url: file.url, type: file.type };
      }),
    );
  }

  async markFileAsUploaded(fileIds: string[]) {
    return Promise.all(
      fileIds.map(async (fileId) => {
        const file = await this.prisma.file.update({
          where: { id: fileId },
          data: { status: Status.UPLOADED },
        });

        if (!file) {
          throw new NotFoundException('File not found');
        }

        return file.status;
      }),
    );
  }

  async streamStaticFile(path: string): Promise<StreamableFile> {
    const public_path = join(__dirname, '..', '..', '..', path);
    console.log(public_path);
    try {
      await fs.access(public_path, constants.F_OK);

      const stream = createReadStream(public_path);
      return new StreamableFile(stream);
    } catch {
      throw new NotFoundException('file not found ');
    }
  }

  findAll() {
    return `This action returns all file`;
  }

  findOne(id: string) {
    return `This action returns a #${id} file`;
  }

  update(id: string, updateFileDto: UpdateFileDto) {
    return `This action updates a #${id} file ${updateFileDto}`;
  }

  remove(id: string) {
    return `This action removes a #${id} file`;
  }
}

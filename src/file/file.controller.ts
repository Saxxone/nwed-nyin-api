import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { DictionaryService } from 'src/dictionary/dictionary.service';
import { UpdateFileDto } from './dto/update-file.dto';
import { compressFiles, fileNameFormatter, fileFilter } from './file.manager';
import { FileService } from './file.service';
import { join } from 'path';

const pronunciation_destination = join(
  __dirname,
  '../../../',
  'public/pronunciations',
);
const destination = join(__dirname, '../../../', 'public/files');

fs.mkdirSync(destination, { recursive: true });

const pronunciation_storage = diskStorage({
  destination: pronunciation_destination,
  filename: fileNameFormatter,
});

const file_storage = diskStorage({
  destination,
  filename: fileNameFormatter,
});

const FILE_SIZE_LIMIT = 1024 * 1024; // 1MB
const FILE_COUNT_LIMIT = 1;

@Controller('file')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly dictionaryService: DictionaryService,
  ) {}

  @UseInterceptors(
    AnyFilesInterceptor({
      storage: file_storage,
      limits: {
        fileSize: FILE_SIZE_LIMIT,
        files: FILE_COUNT_LIMIT,
      },
      fileFilter: fileFilter,
    }),
  )
  @Post('upload')
  async uploadFile(@Request() req: any) {
    let files: Array<Express.Multer.File> = [];
    let compressed_files: Array<Express.Multer.File> = [];

    if (req.files) {
      files = req.files;
    }

    if (files.length === 0) throw new BadRequestException('No files found.');

    compressed_files = await compressFiles(files);

    return await this.fileService.create(
      compressed_files,
      req.user.sub,
      'files',
    );
  }

  @UseInterceptors(
    AnyFilesInterceptor({
      storage: pronunciation_storage,
      limits: {
        fileSize: FILE_SIZE_LIMIT,
        files: FILE_COUNT_LIMIT,
      },
      fileFilter: fileFilter,
    }),
  )
  @Post('upload-sound/:id')
  async uploadSound(@Request() req: any, @Param('id') id: string) {
    let files: Array<Express.Multer.File> = [];

    if (req.files) {
      files = req.files;
    }
    if (files.length === 0) throw new BadRequestException('No files found.');

    const compressed_files = await compressFiles(files);
    return await this.dictionaryService.updateWordPronunciation(
      id,
      [
        {
          ...compressed_files[0],
          filename: req.files[0].filename,
          originalname: req.files[0].originalname,
        },
      ],
      req.user.sub,
    );
  }

  @Get()
  findAll() {
    return this.fileService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fileService.findOne(id);
  }

  @Post('file-urls')
  getFileUrls(@Body() body: string[]) {
    return this.fileService.getFilesUrls(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFileDto: UpdateFileDto) {
    return this.fileService.update(id, updateFileDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fileService.remove(id);
  }
}

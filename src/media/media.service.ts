import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaCategory, Media, Prisma } from '@prisma/client';
import { FileValidatorService } from './services/file-validator.service';
import { PathGeneratorService } from './services/path-generator.service';
import { STORAGE_PROVIDER } from './providers/storage.interface';
import type { StorageProvider } from './providers/storage.interface';
import { UploadedFile } from './types/uploaded-file.type';
import { ConfigService } from '@nestjs/config';

// DTOs
export interface UploadFileDto {
  alt?: string;
  folder?: string;
  productId?: string;
}

export interface MediaResponse {
  id: string;
  url: string;
  thumbnailUrl?: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  category: MediaCategory;
  width?: number;
  height?: number;
  alt?: string;
  createdAt: Date;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly thumbnailWidth: number;

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly prisma: PrismaService,
    private readonly validator: FileValidatorService,
    private readonly pathGenerator: PathGeneratorService,
    private readonly config: ConfigService,
  ) {
    this.thumbnailWidth = this.config.get<number>('media.THUMBNAIL_WIDTH', 300);
  }

  // ============================================================
  // UPLOAD
  // ============================================================

  async uploadSingle(
    file: UploadedFile,
    userId: string,
    dto?: UploadFileDto,
  ): Promise<MediaResponse> {
    this.logger.log(`Uploading: ${file.originalname} (${file.size} bytes)`);

    // Validate
    this.validator.validate(file);

    // Extract metadata (images only)
    const metadata = this.extractMetadata(file);

    // Generate unique path
    const category = this.mapMimeToCategory(file.mimetype);
    const key = this.pathGenerator.generate(file.originalname, {
      category: this.toPathCategory(category),
      folder: dto?.folder,
    });

    // Upload to storage
    const result = await this.storage.upload(file.buffer, key, file.mimetype);

    // Save to database
    const media = await this.prisma.media.create({
      data: {
        uploaderId: userId,
        filename: result.key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        extension: this.getExtension(file.originalname),
        size: file.size,
        category,
        url: result.url,
        alt: dto?.alt,
        folder: dto?.folder,
        width: metadata?.width,
        height: metadata?.height,
        aspectRatio: metadata?.aspectRatio,
        productId: dto?.productId,
      },
    });

    // Generate thumbnail async for images
    if (category === MediaCategory.IMAGE) {
      this.generateThumbnail(media);
    }

    this.logger.log(`Created media record: ${media.id}`);

    return this.toResponse(media);
  }

  async uploadMultiple(
    files: UploadedFile[],
    userId: string,
    dto?: UploadFileDto,
  ): Promise<MediaResponse[]> {
    this.logger.log(`Batch uploading ${files.length} files`);

    // Validate all first
    this.validator.validateMany(files);

    // Process sequentially to avoid DB conflicts, or use Promise.all with unique keys
    const results: MediaResponse[] = [];
    for (const file of files) {
      const result = await this.uploadSingle(file, userId, dto);
      results.push(result);
    }

    return results;
  }

  // ============================================================
  // READ
  // ============================================================

  async findById(id: string, requesterId?: string): Promise<MediaResponse> {
    const media = await this.prisma.media.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!media) throw new NotFoundException(`Media not found: ${id}`);
    if (requesterId && media.uploaderId !== requesterId) {
      throw new ForbiddenException('Access denied');
    }

    return this.toResponse(media);
  }

  async findByUser(
    userId: string,
    options?: {
      category?: MediaCategory;
      folder?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: MediaResponse[]; meta: any }> {
    const { category, folder, page = 1, limit = 20 } = options || {};
    const skip = (page - 1) * limit;

    const where = {
      uploaderId: userId,
      isDeleted: false,
      ...(category && { category }),
      ...(folder && { folder }),
    };

    const [data, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      data: data.map((m) => this.toResponse(m)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByProduct(productId: string): Promise<MediaResponse[]> {
    const media = await this.prisma.media.findMany({
      where: {
        productId,
        isDeleted: false,
        category: MediaCategory.IMAGE, // Usually only images for products
      },
      orderBy: { createdAt: 'asc' },
    });

    return media.map((m) => this.toResponse(m));
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(
    id: string,
    userId: string,
    updates: {
      alt?: string;
      title?: string;
      folder?: string;
      file?: UploadedFile;
    },
  ): Promise<MediaResponse> {
    const media = await this.prisma.media.findFirst({
      where: { id, isDeleted: false },
    });

    if (!media) throw new NotFoundException(`Media not found: ${id}`);
    if (media.uploaderId !== userId)
      throw new ForbiddenException('Access denied');

    const updateData: Prisma.MediaUpdateInput = {};

    // Replace file if provided
    if (updates.file) {
      this.validator.validate(updates.file);

      // Delete old from storage
      await this.storage.delete(media.filename).catch((err) => {
        this.logger.warn(`Failed to delete old file: ${media.filename}`, err);
      });

      // Upload new
      const category = this.mapMimeToCategory(updates.file.mimetype);
      const key = this.pathGenerator.generate(updates.file.originalname, {
        category: this.toPathCategory(category),
        folder: updates.folder || media.folder || undefined,
      });

      const result = await this.storage.upload(
        updates.file.buffer,
        key,
        updates.file.mimetype,
      );

      const metadata = this.extractMetadata(updates.file);

      Object.assign(updateData, {
        filename: result.key,
        originalName: updates.file.originalname,
        mimeType: updates.file.mimetype,
        extension: this.getExtension(updates.file.originalname),
        size: updates.file.size,
        category,
        url: result.url,
        width: metadata?.width,
        height: metadata?.height,
        aspectRatio: metadata?.aspectRatio,
      });
    }

    // Metadata updates
    if (updates.alt !== undefined) updateData.alt = updates.alt;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.folder !== undefined) updateData.folder = updates.folder;

    const updated = await this.prisma.media.update({
      where: { id },
      data: updateData,
    });

    return this.toResponse(updated);
  }

  // ============================================================
  // DELETE
  // ============================================================

  async delete(id: string, userId: string, permanent = false): Promise<void> {
    const media = await this.prisma.media.findFirst({
      where: { id, isDeleted: false },
    });

    if (!media) throw new NotFoundException(`Media not found: ${id}`);
    if (media.uploaderId !== userId)
      throw new ForbiddenException('Access denied');

    if (permanent) {
      // Hard delete: remove from storage + DB
      await this.storage.delete(media.filename).catch((err) => {
        this.logger.error(
          `Failed to delete from storage: ${media.filename}`,
          err,
        );
      });

      await this.prisma.media.delete({ where: { id } });
      this.logger.log(`Permanently deleted: ${id}`);
    } else {
      // Soft delete
      await this.prisma.media.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
      this.logger.log(`Soft deleted: ${id}`);
    }
  }

  async cleanupDeleted(daysOld = 30): Promise<{ deleted: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const oldDeleted = await this.prisma.media.findMany({
      where: {
        isDeleted: true,
        deletedAt: { lt: cutoff },
      },
    });

    for (const media of oldDeleted) {
      await this.storage.delete(media.filename).catch(() => null);
    }

    const result = await this.prisma.media.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: { lt: cutoff },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old media records`);

    return { deleted: result.count };
  }

  async deleteMany(
    ids: string[],
    userId: string,
  ): Promise<{ deleted: number }> {
    const mediaList = await this.prisma.media.findMany({
      where: {
        id: { in: ids },
        uploaderId: userId,
        isDeleted: false,
      },
    });

    if (mediaList.length === 0) {
      return { deleted: 0 };
    }

    const result = await this.prisma.media.updateMany({
      where: { id: { in: mediaList.map((m) => m.id) } },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Bulk soft deleted: ${result.count} media items`);

    return { deleted: result.count };
  }

  // ============================================================
  // URL OPERATIONS
  // ============================================================

  async getSignedUrl(id: string, expiresIn = 3600): Promise<string> {
    const media = await this.prisma.media.findFirst({
      where: { id, isDeleted: false },
    });

    if (!media) throw new NotFoundException(`Media not found: ${id}`);

    return this.storage.getSignedUrl(media.filename, expiresIn);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private extractMetadata(
    file: UploadedFile,
  ): { width: number; height: number; aspectRatio: number } | null {
    if (!file.mimetype.startsWith('image/')) return null;
    return null;
  }

  private generateThumbnail(media: Media): void {
    // Implementation depends on your setup - could use Sharp, Lambda, or CDN transforms
    // For now, just log that it should happen
    this.logger.debug(`Should generate thumbnail for ${media.id}`);
  }

  private mapMimeToCategory(mimeType: string): MediaCategory {
    if (mimeType.startsWith('image/')) return MediaCategory.IMAGE;
    if (mimeType.startsWith('video/')) return MediaCategory.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaCategory.AUDIO;
    if (
      [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument',
      ].some((t) => mimeType.includes(t))
    ) {
      return MediaCategory.DOCUMENT;
    }
    if (
      [
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
      ].includes(mimeType)
    ) {
      return MediaCategory.ARCHIVE;
    }
    return MediaCategory.OTHER;
  }

  private toPathCategory(
    category: MediaCategory,
  ): 'image' | 'video' | 'document' {
    if (category === MediaCategory.IMAGE) return 'image';
    if (category === MediaCategory.VIDEO) return 'video';
    return 'document';
  }

  private getExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  private toResponse(media: Media): MediaResponse {
    return {
      id: media.id,
      url: media.url,
      thumbnailUrl:
        media.category === MediaCategory.IMAGE
          ? `${media.url}?w=${this.thumbnailWidth}`
          : undefined,
      filename: media.filename,
      originalName: media.originalName,
      size: media.size,
      mimeType: media.mimeType,
      category: media.category,
      width: media.width || undefined,
      height: media.height || undefined,
      alt: media.alt || undefined,
      createdAt: media.createdAt,
    };
  }
}

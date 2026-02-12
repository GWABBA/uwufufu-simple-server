import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

import * as sharp from 'sharp';
import pLimit from 'p-limit';
import ffmpegStatic from 'ffmpeg-static';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';

type Converted =
  | { buffer: Buffer; contentType: 'image/webp'; ext: 'webp' }
  | { buffer: Buffer; contentType: 'video/webm'; ext: 'webm' };

// ✅ sharp import 꼬임(ESM/CJS) 대비: 런타임/타입 모두 안전한 함수 레퍼런스
const sharpFn: any = (sharp as any).default ?? (sharp as any);

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private endpoint: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private imageUrl: string;

  // ✅ 변환 동시성 제한 (로컬/라이브에서 CPU 폭주 방지)
  private readonly convertLimit = pLimit(1);

  // ✅ ffmpeg 경로: ffmpeg-static 있으면 쓰고, 없으면 시스템 ffmpeg (로컬 brew / 우분투 apt)
  private readonly ffmpegBin = ffmpegStatic || 'ffmpeg';

  // ✅ 변환 타임아웃 (너무 긴 gif 방지)
  private readonly ffmpegTimeoutMs = 10_000;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('r2.bucketName');
    this.imageUrl = this.configService.get<string>('r2.url');
    this.endpoint = this.configService.get<string>('r2.endpoint');
    this.accessKeyId = this.configService.get<string>('r2.accessKeyId');
    this.secretAccessKey = this.configService.get<string>('r2.secretAccessKey');

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: 'auto',
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ url: string; fileName: string; key: string }> {
    const safeFilename = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '');

    // ✅ 변환은 큐로 처리 (동시 1)
    const converted = await this.convertLimit(() =>
      this.convertToOptimizedFormat(file),
    );

    // 확장자는 변환 결과 기준으로 저장
    const baseName = safeFilename.replace(/\.[^.]+$/, '');
    const finalFileName = `${baseName}.${converted.ext}`;

    const safeFolder = folder.replace(/[\b\t\r\n\f]/g, '').trim();
    const key = `${safeFolder}/${Date.now()}-${finalFileName}`;

    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: converted.buffer,
      ContentType: converted.contentType,
      ACL: ObjectCannedACL.public_read,
    };

    try {
      await this.s3Client.send(new PutObjectCommand(params));
      return {
        url: `${this.imageUrl}/${key}`,
        fileName: finalFileName,
        key,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }

  private async convertToOptimizedFormat(
    file: Express.Multer.File,
  ): Promise<Converted> {
    const mime = (file.mimetype || '').toLowerCase();

    // --- GIF 처리 ---
    if (mime === 'image/gif') {
      // animated: true로 메타 읽으면 pages가 잡힘
      const meta = await sharpFn(file.buffer, { animated: true }).metadata();
      const isAnimated = (meta.pages ?? 1) > 1;

      if (isAnimated) {
        // ✅ 1) 애니 GIF -> WebM 시도
        try {
          const webm = await this.gifToWebm(file.buffer);
          return { buffer: webm, contentType: 'video/webm', ext: 'webm' };
        } catch (err) {
          // ✅ 2) 실패하면 안전하게 animated webp로 fallback (로컬 테스트/라이브 모두 안정)
          console.warn('[gifToWebm] failed, fallback to animated webp:', err);

          const webpAnimated = await sharpFn(file.buffer, { animated: true })
            .webp({ quality: 80 })
            .toBuffer();

          return {
            buffer: webpAnimated,
            contentType: 'image/webp',
            ext: 'webp',
          };
        }
      }

      // 정적 GIF -> WebP
      const webp = await sharpFn(file.buffer).webp({ quality: 80 }).toBuffer();
      return { buffer: webp, contentType: 'image/webp', ext: 'webp' };
    }

    // --- jpg/jpeg/png/webp -> webp ---
    const webp = await sharpFn(file.buffer, { animated: true })
      .webp({ quality: 80 })
      .toBuffer();

    return { buffer: webp, contentType: 'image/webp', ext: 'webp' };
  }

  private async gifToWebm(gifBuffer: Buffer): Promise<Buffer> {
    const tmpDir = os.tmpdir();
    const rand = Math.random().toString(16).slice(2);
    const inputPath = path.join(tmpDir, `upload-${Date.now()}-${rand}.gif`);
    const outputPath = path.join(tmpDir, `upload-${Date.now()}-${rand}.webm`);

    await fs.writeFile(inputPath, gifBuffer);

    let timeout: NodeJS.Timeout | null = null;

    try {
      await new Promise<void>((resolve, reject) => {
        // vp9: 용량 효율 좋음 / -an 무음 / fps 30 제한 / 짝수 픽셀로 맞춤
        const args = [
          '-y',
          '-i',
          inputPath,
          '-an',
          '-c:v',
          'libvpx-vp9',
          '-b:v',
          '0',
          '-crf',
          '35',
          '-vf',
          'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30',
          outputPath,
        ];

        const p = spawn(this.ffmpegBin, args, {
          stdio: ['ignore', 'ignore', 'pipe'],
        });

        let stderr = '';
        p.stderr?.on('data', (d) => (stderr += d.toString()));

        timeout = setTimeout(() => {
          p.kill('SIGKILL');
          reject(new Error(`ffmpeg timeout after ${this.ffmpegTimeoutMs}ms`));
        }, this.ffmpegTimeoutMs);

        p.on('error', reject);
        p.on('close', (code) => {
          if (timeout) clearTimeout(timeout);

          if (code === 0) return resolve();
          reject(
            new Error(
              `ffmpeg failed with code ${code}: ${stderr.slice(-1200)}`,
            ),
          );
        });
      });

      return await fs.readFile(outputPath);
    } finally {
      if (timeout) clearTimeout(timeout);
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  }
}

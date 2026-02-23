// s3.service.ts
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
import { createReadStream } from 'fs';

type ConvertedPath =
  | {
      outPath: string;
      contentType: 'image/webp';
      ext: 'webp';
      isVideo: false;
    }
  | {
      outPath: string;
      contentType: 'video/webm';
      ext: 'webm';
      isVideo: true;
    };

// sharp import 꼬임(ESM/CJS) 대비
const sharpFn: any = (sharp as any).default ?? (sharp as any);

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private endpoint: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private imageUrl: string;

  // ✅ 변환 동시성 제한 (CPU/메모리 폭주 방지)
  private readonly convertLimit = pLimit(1);

  // ✅ ffmpeg 경로
  private readonly ffmpegBin = ffmpegStatic || 'ffmpeg';

  // ✅ 변환 타임아웃 (긴 gif 방지)
  private readonly ffmpegTimeoutMs = 10_000;

  // ✅ (선택) 최대 픽셀 제한: 너무 큰 이미지로 서버 터지는 걸 방지
  private readonly limitInputPixels = 4096 * 4096; // 필요하면 조정
  private readonly maxResize = 2048; // 필요하면 조정 (가로/세로 최대)

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

    // ✅ sharp 메모리/동시성 제어
    try {
      sharpFn.cache(false); // 캐시 끄면 폭주 줄어듦 (원하면 cache({memory: ...})로 제한 가능)
      sharpFn.concurrency(1);
    } catch {
      // ignore
    }
  }

  async uploadFileFromPath(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ url: string; fileName: string; key: string; isVideo: boolean }> {
    const safeFilename = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '');

    // ✅ 변환은 큐로 처리
    const converted = await this.convertLimit(() =>
      this.convertToOptimizedFormatFromPath(file.path, file.mimetype),
    );

    // 확장자는 변환 결과 기준으로 저장
    const baseName = safeFilename.replace(/\.[^.]+$/, '');
    const finalFileName = `${baseName}.${converted.ext}`;

    const safeFolder = this.sanitizeFolder(folder);
    const key = `${safeFolder}/${Date.now()}-${finalFileName}`;

    // ✅ RAM에 Buffer로 올리지 않고, 파일 스트림으로 바로 업로드
    const bodyStream = createReadStream(converted.outPath);

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: bodyStream as any,
          ContentType: converted.contentType,
          ACL: ObjectCannedACL.public_read,
        }),
      );

      return {
        url: `${this.imageUrl}/${key}`,
        fileName: finalFileName,
        key,
        isVideo: converted.isVideo,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    } finally {
      // ✅ 스트림 명시적 정리 (안전성 향상)
      bodyStream.destroy();

      // ✅ 변환 결과 tmp 파일 삭제
      await fs.unlink(converted.outPath).catch(() => {});
    }
  }

  private sanitizeFolder(folder: string): string {
    // 폴더명에 위험문자 제거 + 슬래시/대시/언더스코어 정도만 남기기
    const trimmed = (folder ?? '').trim();
    const safe = trimmed.replace(/[^a-zA-Z0-9/_-]/g, '');
    return safe || 'uploads';
  }

  private async convertToOptimizedFormatFromPath(
    inputPath: string,
    mimetype: string,
  ): Promise<ConvertedPath> {
    const mime = (mimetype || '').toLowerCase();

    // output tmp path
    const tmpDir = os.tmpdir();
    const rand = Math.random().toString(16).slice(2);

    // --- GIF 처리 ---
    if (mime === 'image/gif') {
      // animated: true로 메타 읽으면 pages가 잡힘
      const meta = await sharpFn(inputPath, {
        animated: true,
        limitInputPixels: this.limitInputPixels,
      }).metadata();

      const isAnimated = (meta.pages ?? 1) > 1;

      if (isAnimated) {
        // ✅ 1) 애니 GIF -> WebM 시도 (output은 파일로 생성)
        const webmOut = path.join(tmpDir, `upload-${Date.now()}-${rand}.webm`);
        try {
          await this.gifPathToWebmFile(inputPath, webmOut);
          return {
            outPath: webmOut,
            contentType: 'video/webm',
            ext: 'webm',
            isVideo: true,
          };
        } catch (err) {
          // ✅ 2) 실패하면 animated webp로 fallback (파일로 생성)
          console.warn('[gifToWebm] failed, fallback to animated webp:', err);

          const webpOut = path.join(
            tmpDir,
            `upload-${Date.now()}-${rand}.webp`,
          );

          await sharpFn(inputPath, {
            animated: true,
            limitInputPixels: this.limitInputPixels,
          })
            .resize({
              width: this.maxResize,
              height: this.maxResize,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: 80 })
            .toFile(webpOut);

          return {
            outPath: webpOut,
            contentType: 'image/webp',
            ext: 'webp',
            isVideo: false,
          };
        }
      }

      // 정적 GIF -> WebP (파일로)
      const webpOut = path.join(tmpDir, `upload-${Date.now()}-${rand}.webp`);

      await sharpFn(inputPath, { limitInputPixels: this.limitInputPixels })
        .resize({
          width: this.maxResize,
          height: this.maxResize,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(webpOut);

      return {
        outPath: webpOut,
        contentType: 'image/webp',
        ext: 'webp',
        isVideo: false,
      };
    }

    // --- jpg/jpeg/png/webp -> webp (파일로) ---
    const webpOut = path.join(tmpDir, `upload-${Date.now()}-${rand}.webp`);

    await sharpFn(inputPath, {
      animated: true, // webp 애니 입력이 들어올 수도 있어서
      limitInputPixels: this.limitInputPixels,
    })
      .resize({
        width: this.maxResize,
        height: this.maxResize,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(webpOut);

    return {
      outPath: webpOut,
      contentType: 'image/webp',
      ext: 'webp',
      isVideo: false,
    };
  }

  private async gifPathToWebmFile(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    let timeout: NodeJS.Timeout | null = null;

    await new Promise<void>((resolve, reject) => {
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
          new Error(`ffmpeg failed with code ${code}: ${stderr.slice(-1200)}`),
        );
      });
    });

    if (timeout) clearTimeout(timeout);
  }
}

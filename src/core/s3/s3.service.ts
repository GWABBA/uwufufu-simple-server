import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private endpoint: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private imageUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('r2.bucketName');
    this.imageUrl = this.configService.get<string>('r2.url');
    this.endpoint = this.configService.get<string>('r2.endpoint');
    this.accessKeyId = this.configService.get<string>('r2.accessKeyId');
    this.secretAccessKey = this.configService.get<string>('r2.secretAccessKey');

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: 'auto', // R2 does not require a specific region
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
    const key = `${folder.replace(/[\b\t\r\n\f]/g, '').trim()}/${Date.now()}-${path.basename(file.originalname)}`;

    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: ObjectCannedACL.public_read,
    };

    try {
      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);
      return {
        url: `${this.imageUrl}/${key}`,
        fileName: file.originalname,
        key,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }
}

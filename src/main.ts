import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ValidationPipe } from '@nestjs/common';

import * as express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';

import * as AWSXRay from 'aws-xray-sdk-core';
import * as AWSXRayExpress from 'aws-xray-sdk-express';
import * as http from 'http';
import * as https from 'https';

async function bootstrap() {
  // 1. Create raw Express app
  const rawExpressApp = express();

  // 2. Patch HTTP/HTTPS
  AWSXRay.captureHTTPsGlobal(http);
  AWSXRay.captureHTTPsGlobal(https);

  // ❗️DON'T call capturePromise() unless doing manual subsegments
  // AWSXRay.capturePromise(); // <- removed to avoid context errors

  // 3. Open X-Ray segment for all requests
  rawExpressApp.use(AWSXRayExpress.openSegment('UwufufuBackend'));

  // 4. Create NestJS app using ExpressAdapter
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(rawExpressApp),
    { rawBody: true },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || /^https?:\/\/(?:.*\.)?uwufufu\.com(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.setGlobalPrefix('v1');

  // 5. Close segment after request finishes
  rawExpressApp.use(AWSXRayExpress.closeSegment());

  // 6. Start server
  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
}

bootstrap();

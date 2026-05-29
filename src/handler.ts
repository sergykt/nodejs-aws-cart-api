import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as express from 'express';
import * as serverless from 'serverless-http';
import { AppModule } from './app.module';

let server: any;

async function bootstrap() {
  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  app.enableCors();
  app.use(helmet());
  await app.init();

  return serverless(expressApp);
}

export const handler = async (event: any, context: any) => {
  if (!server) {
    server = await bootstrap();
  }

  return server(event, context);
};

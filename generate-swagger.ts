import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('Luxora API')
    .setDescription('The robust backend API for Luxora E-commerce platform.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  // Create document
  const document = SwaggerModule.createDocument(app, config);
  
  // Save to file
  fs.writeFileSync('swagger.json', JSON.stringify(document, null, 2));
  
  await app.close();
  console.log('Successfully generated swagger.json');
}

bootstrap();

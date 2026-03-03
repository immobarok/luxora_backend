import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: string, metadata: ArgumentMetadata): string {
    const isCuid = /^c[a-z0-9]{24}$/i.test(value);
    if (!isCuid) {
      throw new BadRequestException('Invalid CUID format');
    }
    return value;
  }
}

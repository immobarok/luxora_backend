import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators';
import { SkipTransform } from './common/interceptors/transform.interceptor';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @SkipTransform()
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}

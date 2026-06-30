import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class JsonBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    
    if (request.body && typeof request.body === 'object') {
      for (const key in request.body) {
        if (typeof request.body[key] === 'string') {
          // Try to parse JSON strings into objects/arrays
          const value = request.body[key].trim();
          // Fast check if it looks like JSON array or object
          if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
            try {
              request.body[key] = JSON.parse(value);
            } catch (e) {
              // Ignore if not valid JSON
            }
          }
        }
      }
    }
    
    return next.handle();
  }
}

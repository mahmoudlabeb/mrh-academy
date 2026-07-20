import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        'Unhandled request exception',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: unknown }).message ??
          exceptionResponse);
    const body = {
      statusCode: status,
      message,
      error:
        exception instanceof HttpException
          ? exception.name
          : 'InternalServerError',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.adapterHost.httpAdapter.reply(response, body, status);
  }
}

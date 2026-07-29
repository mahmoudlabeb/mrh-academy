import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';

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
    const requestId = randomUUID();
    const safePath = (
      request.originalUrl ||
      request.url ||
      request.path ||
      '/'
    ).split('?')[0];
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
        `Unhandled request exception requestId=${requestId} path=${safePath}`,
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
      path: safePath,
      requestId,
    };

    if (typeof this.adapterHost.httpAdapter.setHeader === 'function') {
      this.adapterHost.httpAdapter.setHeader(
        response,
        'X-Request-ID',
        requestId,
      );
    } else if (typeof response?.setHeader === 'function') {
      response.setHeader('X-Request-ID', requestId);
    }
    this.adapterHost.httpAdapter.reply(response, body, status);
  }
}

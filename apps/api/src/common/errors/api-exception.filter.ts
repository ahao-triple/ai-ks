import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ZodError } from 'zod';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const payload = normalizeException(exception);

    response.status(payload.statusCode).json({
      error: payload.error,
      message: payload.message,
      statusCode: payload.statusCode,
    });
  }
}

function normalizeException(exception: unknown) {
  if (exception instanceof ZodError) {
    const fields = exception.issues
      .map((issue) => issue.path.join('.'))
      .filter(Boolean);

    return {
      error: 'Bad Request',
      message: fields.length
        ? `参数错误：${fields.join('、')}`
        : '参数错误，请检查输入',
      statusCode: HttpStatus.BAD_REQUEST,
    };
  }

  if (isPrismaUniqueConstraintError(exception)) {
    return {
      error: 'Conflict',
      message: '数据已存在，请勿重复提交',
      statusCode: HttpStatus.CONFLICT,
    };
  }

  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const statusCode = exception.getStatus();
    return {
      error: readHttpError(response, statusCode),
      message: readHttpMessage(response),
      statusCode,
    };
  }

  return {
    error: 'Internal Server Error',
    message: '服务器开小差了，请稍后重试',
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  };
}

function readHttpMessage(response: string | object) {
  if (typeof response === 'string') {
    return response;
  }

  if ('message' in response) {
    const message = response.message;
    return Array.isArray(message) ? message.join('；') : String(message);
  }

  return '请求处理失败';
}

function readHttpError(response: string | object, statusCode: number) {
  if (typeof response === 'object' && 'error' in response) {
    return String(response.error);
  }

  if (statusCode === HttpStatus.BAD_REQUEST) {
    return 'Bad Request';
  }

  return 'Error';
}

function isPrismaUniqueConstraintError(exception: unknown) {
  return (
    exception !== null &&
    typeof exception === 'object' &&
    'code' in exception &&
    exception.code === 'P2002'
  );
}

export function badRequestFromZod(error: ZodError): BadRequestException {
  const fields = error.issues
    .map((issue) => issue.path.join('.'))
    .filter(Boolean);

  return new BadRequestException(
    fields.length ? `参数错误：${fields.join('、')}` : '参数错误，请检查输入',
  );
}

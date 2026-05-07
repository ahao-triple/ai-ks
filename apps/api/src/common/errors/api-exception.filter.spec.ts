import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('turns zod errors into a 400 response with a readable message', () => {
    const response = createResponse();
    const filter = new ApiExceptionFilter();

    filter.catch(
      new ZodError([
        {
          code: 'too_small',
          minimum: 3,
          inclusive: true,
          path: ['username'],
          type: 'string',
          message: 'String must contain at least 3 character(s)',
        },
      ]),
      createHost(response),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('参数错误：username');
  });

  it('keeps explicit http exception messages', () => {
    const response = createResponse();
    const filter = new ApiExceptionFilter();

    filter.catch(new BadRequestException('账号不能为空'), createHost(response));

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('账号不能为空');
  });
});

function createResponse() {
  return {
    body: undefined as any,
    statusCode: undefined as number | undefined,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

function createHost(response: ReturnType<typeof createResponse>) {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as any;
}

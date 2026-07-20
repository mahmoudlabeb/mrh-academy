import { AllExceptionsFilter } from '../all-exceptions.filter.js';

describe('AllExceptionsFilter preservation (P2-H)', () => {
  const createFilter = () =>
    new AllExceptionsFilter({
      httpAdapter: {
        reply: (response: any, body: unknown, status: number) =>
          response.status(status).json(body),
      },
    } as never);

  it('returns HTTP 500 with "Internal server error" for non-HTTP exceptions', () => {
    const filter = createFilter();
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockResponse = { status: mockStatus };
    const mockRequest = { url: '/api/v1/lessons' };

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse as never,
        getRequest: () => mockRequest as never,
      }),
    };

    filter.catch(new Error('Something went wrong'), mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });

  it('still includes statusCode, error, timestamp, and path in error response', () => {
    const filter = createFilter();
    const mockJson = jest.fn();
    const mockResponse = {
      status: jest.fn().mockReturnValue({ json: mockJson }),
    };
    const mockRequest = { url: '/api/v1/test' };

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse as never,
        getRequest: () => mockRequest as never,
      }),
    };

    filter.catch(new Error('test'), mockHost as never);

    expect(mockJson).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'InternalServerError',
      timestamp: expect.any(String),
      path: '/api/v1/test',
    });
  });

  it('returns the HTTP exception status and message for HttpException', () => {
    const { HttpException, HttpStatus } = jest.requireActual('@nestjs/common');
    const filter = createFilter();
    const mockJson = jest.fn();
    const mockResponse = {
      status: jest.fn().mockReturnValue({ json: mockJson }),
    };
    const mockRequest = { url: '/api/v1/lessons' };

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse as never,
        getRequest: () => mockRequest as never,
      }),
    };

    const exception = new HttpException('Custom error', HttpStatus.BAD_REQUEST);
    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Custom error' }),
    );
  });
});

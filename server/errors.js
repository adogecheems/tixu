export class ApiError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  validation(message = '提交的内容有误，请检查后重试。', details) {
    return new ApiError(422, 'VALIDATION_FAILED', message, details);
  },
  unauthorized(message = '请先登录后再继续。') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  },
  forbidden(message = '当前账户没有执行此操作的权限。') {
    return new ApiError(403, 'FORBIDDEN', message);
  },
  notFound(message = '没有找到对应的内容。', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  },
  conflict(message = '内容已被其他操作更新，请刷新后再试。', code = 'CONFLICT', details) {
    return new ApiError(409, code, message, details);
  },
  tooMany(message = '操作过于频繁，请稍后再试。') {
    return new ApiError(429, 'RATE_LIMITED', message);
  },
  server(message = '服务暂时不可用，请稍后再试。') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  },
};

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message = "Invalid request", code = "bad_request") => new AppError(400, code, message);
export const unauthorized = (message = "Authentication required") => new AppError(401, "unauthorized", message);
export const forbidden = (message = "You do not have access to this resource") => new AppError(403, "forbidden", message);
export const notFound = (message = "Not found") => new AppError(404, "not_found", message);
export const conflict = (message: string, code = "conflict") => new AppError(409, code, message);
export const tooMany = (message = "Too many requests. Please try again later.") => new AppError(429, "rate_limited", message);

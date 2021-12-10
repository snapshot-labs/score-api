import { createHash } from 'crypto';

export function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

export function sendError(res, description, status = 500) {
  return res.status(status).json({
    error: 'unauthorized',
    error_description: description
  });
}

export function sha256(str) {
  return createHash('sha256')
    .update(str)
    .digest('hex');
}

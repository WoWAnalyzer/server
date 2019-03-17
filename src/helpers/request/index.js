import requestPromise from 'request-promise-native';

import RequestError from './RequestError';
import RequestTimeoutError from './RequestTimeoutError';
import RequestConnectionResetError from './RequestConnectionResetError';
import RequestSocketTimeoutError from './RequestSocketTimeoutError';
import RequestUnknownError from './RequestUnknownError';

export default async function request(options) {
  try {
    return await requestPromise(options);
  } catch (err) {
    if (err instanceof RequestError) {
      // An error occured connecting or during the transmission
      const code = err.error.code;
      switch (code) {
        case 'ETIMEDOUT':
          throw new RequestTimeoutError(err);
        case 'ECONNRESET':
          throw new RequestConnectionResetError(err);
        case 'ESOCKETTIMEDOUT':
          throw new RequestSocketTimeoutError(err);
        default:
          throw new RequestUnknownError(err);
      }
    }
    throw err;
  }
}

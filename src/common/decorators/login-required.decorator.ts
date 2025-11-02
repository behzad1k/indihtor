import { SetMetadata } from '@nestjs/common';

export const LOGIN_REQUIRED_KEY = 'loginRequired';
export const LoginRequired = () => SetMetadata(LOGIN_REQUIRED_KEY, true);
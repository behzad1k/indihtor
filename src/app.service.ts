import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Crypto Trading Signal Analyzer API';
  }
}
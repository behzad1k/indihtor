import { Controller, Post, Get, Body, Session, Redirect } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Session() session: Record<string, any>) {
    const result = await this.authService.validateUser(loginDto.username, loginDto.password);
    if (result.success) {
      session.logged_in = true;
    }
    return result;
  }

  @Get('logout')
  @Redirect('/login')
  logout(@Session() session: Record<string, any>) {
    session.logged_in = false;
    return { url: '/login' };
  }
}

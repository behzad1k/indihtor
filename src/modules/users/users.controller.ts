import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.usersService.findById(user.userId);
    delete profile.password;
    return profile;
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateData: any,
  ) {
    // Remove sensitive fields
    delete updateData.password;
    delete updateData.email;

    const updated = await this.usersService.update(user.userId, updateData);
    delete updated.password;
    return updated;
  }
}
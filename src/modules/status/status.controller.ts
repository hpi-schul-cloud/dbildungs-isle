import { Controller, Get, Redirect } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { FrontendConfig } from '../../shared/config/index.js';
import { Public } from '../authentication/api/public.decorator.js';

@Controller({ path: 'status' })
@ApiTags('status')
export class StatusController {
    public constructor(private readonly configService: ConfigService) {}

    @Get()
    @Public()
    @Redirect()
    public getStatus(): { url: string } {
        const frontendConfig: FrontendConfig = this.configService.getOrThrow<FrontendConfig>('FRONTEND');

        return { url: frontendConfig.STATUS_REDIRECT_URL };
    }
}

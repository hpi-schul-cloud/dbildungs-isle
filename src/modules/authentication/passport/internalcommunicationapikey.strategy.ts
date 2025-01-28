import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { HeaderApiKeyConfig } from '../../../shared/config/index.js';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

const HEADER_API_KEY: string = 'HEADER_API_KEY';

@Injectable()
export class InternalCommunicationApiKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'api-key') {
    public constructor(private readonly configService: ConfigService) {
        super(
            { header: 'api-key', prefix: '' },
            true,
            (apiKey: string, done: (error: Error | null, valid: boolean | null) => void) => {
                this.validate(apiKey, done);
            },
        );
    }

    public validate(apiKey: string, done: (error: Error | null, valid: boolean | null) => void): void {
        const internalCommunicationApiKeyConfig: HeaderApiKeyConfig =
            this.configService.getOrThrow<HeaderApiKeyConfig>(HEADER_API_KEY);

        if (
            !internalCommunicationApiKeyConfig.INTERNAL_COMMUNICATION_API_KEY ||
            apiKey !== internalCommunicationApiKeyConfig.INTERNAL_COMMUNICATION_API_KEY
        ) {
            return done(new UnauthorizedException('Invalid API key'), null);
        }
        return done(null, true);
    }
}

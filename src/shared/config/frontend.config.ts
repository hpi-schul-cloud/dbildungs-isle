import {
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
    Max,
    Min,
    isBoolean,
    isInt,
    isString,
} from 'class-validator';

import { OneOf } from '../util/one-of.validator.decorator.js';

export class FrontendConfig {
    @IsInt()
    @Min(1024)
    @Max(10000)
    public readonly PORT!: number;

    @IsOptional()
    @OneOf(isString, isInt, isBoolean)
    // Refer to https://expressjs.com/en/guide/behind-proxies.html for more info
    public readonly TRUST_PROXY?: string | number | boolean;

    @IsBoolean()
    @IsNotEmpty()
    public readonly SECURE_COOKIE!: boolean;

    @IsString()
    @IsNotEmpty()
    public readonly SESSION_SECRET!: string;

    @IsString()
    @IsNotEmpty()
    public readonly BACKEND_ADDRESS!: string;

    @IsInt()
    @IsPositive()
    @IsNotEmpty()
    public readonly SESSION_TTL_MS!: number;

    @IsString()
    @IsNotEmpty()
    public readonly OIDC_CALLBACK_URL!: string;

    @IsString()
    @IsNotEmpty()
    public readonly DEFAULT_LOGIN_REDIRECT!: string;

    @IsString()
    @IsNotEmpty()
    public readonly LOGOUT_REDIRECT!: string;

    @IsString()
    @IsNotEmpty()
    public readonly ERROR_PAGE_REDIRECT!: string;

    @IsString()
    @IsNotEmpty()
    public readonly STATUS_REDIRECT_URL!: string;
}

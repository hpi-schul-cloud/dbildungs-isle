import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class RedisConfig {
    @IsString()
    @IsNotEmpty()
    public readonly HOST!: string;

    @IsInt()
    @Min(1024)
    @Max(10000)
    public readonly PORT!: number;

    @IsString()
    @IsNotEmpty()
    public readonly USERNAME!: string;

    @IsString()
    @IsNotEmpty()
    public readonly PASSWORD!: string;

    @IsBoolean()
    @IsNotEmpty()
    public readonly USE_TLS!: boolean;

    @IsOptional()
    @IsString()
    // PEM format
    public readonly PRIVATE_KEY?: string;

    @IsOptional()
    @IsString()
    // PEM format
    public readonly CERT_CHAINS?: string;

    @IsOptional()
    @IsString()
    public readonly CERTIFICATE_AUTHORITIES?: string;

    @IsOptional()
    @IsBoolean()
    public readonly CLUSTERED?: boolean;
}

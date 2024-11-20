import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LdapConfig {
    @IsString()
    @IsNotEmpty()
    public readonly URL!: string;

    @IsString()
    @IsNotEmpty()
    public readonly BIND_DN!: string;

    @IsString()
    @IsNotEmpty()
    public readonly ADMIN_PASSWORD!: string;

    @IsString()
    @IsOptional()
    public readonly OEFFENTLICHE_SCHULEN_DOMAIN?: string;

    @IsString()
    @IsOptional()
    public readonly ERSATZSCHULEN_DOMAIN?: string;
}

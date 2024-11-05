import { IsNotEmpty, IsString } from 'class-validator';

export class KeycloakConfig {
    @IsString()
    @IsNotEmpty()
    public readonly BASE_URL!: string;

    @IsString()
    @IsNotEmpty()
    public readonly ADMIN_REALM_NAME!: string;

    @IsString()
    @IsNotEmpty()
    public readonly ADMIN_CLIENT_ID!: string;

    @IsString()
    @IsNotEmpty()
    public readonly ADMIN_SECRET!: string;

    @IsString()
    @IsNotEmpty()
    public readonly SERVICE_CLIENT_ID!: string;

    @IsString()
    @IsNotEmpty()
    // Stringified JSON like { "keys": [<JWK>] }
    public readonly SERVICE_CLIENT_PRIVATE_JWKS!: string;

    @IsString()
    @IsNotEmpty()
    public readonly REALM_NAME!: string;

    @IsString()
    @IsNotEmpty()
    public readonly CLIENT_ID!: string;

    @IsString()
    @IsNotEmpty()
    public readonly CLIENT_SECRET!: string;

    @IsString()
    @IsNotEmpty()
    public readonly TEST_CLIENT_ID!: string;
}

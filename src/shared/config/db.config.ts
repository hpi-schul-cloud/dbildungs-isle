import { IsNotEmpty, IsString } from 'class-validator';

export class DbConfig {
    @IsString()
    @IsNotEmpty()
    public readonly CLIENT_URL!: string;

    @IsString()
    @IsNotEmpty()
    public readonly DB_NAME!: string;

    @IsString()
    @IsNotEmpty()
    public readonly SECRET?: string;
}

import { IsNumber, IsString } from 'class-validator';

export class PrivacyIdeaConfig {
    @IsString()
    public readonly USERNAME!: string;

    @IsString()
    public readonly PASSWORD!: string;

    @IsString()
    public readonly USER_RESOLVER!: string;

    @IsString()
    public readonly ENDPOINT!: string;

    @IsString()
    public readonly REALM!: string;

    @IsNumber()
    public readonly RENAME_WAITING_TIME_IN_SECONDS!: number;
}

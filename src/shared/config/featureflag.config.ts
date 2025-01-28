import { IsBoolean, IsNotEmpty } from 'class-validator';

export class FeatureFlagConfig {
    @IsBoolean()
    @IsNotEmpty()
    public readonly FEATURE_FLAG_ROLLE_BEARBEITEN!: boolean;

    @IsBoolean()
    @IsNotEmpty()
    public readonly FEATURE_FLAG_BEFRISTUNG_BEARBEITEN!: boolean;
}

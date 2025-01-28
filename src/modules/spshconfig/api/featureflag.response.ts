import { ApiProperty } from '@nestjs/swagger';
import { FeatureFlagConfig } from '../../../shared/config/index.js';

export class FeatureFlagResponse {
    @ApiProperty()
    public rolleBearbeitenEnabled: boolean;

    @ApiProperty()
    public befristungBearbeitenEnabled: boolean;

    public constructor(featureFlagConfig: FeatureFlagConfig) {
        this.rolleBearbeitenEnabled = featureFlagConfig.FEATURE_FLAG_ROLLE_BEARBEITEN;
        this.befristungBearbeitenEnabled = featureFlagConfig.FEATURE_FLAG_BEFRISTUNG_BEARBEITEN;
    }
}

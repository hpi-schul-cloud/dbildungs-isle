import { IsEnum } from 'class-validator';

export enum DeployStage {
    TEST = 'test',
    DEV = 'dev',
    PROD = 'prod',
}

export class EnvConfig {
    @IsEnum(DeployStage)
    public readonly DEPLOY_STAGE!: DeployStage;

    public readonly NEST_LOG_LEVEL!: string;

    [key: `${string}.LOG_LEVEL`]: string;
}

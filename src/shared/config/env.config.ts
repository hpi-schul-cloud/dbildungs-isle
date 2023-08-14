import { IsEnum } from 'class-validator';

export enum NodeEnvType {
    TEST = 'test',
    DEV = 'dev',
    PROD = 'prod',
}

export class EnvConfig {
    @IsEnum(NodeEnvType)
    public readonly NODE_ENV!: NodeEnvType;

    public readonly NEST_LOG_LEVEL!: string;

    [key: `${string}.LOG_LEVEL`]: string;
}

import { readFileSync } from 'fs';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { EnvConfig, DeployStage } from './env.config.js';
import { JsonConfig } from './json.config.js';
import { merge } from 'lodash-es';

// TODO: this is necessary for state management and to determine which
// config json should be loaded, if we use generated config json via
// Kubernetes this will no longer be necessary: EW-???
let deployStage: DeployStage = DeployStage.PROD;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFileToJSON(path: string): any {
    const file: string = readFileSync(path, { encoding: 'utf8' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
    const parsedJson: any = JSON.parse(file);
    return parsedJson;
}

export function loadEnvConfig(config: Record<string, unknown>): EnvConfig {
    const parsedConfig: EnvConfig = plainToInstance(EnvConfig, config, { enableImplicitConversion: true });
    const errors: ValidationError[] = validateSync(parsedConfig, {
        skipMissingProperties: false,
        whitelist: true,
        forbidUnknownValues: true,
    });
    if (errors.length !== 0) {
        throw new Error(
            errors
                .map((error: ValidationError) => error.toString())
                .reduce((previous: string, current: string) => `${previous}\n${current}`),
        );
    }
    deployStage = parsedConfig.DEPLOY_STAGE;
    return parsedConfig;
}

export function loadConfigFiles(): JsonConfig {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
    const json: any = parseFileToJSON(`./config/config.${deployStage}.json`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
    const secrets: any = parseFileToJSON('./config/secrets.json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
    const merged: any = merge(json, secrets);
    const mergedConfig: JsonConfig = plainToInstance(JsonConfig, merged, { enableImplicitConversion: true });

    const errors: ValidationError[] = validateSync(mergedConfig, {
        skipMissingProperties: false,
        whitelist: true,
        forbidUnknownValues: true,
    });
    if (errors.length !== 0) {
        throw new Error(
            errors
                .map((error: ValidationError) => error.toString())
                .reduce((previous: string, current: string) => `${previous}\n${current}`),
        );
    }
    return mergedConfig;
}

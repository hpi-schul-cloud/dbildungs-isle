import 'reflect-metadata'; // some decorators use reflect-metadata in the background
import fs from 'fs';
import { EnvConfig, JsonConfig, DeployStage, loadConfigFiles, loadEnvConfig } from './index.js';

describe('configloader', () => {
    describe('loadEnvConfig', () => {
        describe('when config is valid', () => {
            it('should return validated EnvConfig', () => {
                const config: Record<string, unknown> = { DEPLOY_STAGE: DeployStage.DEV };
                const validatedConfig: EnvConfig = loadEnvConfig(config);
                expect(validatedConfig).toBeInstanceOf(EnvConfig);
            });
        });

        describe('when config is invalid', () => {
            it('should throw', () => {
                const config: Record<string, unknown> = { DEPLOY_STAGE: '' };
                expect(() => loadEnvConfig(config)).toThrow();
            });
        });
    });

    describe('loadConfigFiles', () => {
        describe('when config is valid', () => {
            let readFileSyncSpy: jest.SpyInstance;

            const config: JsonConfig = {
                HOST: {
                    PORT: 8080,
                },
                DB: {
                    CLIENT_URL: 'postgres://localhost:5432',
                    DB_NAME: 'test-db',
                },
            };

            const secrets: string = '{"DB": {"SECRET": "SuperSecretSecret"}}';

            beforeAll(() => {
                readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(config));
                readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(secrets);
            });

            afterAll(() => {
                jest.clearAllMocks();
            });

            it('should return validated JsonConfig', () => {
                const validatedConfig: JsonConfig = loadConfigFiles();
                expect(validatedConfig).toBeInstanceOf(JsonConfig);
                expect(readFileSyncSpy).toBeCalledTimes(2);
            });
        });

        describe('when config is invalid', () => {
            let readFileSyncSpy: jest.SpyInstance;

            const config: JsonConfig = {
                HOST: {
                    PORT: 1,
                },
                DB: {
                    CLIENT_URL: '',
                    DB_NAME: '',
                },
            };

            beforeAll(() => {
                readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));
            });

            afterAll(() => {
                jest.clearAllMocks();
            });

            it('should throw', () => {
                expect(() => loadConfigFiles()).toThrow();
                expect(readFileSyncSpy).toBeCalledTimes(2);
            });
        });
    });
});

# Configuration

> This site explains how configuration is implemented and gives guidelines on
> how to extend or implemented your own configuration modules. For configuration
> we are using the [@nestjs/config](https://www.npmjs.com/package/@nestjs/config)
> package which is also documented on the [nestjs](https://docs.nestjs.com/techniques/configuration)
> documentation site.

## Overview

### General Configuration

All Configuration is passed trough JSON-Files located in the following place

```bash
./config/config.{STAGE}.json
{STAGE} refers to the deployment stage this instance is running.
```

Currently we are planning to create the following stages:

-   DEV
-   TESTING
-   PROD

The config file contains all static, non-secret information we need to start and run dBildung-iam-server.

#### Data Model

```json
{
  "HOST": {
    "PORT": <this is the server port>
  },
  "DB": {
    "CLIENT_URL": "<here goes your connection string>",
    "DB_NAME": "<here goes your db name>"
  },
  "KEYCLOAK": {
    "BASE_URL": "<URL of keycloak>",
    "ADMIN_REALM_NAME": "<name of the admin realm>",
    "ADMIN_CLIENT_ID": "<id of the admin client>",
    "REALM_NAME": "<name of the client realm>",
    "CLIENT_ID": "<id of the client>",
  },
  "FRONTEND": {
    "PORT": "<this is the bff port>",
    "TRUST_PROXY": "<optional, see https://expressjs.com/en/guide/behind-proxies.html>",
    "SECURE_COOKIE": <Enables/Disables HTTPS for cookie>,
    "BACKEND_ADDRESS": "<address of backend server>",
    "SESSION_TTL_MS": <Time in milliseconds after which the session expires>,
    "OIDC_CALLBACK_URL": "<callback that is passed to keycloak>",
    "DEFAULT_LOGIN_REDIRECT": "<default redirect after auth is complete>",
    "LOGOUT_REDIRECT": "<where to redirect user after logout"
  },
  "REDIS": {
    "HOST": "<host of the redis server>",
    "PORT": <port of the redis server>,
    "USERNAME": "<redis username>",
    "USE_TLS": <use TLS for connection>
  }
}
```

### Secrets Configuration

Secrets are provided inside the application in the same way as the static configuration.

```bash
./config/secrets.json
```

There are however a few special rules applied to them:

-   This file is NEVER checked-in into the repository
-   This file is created by the CI/CD pipeline with appropriate information for the given stage

#### Data Model

```json
{
    "DB": {
        "SECRET": "<here goes your secret>"
    },
    "KEYCLOAK": {
        "ADMIN_SECRET": "<secret token for the admin client>",
        "CLIENT_SECRET": "<secret token for the client>"
    },
    "FRONTEND": {
        "SESSION_SECRET": "<is used to encrypt the session cookie>"
    },
    "REDIS": {
        "PASSWORD": "<redis password>",
        "PRIVATE_KEY": "<optional: private key in PEM format>",
        "CERT_CHAINS": "<optional: certificate chains in PEM format>",
        "CERTIFICATE_AUTHORITIES": "<optional: trusted certificate authorities>"
    }
}
```

## Developer Guide

The nest configuration package provides a module which must be imported to use the `ConfigService`.
We are using the config module as a global module, which makes the `ConfigService` globally available.
Here comes an example:

### Initialization

The ConfigModule is initialized in the ServerModule and can be used globally from there by injecting the ConfigService and loading the needed part of the configuration

```ts
ConfigModule.forRoot({
    isGlobal: true,
    validate: loadEnvConfig, //NestJs loads this first and is the only place it loads ENV-variables. We use this to load the current stage
    load: [loadConfig],
});
```

### Usage

```ts
class MyClass {
    public constructor(private readonly configService: ServerConfig<ServerConfig, true>) {}

    public myFunction(): void {
        // the config keys are compile time checked
        const env: DeployStage = this.configService.getOrThrow<DeployStage>('DEPLOY_STAGE');
        const dbConfig: DbConfig = this.configService.getOrThrow<DbConfig>('DB');
        const dbName: string = dbConfig.DB_NAME;
        // ...
    }
}
```

### Structure

![Configuration Composition Structure](./img/config-structure.svg)

-   **General**
    -   The configuration is loaded and validated on application startup
    -   The validation uses decorators from the `class-validator` package
    -   If the configuration is not valid, the application will stop with an error
    -   The parsing from the environment and json is type safe
-   **ServerConfig**
    -   Is the top level configuration type and combines EnvConfig and JsonConfig
    -   Should be used as the generic parameter e.g. `ConfigService<ServerConfig, true>`
-   **EnvConfig**
    -   Is loaded from environment variables and .env file
    -   This is used to determine the correct deployment environment
-   **JsonConfig**
    -   Is loaded form an environment specific json file
    -   Json files can be found in the `config` folder in the repository root

## How to expand the configuration?

-   Where to put the new config value?
    -   If it's secret, than put it into the `EnvConfig`
        -   Annotate the new property with the desired decorators
        -   IMPORTANT: Do NOT put complex types into the `EnvConfig`, only primitive values
    -   If it's something like a feature flag, than put it into the `JsonConfig`
        -   Annotate the new property with the desired decorators
-   Do I want to expand an existing config class like `DbConfig`? If yes, than do the following steps:
    -   Put the new configuration value in the desired class
    -   Annotate the new property with the desired decorators
-   I wan to add configuration for a new feature
    -   Use the `DbConfig` as reference
        -   [ ] Create a new class in the `src/shared/config` folder
        -   [ ] Annotate the properties with the desired decorators
        -   [ ] Add your config to the `JsonConfig` class with the required decorators
        -   [ ] Add your config class to the `src/shared/config/index.ts` file
        -   [ ] Add default values to the environment specific json files

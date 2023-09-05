# Architecture mapping to Code

## Conventions

### File structure

```
src
│
├───entry-points - contains the different runnable node applications and their bootstrapping
├───modules - contains all modules
│   └───[module-name] - contains all files regarding a specific module
│       │   module-name-api.module.spec.ts
│       │   module-name-api.module.ts
│       │   module-name.module.spec.ts
│       │   module-name.module.ts
│       │
│       ├───api - contains use-cases, controllers and API-dtos of a module
│       │       [some-request].body.params.spec.ts
│       │       [some-request].body.params.ts
│       │       [request-body-to-dto].mapper.profile.spec.ts
│       │       [request-body-to-dto].mapper.profile.ts
│       │       [controller-name].controller.spec.ts
│       │       [controller-name].controller.ts
│       │       [use-case-name].uc.spec.ts
│       │       [use-case-name].uc.ts
│       │
│       ├───domain - contains the module's services and domain objects which handle the business logic
│       │       [domain-object].do.ts
│       │       [domain-service].service.spec.ts
│       │       [domain-service].service.ts
│       │
│       └───persistence - contains repositories, db-entities and adapters to other persistence systems
│               [entity-to-do].mapper.profile.spec.ts
│               [entity-to-do].mapper.profile.ts
│               [entity-name].entity.ts
│               [entity-name].repo.integration-spec.ts
│               [entity-name].repo.ts
│
└───shared
    ├───config
    ├───error
    ├───logging
    ├───types
    └───validation

```

### File naming conventions

In TypeScript files: File names use `kebab-case` and end with an indication what kind of class it contains e.g. `.uc.ts` or `.controller.ts`
For Classes we use `PascalCase` (names start with uppercase letter), variables use lowercase for the first letter `camelCase`.

DTOs are named after their purpose. DTOs concerning the REST API are either `.param.ts` or `.response.ts`.
For params we need to differentiate between body, query and path parameters since multiple of them could be used for the same request.
 e.g. create-person.body.param.ts, get-persons.query.params.ts, get-person.response.ts

#### Samples

| File name               | Class name        | Concept    | Location          |
| ----------------------- | ----------------- | ---------- | ----------------- |
| login-user.uc.ts        | LoginUserUc       | use case   | module/uc         |
| text.validator.ts       | TextValidator     | validator  | shared/validators |
| user.repo.ts            | UserRepo          | repository | module/repo       |
| parse-object-id.pipe.ts | ParseObjectIdPipe | pipe       | shared/pipes      |


## Components

Components are defined as NestJS [Modules](https://docs.nestjs.com/modules).

### Communication between components

To access another module's service in your module, that other module has to be imported.
Only services that are listed in its module's `exports`-array can be used by other modules.<br>
It is forbidden to provide a service in multiple modules.

```TypeScript
// modules/feathers/feathers-service.provider.ts
// modules/feathers/feathers.module.ts
@Module({
	providers: [FeathersServiceProvider],
	exports: [FeathersServiceProvider],
})
export class FeathersModule {}

```

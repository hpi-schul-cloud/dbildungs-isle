# Developer Guides

## Error Handling

### Domain Errors

Domain errors should extend from an Nest Http Error. This allows Nest to understand
directly the thrown errors and will translate them into the default http error response.

### Global Exception Filter

We are using a global exception filter which will catch and translate all known errors
and return a 500 status code for all unknown errors.

### SchulConnex Error Handling

The SchulConnex interface has specific errors for most error scenarios. Therefore we have
to translate our own domain errors into SchulConnex specific errors. We are using a filter
decorator on SchulConnex endpoints to translate the thrown errors. This will override the
response of the global exception filter for the decorated endpoints.

## Logging

The `LoggerModule` is **not** a global module and must be imported if logging is
needed for every module separately. The register function takes the module name
and will prefix every log with the module name and class to identify the log location
more easily. The underlying logger is winston, which allows us to use different transports
which could be cons

```typescript
@Module({
    imports: [LoggerModule.register('NewModule'), ...]
    ...
})
export class NewModule {}
```

### Module Logger

The `ModuleLogger` is an internal class and will not be exposed. Through the `ModuleLogger`
we can set the log level for an entire module which varies from the global log level. This
allows better inspection for single modules and will not lead to over flooding of the logs.
The module log lever will always overrides the global log level for the module.

### Class Logger

This logger is the service which you can use for your logs. When the `LoggerModule` was
registered you can inject the `ClassLogger` into your constructor and Nest will resolve
the service for you. The methods of the logger are corresponding to the specific log levels.
Your messages will only be logged if there log level is equal or higher than the global
log level or your module log level. The context of the logger will be set automatically.

### Log Levels?

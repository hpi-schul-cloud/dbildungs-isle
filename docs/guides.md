# Developer Guides

## Error Handling

### Domain Errors

Domain errors should extend from an Nest Http Error. This allows Nest to understand
directly the thrown errors and will translate them into the default http error response.

### Global Exception Filter

We are using a global exception filter which will catch and translate all known errors
and return a 500 status code for all unknown errors.

### SchulConnex Error Format

The SchulConnex interface has specific errors for many error scenarios. Therefore we have
to translate our own domain errors into SchulConnex specific errors.
We use the SchulConnex JSON-structure for all our errors.
The GlobalExceptionFilter will translate all errors into SchulConnex structure.

The body of an error response looks like this.
``` js
type SchulConnexError = {
    statusCode: number;
    subcode: string;
    title: string;
    description: string;
};
```

## Logging

The `LoggerModule` is **not** a global module and must be imported if logging is
needed for every module separately. The register function takes the module name
and will prefix every log with the module name and class to identify the log location
more easily. The underlying logger is winston.

```typescript
@Module({
    imports: [LoggerModule.register('NewModule'), ...]
    ...
})
export class NewModule {}
```

### Module Logger

The `ModuleLogger` is an internal class and will not be exposed. Through the `ModuleLogger`
we can set the log level for an entire module which varies from the global log level.
If no specific log level is set for a module, the global log level will be used.
This allows better inspection for single modules and can prevent flooding of the logs.

### Class Logger

This logger is the service which you can use for your logs. When the `LoggerModule` was
registered you can inject the `ClassLogger` into your constructor and Nest will resolve
the service for you. The methods of the logger are corresponding to the specific log levels.
Your messages will only be logged if there log level is equal or higher than the global
log level or your module log level. The context of the logger will be set automatically.

### Log Levels?

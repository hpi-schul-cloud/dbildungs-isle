# Error Handling

Error Handling for the SchulConneX API methods is done as specified by the respective documentation. We adhere to the
standard and return the same errors.

The current list of possible Errors is listed either in the [official documentation](https://github.com/SchulConneX/v1)
or in our [Confluence](https://docs.dbildungscloud.de/x/sIbbE).

#### SchulConnex Error Format
```json
{
"code": "401",
"subcode": "01",
"titel": " Access Token abgelaufen",
"beschreibung": "Der Access-Token ist abgelaufen und muss erneuert werden."
}
```

## Error Types

### General & Validation Errors

General Errors and Validation Errors are handled by a NestJs `ExceptionFilter`.
The `SchulConnexValidationErrorFilter` catches all Validation Errors thrown by the `class-validator`
The `GlobalExceptionFilter` cathes all other Errors that get thrown by NestJs
Annotations used to validate the API Inputs and transformed into the appropriate SchulConneX error.

To expand or alter the error mappings, you need only to edit the class
`./shared/error/schulconnex-validation-error.filter.ts` and its appropriate tests.

### Domain Errors

Domain Errors are handled by mapping a descendant of `DomainError` to `SchulConnexError`
through a general `SchulConnexErrorMapper` in the UC. It is important, that we have a clear
mapping of `DomainError`s to appropriate SchulConneX Errorcodes and Subcodes, although several
`DomainError`s can be mapped to the same `SchulConnexError`.

It is important, that we do NOT throw Errors from our Domain layer, but return them as part of the result.
(For details, see the general Codestyle Documentation //TODO!!!)

Those should also be documented in our [Confluence](https://docs.dbildungscloud.de/x/sIbbE)


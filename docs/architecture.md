# Architecture

## Domain Driven Design

We follow the goal of domain driven design to keep a clean domain layer.<br>
Business logic is handled in the domain layer.<br>
The domain layer has no dependencies to other layers.
The domain layer offers services. In the application layer there are use cases consuming and orchestrating the services to fulfill a users request.<br>
A use case can be called via a controller exposing an API (usually REST) to clients.<br>
In the future a use case could be called directly by other microservices as well via a communication channel that is to be defined.

![Class Structure](./img/class-structure.svg "Source of draw.io diagram is embedded in the file")

## Modules

A module contains a cohesive portion of the domain. <br>
We always have two modules belonging together. One module that contains the domain and persistence and one module that contains the corresponding use-case and API.
The reason is that this way it is possible to reuse modules for different microservices without including the reused module's API.

A module can contain both services for internal use only and services that are meant to be consumed by other modules.
Decide what services to put in the module's `exports`-array instead of defaulting to export everything "just in case".

## Authorization

Authorization is done in the use cases. A use case needs to check that the user is allowed to carry out every action that is triggered by the use case while executing the services it calls.
The services do not check the user rights again to avoid code duplication. Even services that are exported from a module rely on the authorization being checked by the calling use cases.

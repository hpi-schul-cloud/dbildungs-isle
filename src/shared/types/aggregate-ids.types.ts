import { Flavor } from './flavor.types.js';

declare const personSymbol: unique symbol;
export type PersonID = Flavor<string, typeof personSymbol>;

declare const organisationSymbol: unique symbol;
export type OrganisationID = Flavor<string, typeof organisationSymbol>;

declare const rolleSymbol: unique symbol;
export type RolleID = Flavor<string, typeof rolleSymbol>;

declare const personenkontextSymbol: unique symbol;
export type PersonenkontextID = Flavor<string, typeof personenkontextSymbol>;

declare const serviceProviderSymbol: unique symbol;
export type ServiceProviderID = Flavor<string, typeof serviceProviderSymbol>;

declare const emailAddressSymbol: unique symbol;
export type EmailAddressID = Flavor<string, typeof emailAddressSymbol>;

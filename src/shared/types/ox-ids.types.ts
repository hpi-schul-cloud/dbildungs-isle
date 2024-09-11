import { Flavor } from './flavor.types.js';

declare const oxUserIdSymbol: unique symbol;
export type OXUserID = Flavor<string, typeof oxUserIdSymbol>;

declare const oxUserNameSymbol: unique symbol;
export type OXUserName = Flavor<string, typeof oxUserNameSymbol>;

declare const oxContextIdSymbol: unique symbol;
export type OXContextID = Flavor<string, typeof oxContextIdSymbol>;

declare const oxContextNameSymbol: unique symbol;
export type OXContextName = Flavor<string, typeof oxContextNameSymbol>;

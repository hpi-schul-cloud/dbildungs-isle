import { PersonID } from '../../../shared/types/index.js';

export enum EmailAddressStatus {
    ENABLED = 'ENABLED',
    DISABLED = 'DISABLED',
    REQUESTED = 'REQUESTED',
}

export class EmailAddress<WasPersisted extends boolean> {
    public constructor(
        public id: Persisted<string, WasPersisted>,
        public readonly createdAt: Persisted<Date, WasPersisted>,
        public readonly updatedAt: Persisted<Date, WasPersisted>,
        private addressPersonId: PersonID,
        private addressAddress: string,
        private addressStatus: EmailAddressStatus,
    ) {}

    public static construct(
        id: string,
        createdAt: Date,
        updatedAt: Date,
        personId: PersonID,
        address: string,
        enabled: EmailAddressStatus,
    ): EmailAddress<true> {
        return new EmailAddress(id, createdAt, updatedAt, personId, address, enabled);
    }

    public static createNew(personId: PersonID, address: string, enabled: EmailAddressStatus): EmailAddress<false> {
        return new EmailAddress(undefined, undefined, undefined, personId, address, enabled);
    }

    public enable(): boolean {
        const oldValue: boolean = this.enabled;
        this.addressStatus = EmailAddressStatus.ENABLED;

        return oldValue;
    }

    public request(): boolean {
        const oldValue: boolean = this.enabled;
        this.addressStatus = EmailAddressStatus.REQUESTED;

        return oldValue;
    }

    public disable(): boolean {
        const oldValue: boolean = this.enabled;
        this.addressStatus = EmailAddressStatus.DISABLED;

        return oldValue;
    }

    public get enabled(): boolean {
        return this.addressStatus === EmailAddressStatus.ENABLED;
    }

    public get status(): EmailAddressStatus {
        return this.addressStatus;
    }

    public get enabledOrRequested(): boolean {
        return this.addressStatus !== EmailAddressStatus.DISABLED;
    }

    public get personId(): PersonID {
        return this.addressPersonId;
    }

    public get address(): string {
        return this.addressAddress;
    }

    public setAddress(address: string): string {
        return (this.addressAddress = address);
    }

    public get currentAddress(): Option<string> {
        if (!this.enabled) return undefined;

        return this.addressAddress;
    }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { DomainError } from '../../../shared/error/index.js';
import { OxConfig } from '../../../shared/config/ox.config.js';
import { OxService } from './ox.service.js';
import { CreateUserAction, CreateUserParams, CreateUserResponse } from '../actions/user/create-user.action.js';
import { PersonID } from '../../../shared/types/index.js';
import { Person } from '../../person/domain/person.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { EmailAddressGeneratedEvent } from '../../../shared/events/email-address-generated.event.js';
import { ExistsUserAction, ExistsUserResponse } from '../actions/user/exists-user.action.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';
import { OXContextID, OXContextName } from '../../../shared/types/ox-ids.types.js';
import { EmailAddressChangedEvent } from '../../../shared/events/email-address-changed.event.js';
import { ChangeUserAction, ChangeUserParams } from '../actions/user/change-user.action.js';
import { OxUserChangedEvent } from '../../../shared/events/ox-user-changed.event.js';
import { GetDataForUserAction, GetDataForUserResponse } from '../actions/user/get-data-user.action.js';
import { UserIdParams, UserNameParams } from '../actions/user/ox-user.types.js';
import { EmailRepo } from '../../email/persistence/email.repo.js';
import { EmailAddress, EmailAddressStatus } from '../../email/domain/email-address.js';

@Injectable()
export class OxEventHandler {
    public ENABLED: boolean;

    private readonly authUser: string;

    private readonly authPassword: string;

    private readonly contextID: OXContextID;

    private readonly contextName: OXContextName;

    public constructor(
        private readonly logger: ClassLogger,
        private readonly oxService: OxService,
        private readonly personRepository: PersonRepository,
        private readonly emailRepo: EmailRepo,
        private readonly eventService: EventService,
        configService: ConfigService<ServerConfig>,
    ) {
        const oxConfig: OxConfig = configService.getOrThrow<OxConfig>('OX');

        this.ENABLED = oxConfig.ENABLED === 'true';
        this.authUser = oxConfig.USERNAME;
        this.authPassword = oxConfig.PASSWORD;
        this.contextID = oxConfig.CONTEXT_ID;
        this.contextName = oxConfig.CONTEXT_NAME;
    }

    @EventHandler(EmailAddressChangedEvent)
    public async handleEmailAddressChangedEvent(event: EmailAddressChangedEvent): Promise<void> {
        this.logger.info(
            `Received EmailAddressChangedEvent, personId:${event.personId}, oldEmailAddressId:${event.oldEmailAddressId}, oldAddress:${event.oldAddress}, newEmailAddressId:${event.newEmailAddressId}, newAddress:${event.newAddress}`,
        );

        if (!this.ENABLED) {
            return this.logger.info('Not enabled, ignoring event');
        }

        await this.changeOxUser(event.personId);
    }

    @EventHandler(EmailAddressGeneratedEvent)
    public async handleEmailAddressGeneratedEvent(event: EmailAddressGeneratedEvent): Promise<void> {
        this.logger.info(
            `Received EmailAddressGeneratedEvent, personId:${event.personId}, emailAddressId:${event.emailAddressId}, address:${event.address}`,
        );

        if (!this.ENABLED) {
            return this.logger.info('Not enabled, ignoring event');
        }

        await this.createOxUser(event.personId);
    }

    private async getMostRecentRequestedEmailAddress(personId: PersonID): Promise<Option<EmailAddress<true>>> {
        const requestedEmailAddresses: Option<EmailAddress<true>[]> =
            await this.emailRepo.findByPersonSortedByUpdatedAtDesc(personId, EmailAddressStatus.REQUESTED);
        if (!requestedEmailAddresses || !requestedEmailAddresses[0]) {
            this.logger.error(`No requested email-address found for personId:${personId}`);
            return undefined;
        }
        return requestedEmailAddresses[0];
    }

    private async createOxUser(personId: PersonID): Promise<void> {
        const person: Option<Person<true>> = await this.personRepository.findById(personId);

        if (!person) {
            return this.logger.error(`Person not found for personId:${personId}`);
        }
        if (!person.referrer) {
            return this.logger.error(`Person with personId:${personId} has no referrer: cannot create OXEmailAddress`);
        }

        const mostRecentRequestedEmailAddress: Option<EmailAddress<true>> =
            await this.getMostRecentRequestedEmailAddress(personId);
        if (!mostRecentRequestedEmailAddress) return;
        const requestedEmailAddressString: string = mostRecentRequestedEmailAddress.address;

        const existsParams: UserNameParams = {
            contextId: this.contextID,
            userName: person.referrer,
            login: this.authUser,
            password: this.authPassword,
        };

        const existsAction: ExistsUserAction = new ExistsUserAction(existsParams);

        const existsResult: Result<ExistsUserResponse, DomainError> = await this.oxService.send(existsAction);

        if (existsResult.ok && existsResult.value.exists) {
            this.logger.error(`Cannot create user in OX, username:${person.referrer} already exists`);
            return;
        }

        const params: CreateUserParams = {
            contextId: this.contextID,
            displayName: person.referrer,
            email1: requestedEmailAddressString,
            username: person.referrer,
            firstname: person.vorname,
            mailEnabled: true,
            lastname: person.familienname,
            primaryEmail: requestedEmailAddressString,
            userPassword: 'TestPassword1',
            login: this.authUser,
            password: this.authPassword,
        };

        const action: CreateUserAction = new CreateUserAction(params);
        const result: Result<CreateUserResponse, DomainError> = await this.oxService.send(action);

        if (!result.ok) {
            mostRecentRequestedEmailAddress.failed();
            await this.emailRepo.save(mostRecentRequestedEmailAddress);

            return this.logger.error(`Could not create user in OX, error: ${result.error.message}`);
        }

        this.logger.info(`User created in OX, userId:${result.value.id}, email:${result.value.primaryEmail}`);

        mostRecentRequestedEmailAddress.oxUserID = result.value.id;
        const emailAddressUpdateResult: EmailAddress<true> | DomainError = await this.emailRepo.save(
            mostRecentRequestedEmailAddress,
        );
        if (emailAddressUpdateResult instanceof DomainError) {
            mostRecentRequestedEmailAddress.failed();
            await this.emailRepo.save(mostRecentRequestedEmailAddress);
            this.logger.error(`Persisting oxUserId on emailAddress for personId:${personId} failed`);
        }

        this.eventService.publish(
            new OxUserChangedEvent(
                personId,
                person.referrer,
                result.value.id,
                result.value.username,
                this.contextID,
                this.contextName,
                result.value.primaryEmail,
            ),
        );
    }

    private async changeOxUser(personId: PersonID): Promise<void> {
        const person: Option<Person<true>> = await this.personRepository.findById(personId);

        if (!person) {
            return this.logger.error(`Person not found for personId:${personId}`);
        }
        if (!person.referrer) {
            return this.logger.error(
                `Person with personId:${personId} has no referrer: Cannot Change Email-Address In OX`,
            );
        }
        if (!person.oxUserId) {
            return this.logger.error(`Person with personId:${personId} has no OXUserId`);
        }

        const mostRecentRequestedEmailAddress: Option<EmailAddress<true>> =
            await this.getMostRecentRequestedEmailAddress(personId);
        if (!mostRecentRequestedEmailAddress) return;
        const requestedEmailAddressString: string = mostRecentRequestedEmailAddress.address;

        const getDataParams: UserIdParams = {
            contextId: this.contextID,
            userId: person.oxUserId,
            login: this.authUser,
            password: this.authPassword,
        };

        const getDataAction: GetDataForUserAction = new GetDataForUserAction(getDataParams);

        const getDataResult: Result<GetDataForUserResponse, DomainError> = await this.oxService.send(getDataAction);

        if (!getDataResult.ok) {
            mostRecentRequestedEmailAddress.failed();
            await this.emailRepo.save(mostRecentRequestedEmailAddress);
            return this.logger.error(
                `Cannot get data for user with username:${person.referrer} from OX, Aborting Email-Address Change`,
            );
        }
        const newAliasesArray: string[] = getDataResult.value.aliases;
        newAliasesArray.push(requestedEmailAddressString);

        const params: ChangeUserParams = {
            contextId: this.contextID,
            username: getDataResult.value.username,
            givenname: person.vorname,
            surname: person.familienname,
            displayname: person.referrer,
            defaultSenderAddress: requestedEmailAddressString,
            email1: requestedEmailAddressString,
            aliases: newAliasesArray,
            primaryEmail: requestedEmailAddressString,
            login: this.authUser,
            password: this.authPassword,
        };

        const action: ChangeUserAction = new ChangeUserAction(params);

        const result: Result<void, DomainError> = await this.oxService.send(action);

        if (!result.ok) {
            mostRecentRequestedEmailAddress.failed();
            await this.emailRepo.save(mostRecentRequestedEmailAddress);

            return this.logger.error(
                `Could not change email-address for oxUserId:${person.oxUserId} in OX, error: ${result.error.message}`,
            );
        }

        this.logger.info(
            `Changed primary email-address in OX for user, username:${person.referrer}, new email-address:${requestedEmailAddressString}`,
        );

        this.eventService.publish(
            new OxUserChangedEvent(
                personId,
                person.referrer,
                getDataResult.value.id,
                getDataResult.value.username,
                this.contextID,
                this.contextName,
                requestedEmailAddressString,
            ),
        );
    }
}

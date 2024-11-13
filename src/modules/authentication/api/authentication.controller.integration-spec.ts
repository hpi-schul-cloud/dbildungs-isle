import { faker } from '@faker-js/faker/';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { Session, SessionData } from 'express-session';
import { Client, EndSessionParameters, IssuerMetadata } from 'openid-client';

import { ConfigTestModule } from '../../../../test/utils/config-test.module.js';
import { LoggingTestModule } from '../../../../test/utils/logging-test.module.js';
import { FrontendConfig } from '../../../shared/config/frontend.config.js';
import { OIDC_CLIENT } from '../services/oidc-client.service.js';
import { PassportUser } from '../types/user.js';
import { AuthenticationController } from './authentication.controller.js';
import { UserinfoResponse } from './userinfo.response.js';
import { DatabaseTestModule, MapperTestModule } from '../../../../test/utils/index.js';
import { PersonModule } from '../../person/person.module.js';
import { PersonenKontextModule } from '../../personenkontext/personenkontext.module.js';
import { PersonPermissionsRepo } from '../domain/person-permission.repo.js';
import { MikroORM } from '@mikro-orm/core';
import { PersonenkontextRolleFields, PersonPermissions } from '../domain/person-permissions.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { Person } from '../../person/domain/person.js';
import { ServiceProviderModule } from '../../service-provider/service-provider.module.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { KeycloakConfig } from '../../../shared/config/keycloak.config.js';
import { KeycloakUserService } from '../../keycloak-administration/index.js';

describe('AuthenticationController', () => {
    let module: TestingModule;
    let authController: AuthenticationController;
    let oidcClient: DeepMocked<Client>;
    let frontendConfig: FrontendConfig;
    let personPermissionsRepoMock: DeepMocked<PersonPermissionsRepo>;
    let dbiamPersonenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;
    let organisationRepoMock: DeepMocked<OrganisationRepository>;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    const keycloakUserServiceMock: DeepMocked<KeycloakUserService> = createMock<KeycloakUserService>();
    let keyCloakConfig: KeycloakConfig;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                ConfigTestModule,
                LoggingTestModule,
                MapperTestModule,
                ServiceProviderModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                PersonModule,
                PersonenKontextModule,
            ],
            providers: [
                AuthenticationController,
                {
                    provide: PersonPermissionsRepo,
                    useValue: createMock<PersonPermissionsRepo>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: OIDC_CLIENT,
                    useValue: createMock<Client>(),
                },
                {
                    provide: KeycloakUserService,
                    useValue: keycloakUserServiceMock,
                },
            ],
        }).compile();

        await DatabaseTestModule.setupDatabase(module.get(MikroORM));

        authController = module.get(AuthenticationController);
        oidcClient = module.get(OIDC_CLIENT);
        frontendConfig = module.get(ConfigService).getOrThrow<FrontendConfig>('FRONTEND');
        keyCloakConfig = module.get(ConfigService).getOrThrow<KeycloakConfig>('KEYCLOAK');
        personPermissionsRepoMock = module.get(PersonPermissionsRepo);
        dbiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        organisationRepoMock = module.get(OrganisationRepository);
        rolleRepoMock = module.get(RolleRepo);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(async () => {
        await module.get(MikroORM).close();
        await module.close();
    });

    it('should be defined', () => {
        expect(authController).toBeDefined();
    });

    describe('Login', () => {
        it('should redirect', () => {
            const responseMock: Response = createMock<Response>();
            const session: SessionData = { cookie: { originalMaxAge: 0 } };

            authController.login(responseMock, session);

            expect(responseMock.redirect).toHaveBeenCalled();
        });

        it('should redirect to saved redirectUrl', () => {
            const responseMock: Response = createMock<Response>();
            const user: { redirect_uri: string } = { redirect_uri: faker.internet.url() };
            const passport: { user: { redirect_uri: string } } = { user: user };
            const sessionMock: SessionData = createMock<SessionData>({
                redirectUrl: passport.user.redirect_uri,
                passport: passport,
            });

            authController.login(responseMock, sessionMock);

            expect(responseMock.redirect).toHaveBeenCalledWith(sessionMock.redirectUrl);
        });
    });

    describe('Logout', () => {
        function setupRequest(passportUser?: PassportUser, logoutErr?: Error, destroyErr?: Error): Request {
            const sessionMock: DeepMocked<Session> = createMock<Session>();
            const requestMock: DeepMocked<Request> = createMock<Request>({
                session: sessionMock,
                passportUser,
            });
            requestMock.logout.mockImplementationOnce((cb: (err: unknown) => void): void => {
                cb(logoutErr);
            });
            sessionMock.destroy.mockImplementationOnce((cb: (err: unknown) => void): Session => {
                cb(destroyErr);
                return sessionMock;
            });

            return requestMock;
        }

        it('should call request.logout', () => {
            const requestMock: Request = setupRequest();
            oidcClient.issuer.metadata = createMock<IssuerMetadata>({});

            authController.logout(requestMock, createMock());

            expect(requestMock.logout).toHaveBeenCalled();
        });

        it('should call session.destroy', () => {
            const requestMock: Request = setupRequest();
            oidcClient.issuer.metadata = createMock<IssuerMetadata>({});

            authController.logout(requestMock, createMock());

            expect(requestMock.logout).toHaveBeenCalled();
        });

        describe('when end_session_endpoint is defined', () => {
            it('should call endSessionUrl with correct params', () => {
                const user: PassportUser = createMock<PassportUser>({ id_token: faker.string.alphanumeric(32) });
                const requestMock: Request = setupRequest(user);
                oidcClient.issuer.metadata = createMock<IssuerMetadata>({ end_session_endpoint: faker.internet.url() });

                authController.logout(requestMock, createMock());

                expect(oidcClient.endSessionUrl).toHaveBeenCalledWith<[EndSessionParameters]>({
                    id_token_hint: user.id_token,
                    post_logout_redirect_uri: frontendConfig.LOGOUT_REDIRECT,
                    client_id: oidcClient.metadata.client_id,
                });
            });

            it('should redirect to return value of endSessionUrl', () => {
                const user: PassportUser = createMock<PassportUser>({ id_token: faker.string.alphanumeric(32) });
                const requestMock: Request = setupRequest(user);
                const responseMock: Response = createMock<Response>();
                oidcClient.issuer.metadata = createMock<IssuerMetadata>({ end_session_endpoint: faker.internet.url() });
                const endSessionUrl: string = faker.internet.url();
                oidcClient.endSessionUrl.mockReturnValueOnce(endSessionUrl);

                authController.logout(requestMock, responseMock);

                expect(responseMock.redirect).toHaveBeenCalledWith(endSessionUrl);
            });
        });

        describe('when end_session_endpoint is not defined', () => {
            it('should return to redirectUrl param', () => {
                const requestMock: Request = setupRequest();
                const responseMock: Response = createMock<Response>();
                oidcClient.issuer.metadata = createMock<IssuerMetadata>({ end_session_endpoint: undefined });

                authController.logout(requestMock, responseMock);

                expect(responseMock.redirect).toHaveBeenCalledWith(frontendConfig.LOGOUT_REDIRECT);
            });
        });

        describe('when request.logout fails', () => {
            it('should not throw error', () => {
                const requestMock: Request = setupRequest(undefined, new Error());

                expect(() => authController.logout(requestMock, createMock())).not.toThrow();
            });
        });

        describe('when session.destroy fails', () => {
            it('should not throw error', () => {
                const requestMock: Request = setupRequest(undefined, undefined, new Error());

                expect(() => authController.logout(requestMock, createMock())).not.toThrow();
            });
        });
    });

    describe('info', () => {
        function setupRequest(passportUser?: PassportUser): Request {
            const sessionMock: DeepMocked<Session> = createMock<Session>();
            const requestMock: DeepMocked<Request> = createMock<Request>({
                session: sessionMock,
                passportUser,
            });
            return requestMock;
        }

        it('should return user info', async () => {
            const person: Person<true> = Person.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.person.lastName(),
                faker.person.firstName(),
                '1',
                faker.lorem.word(),
                undefined,
                faker.string.uuid(),
            );
            person.geburtsdatum = faker.date.past();

            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );
            personPermissionsRepoMock.loadPersonPermissions.mockResolvedValueOnce(personPermissions);

            const permissions: PersonPermissions = createMock<PersonPermissions>({
                get personFields(): Person<true> {
                    return createMock<Person<true>>({
                        geburtsdatum: createMock(),
                        updatedAt: new Date(Date.now()),
                    });
                },
                getPersonenkontextewithRoles: (): Promise<PersonenkontextRolleFields[]> =>
                    Promise.resolve([
                        {
                            organisationsId: '',
                            rolle: { systemrechte: [], serviceProviderIds: [] },
                        },
                    ]),
            });
            keycloakUserServiceMock.getLastPasswordChange.mockResolvedValueOnce({
                ok: true,
                value: person.updatedAt,
            });

            const requestMock: Request = setupRequest();
            const result: UserinfoResponse = await authController.info(permissions, requestMock);

            expect(result).toBeInstanceOf(UserinfoResponse);
            expect(result.birthdate!).toBe(permissions.personFields.geburtsdatum?.toISOString());
        });
    });

    describe('ResetPassword', () => {
        it('should redirect to the correct Keycloak URL', () => {
            const responseMock: Response = createMock<Response>();
            const redirectUrl: string = faker.internet.url();
            const loginHint: string = faker.internet.userName();
            authController.resetPassword(redirectUrl, loginHint, responseMock);
            const keyCloakRealm: string = keyCloakConfig.REALM_NAME.toLowerCase();
            const expectedUrl: string = `${oidcClient.issuer.metadata.authorization_endpoint}?client_id=${keyCloakRealm}&login_hint=${loginHint}&response_type=code&scope=openid&kc_action=UPDATE_PASSWORD&redirect_uri=${redirectUrl}`;
            expect(responseMock.redirect).toHaveBeenCalledWith(expectedUrl);
        });
    });
});

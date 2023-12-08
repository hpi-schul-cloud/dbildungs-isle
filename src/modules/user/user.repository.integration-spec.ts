import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository } from './user.repository.js';
import { UserModule } from './user.module.js';
import { ConfigTestModule, DatabaseTestModule, MapperTestModule } from '../../../test/utils/index.js';
import { KeycloakUserService, UserDo } from '../keycloak-administration/index.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { EntityNotFoundError, KeycloakClientError } from '../../shared/error/index.js';
import { User } from './user.js';

describe('A User', () => {
    let module: TestingModule;
    let userRepository: UserRepository;
    let kcUserService: DeepMocked<KeycloakUserService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [UserModule, ConfigTestModule, DatabaseTestModule.forRoot(), MapperTestModule],
        })
            .overrideProvider(KeycloakUserService)
            .useValue(createMock<KeycloakUserService>())
            .compile();
        await module.init();

        userRepository = module.get(UserRepository);
        kcUserService = module.get(KeycloakUserService);
    });

    beforeEach(() => {
        kcUserService.findOne.mockResolvedValue({ ok: false, error: new EntityNotFoundError('Not found') });
    });

    describe('when its created', () => {
        let createdUser: User;
        beforeEach(async () => {
            createdUser = await userRepository.createUser('Max', 'Mustermann');
        });

        it('should have a derived username', () => {
            expect(createdUser.username).toBe('mmustermann');
        });

        it('should have a random password', () => {
            expect(createdUser.newPassword).toHaveLength(10);
        });

        it('should be pristine', () => {
            expect(createdUser.needsSaving).toBe(true);
            expect(createdUser.new).toBe(true);
        });
    });

    describe("when it's saved", () => {
        it('should receive an id', async () => {
            const user: User = new User('', 'mmustermann', 'abcdefg123');
            await user.save(kcUserService);
            expect(kcUserService.create).toBeCalled();
            expect(user.id).not.toBeFalsy();
        });
    });

    describe("when it's loaded", () => {
        let loadedUserMmustermann: User;
        let loadedUserRbergmann: User;

        beforeAll(() => {
            kcUserService.findById.mockImplementation((id: string) => {
                const result: UserDo<true> = new UserDo<true>();
                if (id == 'abcdefghi') {
                    result.id = 'abcdefghi';
                    result.username = 'mmustermann';
                    return Promise.resolve({
                        ok: true,
                        value: result,
                    });
                }
                if (id == '1234567') {
                    result.id = '1234567';
                    result.username = 'rbergmann';
                    return Promise.resolve({
                        ok: true,
                        value: result,
                    });
                }
                return Promise.resolve({ ok: false, error: new EntityNotFoundError('Not found') });
            });
        });

        afterAll(() => {
            kcUserService.findById.mockReset();
        });

        beforeEach(async () => {
            loadedUserMmustermann = await userRepository.loadUser('abcdefghi');
            loadedUserRbergmann = await userRepository.loadUser('1234567');
        });

        it('Should have its username set correctly', () => {
            expect(loadedUserMmustermann.username).toBe('mmustermann');
            expect(loadedUserRbergmann.username).toBe('rbergmann');
        });

        it('should have its ID set correctly', () => {
            expect(loadedUserMmustermann.id).toBe('abcdefghi');
            expect(loadedUserRbergmann.id).toBe('1234567');
        });

        it('should not be pristine', () => {
            expect(loadedUserMmustermann.new).not.toBeTruthy();
            expect(loadedUserRbergmann.new).not.toBeTruthy();
        });
        it('should not need saving', () => {
            expect(loadedUserMmustermann.needsSaving).not.toBeTruthy();
            expect(loadedUserRbergmann.needsSaving).not.toBeTruthy();
        });
        it('should not have a password set', () => {
            expect(loadedUserMmustermann.newPassword).toBeFalsy();
            expect(loadedUserRbergmann.newPassword).toBeFalsy();
        });
    });

    describe('when loading', () => {
        beforeAll(() => {
            kcUserService.findById.mockResolvedValueOnce({
                ok: false,
                error: new KeycloakClientError('KC could not be reached'),
            });
        });

        it('should propagate errors nicely', async () => {
            await expect(userRepository.loadUser('abcdefg')).rejects.toThrow(
                new KeycloakClientError('KC could not be reached'),
            );
        });
    });

    describe('when being deleted', () => {
        let userBergbaum: User;
        let userHerberg: User;

        beforeAll(() => {
            userBergbaum = new User('abcdefg', 'mbergbaum', '');
            userHerberg = new User('dkapcda', 'kherberg', '');
        });

        it('should call the keycloak service with its id', async () => {
            await userRepository.deleteUser(userBergbaum);
            expect(kcUserService.delete).toBeCalledWith('abcdefg');

            await userRepository.deleteUser(userHerberg);
            expect(kcUserService.delete).toBeCalledWith('dkapcda');
        });

        it('should silently ignore deletion of new users', async () => {
            const newUser: User = new User('', 'uneumann', '');
            await userRepository.deleteUser(newUser);

            expect(kcUserService.delete).not.toHaveBeenCalled();
        });
    });
});

import { Injectable } from '@nestjs/common';
import { User } from './user.js';
import { UsernameGeneratorService } from './username-generator.service.js';
import { KeycloakUserService, UserDo } from '../keycloak-administration/index.js';
import { DomainError } from '../../shared/error/index.js';

@Injectable()
export class UserRepository {
    public constructor(
        private usernameGenerator: UsernameGeneratorService,
        private kcUserService: KeycloakUserService,
    ) {}

    public async createUser(vorname: string, nachname: string): Promise<User> {
        const username: string = await this.usernameGenerator.generateUsername(vorname, nachname);
        const newUser: User = new User('', username, 'unset');
        newUser.resetPassword();
        return newUser;
    }

    public async loadUser(id: string): Promise<User> {
        const loadedKcUser: Result<UserDo<true>, DomainError> = await this.kcUserService.findById(id);
        if (loadedKcUser.ok) {
            const value: UserDo<true> = loadedKcUser.value;
            return new User(value.id, value.username, '');
        } else {
            throw loadedKcUser.error;
        }
    }

    public async deleteUser(user: User): Promise<void> {
        if (!user.new) {
            await this.kcUserService.delete(user.id);
        }
    }
}

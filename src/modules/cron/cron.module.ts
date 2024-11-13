import { Module } from '@nestjs/common';
import { CronController } from './cron.controller.js';
import { KeycloakAdministrationModule } from '../keycloak-administration/keycloak-administration.module.js';
import { PersonModule } from '../person/person.module.js';
import { PersonDeleteModule } from '../person/person-deletion/person-delete.module.js';
import { PersonenKontextModule } from '../personenkontext/personenkontext.module.js';

@Module({
    imports: [PersonModule, PersonenKontextModule, KeycloakAdministrationModule, PersonDeleteModule],
    controllers: [CronController],
})
export class CronModule {}

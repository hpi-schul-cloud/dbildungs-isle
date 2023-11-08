import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/error/domain.error.js';
import { Paged } from '../../../shared/paging/index.js';
import { KeycloakUserService, UserDo } from '../../keycloak-administration/index.js';
import { CreatePersonDto } from './create-person.dto.js';
import { PersonDo } from '../domain/person.do.js';
import { PersonService } from '../domain/person.service.js';
import { PersonenkontextDo } from '../domain/personenkontext.do.js';
import { PersonenkontextService } from '../domain/personenkontext.service.js';
import { FindPersonendatensatzDto } from './find-personendatensatz.dto.js';
import { FindPersonenkontextDto } from './find-personenkontext.dto.js';
import { PersonDto } from './person.dto.js';
import { SichtfreigabeType } from './personen-query.param.js';
import { PersonendatensatzDto } from './personendatensatz.dto.js';
import { PersonenkontextDto } from './personenkontext.dto.js';

@Injectable()
export class PersonUc {
    public constructor(
        private readonly personService: PersonService,
        private readonly personenkontextService: PersonenkontextService,
        private readonly userService: KeycloakUserService,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
    ) {}

    public async createPerson(personDto: CreatePersonDto): Promise<void> {
        // create user
        const userDo: UserDo<false> = this.mapper.map(personDto, CreatePersonDto, UserDo<false>);
        const userIdResult: Result<string> = await this.userService.create(userDo);
        if (!userIdResult.ok) {
            throw userIdResult.error;
        }

        // create person
        const personDo: PersonDo<false> = this.mapper.map(personDto, CreatePersonDto, PersonDo);
        personDo.keycloakUserId = userIdResult.value;

        const result: Result<PersonDo<true>> = await this.personService.createPerson(personDo);
        if (result.ok) {
            return;
        }

        // delete user if person could not be created
        const deleteUserResult: Result<void> = await this.userService.delete(userIdResult.value);
        if (deleteUserResult.ok) {
            throw result.error;
        } else {
            throw deleteUserResult.error;
        }
    }

    public async findPersonById(id: string): Promise<PersonendatensatzDto> {
        const result: Result<PersonDo<true>> = await this.personService.findPersonById(id);

        if (!result.ok) {
            throw result.error;
        }

        const personDto: PersonDto = this.mapper.map(result.value, PersonDo, PersonDto);
        const personenkontexteDto: PersonenkontextDto[] = await this.findPersonenkontexteForPerson(
            id,
            SichtfreigabeType.NEIN,
        );

        return new PersonendatensatzDto({
            person: personDto,
            personenkontexte: personenkontexteDto,
        });
    }

    public async findAll(personDto: FindPersonendatensatzDto): Promise<Paged<PersonendatensatzDto>> {
        const personDo: PersonDo<false> = this.mapper.map(personDto, FindPersonendatensatzDto, PersonDo);
        const result: Paged<PersonDo<true>> = await this.personService.findAllPersons(
            personDo,
            personDto.offset,
            personDto.limit,
        );

        if (result.total === 0) {
            return {
                total: result.total,
                offset: result.offset,
                limit: result.limit,
                items: [],
            };
        }

        const personDtos: PersonDto[] = result.items.map((person: PersonDo<true>) =>
            this.mapper.map(person, PersonDo, PersonDto),
        );
        const personendatensatzDtos: PersonendatensatzDto[] = [];

        for (const person of personDtos) {
            const personenkontextDtos: PersonenkontextDto[] = await this.findPersonenkontexteForPerson(
                person.id,
                personDto.sichtfreigabe,
            );

            personendatensatzDtos.push(
                new PersonendatensatzDto({
                    person,
                    personenkontexte: personenkontextDtos,
                }),
            );
        }

        return {
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            items: personendatensatzDtos,
        };
    }

    public async resetPassword(personId: string): Promise<Result<string>> {
        return this.userService.resetPasswordByPersonId(personId);
    }

    private async findPersonenkontexteForPerson(
        personId: string,
        sichtfreigabe: SichtfreigabeType,
    ): Promise<PersonenkontextDto[]> {
        const personenkontextFilter: FindPersonenkontextDto = {
            personId: personId,
            sichtfreigabe: sichtfreigabe,
        };
        const result: Result<PersonenkontextDo<true>[], DomainError> =
            await this.personenkontextService.findAllPersonenkontexte(
                this.mapper.map(personenkontextFilter, FindPersonenkontextDto, PersonenkontextDo),
            );

        if (!result.ok) {
            return [];
        }

        const personenkontextDtos: PersonenkontextDto[] = result.value.map((personenkontext: PersonenkontextDo<true>) =>
            this.mapper.map(personenkontext, PersonenkontextDo, PersonenkontextDto),
        );

        return personenkontextDtos;
    }
}

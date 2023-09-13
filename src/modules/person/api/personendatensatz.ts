import { AutoMap } from '@automapper/classes';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ValidateNested } from 'class-validator';
import { PersonResponse } from './person.response.js';

export class PersonenDatensatz {
    @AutoMap(() => PersonResponse)
    @ValidateNested()
    @Type(() => PersonResponse)
    @ApiProperty({ name: 'person', type: PersonResponse, required: true })
    public person!: PersonResponse;

    // personKontext wird spaeter hier hinzugefuegt.
}

import { AutoMap } from '@automapper/classes';

export class FindPersonDatensatzDTO {
    @AutoMap()
    public referrer?: string;

    @AutoMap()
    public familienname?: string;

    @AutoMap()
    public vorname?: string;
}

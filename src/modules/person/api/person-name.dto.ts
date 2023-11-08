import { AutoMap } from '@automapper/classes';

export class PersonNameDto {
    @AutoMap()
    public vorname: string = '';

    @AutoMap()
    public familienname: string = '';

    @AutoMap()
    public initialenfamilienname?: string;

    @AutoMap()
    public initialenvorname?: string;

    @AutoMap()
    public rufname?: string;

    @AutoMap()
    public titel?: string;

    @AutoMap(() => [String])
    public anrede?: string[];

    @AutoMap(() => [String])
    public namenssuffix?: string[];

    @AutoMap(() => [String])
    public namenspraefix?: string[];

    @AutoMap()
    public sortierindex?: string;

    public constructor(props: Readonly<PersonNameDto>) {
        Object.assign(this, props);
    }
}

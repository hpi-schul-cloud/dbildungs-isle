import { IsInt, Min } from 'class-validator';

export class ImportConfig {
    @Min(0)
    @IsInt()
    public readonly IMPORT_FILE_MAXGROESSE_IN_MB!: number;
}

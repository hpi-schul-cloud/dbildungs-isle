import { CommandRunner, SubCommand } from 'nest-commander';
import { ClassLogger } from '../../core/logging/class-logger.js';
import { EntityFile } from './db-seed.console.js';
import { OrganisationFile } from './file/organisation-file.js';
import { OrganisationsTyp } from '../../modules/organisation/domain/organisation.enums.js';
import { promises as fs } from 'fs';

@SubCommand({ name: 'seedingdata-generate', description: 'generates seed data in seeding folder' })
export class DbSeedDataGeneratorConsole extends CommandRunner {
    public constructor(private readonly logger: ClassLogger) {
        super();
    }

    private getDirectory(_passedParams: string[]): string {
        if (_passedParams[0] !== undefined) {
            return _passedParams[0];
        }
        throw new Error('No directory provided!');
    }

    private getParameterValue(_passedParams: string[], paramName: string): number {
        const parameter: string | undefined = _passedParams.find((arg: string) => arg.startsWith(paramName));

        let paramValue: number;
        if (parameter) {
            paramValue = Number(parameter.split('=')[1]);
            this.logger.info(`${paramName}: ${paramValue}`);
            return paramValue;
        }

        throw new Error(`The parameter ${paramName} was not provided`);
    }

    private validationParamValues(schoolCount: number, classCount: number): void {
        if (schoolCount <= 0) {
            throw new Error('The value for numberOfSchools provided muss be greater than 0');
        }

        if (classCount <= 0) {
            throw new Error('The value for classesPerSchool provided muss be greater than 0');
        }
        if (classCount % 3 != 0) {
            throw new Error('The value for classesPerSchool provided muss be divisible by 3');
        }
    }

    private getOrganisations(schoolCount: number, classCount: number): EntityFile<OrganisationFile> {
        const defaultSchoolName: string = 'Testschule';

        const organisations: OrganisationFile[] = [];
        const klassen: string[] = ['A', 'B', 'C'];
        const lastOrgaId: number = 14;
        let klassenIdIndex: number = 1;

        for (let i: number = 1; i <= schoolCount; i++) {
            const schuleId: number = lastOrgaId + i;
            const kennung: string = '11111' + schuleId;
            const schulname: string = `${defaultSchoolName}-${schuleId}`;

            organisations.push({
                id: schuleId,
                kennung: kennung,
                name: schulname,
                namensergaenzung: 'Keine',
                kuerzel: schulname,
                typ: OrganisationsTyp.SCHULE,
                administriertVon: 1,
                zugehoerigZu: 1,
            });

            for (let j: number = 1; j <= classCount / 3; j++) {
                for (let k: number = 0; k < klassen.length; k++) {
                    const klasseId: number = schoolCount + lastOrgaId + klassenIdIndex;
                    const klassenname: string = j + klassen[k]!;

                    organisations.push({
                        id: klasseId,
                        name: klassenname,
                        namensergaenzung: 'Keine',
                        typ: OrganisationsTyp.KLASSE,
                        administriertVon: schuleId,
                        zugehoerigZu: schuleId,
                    });

                    klassenIdIndex++;
                }
            }
        }

        return {
            entityName: 'Organisation',
            entities: organisations,
        };
    }

    public override async run(_passedParams: string[], _options?: Record<string, unknown>): Promise<void> {
        this.logger.info('Initializing seed data generator...');
        const directory: string = this.getDirectory(_passedParams);
        const schoolCount: number = this.getParameterValue(_passedParams, 'numberOfSchools');
        const classCount: number = this.getParameterValue(_passedParams, 'classesPerSchool');

        this.validationParamValues(schoolCount, classCount);

        this.logger.info('Generating Schulen & Klassen...');
        try {
            const jsonData: string = JSON.stringify(this.getOrganisations(schoolCount, classCount), null, '\t');
            const organisationFilePath: string = directory + '06_organisation.json';
            await fs.writeFile(organisationFilePath, jsonData);
            this.logger.info(`Saved data successfully under: ${organisationFilePath}`);
        } catch (error) {
            this.logger.error('Something went wrong when saving generating seeding data!');
            this.logger.error(String(error));
            throw error;
        }

        this.logger.info('Seed data generated');
    }
}

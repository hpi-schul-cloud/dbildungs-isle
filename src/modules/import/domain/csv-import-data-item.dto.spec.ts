import { plainToInstance } from 'class-transformer';
import 'reflect-metadata';
import { CSVImportDataItemDTO } from './csv-import-data-item.dto.js';

describe('CSVImportDataItemDTO', () => {
    const cSVImportDataItemDTO: CSVImportDataItemDTO = {
        nachname: 'John',
        vorname: 'Doe',
        klasse: '1A',
        personalnummer: '1234567',
    };

    it('should convert a plain object to a class of CSVImportDataItemDTO', () => {
        const incomingParams: object = {
            nachname: 'John',
            vorname: 'Doe',
            klasse: '1A',
            personalnummer: '1234567',
        };
        const mappedParams: CSVImportDataItemDTO = plainToInstance(CSVImportDataItemDTO, incomingParams, {});
        expect(mappedParams).toBeInstanceOf(CSVImportDataItemDTO);
        expect(mappedParams).toEqual(cSVImportDataItemDTO);
    });
});

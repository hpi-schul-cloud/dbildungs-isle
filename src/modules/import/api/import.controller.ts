import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    ParseFilePipeBuilder,
    Post,
    Res,
    StreamableFile,
    UploadedFile,
    UseFilters,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiConsumes,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOAuth2,
    ApiOkResponse,
    ApiProduces,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SchulConnexValidationErrorFilter } from '../../../shared/error/schulconnex-validation-error.filter.js';
import { AuthenticationExceptionFilter } from '../../authentication/api/authentication-exception-filter.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { DbiamPersonenkontextImportBodyParams } from './dbiam-personenkontext-import.body.params.js';
import { ImportWorkflowFactory } from '../domain/import-workflow.factory.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { Permissions } from '../../authentication/api/permissions.decorator.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { ImportUploadResultFields, ImportWorkflow } from '../domain/import-workflow.js';
import { DbiamImportError } from './dbiam-import.error.js';
import { ImportvorgangByIdBodyParams } from './importvorgang-by-id.body.params.js';
import { Response } from 'express';
import { ImportUploadResponse } from './importvorgang-upload.response.js';
import { ImportDomainError } from '../domain/import-domain.error.js';
import { SchulConnexErrorMapper } from '../../../shared/error/schul-connex-error.mapper.js';
import { ImportExceptionFilter } from './import-exception-filter.js';

@UseFilters(SchulConnexValidationErrorFilter, new AuthenticationExceptionFilter(), new ImportExceptionFilter())
@ApiTags('import')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'import' })
export class ImportController {
    public constructor(private readonly importWorkflowFactory: ImportWorkflowFactory) {}

    @Post('upload')
    @ApiConsumes('multipart/form-data')
    @ApiOkResponse({ description: 'Returns an import upload response object.', type: ImportUploadResponse })
    @ApiBadRequestResponse({ description: 'The CSV file was not valid.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to import data with a CSV file.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to import data with a CSV file.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while importing data with a CSV file.' })
    @UseInterceptors(FileInterceptor('file'))
    public async uploadFile(
        @Body() body: DbiamPersonenkontextImportBodyParams,
        @UploadedFile(
            new ParseFilePipeBuilder()
                .addFileTypeValidator({
                    fileType: 'text/csv',
                })
                .build({
                    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
                    fileIsRequired: true,
                }),
        )
        file: Express.Multer.File,
        @Permissions() permissions: PersonPermissions,
    ): Promise<ImportUploadResponse> {
        const importWorkflow: ImportWorkflow = this.importWorkflowFactory.createNew();
        importWorkflow.initialize(body.organisationId, body.rolleId);
        const result: DomainError | ImportUploadResultFields = await importWorkflow.validateImport(file, permissions);
        if (result instanceof DomainError) {
            if (result instanceof ImportDomainError) {
                throw result;
            }

            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result),
            );
        }

        return new ImportUploadResponse(result.importVorgangId, result.isValid);
    }

    @ApiProduces('text/plain')
    @Post('execute')
    @HttpCode(HttpStatus.OK)
    @ApiOkResponse({
        description: 'Import transaction was executed successfully. The text file can be downloaded',
        schema: {
            type: 'string',
            format: 'binary',
        },
    })
    @ApiNotFoundResponse({ description: 'The import transaction does not exist.' })
    @ApiBadRequestResponse({
        description: 'Something went wrong with the found import transaction.',
        type: DbiamImportError,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to execute the import transaction.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to execute the import transaction.' })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error while executing the import transaction.',
    })
    public async executeImport(
        @Body() body: ImportvorgangByIdBodyParams,
        @Res({ passthrough: true }) res: Response,
        @Permissions() permissions: PersonPermissions,
    ): Promise<StreamableFile> {
        const importWorkflow: ImportWorkflow = this.importWorkflowFactory.createNew();
        importWorkflow.initialize(body.organisationId, body.rolleId);
        const result: Result<Buffer> = await importWorkflow.executeImport(body.importvorgangId, permissions);

        if (!result.ok) {
            if (result.error instanceof ImportDomainError) {
                throw result.error;
            }

            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error as DomainError),
            );
        } else {
            const fileName: string = importWorkflow.getFileName(body.importvorgangId);
            const contentDisposition: string = `attachment; filename="${fileName}"`;
            res.set({
                'Content-Type': 'text/plain',
                'Content-Disposition': contentDisposition,
            });
            return new StreamableFile(result.value);
        }
    }
}

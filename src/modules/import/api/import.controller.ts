import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseFilePipeBuilder,
    Post,
    Query,
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
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOAuth2,
    ApiOkResponse,
    ApiOperation,
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
import { ImportvorgangByIdParams } from './importvorgang-by-id.params.js';
import { ImportvorgangQueryParams } from './importvorgang-query.param.js';
import { PagingHeadersObject } from '../../../shared/paging/paging.enums.js';
import { ImportVorgangResponse } from './importvorgang.response.js';
import { PagedResponse } from '../../../shared/paging/paged.response.js';
import { ImportVorgangRepository } from '../persistence/import-vorgang.repository.js';
import { ImportVorgang } from '../domain/import-vorgang.js';
import { Paged } from '../../../shared/paging/paged.js';
import { ImportStatus } from '../domain/import.enums.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';

@UseFilters(SchulConnexValidationErrorFilter, new AuthenticationExceptionFilter(), new ImportExceptionFilter())
@ApiTags('import')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'import' })
export class ImportController {
    public constructor(
        private readonly importWorkflowFactory: ImportWorkflowFactory,
        private readonly importVorgangRepository: ImportVorgangRepository,
    ) {}

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
                    fileType: 'text/csv|application/vnd.ms-excel', //added application/vnd.ms-excel for firefox compatibility with csv files
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

        return new ImportUploadResponse(
            result.importVorgangId,
            result.isValid,
            result.totalImportDataItems,
            result.invalidImportDataItems,
        );
    }

    @ApiProduces('text/plain')
    @Post('execute')
    @HttpCode(HttpStatus.OK)
    @ApiOkResponse({
        description: 'The execution of the import transaction was initiated successfully.',
        type: undefined,
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
        @Permissions() permissions: PersonPermissions,
    ): Promise<void> {
        const importWorkflow: ImportWorkflow = this.importWorkflowFactory.createNew();
        importWorkflow.initialize(body.organisationId, body.rolleId);
        const result: Result<void> = await importWorkflow.executeImport(body.importvorgangId, permissions);

        if (!result.ok) {
            if (result.error instanceof ImportDomainError) {
                throw result.error;
            }

            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error as DomainError),
            );
        }
    }

    @Delete(':importvorgangId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ description: 'Delete a role by id.' })
    @ApiNoContentResponse({ description: 'Import transaction was deleted successfully.' })
    @ApiBadRequestResponse({
        description: 'Something went wrong with the found import transaction.',
        type: DbiamImportError,
    })
    @ApiNotFoundResponse({ description: 'The import transaction that should be deleted does not exist.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to delete the import transaction.' })
    public async deleteImportTransaction(
        @Param() params: ImportvorgangByIdParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<void> {
        const importWorkflow: ImportWorkflow = this.importWorkflowFactory.createNew();
        const result: Result<void> = await importWorkflow.cancelImport(params.importvorgangId, permissions);
        if (!result.ok) {
            if (result.error instanceof DomainError) {
                throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                    SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error),
                );
            }
        }
    }

    @Get('history')
    @ApiOperation({ description: 'Get the history of import.' })
    @ApiOkResponse({
        description: 'The import transactions were successfully returned',
        type: [ImportVorgangResponse],
        headers: PagingHeadersObject,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get import transactions.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get import transactions.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting import transactions.' })
    public async findImportTransactions(
        @Query() queryParams: ImportvorgangQueryParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PagedResponse<ImportVorgangResponse>> {
        const [result, total]: [ImportVorgang<true>[], number] = await this.importVorgangRepository.findAuthorized(
            permissions,
            {
                status: queryParams.status,
                personId: permissions.personFields.id,
                rolleIds: queryParams.rolleIds,
                organisationIds: queryParams.organisationIds,
                offset: queryParams.offset,
                limit: queryParams.limit,
            },
        );

        const pagedImportVorgangResponse: Paged<ImportVorgangResponse> = {
            total: total,
            offset: queryParams.offset ?? 0,
            limit: queryParams.limit ?? result.length,
            items: result.map((importVorgang: ImportVorgang<true>) => new ImportVorgangResponse(importVorgang)),
        };

        return new PagedResponse(pagedImportVorgangResponse);
    }

    @ApiProduces('text/plain')
    @Post('download')
    @HttpCode(HttpStatus.OK)
    @ApiOkResponse({
        description: 'The import result file was generated and downloaded successfully.',
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
    @ApiUnauthorizedResponse({ description: 'Not authorized to download the import result.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to download the import result.' })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error while generating the import result file.',
    })
    public async downloadFile(
        @Body() body: ImportvorgangByIdBodyParams,
        @Res({ passthrough: true }) res: Response,
        @Permissions() permissions: PersonPermissions,
    ): Promise<StreamableFile> {
        const importWorkflow: ImportWorkflow = this.importWorkflowFactory.createNew();
        importWorkflow.initialize(body.organisationId, body.rolleId);
        const result: Result<Buffer> = await importWorkflow.downloadFile(body.importvorgangId, permissions);

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

    @Get(':importvorgangId/status')
    @ApiOperation({ description: 'Get status for the import transaction by id.' })
    @ApiOkResponse({
        description: 'The status for the import transaction was successfully returned.',
        type: String,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get the status for the import transaction by id.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to get status for the import transaction by id.' })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error while getting status for the import transaction by id.',
    })
    public async getImportStatus(@Param() params: ImportvorgangByIdParams): Promise<ImportStatus> {
        const result: Option<ImportVorgang<true>> = await this.importVorgangRepository.findById(params.importvorgangId);
        if (!result) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('ImportVorgang', params.importvorgangId),
                ),
            );
        }

        return result.status;
    }
}

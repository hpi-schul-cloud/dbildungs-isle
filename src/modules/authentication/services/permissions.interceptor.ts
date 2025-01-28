import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload, decode } from 'jsonwebtoken';
import { Observable } from 'rxjs';
import { PersonPermissionsRepo } from '../domain/person-permission.repo.js';
import { PersonPermissions } from '../domain/person-permissions.js';

@Injectable()
export class PermissionsInterceptor implements NestInterceptor {
    public constructor(private personPermissionsRepo: PersonPermissionsRepo) {}

    public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const req: Request = context.switchToHttp().getRequest();

        if (req.passportUser?.access_token) {
            const decoded: string | JwtPayload | null = decode(req.passportUser.access_token);
            const subjectId: string | undefined = decoded?.sub as string | undefined;

            if (subjectId) {
                req.passportUser.personPermissions = async (): Promise<PersonPermissions> => {
                    return this.personPermissionsRepo.loadPersonPermissions(subjectId);
                };
            }
        }
        return next.handle();
    }
}

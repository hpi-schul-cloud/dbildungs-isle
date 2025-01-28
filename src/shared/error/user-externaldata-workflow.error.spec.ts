import { UserExternalDataWorkflowError } from './user-externaldata-workflow.error.js';

describe('UserExternalDataWorkflowError', () => {
    describe('constructor', () => {
        describe('when calling the constructor', () => {
            it('should set message and code', () => {
                const error: UserExternalDataWorkflowError = new UserExternalDataWorkflowError('Mein Text');
                expect(error.message).toBe('Mein Text');
                expect(error.code).toBe('USER_EXTERNALDATA_WORKFLOW');
            });
        });
    });
});

import { PersonID } from '../../../shared/types/aggregate-ids.types.js';

export class UserLock {
    private constructor(
        public person: PersonID,
        public locked_by: string,
        public locked_until: Date | undefined,
        public created_at: Date | undefined,
    ) {}

    public static construct(
        person: PersonID,
        locked_by: string,
        locked_until: Date | undefined,
        created_at: Date,
    ): UserLock {
        return new UserLock(person, locked_by, locked_until, created_at);
    }
}

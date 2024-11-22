// Partial, actual structure contains more data
export type CreateGroupParams = {
    id: string;

    name: string;
    type: 'Unspecified' | 'Site' | 'School' | 'Course' | 'CourseGroup';

    parentId: string;
    relationLabel?: string;

    longDescription?: string;
    fullDescription?: string;
};

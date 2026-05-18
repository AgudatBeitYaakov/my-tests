export const TEACHER_COLUMNS =
  "id, first_name, last_name, full_name_generated, tz, email, notes, created_at, deleted_at";

export const TEACHER_EMBED_FIELDS = "id, first_name, last_name, full_name_generated";

export const TEACHER_EMBED = `teachers ( ${TEACHER_EMBED_FIELDS}, email, tz )`;

export const TEACHER_EMBED_IN_EXAM = `teachers ( ${TEACHER_EMBED_FIELDS} )`;

export const ASSIGNMENT_WITH_LOOKUPS = `
  *,
  teachers ( id, first_name, last_name, full_name_generated, email, tz )
`;

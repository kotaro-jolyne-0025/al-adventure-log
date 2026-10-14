/** Preserve the server timestamp verbatim; Date would lose PostgreSQL microseconds. */
export interface WritePrecondition { expectedUpdatedAt?: string; }

export function versionHeader(expectedUpdatedAt?: string) {
  return { headers: { 'X-Expected-Updated-At': expectedUpdatedAt ?? '' } };
}

export function writeRequest<T extends WritePrecondition>(request: T) {
  const { expectedUpdatedAt, ...body } = request;
  return { body, options: versionHeader(expectedUpdatedAt) };
}

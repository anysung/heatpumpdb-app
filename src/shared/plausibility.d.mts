export declare const CARNOT: Record<'cop_A7W35' | 'cop_A2W35' | 'cop_AMinus7W35', number>;
export declare const COP_FIELDS: string[];
export declare function impossibleFields(r: Record<string, unknown>): string[];
export declare function inconsistentFields(r: Record<string, unknown>): string[];
export declare function sanitizeRecord<T extends Record<string, unknown>>(r: T): T & { qa_removed?: string[]; qa_flags?: string[] };
export declare function plausibilityOf(r: Record<string, unknown>): { removed: string[]; flags: string[]; needsCheck: boolean };

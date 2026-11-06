export type OutdoorVisual = { kind: 'photo'; id: string } | { kind: 'graphic' } | null;
export declare const unitWidths: number[];
export declare function unitFile(id: string, width: number): string;
export declare function outdoorVisual(brand: unknown, type: unknown, segment: string): OutdoorVisual;

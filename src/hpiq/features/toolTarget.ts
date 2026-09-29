/**
 * Which product a calculator opens with (2026-09-29). The product detail's
 * "Noise check" / "Running cost" buttons set it and navigate; the calculator
 * reads it once on mount. Module-level so HpiqApp needs no new state.
 */
let target: string | null = null;
export const setToolTarget = (id: string | null) => { target = id; };
export const takeToolTarget = (): string | null => { const t = target; target = null; return t; };
export const peekToolTarget = (): string | null => target;

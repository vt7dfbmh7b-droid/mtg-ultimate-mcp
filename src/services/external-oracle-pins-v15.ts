import type { ExternalOracleIdV15 } from './external-oracles-v15.js';

export interface ExternalOracleBaselinePinV15 {
  oracleId: ExternalOracleIdV15;
  repository: string;
  commit: string;
  capturedDate: string;
  note: string;
}

/**
 * Reproducible baseline revisions captured during V0.15 development.
 * These are not auto-updated. Upstream movement should be reviewed and compared
 * before a new revision becomes a deterministic benchmark baseline.
 */
export const EXTERNAL_ORACLE_BASELINE_PINS_V15: Record<ExternalOracleIdV15, ExternalOracleBaselinePinV15> = {
  'j4th-mtg-mcp': {
    oracleId: 'j4th-mtg-mcp',
    repository: 'j4th/mtg-mcp-server',
    commit: 'f1a614013bd115c058275c347d83c78ebf6360b2',
    capturedDate: '2026-08-17',
    note: 'v3.0.0-era baseline used for MCP/deck-workflow comparison planning.',
  },
  'nccurry-mtg-mcp': {
    oracleId: 'nccurry-mtg-mcp',
    repository: 'nccurry/mtg-mcp',
    commit: '117d5ca83f3fa41944624fe3a1db5ef7321b6963',
    capturedDate: '2026-08-17',
    note: '0.9.0 evidence-first baseline used for statistics/evidence architecture comparison.',
  },
  forge: {
    oracleId: 'forge',
    repository: 'Card-Forge/forge',
    commit: '1dfbcc87c85b90b37b390a22045541be0f09a59c',
    capturedDate: '2026-08-17',
    note: 'Forge rules/simulation reference baseline. Snapshot fixtures should record the exact commit actually executed.',
  },
  manabrew: {
    oracleId: 'manabrew',
    repository: 'witchesofthehill/manabrew',
    commit: '8ff8bde643ad87bb9be177e32a57fb7954f93ae2',
    capturedDate: '2026-08-17',
    note: 'Manabrew parity-methodology baseline; remains in the same independence family as Forge.',
  },
};

export function baselineExternalOracleVersionV15(oracleId: ExternalOracleIdV15): string {
  return EXTERNAL_ORACLE_BASELINE_PINS_V15[oracleId].commit;
}

export function isPinnedExternalOracleVersionV15(oracleId: ExternalOracleIdV15, version: string): boolean {
  return EXTERNAL_ORACLE_BASELINE_PINS_V15[oracleId].commit === version.trim();
}

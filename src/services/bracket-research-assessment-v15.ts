import {
  assessBracketCeilingV15,
  type BracketAssessmentSignalsV15,
  type BracketCeilingAssessmentV15,
  type CommanderBracketV15,
} from './bracket-ceiling-v15.js';
import {
  evaluateCompetitiveBracketEvidenceV15,
  type CompetitiveBracketEvidenceV15,
} from './competitive-bracket-evidence-v15.js';
import type { ResearchObservationV15 } from './research-learning-v15.js';

export interface BracketResearchAssessmentV15 {
  competitiveEvidence: CompetitiveBracketEvidenceV15;
  assessment: BracketCeilingAssessmentV15;
}

/**
 * Research-grounded bracket assessment. competitiveMetagameEvidence is always derived
 * from provenance-aware research and therefore cannot be trusted from caller input.
 */
export function assessBracketFromResearchV15(
  targetBracket: CommanderBracketV15,
  signals: Omit<BracketAssessmentSignalsV15, 'competitiveMetagameEvidence'> & { competitiveMetagameEvidence?: never },
  observations: ResearchObservationV15[],
  constraints: string[] = [],
): BracketResearchAssessmentV15 {
  const competitiveEvidence = evaluateCompetitiveBracketEvidenceV15(observations);
  const assessment = assessBracketCeilingV15(targetBracket, {
    ...signals,
    competitiveMetagameEvidence: competitiveEvidence.competitiveMetagameEvidence,
  }, constraints);
  return { competitiveEvidence, assessment };
}

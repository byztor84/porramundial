/* ============================================
   Porra Mundial - TypeScript Types
   Tipos para la base de datos de Supabase
   ============================================ */

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'user';
  prediction_locked: boolean;
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  code: string;
  group_letter: string;
  fifa_ranking: number;
  flag_emoji: string;
}

export interface Match {
  id: number;
  stage: 'group' | 'R32' | 'R16' | 'QF' | 'SF' | '3rd' | 'F';
  group_letter: string | null;
  match_number: number;
  team_a_id: number | null;
  team_b_id: number | null;
  match_datetime: string;
  is_bonus: boolean;
  venue: string | null;
  created_at: string;
  // Joined fields
  team_a?: Team;
  team_b?: Team;
}

export interface Prediction {
  id: number;
  user_id: string;
  match_id: number;
  predicted_score_a: number;
  predicted_score_b: number;
  predicted_winner_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  match?: Match;
}

export interface Result {
  match_id: number;
  score_a: number;
  score_b: number;
  winner_id: number | null;
  yellow_cards_a: number;
  red_cards_a: number;
  yellow_cards_b: number;
  red_cards_b: number;
  entered_by: string;
  created_at: string;
  updated_at: string;
}

export interface BracketPrediction {
  id: number;
  user_id: string;
  stage: 'R32' | 'R16' | 'QF' | 'SF' | 'F' | 'champion';
  team_id: number;
}

export interface HonorsPrediction {
  id: number;
  user_id: string;
  champion_id: number | null;
  runner_up_id: number | null;
  top_scorer: string;
}

export interface Standing {
  user_id: string;
  total_points: number;
  exact_hits: number;
  match_points: number;
  bracket_points: number;
  honors_points: number;
  updated_at: string;
  // Joined fields
  profile?: Profile;
}

// ---- Wizard State Types ----

export interface GroupPrediction {
  matchId: number;
  scoreA: number;
  scoreB: number;
}

export interface GroupStanding {
  teamId: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;
}

export interface WizardState {
  currentStep: number;
  groups: Record<string, GroupPrediction[]>;
  groupStandings: Record<string, GroupStanding[]>;
  bestThirds: number[]; // team IDs of best 3rd-placed teams
  knockoutPredictions: Record<string, KnockoutPrediction>;
  honors: {
    championId: number | null;
    runnerUpId: number | null;
    topScorer: string;
  };
  isLocked: boolean;
}

export interface KnockoutPrediction {
  matchId: number;
  scoreA: number;
  scoreB: number;
  winnerId: number | null; // for penalties
}

// ---- Scoring Types ----

export interface MatchScore {
  points: number;
  isExact: boolean;
  isDifference: boolean;
  is1X2: boolean;
  bonusMultiplier: number;
}

export type StageLabel = 'group' | 'R32' | 'R16' | 'QF' | 'SF' | '3rd' | 'F';

export const STAGE_LABELS: Record<StageLabel, string> = {
  group: 'Fase de Grupos',
  R32: 'Treintaidosavos',
  R16: 'Octavos de Final',
  QF: 'Cuartos de Final',
  SF: 'Semifinales',
  '3rd': 'Tercer Puesto',
  F: 'Final',
};

export const STAGE_BRACKET_POINTS: Record<string, number> = {
  R32: 3,
  R16: 5,
  QF: 8,
  SF: 12,
  F: 15,
};

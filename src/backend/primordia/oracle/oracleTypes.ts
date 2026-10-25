export interface OracleQuestion {
  userId: string;
  question: string;
}

export interface OracleResponse {
  guidance: string;
  opportunity: string;
  warning: string;
  nextAction: string;
}

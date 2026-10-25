export interface IdentityValue {
  id: string;
  name: string;
  description: string;
}

export interface IdentityMission {
  id: string;
  statement: string;
}

export interface IdentityProfile {
  userId: string;
  currentSelf: string;
  futureSelf: string;
  mission: string;
  values: IdentityValue[];
}

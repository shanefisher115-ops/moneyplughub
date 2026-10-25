import { IdentityProfile } from "./identityTypes";

export const defaultIdentityProfile: IdentityProfile = {
  userId: "usr_admin_001",
  currentSelf: "Builder",
  futureSelf: "Sovereign Architect",
  mission: "Build PrimordiaOS",
  values: []
};

export function getIdentityProfile(): IdentityProfile {
  return defaultIdentityProfile;
}

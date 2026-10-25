import { IdentityProfile } from "./identityTypes";

export class IdentityEngine {
  public static evaluate(profile: IdentityProfile) {
    return {
      currentSelf: profile.currentSelf,
      futureSelf: profile.futureSelf,
      mission: profile.mission,
      identityGap:
        profile.currentSelf === profile.futureSelf
          ? "Aligned"
          : "Growth Required"
    };
  }
}

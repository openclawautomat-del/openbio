/** Phase 2 features (domains, teams, contact forms, goals, CSV) can be switched off with FEATURE_PHASE2=0 or false. */
export const phase2Enabled = () => !["0", "false"].includes((process.env.FEATURE_PHASE2 || "").toLowerCase());

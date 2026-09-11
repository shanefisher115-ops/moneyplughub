🔒 Fix hardcoded AWS SES credentials

🎯 What: Removed the hardcoded AWS SES SMTP user and password fallback values in src/backend/config.ts and replaced them with empty strings.
⚠️ Risk: Hardcoding credentials directly in source code is a significant security risk, as it could expose sensitive infrastructure information (such as email systems) if the codebase were accessed by unauthorized users.
🛡️ Solution: Updated the 'user' and 'pass' getters within the awsSes config to rely purely on environment variables (process.env.AWS_SES_SMTP_USER and process.env.AWS_SES_SMTP_PASS). If these are not provided, it now defaults to empty strings instead of sensitive values.

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ override: true });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'moneyplughub-cosmic-secure-jwt-2026-secret-key',
  jwtExpiresIn: '7d',
  
  // Real money commission configuration: $10.00 = 1000 cents per referral
  commissionAmountUsd: parseFloat(process.env.COMMISSION_AMOUNT_USD || '10.00'),
  get commissionAmountCents(): number {
    return Math.round(this.commissionAmountUsd * 100);
  },
  
  // Durable database persistence path
  dbPath: process.env.DB_PATH 
    ? path.resolve(process.env.DB_PATH) 
    : path.resolve(process.cwd(), 'data', 'moneyplughub.db'),

  // Initial Admin Seeder
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@moneyplughub.local',
    password: process.env.ADMIN_PASSWORD || 'AdminSecret2026!',
    displayName: process.env.ADMIN_DISPLAY_NAME || 'Primary Auditor',
  },

  // Clerk Authentication Configuration
  clerk: {
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_moneyplughub_clerk_2026',
    secretKey: process.env.CLERK_SECRET_KEY || 'sk_test_moneyplughub_clerk_secret_2026',
    jwtKey: process.env.CLERK_JWT_KEY || '',
  },

  // Stripe Billing & Webhook Sentinel
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_stripe_moneyplughub_2026',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_stripe_moneyplughub_2026',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_moneyplughub_webhook_2026',
  },

  // Payout Processor & Automated ACH/Crypto rails
  payouts: {
    processorKey: process.env.PAYOUT_PROCESSOR_KEY || 'pay_proc_test_moneyplughub_2026',
    provider: process.env.PAYOUT_PROVIDER || 'stripe_connect',
  },

  // Database Connection URL (Postgres/Planetscale/Supabase adapter fallback or local WAL SQLite)
  databaseUrl: process.env.DATABASE_URL || '',

  // ElevenLabs AI Voice Synthesis
  elevenLabs: {
    get apiKey(): string {
      return process.env.ELEVENLABS_API_KEY || '';
    },
    get voiceId(): string {
      return process.env.ELEVENLABS_VOICE_ID || 'm6Q2NTc6q5ldaHnwzSDp';
    },
    get modelId(): string {
      return process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';
    },
    get isEnabled(): boolean {
      const key = process.env.ELEVENLABS_API_KEY || '';
      return key.length > 10;
    },
  },

  // Google Gemini / Ultra / Vertex AI Credits & Engine
  google: {
    get apiKey(): string {
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '';
    },
    get projectId(): string {
      return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || '';
    },
    get location(): string {
      return process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    },
    get isConfigured(): boolean {
      return this.apiKey.length > 5 || this.projectId.length > 0;
    },
  },

  // AWS SES & Mail Manager Relay for PHOM Autonomous Cold Outreach Swarm
  awsSes: {
    get host(): string {
      return process.env.AWS_SES_SMTP_HOST || '4btfd2uicezk.fips.wmjb.mail-manager-smtp.amazonaws.com';
    },
    get port(): number {
      return parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10);
    },
    get user(): string {
      return process.env.AWS_SES_SMTP_USER || 'inp-ikzfukep4wgbxjfcpiyxen3a';
    },
    get pass(): string {
      return process.env.AWS_SES_SMTP_PASS || 'Demoniac666$';
    },
    get from(): string {
      return process.env.AWS_SES_FROM || 'Shane <sovereign-relay@primordialorigin.com>';
    },
    get domain(): string {
      return process.env.PHOM_DOMAIN || 'primordialorigin.com';
    },
  },

  // Supabase Cloud Database & Replication Bridge
  supabase: {
    get url(): string {
      return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://jccxdlvzeckyaqprkmba.supabase.co';
    },
    get anonKey(): string {
      return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    },
    get serviceRoleKey(): string {
      return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    },
    get isConfigured(): boolean {
      return (this.serviceRoleKey.length > 5 || this.anonKey.length > 5) && this.url.length > 10;
    },
  },
};


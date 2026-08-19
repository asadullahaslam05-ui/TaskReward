/**
 * Seed script — initializes:
 * - Default site settings (all business-configurable values)
 * - Payment methods (Easypaisa, JazzCash, Binance)
 * - Default task categories
 * - Content pages (About, FAQ, Terms, Privacy, etc.)
 * - Bootstrap admin account
 * - Sample tasks for demo
 *
 * Run with: bun run seed
 */
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

async function seed() {
  console.log("🌱 Starting seed...");

  // ============================================================
  // 1. DEFAULT SITE SETTINGS
  // ============================================================
  console.log("→ Seeding site settings...");
  const defaultSettings = [
    { key: "site.name", value: "TaskReward", category: "GENERAL", type: "STRING" },
    { key: "site.description", value: "Complete tasks and earn real money. Join thousands of earners today.", category: "GENERAL", type: "TEXT" },
    { key: "site.logo", value: "", category: "GENERAL", type: "STRING" },
    { key: "site.favicon", value: "", category: "GENERAL", type: "STRING" },
    { key: "site.support_email", value: "support@taskreward.com", category: "GENERAL", type: "STRING" },
    { key: "site.support_whatsapp", value: "+923001234567", category: "GENERAL", type: "STRING" },
    { key: "site.currency_code", value: "PKR", category: "GENERAL", type: "STRING" },
    { key: "site.currency_symbol", value: "Rs", category: "GENERAL", type: "STRING" },
    { key: "site.timezone", value: "Asia/Karachi", category: "GENERAL", type: "STRING" },
    { key: "site.footer_text", value: "© 2025 TaskReward. All rights reserved.", category: "GENERAL", type: "STRING" },
    { key: "site.social_links", value: JSON.stringify([
      { name: "Facebook", url: "https://facebook.com", icon: "facebook" },
      { name: "Twitter", url: "https://twitter.com", icon: "twitter" },
      { name: "Instagram", url: "https://instagram.com", icon: "instagram" },
      { name: "WhatsApp", url: "https://wa.me/923001234567", icon: "whatsapp" },
    ]), category: "GENERAL", type: "JSON" },
    { key: "feature.registration_enabled", value: "true", category: "GENERAL", type: "BOOLEAN" },
    { key: "feature.login_enabled", value: "true", category: "GENERAL", type: "BOOLEAN" },
    { key: "feature.withdrawals_enabled", value: "true", category: "WITHDRAWALS", type: "BOOLEAN" },
    { key: "feature.tasks_enabled", value: "true", category: "TASKS", type: "BOOLEAN" },
    { key: "feature.maintenance_mode", value: "false", category: "MAINTENANCE", type: "BOOLEAN" },
    { key: "feature.referral_enabled", value: "true", category: "REWARDS", type: "BOOLEAN" },
    { key: "registration.fee", value: "500", category: "REGISTRATION", type: "NUMBER" },
    { key: "registration.manual_approval", value: "true", category: "REGISTRATION", type: "BOOLEAN" },
    { key: "registration.welcome_message", value: "Welcome to TaskReward! Complete your registration payment to start earning money by completing simple tasks.", category: "REGISTRATION", type: "TEXT" },
    { key: "registration.instructions", value: "1. Choose a payment method below.\n2. Send the exact registration fee to the provided account.\n3. Take a screenshot of the transaction.\n4. Fill in the payment details and upload the screenshot.\n5. Wait for admin approval (usually within 24 hours).", category: "REGISTRATION", type: "TEXT" },
    { key: "brand.primary_color", value: "#6366f1", category: "BRANDING", type: "STRING" },
    { key: "brand.secondary_color", value: "#8b5cf6", category: "BRANDING", type: "STRING" },
    { key: "brand.accent_color", value: "#ec4899", category: "BRANDING", type: "STRING" },
    { key: "tasks.default_reward", value: "10", category: "TASKS", type: "NUMBER" },
    { key: "tasks.max_submissions_per_user", value: "1", category: "TASKS", type: "NUMBER" },
    { key: "tasks.daily_limit", value: "20", category: "TASKS", type: "NUMBER" },
    { key: "tasks.prevent_duplicates", value: "true", category: "TASKS", type: "BOOLEAN" },
    { key: "withdrawal.min_amount", value: "100", category: "WITHDRAWALS", type: "NUMBER" },
    { key: "withdrawal.max_amount", value: "50000", category: "WITHDRAWALS", type: "NUMBER" },
    { key: "withdrawal.daily_limit", value: "10000", category: "WITHDRAWALS", type: "NUMBER" },
    { key: "withdrawal.fee", value: "0", category: "WITHDRAWALS", type: "NUMBER" },
    { key: "withdrawal.processing_message", value: "Withdrawals are processed within 24-48 hours. Please ensure your account details are correct.", category: "WITHDRAWALS", type: "TEXT" },
    { key: "referral.reward", value: "50", category: "REWARDS", type: "NUMBER" },
    { key: "referral.type", value: "FIXED", category: "REWARDS", type: "STRING" },
    { key: "referral.max_reward", value: "500", category: "REWARDS", type: "NUMBER" },
    { key: "seo.title", value: "TaskReward - Earn Money Online Completing Tasks", category: "SEO", type: "STRING" },
    { key: "seo.description", value: "Join TaskReward and earn real money by completing simple TikTok tasks. Fast payouts via Easypaisa, JazzCash, and Binance.", category: "SEO", type: "TEXT" },
    { key: "seo.og_image", value: "", category: "SEO", type: "STRING" },
  ];

  for (const s of defaultSettings) {
    await db.siteSetting.upsert({
      where: { key: s.key },
      create: s,
      update: {},
    });
  }
  console.log(`  ✓ ${defaultSettings.length} settings seeded`);

  // ============================================================
  // 2. PAYMENT METHODS
  // ============================================================
  console.log("→ Seeding payment methods...");
  const paymentMethods = [
    { code: "EASYPAISA", name: "Easypaisa", description: "Pay via Easypaisa mobile account", enabled: true, accountName: "TaskReward Official", accountNumber: "03001234567", instructions: "Send the exact registration fee to the Easypaisa account above. Take a screenshot of the confirmation and upload it as proof.", sortOrder: 1 },
    { code: "JAZZCASH", name: "JazzCash", description: "Pay via JazzCash mobile account", enabled: true, accountName: "TaskReward Official", accountNumber: "03001234567", instructions: "Send the exact registration fee to the JazzCash account above. Take a screenshot of the confirmation and upload it as proof.", sortOrder: 2 },
    { code: "BINANCE", name: "Binance Pay", description: "Pay via Binance (USDT)", enabled: true, walletAddress: "TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", network: "TRC20", instructions: "Send the equivalent USDT amount to the Binance wallet address above on the TRC20 network. Take a screenshot of the transaction and upload it as proof.", sortOrder: 3 },
  ];
  for (const pm of paymentMethods) {
    await db.paymentMethod.upsert({
      where: { code: pm.code },
      create: pm,
      update: {},
    });
  }
  console.log(`  ✓ ${paymentMethods.length} payment methods seeded`);

  // ============================================================
  // 3. TASK CATEGORIES
  // ============================================================
  console.log("→ Seeding task categories...");
  const categories = [
    { name: "TikTok", description: "TikTok engagement tasks", active: true },
    { name: "YouTube", description: "YouTube engagement tasks", active: true },
    { name: "Instagram", description: "Instagram engagement tasks", active: true },
    { name: "Facebook", description: "Facebook engagement tasks", active: true },
  ];
  for (const c of categories) {
    await db.taskCategory.upsert({
      where: { name: c.name },
      create: c,
      update: {},
    });
  }
  console.log(`  ✓ ${categories.length} categories seeded`);

  // ============================================================
  // 4. CONTENT PAGES
  // ============================================================
  console.log("→ Seeding content pages...");
  const contentPages = [
    { slug: "about", title: "About Us", content: "TaskReward is a leading online earning platform that allows users to earn money by completing simple social media tasks. We connect advertisers with real users to drive authentic engagement." },
    { slug: "faq", title: "Frequently Asked Questions", content: "## How do I start earning?\n\n1. Register an account and pay the registration fee.\n2. Wait for admin approval.\n3. Complete available tasks and submit proof.\n4. Get rewarded to your wallet.\n5. Withdraw your earnings via Easypaisa, JazzCash, or Binance.\n\n## How much can I earn?\n\nEarnings depend on the number of tasks available and their rewards. Each task shows its reward amount.\n\n## When will I receive my withdrawal?\n\nWithdrawals are processed within 24-48 hours after admin approval." },
    { slug: "terms", title: "Terms & Conditions", content: "By using TaskReward, you agree to these terms:\n\n1. You must be 18 years or older.\n2. One account per person.\n3. Fake or bot engagement is strictly prohibited.\n4. The platform reserves the right to suspend accounts violating these terms.\n5. All rewards are subject to admin verification." },
    { slug: "privacy", title: "Privacy Policy", content: "We respect your privacy and protect your personal data:\n\n1. We collect only necessary information for account management.\n2. Payment information is kept confidential.\n3. We never share your data with third parties without consent.\n4. You can request data deletion at any time." },
    { slug: "refund", title: "Refund Policy", content: "Registration fees are non-refundable once approved. If your registration is rejected, the fee will be returned according to admin discretion." },
    { slug: "withdrawal-policy", title: "Withdrawal Policy", content: "Withdrawals are processed within 24-48 hours. Minimum withdrawal amount is PKR 100. Ensure your payout account details are correct before submitting." },
    { slug: "task-rules", title: "Task Rules", content: "1. Complete tasks honestly and manually.\n2. Submit genuine proof screenshots.\n3. Do not use bots or automation.\n4. Duplicate or fake submissions will be rejected.\n5. Repeated violations result in account suspension." },
    { slug: "contact", title: "Contact Us", content: "Email: support@taskreward.com\nWhatsApp: +92 300 1234567\n\nOur support team is available 9 AM - 9 PM (PKT)." },
    { slug: "help", title: "Help Center", content: "Need help? Create a support ticket from your dashboard and our team will assist you." },
  ];
  for (const p of contentPages) {
    await db.contentPage.upsert({
      where: { slug: p.slug },
      create: p,
      update: {},
    });
  }
  console.log(`  ✓ ${contentPages.length} content pages seeded`);

  // ============================================================
  // 5. BOOTSTRAP ADMIN ACCOUNT
  // ============================================================
  console.log("→ Seeding admin account...");
  const adminEmail = "adminasadullah@ceo.com";
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || "Admin@2025!";
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db.user.create({
      data: {
        email: adminEmail,
        username: "adminasadullah",
        fullName: "Asadullah (Admin)",
        phone: "+923001234567",
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        referralCode: "ADMINREF",
      },
    });
    console.log("  ✓ Admin account created");
    console.log(`    Email: ${adminEmail}`);
    console.log(`    Password: ${adminPassword}`);
  } else {
    console.log("  ✓ Admin account already exists");
  }

  // ============================================================
  // 6. SAMPLE TASKS
  // ============================================================
  console.log("→ Seeding sample tasks...");
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  if (admin) {
    const tiktokCat = await db.taskCategory.findUnique({ where: { name: "TikTok" } });
    const existingTasks = await db.task.count();
    if (existingTasks === 0 && tiktokCat) {
      const sampleTasks = [
        { title: "Like TikTok Video #1", platform: "TikTok", type: "LIKE", targetUrl: "https://www.tiktok.com/@example/video/1234567890", profileUrl: "https://www.tiktok.com/@example", instructions: "1. Open the TikTok video link.\n2. Like the video (tap the heart icon).\n3. Take a screenshot showing you liked it.\n4. Upload the screenshot as proof.", reward: 10, status: "ACTIVE", maxCompletions: 100, screenshotRequired: true, textProofRequired: false, linkProofRequired: false, estimatedTime: "2-3 min", categoryId: tiktokCat.id, createdById: admin.id },
        { title: "Follow TikTok Account #1", platform: "TikTok", type: "FOLLOW", targetUrl: "https://www.tiktok.com/@example", profileUrl: "https://www.tiktok.com/@example", instructions: "1. Open the TikTok profile link.\n2. Follow the account.\n3. Take a screenshot showing you follow the account.\n4. Upload the screenshot as proof.", reward: 15, status: "ACTIVE", maxCompletions: 50, screenshotRequired: true, estimatedTime: "1-2 min", categoryId: tiktokCat.id, createdById: admin.id },
        { title: "Comment on TikTok Video #1", platform: "TikTok", type: "COMMENT", targetUrl: "https://www.tiktok.com/@example/video/1234567890", profileUrl: "https://www.tiktok.com/@example", instructions: "1. Open the TikTok video link.\n2. Leave a positive comment.\n3. Take a screenshot of your comment.\n4. Upload the screenshot and enter your comment text as proof.", reward: 20, status: "ACTIVE", maxCompletions: 30, screenshotRequired: true, textProofRequired: true, estimatedTime: "3-4 min", categoryId: tiktokCat.id, createdById: admin.id },
        { title: "Watch TikTok Video #1", platform: "TikTok", type: "WATCH", targetUrl: "https://www.tiktok.com/@example/video/1234567890", profileUrl: "https://www.tiktok.com/@example", instructions: "1. Open the TikTok video link.\n2. Watch the full video.\n3. Take a screenshot at the end of the video.\n4. Upload the screenshot as proof.", reward: 5, status: "ACTIVE", maxCompletions: 200, screenshotRequired: true, estimatedTime: "1-2 min", categoryId: tiktokCat.id, createdById: admin.id },
      ];
      for (const t of sampleTasks) {
        await db.task.create({ data: t });
      }
      console.log(`  ✓ ${sampleTasks.length} sample tasks seeded`);
    } else {
      console.log("  ✓ Tasks already exist, skipping");
    }
  }

  // ============================================================
  // 7. DEFAULT ANNOUNCEMENT
  // ============================================================
  console.log("→ Seeding default announcement...");
  const existingAnn = await db.announcement.count();
  if (existingAnn === 0) {
    await db.announcement.create({
      data: { title: "Welcome to TaskReward!", message: "Complete tasks and earn real money. New tasks are added regularly. Check back daily for more earning opportunities!", type: "INFO", active: true, targetAudience: "ALL" },
    });
    console.log("  ✓ Announcement seeded");
  }

  console.log("\n✅ Seed completed successfully!");
  console.log("\n📋 Admin Login:");
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
}

seed()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });

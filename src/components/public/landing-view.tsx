"use client";

import { useSettings } from "@/hooks/use-settings";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  ListChecks,
  ShieldCheck,
  Smartphone,
  Zap,
  CheckCircle2,
  ArrowRight,
  Star,
  Gift,
  HeadphonesIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";

export function LandingView() {
  const { settings } = useSettings();
  const { setView } = useAppStore();

  const features = [
    {
      icon: ListChecks,
      title: "Complete Tasks",
      desc: "Like, follow, comment, and watch TikTok videos to earn rewards.",
    },
    {
      icon: Wallet,
      title: "Instant Wallet",
      desc: "Track your earnings in real-time with our ledger-based wallet system.",
    },
    {
      icon: Zap,
      title: "Fast Withdrawals",
      desc: "Withdraw via Easypaisa, JazzCash, or Binance within 24-48 hours.",
    },
    {
      icon: ShieldCheck,
      title: "Secure Platform",
      desc: "Server-side validation, audit logs, and fraud protection keep your funds safe.",
    },
    {
      icon: Gift,
      title: "Referral Bonuses",
      desc: settings?.referralReward
        ? `Earn ${settings?.currencySymbol || "Rs"} ${settings.referralReward} for every friend you refer.`
        : "Earn rewards for every friend you refer.",
    },
    {
      icon: HeadphonesIcon,
      title: "24/7 Support",
      desc: "Get help anytime through our in-app support ticket system.",
    },
  ];

  const steps = [
    { num: "1", title: "Register & Pay", desc: settings?.registrationFee
      ? `Pay the one-time registration fee of ${settings?.currencySymbol || "Rs"} ${settings.registrationFee}.`
      : "Pay the one-time registration fee to activate your account." },
    { num: "2", title: "Get Approved", desc: "Admin verifies your payment and activates your account." },
    { num: "3", title: "Complete Tasks", desc: "Choose from available tasks and submit proof of completion." },
    { num: "4", title: "Withdraw Earnings", desc: "Cash out your earnings to your preferred payment method." },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" variant="mark" />
            <span className="font-bold text-lg">{settings?.siteName || "TaskReward"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setView("login")}>
              Login
            </Button>
            {settings?.registrationEnabled && (
              <Button onClick={() => setView("register")} className="bg-gradient-gold text-brand-navy hover:opacity-90">Get Started</Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-navy" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="secondary" className="mx-auto">
              <Star className="h-3 w-3 mr-1" />
              Trusted by thousands of earners
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Earn Real Money by Completing{" "}
              <span className="text-gradient-gold">
                Simple Tasks
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {settings?.siteDescription || "Complete tasks and earn real money. Join thousands of earners today."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {/* While settings load, default to showing the registration button (optimistic) */}
              {settings?.registrationEnabled !== false ? (
                <Button size="lg" onClick={() => setView("register")} className="gap-2">
                  Start Earning Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="lg" disabled>
                  Registration Temporarily Closed
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={() => setView("login")}>
                Login to Dashboard
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Instant payouts
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                No hidden fees
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                24/7 support
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats section removed.
          The previous section displayed fabricated marketing statistics
          ("10,000+ Active Users", "500,000+ Tasks Completed", "Rs 5M+ Paid Out",
          "Rs 200+ Avg. Daily Earnings") — all hardcoded fake values that were
          never admin-configurable and would mislead real users. To re-introduce
          site stats, wire them to a real data source (e.g. live counts from the
          DB aggregated server-side, or admin-configured values in the
          `content_sections` table). */}

      {/* Features */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose {settings?.siteName || "TaskReward"}?</h2>
            <p className="text-muted-foreground">
              A complete earning platform built with security, transparency, and user experience in mind.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">Start earning in 4 simple steps.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step.num} className="relative">
                <Card className="p-6 h-full">
                  <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mb-4">
                    {step.num}
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </Card>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-3 h-6 w-6 text-muted-foreground -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <Card className="max-w-3xl mx-auto p-8 md:p-12 text-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white border-0">
            <Smartphone className="h-12 w-12 mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Earning?</h2>
            <p className="text-white/90 mb-6 max-w-xl mx-auto">
              Join {settings?.siteName || "TaskReward"} today and turn your spare time into real income.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setView("register")}
              disabled={settings?.registrationEnabled === false}
              className="gap-2"
            >
              Create Your Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-auto bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BrandLogo size="xs" variant="mark" />
              <span className="font-semibold">{settings?.siteName || "TaskReward"}</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {settings?.footerText || "© 2025 TaskReward. All rights reserved."}
            </p>
            <div className="flex gap-4 text-sm">
              {settings?.socialLinks?.map((link: any) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

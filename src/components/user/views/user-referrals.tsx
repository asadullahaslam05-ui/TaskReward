"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client/client";
import { useSettings } from "@/hooks/use-settings";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserCheck,
  DollarSign,
  Copy,
  Link as LinkIcon,
  Gift,
  Percent,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils-fin";

// ---------- Types ----------
interface ReferredUser {
  username: string;
  fullName: string;
  createdAt: string;
  status: string;
}

interface ReferralEarning {
  id: string;
  amount: number;
  status: string; // PENDING | CREDITED | REVERSED
  createdAt: string;
  referred: ReferredUser;
}

interface ReferralData {
  enabled: boolean;
  reward: number;
  type: string; // FIXED | PERCENTAGE
  maxReward: number;
  referralCode: string;
  referralLink: string;
  stats: {
    totalReferrals: number;
    activeReferrals: number;
    totalEarned: number;
  };
  recentReferrals: ReferralEarning[];
}

// ---------- Helpers ----------
async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error("Failed to copy to clipboard");
  }
}

// ---------- Component ----------
export function UserReferrals() {
  const { settings } = useSettings();
  const { data, isLoading, error } = useQuery<ReferralData>({
    queryKey: ["referrals"],
    queryFn: () => apiGet<ReferralData>("/api/supabase/referrals"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-red-500">
          Failed to load referral data. Please try again.
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // If referral disabled
  if (!data.enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-violet-600" />
            Referrals
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Invite friends and earn rewards.
          </p>
        </div>
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Ban className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Referral program is disabled</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              The referral program is currently turned off by the
              administrator. Please check back later or contact support for
              more information.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const referralLink =
    data.referralLink ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${data.referralCode}`
      : `/?ref=${data.referralCode}`);

  const isPercentage = data.type === "PERCENTAGE";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-violet-600" />
          Referrals
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Invite friends and earn rewards for every successful referral.
        </p>
      </div>

      {/* Reward Banner */}
      <Card className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-white/10 -mr-12 -mt-12" />
        <div className="absolute bottom-0 right-12 h-20 w-20 rounded-full bg-white/5 -mb-8" />
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 relative">
          <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Gift className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="text-white/80 text-sm font-medium">
              Referral Reward
            </div>
            <div className="text-3xl font-bold flex items-center gap-2">
              {isPercentage ? (
                <>
                  {data.reward}%
                  <Percent className="h-6 w-6" />
                </>
              ) : (
                <CurrencyDisplay amount={data.reward} />
              )}
            </div>
            <div className="text-white/80 text-sm mt-1">
              {isPercentage
                ? `Earn ${data.reward}% of your referral's registration fee`
                : `Earn a fixed reward for every active referral`}
              {data.maxReward > 0 && (
                <span> · Max: <CurrencyDisplay amount={data.maxReward} /></span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral code & link */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-violet-600" />
              Your Referral Code
            </CardTitle>
            <CardDescription>
              Share this code with friends to refer them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={data.referralCode}
                className="font-mono font-semibold text-lg"
              />
              <Button
                onClick={() =>
                  copyToClipboard(data.referralCode, "Referral code")
                }
                size="icon"
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white flex-shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-violet-600" />
              Your Referral Link
            </CardTitle>
            <CardDescription>
              Share this link directly with friends.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={referralLink}
                className="text-sm"
              />
              <Button
                onClick={() =>
                  copyToClipboard(referralLink, "Referral link")
                }
                size="icon"
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white flex-shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
              <Users className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {data.stats.totalReferrals}
              </div>
              <div className="text-xs text-muted-foreground">
                Total Referrals
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {data.stats.activeReferrals}
              </div>
              <div className="text-xs text-muted-foreground">
                Active Referrals
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-950/40 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-fuchsia-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                <CurrencyDisplay amount={data.stats.totalEarned} />
              </div>
              <div className="text-xs text-muted-foreground">
                Total Earned
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent referrals table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Referrals</CardTitle>
          <CardDescription>
            Your latest referred users and their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentReferrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No referrals yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
                Share your referral code or link above to start inviting
                friends and earning rewards.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referred User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Reward</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentReferrals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {r.referred.fullName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            @{r.referred.username}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {r.status === "CREDITED" ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +<CurrencyDisplay amount={r.amount} />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            <CurrencyDisplay amount={r.amount} />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <div className="font-medium text-sm">Share your link</div>
              <p className="text-xs text-muted-foreground">
                Send your referral code or link to friends.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <div className="font-medium text-sm">Friend registers</div>
              <p className="text-xs text-muted-foreground">
                They sign up and pay the registration fee using your code.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div>
              <div className="font-medium text-sm">You earn rewards</div>
              <p className="text-xs text-muted-foreground">
                {isPercentage
                  ? `Get ${data.reward}% of their registration fee.`
                  : `Get ${settings?.currencySymbol || "Rs"} ${data.reward} credited to your wallet.`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

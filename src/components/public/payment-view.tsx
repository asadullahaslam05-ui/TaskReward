"use client";

import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useSettings } from "@/hooks/use-settings";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiGet, apiPost, uploadFile, getSignedUrl } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Wallet, Loader2, Upload, Copy, CheckCircle2, Clock, XCircle, LogOut, CreditCard, QrCode } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { toast } from "sonner";

interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  accountName: string | null;
  accountNumber: string | null;
  walletAddress: string | null;
  network: string | null;
  qrCodeUrl: string | null;
  instructions: string | null;
}

interface RegistrationPayment {
  id: string;
  paymentMethodId: string;
  paymentMethod: PaymentMethod;
  senderName: string;
  senderAccount: string;
  transactionId: string;
  amount: number;
  paymentDate: string;
  screenshotUrl: string;
  note: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

export function PaymentView() {
  const { settings } = useSettings();
  const { user } = useCurrentUser();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [existingPayments, setExistingPayments] = useState<RegistrationPayment[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState({
    senderName: "",
    senderAccount: "",
    transactionId: "",
    amount: settings?.registrationFee || 500,
    paymentDate: "",
    screenshotPath: "",
    screenshotBucket: "payment-proofs",
    note: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<PaymentMethod[]>("/api/supabase/payment-methods"),
      apiGet<RegistrationPayment[]>("/api/supabase/registration-payments"),
    ])
      .then(([m, p]) => {
        setMethods(m);
        setExistingPayments(p);
        if (m.length > 0) setSelectedMethod(m[0]);
      })
      .catch((e) => toast.error(e.message));
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadFile(file, "payment-proofs", "payment");
      setForm((prev) => ({
        ...prev,
        screenshotPath: result.path,
        screenshotBucket: result.bucket,
      }));
      // Fetch a short-lived signed URL so the user can preview their upload.
      try {
        const url = await getSignedUrl(result.path, result.bucket);
        setPreviewUrl(url);
      } catch {
        setPreviewUrl("");
      }
      toast.success("Screenshot uploaded");
    } catch (e: any) {
      toast.error(e.message || "Unable to upload screenshot. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod) return;
    if (!form.screenshotPath) {
      toast.error("Please upload payment screenshot");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/api/supabase/registration-payments", {
        paymentMethodId: selectedMethod.id,
        senderName: form.senderName,
        senderAccount: form.senderAccount,
        transactionId: form.transactionId,
        amount: form.amount,
        paymentDate: form.paymentDate || new Date().toISOString(),
        screenshotPath: form.screenshotPath,
        screenshotBucket: form.screenshotBucket,
        note: form.note,
      });
      toast.success("Payment submitted! Please wait for admin approval.");
      // Refresh payments
      const p = await apiGet<RegistrationPayment[]>("/api/supabase/registration-payments");
      setExistingPayments(p);
      // Reset form
      setForm({
        senderName: "",
        senderAccount: "",
        transactionId: "",
        amount: settings?.registrationFee || 500,
        paymentDate: "",
        screenshotPath: "",
        screenshotBucket: "payment-proofs",
        note: "",
      });
      setPreviewUrl("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied to clipboard");
  };

  const pendingPayment = existingPayments.find((p) => p.status === "PENDING");
  const rejectedPayment = existingPayments.find((p) => p.status === "REJECTED");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-navy">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" variant="mark" />
            <span className="font-bold text-brand-silver">{settings?.siteName || "TaskReward"}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const supabase = createBrowserSupabaseClient();
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Welcome / Status */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold mb-1">
                  Welcome, {user?.fullName}!
                </h1>
                <p className="text-sm text-muted-foreground">
                  {settings?.registrationWelcomeMessage ||
                    "Complete your registration payment to activate your account."}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Registration Fee:</span>
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                    {settings?.currencySymbol || "Rs"} {settings?.registrationFee || 500}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Existing payment status */}
          {pendingPayment && (
            <Card className="p-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
              <div className="flex items-start gap-4">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                    Payment Pending Review
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Your payment of {settings?.currencySymbol || "Rs"} {pendingPayment.amount} via{" "}
                    {pendingPayment.paymentMethod?.name || "—"} is being reviewed by our admin team.
                    You will be notified once approved.
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Submitted on {new Date(pendingPayment.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {rejectedPayment && !pendingPayment && (
            <Card className="p-6 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
              <div className="flex items-start gap-4">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 dark:text-red-200">
                    Payment Rejected
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {rejectedPayment.adminNote || "Your previous payment was rejected. Please submit a new payment."}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Instructions */}
          {settings?.registrationInstructions && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Instructions
              </h3>
              <div className="text-sm text-muted-foreground whitespace-pre-line">
                {settings.registrationInstructions}
              </div>
            </Card>
          )}

          {/* Payment form - only show if no pending payment */}
          {!pendingPayment && (
            <>
              {/* Payment Method Selection */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Choose Payment Method</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  {methods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedMethod?.id === method.id
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                          : "border-border hover:border-violet-300"
                      }`}
                    >
                      <div className="font-medium">{method.name}</div>
                      {method.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {method.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Selected Method Details */}
              {selectedMethod && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    {selectedMethod.name} Details
                  </h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      {selectedMethod.accountName && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <div className="text-xs text-muted-foreground">Account Name</div>
                            <div className="font-medium">{selectedMethod.accountName}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(selectedMethod.accountName!, "name")}
                          >
                            {copied === "name" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                      {selectedMethod.accountNumber && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <div className="text-xs text-muted-foreground">Account Number</div>
                            <div className="font-medium">{selectedMethod.accountNumber}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(selectedMethod.accountNumber!, "number")}
                          >
                            {copied === "number" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                      {selectedMethod.walletAddress && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">Wallet Address</div>
                            <div className="font-medium truncate">{selectedMethod.walletAddress}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(selectedMethod.walletAddress!, "wallet")}
                            className="flex-shrink-0"
                          >
                            {copied === "wallet" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                      {selectedMethod.network && (
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="text-xs text-muted-foreground">Network</div>
                          <div className="font-medium">{selectedMethod.network}</div>
                        </div>
                      )}
                    </div>

                    <div>
                      {selectedMethod.qrCodeUrl ? (
                        <div className="text-center">
                          <img
                            src={selectedMethod.qrCodeUrl}
                            alt="QR Code"
                            className="mx-auto rounded-lg border max-w-[200px]"
                          />
                          <p className="text-xs text-muted-foreground mt-2">Scan to pay</p>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950/20 text-center">
                          <CreditCard className="h-12 w-12 mx-auto text-violet-500 mb-2" />
                          <p className="text-sm font-medium">Amount to Send</p>
                          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                            {settings?.currencySymbol || "Rs"} {settings?.registrationFee || 500}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedMethod.instructions && (
                    <div className="mt-4 p-4 rounded-lg bg-muted/30">
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {selectedMethod.instructions}
                      </p>
                    </div>
                  )}
                </Card>
              )}

              {/* Payment Submission Form */}
              {selectedMethod && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Submit Payment Proof</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="senderName">Sender Name</Label>
                        <Input
                          id="senderName"
                          placeholder="Your name on the payment account"
                          value={form.senderName}
                          onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="senderAccount">Sender Account/Number</Label>
                        <Input
                          id="senderAccount"
                          placeholder="Account you sent from"
                          value={form.senderAccount}
                          onChange={(e) => setForm({ ...form, senderAccount: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="transactionId">Transaction ID / Reference</Label>
                        <Input
                          id="transactionId"
                          placeholder="Transaction reference number"
                          value={form.transactionId}
                          onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount Sent ({settings?.currencySymbol || "Rs"})</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={form.amount}
                          onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paymentDate">Payment Date & Time</Label>
                      <Input
                        id="paymentDate"
                        type="datetime-local"
                        value={form.paymentDate}
                        onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="screenshot">Payment Screenshot *</Label>
                      {form.screenshotPath ? (
                        <div className="relative">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt="Payment proof"
                              className="rounded-lg border max-h-64 mx-auto"
                            />
                          ) : (
                            <div className="flex items-center justify-center max-h-64 mx-auto rounded-lg border bg-muted/50 p-8">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setForm({ ...form, screenshotPath: "" });
                              setPreviewUrl("");
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          {uploading ? (
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          ) : (
                            <Upload className="h-8 w-8 text-muted-foreground" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {uploading ? "Uploading..." : "Click to upload screenshot"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(file);
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="note">Note (Optional)</Label>
                      <Textarea
                        id="note"
                        placeholder="Any additional information"
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting || uploading}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Payment"
                      )}
                    </Button>
                  </form>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

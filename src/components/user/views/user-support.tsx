"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client/client";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HeadphonesIcon,
  Plus,
  MessageSquare,
  ArrowLeft,
  Send,
  User,
  Headphones,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRelativeTime } from "@/lib/utils-fin";

// ---------- Types ----------
interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface SupportMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: string; // USER | ADMIN
  message: string;
  attachmentUrl?: string | null;
  createdAt: string;
}

interface TicketMessagesResponse {
  ticket: Ticket;
  messages: SupportMessage[];
}

// ---------- Constants ----------
const CATEGORIES = [
  { value: "GENERAL", label: "General Inquiry" },
  { value: "PAYMENT", label: "Payment Issue" },
  { value: "TASK", label: "Task Issue" },
  { value: "WITHDRAWAL", label: "Withdrawal Issue" },
  { value: "ACCOUNT", label: "Account Issue" },
  { value: "OTHER", label: "Other" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  { value: "NORMAL", label: "Normal", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  { value: "HIGH", label: "High", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  { value: "URGENT", label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
];

function priorityClass(p: string) {
  return PRIORITIES.find((x) => x.value === p)?.color || PRIORITIES[1].color;
}

function categoryLabel(c: string) {
  return CATEGORIES.find((x) => x.value === c)?.label || c;
}

// ---------- Component ----------
export function UserSupport() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Create form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("NORMAL");
  const [message, setMessage] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch tickets list
  const { data: tickets, isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["support-tickets"],
    queryFn: () => apiGet<Ticket[]>("/api/supabase/support/tickets"),
  });

  // Fetch messages for selected ticket
  const {
    data: conversation,
    isLoading: convoLoading,
  } = useQuery<TicketMessagesResponse>({
    queryKey: ["support-ticket-messages", selectedTicketId],
    queryFn: () =>
      apiGet<TicketMessagesResponse>(
        `/api/supabase/support/tickets/${selectedTicketId}/messages`
      ),
    enabled: !!selectedTicketId,
    refetchInterval: selectedTicketId ? 8000 : false,
  });

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages?.length]);

  // Reset form fields helper
  const resetCreateForm = () => {
    setSubject("");
    setCategory("GENERAL");
    setPriority("NORMAL");
    setMessage("");
  };

  // Handle dialog open state changes - reset form when closing
  const handleCreateDialogChange = (open: boolean) => {
    if (!open) {
      resetCreateForm();
    }
    setCreateOpen(open);
  };

  // Create ticket
  const createMutation = useMutation({
    mutationFn: (payload: any) => apiPost("/api/supabase/support/tickets", payload),
    onSuccess: () => {
      toast.success("Support ticket created");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      handleCreateDialogChange(false);
    },
    onError: (err: any) =>
      toast.error(err.message || "Failed to create ticket"),
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: (payload: { message: string }) =>
      apiPost(`/api/supabase/support/tickets/${selectedTicketId}/messages`, payload),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({
        queryKey: ["support-ticket-messages", selectedTicketId],
      });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Reply sent");
    },
    onError: (err: any) => toast.error(err.message || "Failed to send reply"),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3) {
      toast.error("Subject must be at least 3 characters");
      return;
    }
    if (message.trim().length < 5) {
      toast.error("Message must be at least 5 characters");
      return;
    }
    createMutation.mutate({
      subject: subject.trim(),
      category,
      priority,
      message: message.trim(),
    });
  };

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) {
      toast.error("Please type a message");
      return;
    }
    replyMutation.mutate({ message: replyText.trim() });
  };

  const selectedTicket = tickets?.find((t) => t.id === selectedTicketId);
  const isClosed =
    conversation?.ticket?.status === "CLOSED" ||
    conversation?.ticket?.status === "RESOLVED";

  // Conversation view
  if (selectedTicketId && selectedTicket) {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedTicketId(null);
            setReplyText("");
          }}
          className="text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to tickets
        </Button>

        {/* Ticket header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg break-words">
                  {selectedTicket.subject}
                </CardTitle>
                <CardDescription className="mt-1">
                  {categoryLabel(selectedTicket.category)} · Created{" "}
                  {formatDate(selectedTicket.createdAt)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={selectedTicket.status} />
                <Badge
                  className={`${priorityClass(selectedTicket.priority)} border-0`}
                >
                  {selectedTicket.priority} priority
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Messages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-violet-600" />
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {convoLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
                  {conversation?.messages?.map((m) => {
                    const isUser = m.senderRole === "USER";
                    return (
                      <div
                        key={m.id}
                        className={`flex gap-3 ${
                          isUser ? "flex-row-reverse" : ""
                        }`}
                      >
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isUser
                              ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isUser ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Headphones className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={`flex-1 min-w-0 ${
                            isUser ? "items-end text-right" : ""
                          } flex flex-col`}
                        >
                          <div
                            className={`inline-block px-4 py-2.5 rounded-2xl text-sm break-words max-w-[85%] ${
                              isUser
                                ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white self-end"
                                : "bg-muted text-foreground self-start"
                            }`}
                          >
                            {m.message}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 px-1">
                            {isUser ? "You" : "Support"} ·{" "}
                            {formatRelativeTime(m.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {conversation?.messages?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No messages yet.
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply form */}
                {isClosed ? (
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center text-sm text-muted-foreground">
                    This ticket is closed. You cannot send new messages.
                  </div>
                ) : (
                  <form
                    onSubmit={handleReply}
                    className="mt-4 pt-4 border-t flex items-end gap-2"
                  >
                    <div className="flex-1">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={replyMutation.isPending || !replyText.trim()}
                      className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
                    >
                      <Send className="h-4 w-4" />
                      <span className="sr-only">Send</span>
                    </Button>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tickets list view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeadphonesIcon className="h-6 w-6 text-violet-600" />
            Support
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Need help? Create a ticket and our team will assist you.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={handleCreateDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Create Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>
                Fill out the form below and our support team will get back to
                you.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">
                  Subject <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your issue"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">
                  Message <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  rows={5}
                  required
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCreateDialogChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
                >
                  {createMutation.isPending ? "Creating..." : "Create Ticket"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tickets list */}
      <Card>
        <CardHeader>
          <CardTitle>Your Tickets</CardTitle>
          <CardDescription>
            Click a ticket to view the full conversation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !tickets || tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <HeadphonesIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">No support tickets</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                You haven&apos;t created any support tickets yet. If you need
                assistance, click &quot;Create Ticket&quot; to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className="w-full text-left p-4 rounded-lg border bg-card hover:bg-muted/40 hover:border-violet-200 dark:hover:border-violet-900/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {t.subject}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {categoryLabel(t.category)}
                        </Badge>
                        <Badge
                          className={`${priorityClass(t.priority)} border-0 text-xs`}
                        >
                          {t.priority}
                        </Badge>
                        <StatusBadge status={t.status} />
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {t._count?.messages || 0}
                      </Badge>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(t.updatedAt)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

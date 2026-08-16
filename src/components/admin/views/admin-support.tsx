"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Headphones,
  MessageSquare,
  Send,
  Mail,
  ArrowLeft,
  Clock,
  User,
  RefreshCw,
} from "lucide-react";

import { apiGet, apiPost, apiPatch } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatRelativeTime, formatDate } from "@/lib/utils-fin";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface TicketUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
}

interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  userId: string;
  user: TicketUser;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: string;
  message: string;
  attachmentUrl?: string | null;
  createdAt: string;
}

interface TicketConversation {
  ticket: Ticket;
  messages: TicketMessage[];
}

const STATUS_OPTIONS: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
];

const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  NORMAL: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  URGENT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const CATEGORY_COLORS: Record<string, string> = {
  GENERAL:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PAYMENT:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  TASK: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  WITHDRAWAL:
    "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  ACCOUNT:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  OTHER: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

interface TicketsResponse {
  tickets: Ticket[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function AdminSupport() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [newStatus, setNewStatus] = useState<TicketStatus | "">("");
  const [newPriority, setNewPriority] = useState<TicketPriority | "">("");

  const queryParams = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
  const { data, isLoading } = useQuery<TicketsResponse>({
    queryKey: ["admin-support", statusFilter],
    queryFn: () => apiGet<TicketsResponse>(`/api/supabase/admin/support${queryParams}`),
  });
  const tickets = data?.tickets ?? [];

  const { data: conversation, isLoading: convLoading } = useQuery<
    TicketConversation,
    Error
  >({
    queryKey: ["ticket-conversation", selectedTicketId],
    queryFn: () =>
      apiGet<TicketConversation>(
        `/api/supabase/support/tickets/${selectedTicketId}/messages`
      ),
    enabled: !!selectedTicketId,
  });

  const replyMutation = useMutation({
    mutationFn: (message: string) =>
      apiPost(`/api/supabase/support/tickets/${selectedTicketId}/messages`, { message }),
    onSuccess: () => {
      toast.success("Reply sent");
      setReply("");
      queryClient.invalidateQueries({
        queryKey: ["ticket-conversation", selectedTicketId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to send reply"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { status?: TicketStatus; priority?: TicketPriority }) =>
      apiPatch(`/api/supabase/admin/support/${selectedTicketId}`, payload),
    onSuccess: () => {
      toast.success("Ticket updated");
      queryClient.invalidateQueries({
        queryKey: ["ticket-conversation", selectedTicketId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      setNewStatus("");
      setNewPriority("");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update ticket"),
  });

  const openTicket = (id: string) => {
    setSelectedTicketId(id);
    setConversationOpen(true);
    setReply("");
    setNewStatus("");
    setNewPriority("");
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) {
      toast.error("Reply cannot be empty");
      return;
    }
    replyMutation.mutate(reply.trim());
  };

  const handleStatusChange = () => {
    const payload: any = {};
    if (newStatus) payload.status = newStatus;
    if (newPriority) payload.priority = newPriority;
    if (Object.keys(payload).length === 0) {
      toast.error("Select a status or priority to update");
      return;
    }
    updateMutation.mutate(payload);
  };

  // Stats
  const stats = {
    total: tickets?.length ?? 0,
    open: tickets?.filter((t) => t.status === "OPEN").length ?? 0,
    inProgress: tickets?.filter((t) => t.status === "IN_PROGRESS").length ?? 0,
    waiting: tickets?.filter((t) => t.status === "WAITING").length ?? 0,
    resolved: tickets?.filter((t) => t.status === "RESOLVED").length ?? 0,
    closed: tickets?.filter((t) => t.status === "CLOSED").length ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Headphones className="h-6 w-6 text-violet-500" />
          Support Tickets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage and respond to user support tickets.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Open</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">
            {stats.open}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">In Progress</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {stats.inProgress}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Waiting</div>
          <div className="text-2xl font-bold mt-1 text-gray-600">
            {stats.waiting}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Resolved</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {stats.resolved}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Closed</div>
          <div className="text-2xl font-bold mt-1 text-gray-600">
            {stats.closed}
          </div>
        </Card>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("ALL")}
          className={
            statusFilter === "ALL"
              ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
              : ""
          }
        >
          All ({stats.total})
        </Button>
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className={
              statusFilter === s
                ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
                : ""
            }
          >
            {s.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {/* Tickets list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No tickets found</h3>
          <p className="text-sm text-muted-foreground">
            No support tickets match the current filter.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Card
              key={t.id}
              className="p-4 hover:border-violet-300 cursor-pointer transition-colors"
              onClick={() => openTicket(t.id)}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold truncate">{t.subject}</h3>
                    <Badge
                      variant="outline"
                      className={
                        CATEGORY_COLORS[t.category] || CATEGORY_COLORS.OTHER
                      }
                    >
                      {t.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={PRIORITY_COLORS[t.priority]}
                    >
                      {t.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {t.user?.fullName} (@{t.user?.username})
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {t.user?.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {t._count?.messages ?? 0} messages
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(t.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Ticket conversation dialog */}
      <Dialog open={conversationOpen} onOpenChange={setConversationOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <ArrowLeft
                className="h-4 w-4 cursor-pointer"
                onClick={() => setConversationOpen(false)}
              />
              <span className="truncate">{conversation?.ticket.subject}</span>
            </DialogTitle>
          </DialogHeader>

          {convLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !conversation ? (
            <div className="p-8 text-center text-muted-foreground">
              Ticket not found.
            </div>
          ) : (
            <>
              {/* Ticket meta */}
              <div className="flex flex-wrap gap-2 items-center pb-3 border-b text-xs">
                <Badge variant="outline" className={PRIORITY_COLORS[conversation.ticket.priority]}>
                  {conversation.ticket.priority}
                </Badge>
                <StatusBadge status={conversation.ticket.status} />
                <Badge variant="outline" className="capitalize">
                  {conversation.ticket.category}
                </Badge>
                <span className="text-muted-foreground">
                  Opened {formatDate(conversation.ticket.createdAt)}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 max-h-[40vh] p-1">
                {conversation.messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-6">
                    No messages yet.
                  </div>
                ) : (
                  conversation.messages.map((m) => {
                    const isAdmin = m.senderRole === "ADMIN";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            isAdmin
                              ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
                              : "bg-muted"
                          }`}
                        >
                          <div
                            className={`text-xs font-semibold mb-1 ${
                              isAdmin ? "text-white/80" : "text-muted-foreground"
                            }`}
                          >
                            {isAdmin ? "Admin" : (conversation.ticket?.user?.fullName || "—")}
                          </div>
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {m.message}
                          </div>
                          <div
                            className={`text-[10px] mt-1 ${
                              isAdmin ? "text-white/70" : "text-muted-foreground/70"
                            }`}
                          >
                            {formatRelativeTime(m.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Status / Priority update */}
              <div className="border-t pt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Update Status</Label>
                    <Select
                      value={newStatus}
                      onValueChange={(v) => setNewStatus(v as TicketStatus)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Update Priority</Label>
                    <Select
                      value={newPriority}
                      onValueChange={(v) =>
                        setNewPriority(v as TicketPriority)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStatusChange}
                      disabled={updateMutation.isPending}
                      className="w-full"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Apply
                    </Button>
                  </div>
                </div>

                {/* Reply */}
                <form onSubmit={handleSendReply} className="space-y-2">
                  <Label htmlFor="reply" className="text-xs">
                    Reply
                  </Label>
                  <Textarea
                    id="reply"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={
                        replyMutation.isPending ||
                        conversation.ticket.status === "CLOSED"
                      }
                      className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {replyMutation.isPending ? "Sending..." : "Send Reply"}
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

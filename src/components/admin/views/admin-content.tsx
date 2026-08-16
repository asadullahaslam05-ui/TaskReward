"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  Save,
  Eye,
  Code,
  Clock,
  FileType,
  Search,
} from "lucide-react";

import { apiGet, apiPut } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils-fin";

interface ContentPageMeta {
  slug: string;
  title: string;
  updatedAt: string;
}

interface ContentPage extends ContentPageMeta {
  id: string;
  content: string;
}

const DEFAULT_PAGES = [
  { slug: "about", title: "About Us" },
  { slug: "faq", title: "FAQ" },
  { slug: "terms", title: "Terms & Conditions" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "refund", title: "Refund Policy" },
  { slug: "withdrawal-policy", title: "Withdrawal Policy" },
  { slug: "task-rules", title: "Task Rules" },
  { slug: "contact", title: "Contact Us" },
  { slug: "help", title: "Help Center" },
];

export function AdminContent() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // List of pages
  const { data: pages, isLoading } = useQuery<ContentPageMeta[]>({
    queryKey: ["content-pages"],
    queryFn: () => apiGet<ContentPageMeta[]>("/api/supabase/admin/content"),
  });

  // Selected page full content
  const { data: currentPage, isLoading: pageLoading } = useQuery<
    ContentPage,
    Error
  >({
    queryKey: ["content-page", selectedSlug],
    queryFn: () =>
      apiGet<ContentPage>(`/api/content?slug=${selectedSlug}`),
    enabled: !!selectedSlug,
    retry: false,
  });

  // Build display list (DB-backed pages merged with default list)
  const displayPages = (() => {
    if (!pages) return DEFAULT_PAGES;
    const map = new Map<string, ContentPageMeta>();
    for (const p of DEFAULT_PAGES) {
      map.set(p.slug, {
        slug: p.slug,
        title: p.title,
        updatedAt: "",
      });
    }
    for (const p of pages) {
      map.set(p.slug, p);
    }
    return Array.from(map.values());
  })();

  const filteredPages = displayPages.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q)
    );
  });

  const handleSelect = (slug: string) => {
    setSelectedSlug(slug);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-violet-500" />
          Pages & Content
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit static pages shown across the platform (markdown supported).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Pages sidebar */}
        <Card className="p-3 h-fit">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {isLoading ? (
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
              {filteredPages.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => handleSelect(p.slug)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedSlug === p.slug
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 font-medium"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="truncate">{p.title}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    /{p.slug}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Editor */}
        {!selectedSlug ? (
          <Card className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
            <FileType className="h-16 w-16 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1">Select a page to edit</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a page from the list to edit its content. All changes are
              saved instantly.
            </p>
          </Card>
        ) : pageLoading ? (
          <Card className="p-6 space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </Card>
        ) : !currentPage ? (
          <Card className="p-12 text-center">
            <FileType className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1">Page not found</h3>
            <p className="text-sm text-muted-foreground">
              This page does not exist yet. Try another one.
            </p>
          </Card>
        ) : (
          <ContentEditor
            key={currentPage.id}
            page={currentPage}
            slug={selectedSlug}
          />
        )}
      </div>
    </div>
  );
}

function ContentEditor({
  page,
  slug,
}: {
  page: ContentPage;
  slug: string;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");

  const saveMutation = useMutation({
    mutationFn: (payload: { title: string; content: string }) =>
      apiPut(`/api/supabase/admin/content/${slug}`, payload),
    onSuccess: () => {
      toast.success("Content saved");
      queryClient.invalidateQueries({ queryKey: ["content-pages"] });
      queryClient.invalidateQueries({
        queryKey: ["content-page", slug],
      });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    saveMutation.mutate({ title: title.trim(), content });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {page.title}
            <Badge variant="outline" className="text-xs">
              /{slug}
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            Last updated {page.updatedAt ? formatDate(page.updatedAt) : "never"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            <button
              onClick={() => setViewMode("edit")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                viewMode === "edit"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <Code className="h-3 w-3" />
              Edit
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                viewMode === "preview"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
          >
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Page Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Page title"
        />
      </div>

      {viewMode === "edit" ? (
        <div className="space-y-1.5">
          <Label htmlFor="content">Content (Markdown supported)</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the page content in markdown..."
            rows={20}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Use markdown syntax: # headings, **bold**, *italic*,
            [links](url), - lists, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Preview</Label>
          <div className="border rounded-md p-4 min-h-[400px] prose prose-sm dark:prose-invert max-w-none">
            {content ? (
              <MarkdownPreview content={content} />
            ) : (
              <p className="text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * Minimal markdown preview (no external deps).
 * Supports: headings, bold, italic, inline code, links, lists, paragraphs.
 */
function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = (key: number) => {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item, i) => (
      <li key={i}>{renderInline(item)}</li>
    ));
    if (listType === "ol") {
      elements.push(<ol key={`list-${key}`}>{items}</ol>);
    } else {
      elements.push(<ul key={`list-${key}`}>{items}</ul>);
    }
    listBuffer = [];
    listType = null;
  };

  const renderInline = (text: string) => {
    // Inline code
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let idx = 0;
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/;
    while (remaining.length > 0) {
      const m = regex.exec(remaining);
      if (!m) {
        parts.push(remaining);
        break;
      }
      if (m.index > 0) {
        parts.push(remaining.substring(0, m.index));
      }
      if (m[2]) {
        // bold
        parts.push(<strong key={idx++}>{m[2]}</strong>);
      } else if (m[3]) {
        // italic
        parts.push(<em key={idx++}>{m[3]}</em>);
      } else if (m[4]) {
        // code
        parts.push(
          <code
            key={idx++}
            className="bg-muted px-1 py-0.5 rounded text-xs"
          >
            {m[4]}
          </code>
        );
      } else if (m[5] && m[6]) {
        // link
        parts.push(
          <a
            key={idx++}
            href={m[6]}
            className="text-violet-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {m[5]}
          </a>
        );
      }
      remaining = remaining.substring(m.index + m[0].length);
    }
    return <>{parts}</>;
  };

  lines.forEach((rawLine, i) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList(i);
      return;
    }
    if (line.startsWith("# ")) {
      flushList(i);
      elements.push(<h1 key={i}>{renderInline(line.slice(2))}</h1>);
    } else if (line.startsWith("## ")) {
      flushList(i);
      elements.push(<h2 key={i}>{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("### ")) {
      flushList(i);
      elements.push(<h3 key={i}>{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (listType !== "ul") {
        flushList(i);
        listType = "ul";
      }
      listBuffer.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      if (listType !== "ol") {
        flushList(i);
        listType = "ol";
      }
      listBuffer.push(line.replace(/^\d+\.\s/, ""));
    } else if (line === "---" || line === "***") {
      flushList(i);
      elements.push(<hr key={i} className="my-3 border-t" />);
    } else {
      flushList(i);
      elements.push(
        <p key={i} className="my-1">
          {renderInline(line)}
        </p>
      );
    }
  });
  flushList(lines.length);

  return <div className="space-y-1">{elements}</div>;
}

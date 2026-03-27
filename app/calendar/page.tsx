"use client";
import { useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { useStore } from "@/lib/store";
import { Button, Card, Chip, SectionLabel, PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, parseISO,
  addMonths, subMonths, isToday, addWeeks, subWeeks, eachHourOfInterval,
  startOfDay, endOfDay, getHours,
} from "date-fns";
import type { ScheduledPost, Platform } from "@/lib/types";
import { PLATFORM_ICONS, PLATFORM_LABELS } from "@/lib/templates";
import clsx from "clsx";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

type ViewMode = "month" | "week";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-text-muted/30 text-text-muted",
  scheduled: "bg-accent/20 text-accent-light",
  published: "bg-success/20 text-success",
  failed: "bg-error/20 text-error",
};

const ItemTypes = {
  POST: 'post',
};

interface DragItem {
  id: string;
  scheduledAt: string;
}

// Draggable Post Component
interface DraggablePostProps {
  post: ScheduledPost;
  onClick: (post: ScheduledPost) => void;
  className?: string;
}

const DraggablePost: React.FC<DraggablePostProps> = ({ post, onClick, className }) => {
  const [{ isDragging }, drag] = useDrag<DragItem, unknown, { isDragging: boolean }>(() => ({
    type: ItemTypes.POST,
    item: { id: post.id, scheduledAt: post.scheduledAt },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <button
      ref={drag}
      onClick={() => onClick(post)}
      className={clsx(
        "w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate",
        STATUS_COLORS[post.status],
        className,
        isDragging ? "opacity-50" : "opacity-100"
      )}
      style={{ cursor: 'grab' }}
    >
      {PLATFORM_ICONS[post.platforms[0]]} {post.content.caption.slice(0, 20)}…
    </button>
  );
};

// Droppable Day Component
interface DroppableDayProps {
  day: Date;
  children: React.ReactNode;
  onDropPost: (postId: string, newDate: Date) => void;
  className?: string;
}

const DroppableDay: React.FC<DroppableDayProps> = ({ day, children, onDropPost, className }) => {
  const [, drop] = useDrop(() => ({
    accept: ItemTypes.POST,
    drop: (item: DragItem) => onDropPost(item.id, day),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  return (
    <div ref={drop} className={clsx(className)}>
      {children}
    </div>
  );
};


export default function CalendarPage() {
  const { getActiveBrand, posts, updatePost, deletePost } = useStore();
  const brand = getActiveBrand();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  const brandPosts = brand ? posts.filter((p) => p.brandId === brand.id) : [];

  const getPostsForDay = (day: Date) =>
    brandPosts.filter((p) => isSameDay(parseISO(p.scheduledAt), day));

  // ── Month view ─────────────────────────────────────────────────────────
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // ── Week view ──────────────────────────────────────────────────────────
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const nav = (dir: "prev" | "next") => {
    if (viewMode === "month") {
      setCurrentDate(dir === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else {
      setCurrentDate(dir === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    }
  };

  const handleDropPost = useCallback((postId: string, newDate: Date) => {
    const postToUpdate = brandPosts.find(p => p.id === postId);
    if (postToUpdate) {
      // Preserve the time component of the original scheduledAt if dropping on the same day
      // Otherwise, set to a default time for the new day (e.g., 9 AM)
      const originalScheduledAt = parseISO(postToUpdate.scheduledAt);
      let updatedScheduledAt = newDate;

      if (isSameDay(originalScheduledAt, newDate)) {
        updatedScheduledAt.setHours(originalScheduledAt.getHours());
        updatedScheduledAt.setMinutes(originalScheduledAt.getMinutes());
      } else {
        updatedScheduledAt.setHours(9); // Default to 9 AM for new days
        updatedScheduledAt.setMinutes(0);
      }

      updatePost(postId, { scheduledAt: updatedScheduledAt.toISOString() });
    }
  }, [brandPosts, updatePost]);

  if (!brand) {
    return (
      <AppShell>
        <div className="p-8">
          <EmptyState
            icon="📅"
            title="No brand selected"
            description="Create a brand to start scheduling content."
            action={<Link href="/onboarding"><Button>Create Brand</Button></Link>}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <DndProvider backend={HTML5Backend}>
        <div className="p-8 max-w-7xl mx-auto">
          <PageHeader
            title="Content Calendar"
            subtitle={brand ? `Scheduling for ${brand.name}` : "Select a brand to see posts"}
            action={
              <div className="flex gap-2 items-center">
                <div className="flex bg-surface border border-border rounded-xl overflow-hidden">
                  {(["month", "week"] as ViewMode[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setViewMode(v)}
                      className={clsx(
                        "px-4 py-2 text-sm font-medium transition-colors capitalize",
                        viewMode === v ? "bg-accent text-white" : "text-text-muted hover:text-text"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <Link href="/composer">
                  <Button size="sm">+ New Post</Button>
                </Link>
              </div>
            }
          />

          <div className="grid grid-cols-4 gap-6">
            {/* Calendar */}
            <div className="col-span-3">
              {/* Nav */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => nav("prev")} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-text-muted hover:text-text transition-colors">
                  ←
                </button>
                <h2 className="font-semibold text-lg">
                  {viewMode === "month"
                    ? format(currentDate, "MMMM yyyy")
                    : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
                </h2>
                <button onClick={() => nav("next")} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-text-muted hover:text-text transition-colors">
                  →
                </button>
              </div>

              {/* Day labels */}
              <div className="grid grid-cols-7 mb-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-text-muted py-2">
                    {d}
                  </div>
                ))}
              </div>

              {/* ── Month grid ── */}
              {viewMode === "month" && (
                <div className="grid grid-cols-7 gap-1">
                  {calDays.map((day) => {
                    const dayPosts = getPostsForDay(day);
                    const inMonth = isSameMonth(day, currentDate);
                    return (
                      <DroppableDay
                        key={day.toISOString()}
                        day={day}
                        onDropPost={handleDropPost}
                        className={clsx(
                          "min-h-[90px] p-2 rounded-xl border transition-colors",
                          inMonth ? "bg-card border-border" : "bg-surface/50 border-transparent",
                          isToday(day) && "border-accent/50"
                        )}
                      >
                        <span
                          className={clsx(
                            "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1",
                            isToday(day)
                              ? "bg-accent text-white"
                              : inMonth
                              ? "text-text"
                              : "text-text-muted"
                          )}
                        >
                          {format(day, "d")}
                        </span>
                        <div className="space-y-0.5">
                          {dayPosts.slice(0, 2).map((p) => (
                            <DraggablePost
                              key={p.id}
                              post={p}
                              onClick={() => setSelectedPost(p)}
                            />
                          ))}
                          {dayPosts.length > 2 && (
                            <p className="text-[10px] text-text-muted pl-1">+{dayPosts.length - 2} more</p>
                          )}
                        </div>
                      </DroppableDay>
                    );
                  })}
                </div>
              )}

              {/* ── Week view ── */}
              {viewMode === "week" && (
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day) => {
                    const dayPosts = getPostsForDay(day);
                    return (
                      <DroppableDay
                        key={day.toISOString()}
                        day={day}
                        onDropPost={handleDropPost}
                        className={clsx(
                          "min-h-[400px] p-2 rounded-xl border",
                          isToday(day) ? "bg-accent/5 border-accent/30" : "bg-card border-border"
                        )}
                      >
                        <div className="text-center mb-3">
                          <p className="text-xs text-text-muted">{format(day, "EEE")}</p>
                          <span
                            className={clsx(
                              "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto",
                              isToday(day) ? "bg-accent text-white" : "text-text"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {dayPosts.map((p) => (
                            <DraggablePost
                              key={p.id}
                              post={p}
                              onClick={() => setSelectedPost(p)}
                              className="p-2 rounded-lg"
                            />
                          ))}
                        </div>
                      </DroppableDay>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Right: Post detail / Stats ── */}
            <div className="col-span-1 space-y-5">
              {/* Legend */}
              <Card className="p-4">
                <SectionLabel>Status</SectionLabel>
                <div className="space-y-2">
                  {Object.entries(STATUS_COLORS).map(([status, cls]) => (
                    <div key={status} className="flex items-center gap-2">
                      <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium capitalize", cls)}>
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Stats */}
              <Card className="p-4">
                <SectionLabel>This Month</SectionLabel>
                <div className="space-y-3">
                  {[
                    ["Scheduled", brandPosts.filter((p) => p.status === "scheduled").length],
                    ["Published", brandPosts.filter((p) => p.status === "published").length],
                    ["Drafts", brandPosts.filter((p) => p.status === "draft").length],
                  ].map(([label, count]) => (
                    <div key={label as string} className="flex justify-between items-center">
                      <span className="text-xs text-text-muted">{label as string}</span>
                      <span className="text-sm font-bold">{count as number}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Selected post detail */}
              {selectedPost ? (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <SectionLabel>Post Detail</SectionLabel>
                    <button onClick={() => setSelectedPost(null)} className="text-text-muted hover:text-text text-lg">×</button>
                  </div>
                  <Chip variant={selectedPost.status === "scheduled" ? "accent" : selectedPost.status === "published" ? "success" : "neutral"} className="mb-3 capitalize text-[11px]">
                    {selectedPost.status}
                  </Chip>
                  <p className="text-xs text-text-muted mb-1">
                    {format(parseISO(selectedPost.scheduledAt), "MMM d, yyyy · h:mm a")}
                  </p>
                  <div className="flex gap-1 mb-3 flex-wrap">
                    {selectedPost.platforms.map((p) => (
                      <Chip key={p} variant="neutral" className="text-[10px]">
                        {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p as Platform]}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-text mb-4 line-clamp-4">
                    {selectedPost.content.caption}
                  </p>
                  <div className="flex gap-2">
                    {selectedPost.status === "scheduled" && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => {
                          updatePost(selectedPost.id, { status: "published" });
                          setSelectedPost({ ...selectedPost, status: "published" });
                        }}
                      >
                        ✓ Mark Published
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        deletePost(selectedPost.id);
                        setSelectedPost(null);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="p-4 text-center">
                  <p className="text-xs text-text-muted">Click any post to view details</p>
                </Card>
              )}

              <Link href="/composer">
                <Button className="w-full" variant="ghost">+ Create New Post</Button>
              </Link>
            </div>
          </div>
        </div>
      </DndProvider>
    </AppShell>
  );
}

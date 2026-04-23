/**
 * LeadTasksPanel — Sprint 5
 *
 * Operator follow-up tasks for a lead. Tasks have a title, optional due
 * date, and a completed state. Shows open vs done tasks and overdue
 * highlighting.
 */

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Plus, Trash2, AlertCircle, CheckCircle2, Circle, ListChecks, Calendar,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  createLeadTask, deleteLeadTask, getErrorMessage, listLeadTasks, updateLeadTask,
  type LeadTask,
} from "@/services/adminDataService";

interface LeadTasksPanelProps {
  leadId: string;
}

export function LeadTasksPanel({ leadId }: LeadTasksPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  const { data: tasks = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "lead-tasks", leadId],
    queryFn: () => listLeadTasks(leadId),
    enabled: !!leadId,
  });

  const { open, done } = useMemo(() => {
    const open: LeadTask[] = [];
    const done: LeadTask[] = [];
    for (const t of tasks) (t.completed ? done : open).push(t);
    return { open, done };
  }, [tasks]);

  const createMutation = useMutation({
    mutationFn: () =>
      createLeadTask({
        lead_id: leadId,
        title,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      }),
    onSuccess: () => {
      setTitle("");
      setDueAt("");
      queryClient.invalidateQueries({ queryKey: ["admin", "lead-tasks", leadId] });
      toast({ title: "Task added" });
    },
    onError: (err) => {
      toast({ title: "Couldn't save task", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { task_id: string; completed: boolean }) =>
      updateLeadTask(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "lead-tasks", leadId] });
    },
    onError: (err) => {
      toast({ title: "Update failed", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLeadTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "lead-tasks", leadId] });
      toast({ title: "Task deleted" });
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || createMutation.isPending) return;
    createMutation.mutate();
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Workflow
          </p>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mt-0.5">
            Tasks
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5" />
          {open.length} open · {done.length} done
        </span>
      </header>

      <form onSubmit={handleSubmit} className="space-y-2 mb-5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Follow up with homeowner about quote scope…"
          maxLength={200}
          className="h-10"
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-9 pl-8 text-xs"
              aria-label="Due date"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!title.trim() || createMutation.isPending}
            className="h-9"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add task
              </>
            )}
          </Button>
        </div>
      </form>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{getErrorMessage(error)}</p>
            <button onClick={() => refetch()} className="mt-1 text-xs underline">
              Try again
            </button>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-3">No tasks yet.</p>
      ) : (
        <div className="space-y-4">
          {open.length > 0 && (
            <TaskGroup
              label="Open"
              tasks={open}
              onToggle={(t) => updateMutation.mutate({ task_id: t.id, completed: !t.completed })}
              onDelete={(t) => deleteMutation.mutate(t.id)}
              busyId={
                updateMutation.isPending
                  ? (updateMutation.variables?.task_id ?? null)
                  : deleteMutation.isPending
                  ? (deleteMutation.variables ?? null)
                  : null
              }
            />
          )}
          {done.length > 0 && (
            <TaskGroup
              label="Completed"
              tasks={done}
              onToggle={(t) => updateMutation.mutate({ task_id: t.id, completed: !t.completed })}
              onDelete={(t) => deleteMutation.mutate(t.id)}
              busyId={
                updateMutation.isPending
                  ? (updateMutation.variables?.task_id ?? null)
                  : deleteMutation.isPending
                  ? (deleteMutation.variables ?? null)
                  : null
              }
            />
          )}
        </div>
      )}
    </section>
  );
}

function TaskGroup({
  label, tasks, onToggle, onDelete, busyId,
}: {
  label: string;
  tasks: LeadTask[];
  onToggle: (t: LeadTask) => void;
  onDelete: (t: LeadTask) => void;
  busyId: string | null;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
        {label}
      </p>
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onToggle={() => onToggle(t)}
            onDelete={() => onDelete(t)}
            busy={busyId === t.id}
          />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({
  task, onToggle, onDelete, busy,
}: {
  task: LeadTask;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const overdue = !task.completed && task.due_at && isPast(new Date(task.due_at));
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-border bg-background/60 px-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="mt-0.5 shrink-0"
        aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : task.completed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
          {task.title}
        </p>
        {task.due_at && (
          <p className={`mt-0.5 text-[11px] font-mono ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            Due {format(new Date(task.due_at), "MMM d, yyyy h:mm a")}
            {overdue && " · OVERDUE"}
          </p>
        )}
        {task.created_by_email && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">By {task.created_by_email}</p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={busy}
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
        aria-label="Delete task"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

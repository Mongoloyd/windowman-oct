/**
 * LeadNotesPanel — Sprint 5
 *
 * Free-form operator notes (call logs, observations, internal context).
 * Stores actor + email server-side; supports delete (operator+).
 */

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, AlertCircle, MessageSquareText } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  createLeadNote, deleteLeadNote, getErrorMessage, listLeadNotes,
  type LeadNote,
} from "@/services/adminDataService";
import { NOTE_CATEGORIES } from "../leadWorkflow";

interface LeadNotesPanelProps {
  leadId: string;
}

export function LeadNotesPanel({ leadId }: LeadNotesPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("general");

  const { data: notes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "lead-notes", leadId],
    queryFn: () => listLeadNotes(leadId),
    enabled: !!leadId,
  });

  const createMutation = useMutation({
    mutationFn: () => createLeadNote(leadId, body, category),
    onSuccess: () => {
      setBody("");
      setCategory("general");
      queryClient.invalidateQueries({ queryKey: ["admin", "lead-notes", leadId] });
      toast({ title: "Note added" });
    },
    onError: (err) => {
      toast({ title: "Couldn't save note", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteLeadNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "lead-notes", leadId] });
      toast({ title: "Note deleted" });
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || createMutation.isPending) return;
    createMutation.mutate();
  };

  return (
    <section className="wm-lead-dossier-panel">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="wm-lead-dossier-kicker">
            Workflow
          </p>
          <h2 className="wm-lead-dossier-heading">
            Notes
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
          <MessageSquareText className="h-3.5 w-3.5" />
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </span>
      </header>

      <form onSubmit={handleSubmit} className="mb-5 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="lead-note-body" className="text-sm font-semibold text-slate-800">
            Internal note
          </Label>
          <Textarea
            id="lead-note-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Log a call, capture context, or leave an internal note…"
            rows={3}
            maxLength={4000}
            className="resize-none"
          />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(8rem,12rem)_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label id="lead-note-category-label" className="text-sm font-semibold text-slate-800">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                className="h-11 w-full text-sm"
                aria-labelledby="lead-note-category-label"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-slate-700 sm:pb-3 sm:text-right">
            {body.length}/4000
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || createMutation.isPending}
            className="h-11 min-h-11"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add note
              </>
            )}
          </Button>
        </div>
      </form>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
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
      ) : notes.length === 0 ? (
        <p className="text-sm text-slate-700 italic py-3">No notes yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              onDelete={() => deleteMutation.mutate(n.id)}
              deleting={deleteMutation.isPending && deleteMutation.variables === n.id}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteRow({
  note, onDelete, deleting,
}: {
  note: LeadNote;
  onDelete: () => void;
  deleting: boolean;
}) {
  const cat = NOTE_CATEGORIES.find((c) => c.value === note.category)?.label ?? "Note";
  return (
    <li className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-sm font-bold uppercase tracking-wider text-slate-700">
            {cat}
          </span>
          <span className="text-xs text-slate-700 truncate">
            {note.created_by_email ?? "Operator"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-slate-700 font-mono">
            {format(new Date(note.created_at), "MMM d, h:mm a")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={deleting}
            className="h-11 w-11 text-slate-700 hover:text-destructive"
            aria-label="Delete note"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{note.body}</p>
    </li>
  );
}

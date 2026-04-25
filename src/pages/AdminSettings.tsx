/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AdminSettings — Role Management Dashboard (super_admin only)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trust-Centric Soft SaaS Design System
 * - Light, airy, professional aesthetic
 * - Skeuomorphic depth via soft drop-shadows
 * - Blue gradient CTAs, emerald/orange status badges
 *
 * ROUTE: /admin/settings
 */

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Clock,
  ChevronDown,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Eye,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import {
  listUserRoles,
  manageUserRole,
  getRoleAuditLog,
  getErrorMessage,
  isAdminDataError,
  type AppRole,
  type AdminActionResponses,
} from "@/services/adminDataService";
import { SharedMarketReadinessSection } from "@/components/admin/SharedMarketReadinessSection";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type UserWithRole = AdminActionResponses["list_user_roles"]["users"][number];
type AuditEntry = AdminActionResponses["get_role_audit_log"]["entries"][number];

const ROLE_CONFIG: Record<
  AppRole,
  {
    label: string;
    icon: typeof Shield;
    badgeBg: string;
    badgeText: string;
    dotColor: string;
    description: string;
  }
> = {
  super_admin: {
    label: "Super Admin",
    icon: ShieldAlert,
    badgeBg: "bg-red-100 border-red-300",
    badgeText: "text-red-950",
    dotColor: "bg-rose-500",
    description: "Full access. Manage roles, delete data, view financials.",
  },
  operator: {
    label: "Operator",
    icon: ShieldCheck,
    badgeBg: "bg-blue-100 border-blue-300",
    badgeText: "text-blue-950",
    dotColor: "bg-blue-500",
    description: "Update leads, manage opportunities, trigger voice calls.",
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    badgeBg: "bg-emerald-100 border-emerald-300",
    badgeText: "text-emerald-950",
    dotColor: "bg-emerald-500",
    description: "Read-only dashboard access.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Access Denied Component
// ═══════════════════════════════════════════════════════════════════════════

function AccessDenied() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-white shadow-lg shadow-rose-100/50 border border-rose-100 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-rose-500" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Access Restricted
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          This section requires Super Admin clearance.
          <br />
          Contact your administrator to request access.
        </p>
        <Button
          onClick={() => window.history.back()}
          className="bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-xl shadow-md shadow-blue-200/50 hover:shadow-lg hover:from-blue-400 hover:to-blue-500 transition-all duration-200 px-6"
        >
          Go Back
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Role Badge Component
// ═══════════════════════════════════════════════════════════════════════════

function RoleBadge({ role }: { role: AppRole }) {
  const config = ROLE_CONFIG[role];
  if (!config) return <span className="text-slate-700">{role}</span>;

  return (
    <span
      className={`wm-admin-badge ${config.badgeBg} ${config.badgeText}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Role Selector Dropdown
// ═══════════════════════════════════════════════════════════════════════════

function RoleSelector({
  currentRole,
  userId,
  userEmail,
  currentUserId,
  onRoleChanged,
}: {
  currentRole: AppRole;
  userId: string;
  userEmail: string;
  currentUserId: string | null;
  onRoleChanged: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = userId === currentUserId;

  const handleSelect = async (newRole: AppRole) => {
    if (newRole === currentRole) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      await manageUserRole(userId, newRole);
      setIsOpen(false);
      onRoleChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => !isSelf && setIsOpen(!isOpen)}
        disabled={isSelf || isUpdating}
        className={`
          inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm
          transition-all duration-200
          ${
            isSelf
              ? "border-slate-100 text-slate-700 cursor-not-allowed bg-slate-50"
              : "border-slate-200 text-slate-700 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/40 cursor-pointer bg-white"
          }
        `}
        title={isSelf ? "Cannot change your own role" : `Change role for ${userEmail}`}
      >
        {isUpdating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
        ) : (
          <RoleBadge role={currentRole} />
        )}
        {!isSelf && <ChevronDown className="w-3.5 h-3.5 text-slate-700" />}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
            {(Object.keys(ROLE_CONFIG) as AppRole[]).map((roleKey) => {
              const config = ROLE_CONFIG[roleKey];
              const Icon = config.icon;
              const isActive = roleKey === currentRole;

              return (
                <button
                  key={roleKey}
                  onClick={() => handleSelect(roleKey)}
                  className={`
                    w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all duration-150
                    ${
                      isActive
                        ? "bg-blue-50/60 border-l-[3px] border-blue-500"
                        : "hover:bg-slate-50 border-l-[3px] border-transparent"
                    }
                  `}
                >
                  <div
                    className={`p-1.5 rounded-lg ${isActive ? "bg-blue-100" : "bg-slate-100"}`}
                  >
                    <Icon
                      className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-700"}`}
                    />
                  </div>
                  <div>
                    <div
                      className={`text-sm font-semibold ${isActive ? "text-slate-900" : "text-slate-700"}`}
                    >
                      {config.label}
                    </div>
                    <div className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                      {config.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && (
        <p className="absolute top-full mt-1.5 right-0 text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded-lg whitespace-nowrap shadow-sm">
          {error}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Users Table
// ═══════════════════════════════════════════════════════════════════════════

function UsersTable({
  users,
  currentUserId,
  onRoleChanged,
}: {
  users: UserWithRole[];
  currentUserId: string | null;
  onRoleChanged: () => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-3.5 px-5 text-[11px] font-bold text-slate-700 uppercase tracking-widest">
              User
            </th>
            <th className="text-left py-3.5 px-5 text-[11px] font-bold text-slate-700 uppercase tracking-widest">
              Role
            </th>
            <th className="text-left py-3.5 px-5 text-[11px] font-bold text-slate-700 uppercase tracking-widest hidden md:table-cell">
              Last Sign In
            </th>
            <th className="text-right py-3.5 px-5 text-[11px] font-bold text-slate-700 uppercase tracking-widest">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {users.map((user) => {
            const isSelf = user.user_id === currentUserId;
            return (
              <tr
                key={user.user_id}
                className={`
                  transition-colors duration-150
                  ${isSelf ? "bg-blue-50/30" : "hover:bg-slate-50/50"}
                `}
              >
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 shadow-sm shadow-blue-200/50 flex items-center justify-center text-white text-xs font-bold">
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-900">
                        {user.email}
                      </span>
                      {isSelf && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold uppercase tracking-wide">
                          You
                        </span>
                      )}
                      <p className="text-[11px] text-slate-700 mt-0.5 hidden sm:block">
                        {user.user_id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-5">
                  <RoleBadge role={user.role} />
                </td>
                <td className="py-4 px-5 hidden md:table-cell">
                  <span className="text-xs text-slate-700">
                    {user.last_sign_in
                      ? new Date(user.last_sign_in).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "Never"}
                  </span>
                </td>
                <td className="py-4 px-5 text-right">
                  <RoleSelector
                    currentRole={user.role}
                    userId={user.user_id}
                    userEmail={user.email}
                    currentUserId={currentUserId}
                    onRoleChanged={onRoleChanged}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Audit Log Panel
// ═══════════════════════════════════════════════════════════════════════════

function AuditLogPanel({
  entries,
  isLoading,
}: {
  entries: AuditEntry[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm text-slate-700">
          No role changes recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-900">
                {entry.changed_by_email}
              </span>{" "}
              {entry.action === "grant" ? "granted" : "changed"}{" "}
              <span className="font-semibold text-slate-900">
                {entry.target_email}
              </span>
              {entry.old_role && (
                <>
                  {" from "}
                  <span className="font-medium text-slate-700">{entry.old_role}</span>
                </>
              )}
              {" to "}
              <span className="font-semibold text-blue-600">{entry.new_role}</span>
            </p>
            <p className="text-[11px] text-slate-700 mt-1">
              {new Date(entry.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Stat Card (Role Legend)
// ═══════════════════════════════════════════════════════════════════════════

function RoleStatCard({
  roleKey,
  count,
}: {
  roleKey: AppRole;
  count: number;
}) {
  const config = ROLE_CONFIG[roleKey];
  const Icon = config.icon;

  return (
    <div className="relative bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 p-5 overflow-hidden">
      {/* Subtle gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 opacity-20 rounded-t-2xl" />

      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl ${config.badgeBg} flex items-center justify-center shadow-sm`}
        >
          <Icon className={`w-5 h-5 ${config.badgeText}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">{config.label}</p>
          <p className="text-xs text-slate-700 truncate leading-relaxed">
            {config.description}
          </p>
        </div>
        <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {count}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Settings Page Content
// ═══════════════════════════════════════════════════════════════════════════

function AdminSettingsContent() {
  const { isSuperAdmin, isLoading: roleLoading, userId } = useCurrentUserRole();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const result = await listUserRoles();
      setUsers(result.users || []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const fetchAuditLog = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const result = await getRoleAuditLog(100);
      setAuditLog(result.entries || []);
    } catch (err) {
      console.error("[AdminSettings] Audit log error:", err);
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
      fetchAuditLog();
    }
  }, [isSuperAdmin, fetchUsers, fetchAuditLog]);

  // Gate: only super_admin
  if (roleLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-700">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <AccessDenied />;
  }

  const handleRoleChanged = () => {
    fetchUsers();
    fetchAuditLog();
  };

  return (
    <AdminShell
      eyebrow="Admin · Access Control"
      title="Role Management"
      subtitle={`${users.length} user${users.length !== 1 ? "s" : ""} with assigned roles`}
      backTo="/admin"
      belowHeader={
        <Button
          onClick={() => {
            fetchUsers();
            fetchAuditLog();
          }}
          variant="outline"
          size="sm"
          className="h-9"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingUsers ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Role Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(Object.keys(ROLE_CONFIG) as AppRole[]).map((roleKey) => (
            <RoleStatCard
              key={roleKey}
              roleKey={roleKey}
              count={users.filter((u) => u.role === roleKey).length}
            />
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-800">{error}</p>
              <button
                onClick={fetchUsers}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium underline underline-offset-2 mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Content Card with Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] overflow-hidden">
          {/* Tab Bar */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition-all duration-200 ${
                activeTab === "users"
                  ? "text-blue-600 border-b-2 border-blue-500 bg-blue-50/30"
                  : "text-slate-700 hover:text-slate-700 hover:bg-slate-50/50"
              }`}
            >
              <Users className="w-4 h-4" />
              Users & Roles
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition-all duration-200 ${
                activeTab === "audit"
                  ? "text-blue-600 border-b-2 border-blue-500 bg-blue-50/30"
                  : "text-slate-700 hover:text-slate-700 hover:bg-slate-50/50"
              }`}
            >
              <Clock className="w-4 h-4" />
              Audit Log
              {auditLog.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                  {auditLog.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === "users" ? (
              isLoadingUsers ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl bg-slate-50" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-700">
                    No users with assigned roles.
                  </p>
                </div>
              ) : (
                <UsersTable
                  users={users}
                  currentUserId={userId}
                  onRoleChanged={handleRoleChanged}
                />
              )
            ) : (
              <div className="p-5 bg-slate-50/50">
                <AuditLogPanel entries={auditLog} isLoading={isLoadingAudit} />
              </div>
            )}
          </div>
        </div>

        {/* Phase 8 — Shared Market Network: informational-only future direction.
            Mounted here so super-admins can see where future shared-market
            controls will live. No interactive controls; no backend wiring. */}
        <SharedMarketReadinessSection />
      </div>
    </AdminShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Exported Page (wrapped with AuthGuard)
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminSettings() {
  return (
    <AuthGuard>
      <AdminSettingsContent />
    </AuthGuard>
  );
}

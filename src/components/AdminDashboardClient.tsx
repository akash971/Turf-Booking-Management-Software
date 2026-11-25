"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  Lock,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Trophy,
  Wallet,
  Webhook,
  XCircle,
} from "lucide-react";
import type {
  Booking,
  BookingStatus,
  DashboardSummary,
  TurfSettings,
} from "@/types/booking";
import {
  DEFAULT_TURF_SETTINGS,
  formatBDT,
  formatDisplayDate,
  formatTeamSize,
  getTodayLocalISO,
} from "@/lib/pricing";

interface AdminDashboardClientProps {
  initialAuthenticated: boolean;
  turfName: string;
}

const STATUS_BADGE_STYLES: Record<BookingStatus, string> = {
  pending:
    "border-amber-500/35 bg-amber-500/15 text-amber-300",
  confirmed:
    "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
  cancelled:
    "border-rose-500/35 bg-rose-500/15 text-rose-300",
};

function formatCreatedTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function AdminDashboardClient({
  initialAuthenticated,
  turfName,
}: AdminDashboardClientProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"bookings" | "settings">(
    "bookings"
  );

  // Bookings & filters
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    total_bookings: 0,
    todays_bookings: 0,
    pending_bookings: 0,
    confirmed_bookings: 0,
    cancelled_bookings: 0,
    total_advance_collected: 0,
    confirmed_advance_collected: 0,
    pending_advance_expected: 0,
  });
  const [dbProvider, setDbProvider] = useState<string>("sqlite");
  const [webhookConfigured, setWebhookConfigured] = useState<boolean>(false);

  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<BookingStatus | "all">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingBookings, setLoadingBookings] = useState<boolean>(false);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(
    null
  );
  const [exporting, setExporting] = useState<boolean>(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Settings tab state
  const [settings, setSettings] = useState<TurfSettings>(DEFAULT_TURF_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [newSlotInput, setNewSlotInput] = useState<string>("");

  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    setBannerError(null);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/bookings?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load bookings.");

      setBookings(data.bookings || []);
      if (data.summary) setSummary(data.summary);
      if (data.database_provider) setDbProvider(data.database_provider);
      setWebhookConfigured(Boolean(data.webhook_configured));
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "Failed to load bookings."
      );
    } finally {
      setLoadingBookings(false);
    }
  }, [filterDate, filterStatus, searchQuery]);

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
      }
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchBookings();
  }, [authenticated, fetchBookings]);

  useEffect(() => {
    if (!authenticated) return;
    fetchSettings();
  }, [authenticated, fetchSettings]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid password.");
      }
      setPassword("");
      setAuthenticated(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthenticated(false);
  };

  const handleStatusChange = async (
    bookingId: string,
    nextStatus: BookingStatus
  ) => {
    setUpdatingBookingId(bookingId);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status.");
      }
      await fetchBookings();
      setBannerSuccess(`Booking ${bookingId} marked as ${nextStatus}.`);
      setTimeout(() => setBannerSuccess(null), 3000);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "Status update failed."
      );
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleExportExcel = async (scope: "filtered" | "all") => {
    setExporting(true);
    setBannerError(null);
    try {
      const params = new URLSearchParams();
      params.set("scope", scope);
      if (scope === "filtered") {
        if (filterDate) params.set("date", filterDate);
        if (filterStatus !== "all") params.set("status", filterStatus);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/admin/export?${params.toString()}`);
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!res.ok) {
        throw new Error("Could not generate Excel file.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] || `turf-bookings-${getTodayLocalISO()}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "Excel export failed."
      );
    } finally {
      setExporting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings.");
      }
      setSettings(data.settings);
      setBannerSuccess("Pricing & turf settings saved successfully.");
      setTimeout(() => setBannerSuccess(null), 3500);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "Could not save settings."
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const hasActiveFilters =
    Boolean(filterDate) ||
    filterStatus !== "all" ||
    searchQuery.trim().length > 0;

  // =========================================================================
  // LOGIN VIEW
  // =========================================================================
  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-7 shadow-2xl shadow-slate-950/70 backdrop-blur-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/25">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">{turfName}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin_password"
                className="mb-1.5 block text-xs font-semibold text-slate-300"
              >
                Admin Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="admin_password"
                  type="password"
                  required
                  autoFocus
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pr-4 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {authError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 cursor-pointer"
            >
              {authLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Unlock Dashboard"
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-emerald-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Customer Booking Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED ADMIN DASHBOARD
  // =========================================================================
  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 shadow-md shadow-emerald-500/25">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white sm:text-lg">
                  Turf Admin Console
                </h1>
                <span className="hidden items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300 sm:inline-flex">
                  <Database className="h-2.5 w-2.5 text-emerald-400" />
                  {dbProvider}
                </span>
                <span
                  className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase sm:inline-flex ${
                    webhookConfigured
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-700 bg-slate-900 text-slate-400"
                  }`}
                >
                  <Webhook className="h-2.5 w-2.5" />
                  Webhook {webhookConfigured ? "On" : "Off"}
                </span>
              </div>
              <p className="text-xs text-slate-400">{turfName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("bookings")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeTab === "bookings"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Bookings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                Pricing & Slots
              </button>
            </div>

            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:text-white md:inline-flex"
            >
              Booking Page
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-500/40 hover:text-rose-300 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6">
        {/* Global Status Banners */}
        {bannerError && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{bannerError}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerError(null)}
              className="text-xs font-semibold text-rose-300 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {bannerSuccess && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{bannerSuccess}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* BOOKINGS TAB                                                      */}
        {/* ================================================================= */}
        {activeTab === "bookings" ? (
          <>
            {/* Summary Cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total Bookings
                  </p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-emerald-400">
                    <CalendarCheck2 className="h-4 w-4" />
                  </div>
                </div>
                <p className="font-mono-num mt-3 text-3xl font-extrabold text-white">
                  {summary.total_bookings}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {summary.confirmed_bookings} confirmed •{" "}
                  {summary.cancelled_bookings} cancelled
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Today&apos;s Bookings
                  </p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                </div>
                <p className="font-mono-num mt-3 text-3xl font-extrabold text-white">
                  {summary.todays_bookings}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Active matches scheduled for {getTodayLocalISO()}
                </p>
              </div>

              <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/35 p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    Total Advance Collected
                  </p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
                <p className="font-mono-num mt-3 text-3xl font-extrabold text-emerald-400">
                  {formatBDT(summary.total_advance_collected)}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Pending Ogrim:{" "}
                  <span className="font-mono-num font-semibold text-amber-300">
                    {formatBDT(summary.pending_advance_expected)}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFilterStatus(
                    filterStatus === "pending" ? "all" : "pending"
                  )
                }
                className={`rounded-3xl border p-5 text-left shadow-lg transition cursor-pointer ${
                  filterStatus === "pending"
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-slate-800 bg-slate-900/80 hover:border-amber-500/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                    Pending Verification
                  </p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <p className="font-mono-num mt-3 text-3xl font-extrabold text-white">
                  {summary.pending_bookings}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {filterStatus === "pending"
                    ? "Showing pending only (click to clear)"
                    : "Click to filter pending bookings"}
                </p>
              </button>
            </section>

            {/* Filter Toolbar + Excel Export */}
            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Search + Date + Status */}
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search ID, name, phone, team..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pr-4 pl-10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      aria-label="Filter by match date"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => setFilterDate(getTodayLocalISO())}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 cursor-pointer"
                    >
                      Today
                    </button>
                    {filterDate && (
                      <button
                        type="button"
                        onClick={() => setFilterDate("")}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
                    {(["all", "pending", "confirmed", "cancelled"] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFilterStatus(st)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize transition cursor-pointer ${
                            filterStatus === st
                              ? "bg-emerald-500 text-slate-950"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Refresh & Excel Export Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchBookings}
                    disabled={loadingBookings}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        loadingBookings ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportExcel("filtered")}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-md shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 cursor-pointer"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    Export to Excel (.xlsx)
                  </button>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => handleExportExcel("all")}
                      disabled={exporting}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export All
                    </button>
                  )}
                </div>
              </div>

              {/* Bookings Table */}
              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3.5">Booking ID</th>
                      <th className="px-4 py-3.5">Match Date & Slot</th>
                      <th className="px-4 py-3.5">Customer & Team</th>
                      <th className="px-4 py-3.5">Format</th>
                      <th className="px-4 py-3.5">Amounts (BDT)</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">
                        Quick Status Toggle
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {loadingBookings && bookings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-slate-400"
                        >
                          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-400" />
                          Loading bookings...
                        </td>
                      </tr>
                    ) : bookings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-slate-400"
                        >
                          <Filter className="mx-auto mb-2 h-6 w-6 text-slate-600" />
                          <p className="font-semibold text-slate-300">
                            No bookings found
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {hasActiveFilters
                              ? "Try clearing your date, search, or status filters."
                              : "New customer bookings will appear here instantly."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b) => {
                        const isUpdating = updatingBookingId === b.booking_id;
                        const waDigits = b.customer_phone.replace(/[^\d]/g, "");
                        const waHref = `https://wa.me/${
                          waDigits.startsWith("0")
                            ? `88${waDigits}`
                            : waDigits
                        }`;

                        return (
                          <tr
                            key={b.booking_id}
                            className="transition hover:bg-slate-900/60"
                          >
                            <td className="px-4 py-3.5 align-top">
                              <p className="font-mono-num text-xs font-bold text-emerald-400">
                                {b.booking_id}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {formatCreatedTimestamp(b.created_at)}
                              </p>
                            </td>

                            <td className="px-4 py-3.5 align-top">
                              <p className="font-semibold text-white">
                                {formatDisplayDate(b.match_date)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {b.time_slot}
                              </p>
                            </td>

                            <td className="px-4 py-3.5 align-top">
                              <p className="font-semibold text-white">
                                {b.customer_name}
                              </p>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                                <span className="font-mono-num">
                                  {b.customer_phone}
                                </span>
                                <a
                                  href={waHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Message on WhatsApp"
                                  className="text-emerald-400 hover:text-emerald-300"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              </div>
                              {b.team_name && (
                                <span className="mt-1 inline-block rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                                  {b.team_name}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 align-top">
                              <span className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-bold text-slate-200">
                                {formatTeamSize(b.players_per_team)}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 align-top">
                              <p className="font-mono-num text-xs font-bold text-emerald-400">
                                Adv: {formatBDT(b.advance_amount)}
                              </p>
                              <p className="font-mono-num mt-0.5 text-[11px] text-slate-400">
                                Total: {formatBDT(b.total_amount)}
                              </p>
                            </td>

                            <td className="px-4 py-3.5 align-top">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE_STYLES[b.status]}`}
                              >
                                {b.status}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-right align-top">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={
                                    isUpdating || b.status === "confirmed"
                                  }
                                  onClick={() =>
                                    handleStatusChange(
                                      b.booking_id,
                                      "confirmed"
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    isUpdating || b.status === "pending"
                                  }
                                  onClick={() =>
                                    handleStatusChange(b.booking_id, "pending")
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  Pending
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    isUpdating || b.status === "cancelled"
                                  }
                                  onClick={() =>
                                    handleStatusChange(
                                      b.booking_id,
                                      "cancelled"
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          /* ================================================================= */
          /* PRICING & TURF SETTINGS TAB                                       */
          /* ================================================================= */
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {loadingSettings ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-12 text-center text-slate-400">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-400" />
                Loading turf settings...
              </div>
            ) : (
              <>
                {/* Tier Pricing Table */}
                <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">
                        Team Size Pricing Tiers (BDT ৳)
                      </h2>
                      <p className="text-xs text-slate-400">
                        Configure total match fee and required advance (Ogrim)
                        for standard formats.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((prev) => {
                          const maxPlayers = prev.tiers.reduce(
                            (m, t) => Math.max(m, t.players_per_team),
                            7
                          );
                          const nextP = Math.min(22, maxPlayers + 1);
                          return {
                            ...prev,
                            tiers: [
                              ...prev.tiers,
                              {
                                players_per_team: nextP,
                                label: `${nextP}v${nextP} Format`,
                                total_price: 4000,
                                advance_amount: 1800,
                              },
                            ],
                          };
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Tier
                    </button>
                  </div>

                  <div className="space-y-3">
                    {settings.tiers.map((tier, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:grid-cols-12 sm:items-end"
                      >
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                            Players/Team
                          </label>
                          <input
                            type="number"
                            min={2}
                            max={22}
                            value={tier.players_per_team}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setSettings((prev) => {
                                const tiers = [...prev.tiers];
                                tiers[index] = {
                                  ...tiers[index],
                                  players_per_team: val,
                                };
                                return { ...prev, tiers };
                              });
                            }}
                            className="font-mono-num w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                            Label
                          </label>
                          <input
                            type="text"
                            value={tier.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSettings((prev) => {
                                const tiers = [...prev.tiers];
                                tiers[index] = { ...tiers[index], label: val };
                                return { ...prev, tiers };
                              });
                            }}
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                            Total Price (৳)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={50}
                            value={tier.total_price}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setSettings((prev) => {
                                const tiers = [...prev.tiers];
                                tiers[index] = {
                                  ...tiers[index],
                                  total_price: val,
                                };
                                return { ...prev, tiers };
                              });
                            }}
                            className="font-mono-num w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-[11px] font-semibold text-emerald-300">
                            Advance / Ogrim (৳)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={50}
                            value={tier.advance_amount}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setSettings((prev) => {
                                const tiers = [...prev.tiers];
                                tiers[index] = {
                                  ...tiers[index],
                                  advance_amount: val,
                                };
                                return { ...prev, tiers };
                              });
                            }}
                            className="font-mono-num w-full rounded-xl border border-emerald-500/35 bg-slate-900 px-3 py-2 text-sm text-emerald-300 outline-none focus:border-emerald-400"
                          />
                        </div>

                        <div className="sm:col-span-1 sm:text-right">
                          <button
                            type="button"
                            disabled={settings.tiers.length <= 1}
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                tiers: prev.tiers.filter((_, i) => i !== index),
                              }))
                            }
                            aria-label="Remove tier"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Custom Player Count Formula & WhatsApp Fallback */}
                <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                    <h3 className="text-base font-extrabold text-white">
                      Custom Player Count Formula
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Used automatically when a customer enters a custom player
                      count outside your preset tiers.
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                          Base Players/Team
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={22}
                          value={settings.custom_base_players}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              custom_base_players: Number(e.target.value),
                            }))
                          }
                          className="font-mono-num w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                          Base Total (৳)
                        </label>
                        <input
                          type="number"
                          step={50}
                          value={settings.custom_base_total}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              custom_base_total: Number(e.target.value),
                            }))
                          }
                          className="font-mono-num w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                          Base Advance (৳)
                        </label>
                        <input
                          type="number"
                          step={50}
                          value={settings.custom_base_advance}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              custom_base_advance: Number(e.target.value),
                            }))
                          }
                          className="font-mono-num w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                          Per Extra Player Total (৳)
                        </label>
                        <input
                          type="number"
                          step={50}
                          value={settings.custom_per_player_total}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              custom_per_player_total: Number(e.target.value),
                            }))
                          }
                          className="font-mono-num w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1 block text-[11px] font-semibold text-emerald-300">
                          Per Extra Player Advance (৳)
                        </label>
                        <input
                          type="number"
                          step={50}
                          value={settings.custom_per_player_advance}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              custom_per_player_advance: Number(e.target.value),
                            }))
                          }
                          className="font-mono-num w-full rounded-xl border border-emerald-500/35 bg-slate-950 px-3 py-2 text-sm text-emerald-300 outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Number & Daily Time Slots */}
                  <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        WhatsApp Fallback Number
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Used for the one-tap wa.me button in the booking
                        confirmation modal (include country code, e.g.
                        8801712345678).
                      </p>
                      <input
                        type="text"
                        value={settings.admin_whatsapp_number}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            admin_whatsapp_number: e.target.value,
                          }))
                        }
                        placeholder="8801712345678"
                        className="font-mono-num mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="border-t border-slate-800 pt-5">
                      <h3 className="text-base font-extrabold text-white">
                        Fixed Daily Time Slots
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {settings.time_slots.map((slot, idx) => (
                          <span
                            key={`${slot}-${idx}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200"
                          >
                            {slot}
                            <button
                              type="button"
                              disabled={settings.time_slots.length <= 1}
                              onClick={() =>
                                setSettings((p) => ({
                                  ...p,
                                  time_slots: p.time_slots.filter(
                                    (_, i) => i !== idx
                                  ),
                                }))
                              }
                              className="text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={newSlotInput}
                          onChange={(e) => setNewSlotInput(e.target.value)}
                          placeholder="e.g. 02:00 PM – 03:30 PM"
                          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = newSlotInput.trim();
                            if (!trimmed) return;
                            if (settings.time_slots.includes(trimmed)) return;
                            setSettings((p) => ({
                              ...p,
                              time_slots: [...p.time_slots, trimmed],
                            }));
                            setNewSlotInput("");
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Slot
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 cursor-pointer"
                  >
                    {savingSettings ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save All Settings
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </main>
    </div>
  );
}

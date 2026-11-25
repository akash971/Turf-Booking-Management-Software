"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  MapPin,
  Minus,
  Moon,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunset,
  Trophy,
  User,
  Users,
  Wallet,
} from "lucide-react";
import type {
  Booking,
  SlotAvailability,
  TurfSettings,
} from "@/types/booking";
import {
  calculatePrice,
  formatBDT,
  formatDisplayDate,
  formatTeamSize,
} from "@/lib/pricing";
import { CalendarPicker } from "./CalendarPicker";
import { BookingModal } from "./BookingModal";

interface BookingClientProps {
  initialDate: string;
  initialSettings: TurfSettings;
  initialSlots: SlotAvailability[];
  turfName: string;
  turfLocation: string;
}

function getSlotIcon(slot: string) {
  const upper = slot.toUpperCase();
  if (upper.includes("AM")) return Sun;
  if (upper.startsWith("04:") || upper.startsWith("4:") || upper.startsWith("05:") || upper.startsWith("5:")) {
    return Sunset;
  }
  return Moon;
}

export function BookingClient({
  initialDate,
  initialSettings,
  initialSlots,
  turfName,
  turfLocation,
}: BookingClientProps) {
  const [settings] = useState<TurfSettings>(initialSettings);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [slots, setSlots] = useState<SlotAvailability[]>(initialSlots);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  const defaultTierPlayers = settings.tiers[0]?.players_per_team ?? 5;
  const [playersPerTeam, setPlayersPerTeam] =
    useState<number>(defaultTierPlayers);
  const [useCustomPlayers, setUseCustomPlayers] = useState<boolean>(false);

  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<{
    booking: Booking;
    whatsappUrl: string;
  } | null>(null);

  const fetchSlotsForDate = useCallback(async (dateStr: string) => {
    setLoadingSlots(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/slots?date=${encodeURIComponent(dateStr)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not load time slots.");
      }
      setSlots(data.slots || []);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load availability."
      );
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // Re-fetch slots whenever the customer changes the date
  useEffect(() => {
    if (selectedDate === initialDate && slots === initialSlots) return;
    setSelectedSlot("");
    fetchSlotsForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const pricing = useMemo(
    () => calculatePrice(playersPerTeam, settings),
    [playersPerTeam, settings]
  );

  const availableSlotCount = useMemo(
    () => slots.filter((s) => s.available).length,
    [slots]
  );

  const handleSelectPresetTier = (count: number) => {
    setUseCustomPlayers(false);
    setPlayersPerTeam(count);
  };

  const handleCustomPlayerChange = (nextVal: number) => {
    const clamped = Math.max(2, Math.min(22, nextVal));
    setUseCustomPlayers(true);
    setPlayersPerTeam(clamped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedSlot) {
      setErrorMessage("Please select an available time slot first.");
      return;
    }
    if (customerName.trim().length < 2) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    const digits = customerPhone.replace(/[^\d]/g, "");
    if (digits.length < 10) {
      setErrorMessage(
        "Please enter a valid phone / WhatsApp number (e.g. 017XXXXXXXX)."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_date: selectedDate,
          time_slot: selectedSlot,
          players_per_team: playersPerTeam,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          team_name: teamName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Refresh slots so customer immediately sees updated lock state
          fetchSlotsForDate(selectedDate);
          setSelectedSlot("");
        }
        throw new Error(data.error || "Could not complete booking.");
      }

      setConfirmedResult({
        booking: data.booking,
        whatsappUrl: data.whatsapp_url,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalDone = () => {
    setConfirmedResult(null);
    setSelectedSlot("");
    setCustomerName("");
    setCustomerPhone("");
    setTeamName("");
    fetchSlotsForDate(selectedDate);
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/25">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white sm:text-lg">
                {turfName}
              </h1>
              <p className="flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="h-3 w-3 text-emerald-400" />
                {turfLocation}
              </p>
            </div>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </Link>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-4 sm:px-6 sm:pt-8">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-slate-900/95 to-emerald-950/40 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                FIFA-Grade Turf & Box Cricket
              </span>
              <h2 className="mt-2.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Book Your Match Slot in 30 Seconds
              </h2>
              <p className="mt-1.5 max-w-xl text-sm text-slate-400">
                Pick a date, lock your preferred floodlit slot, choose team size,
                and get instant booking confirmation with transparent advance
                (Ogrim) pricing in BDT.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
              <div className="text-xs">
                <p className="font-semibold text-white">Live Slot Locking</p>
                <p className="text-slate-400">
                  {availableSlotCount} of {slots.length} slots open on{" "}
                  <span className="text-emerald-300">
                    {formatDisplayDate(selectedDate)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Booking Grid */}
      <main className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          {/* Left Column: Steps 1 to 4 */}
          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            {/* Step 1: Date Picker */}
            <section className="rounded-3xl border border-slate-800/90 bg-slate-900/75 p-5 shadow-xl shadow-slate-950/40 backdrop-blur-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                    1
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Select Match Date
                    </h3>
                    <p className="text-xs text-slate-400">
                      Choose today or any upcoming date
                    </p>
                  </div>
                </div>
                <span className="hidden rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 sm:inline-block">
                  {formatDisplayDate(selectedDate)}
                </span>
              </div>

              <CalendarPicker
                selectedDate={selectedDate}
                minDate={initialDate}
                onSelectDate={setSelectedDate}
              />
            </section>

            {/* Step 2: Time Slot Selector */}
            <section className="rounded-3xl border border-slate-800/90 bg-slate-900/75 p-5 shadow-xl shadow-slate-950/40 backdrop-blur-sm sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                    2
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Choose Time Slot
                    </h3>
                    <p className="text-xs text-slate-400">
                      90-minute match sessions • Booked & pending slots are locked
                    </p>
                  </div>
                </div>

                {loadingSlots && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Refreshing...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {slots.map((slot) => {
                  const Icon = getSlotIcon(slot.time_slot);
                  const isSelected =
                    slot.available && selectedSlot === slot.time_slot;

                  return (
                    <button
                      key={slot.time_slot}
                      type="button"
                      disabled={!slot.available || loadingSlots}
                      onClick={() => setSelectedSlot(slot.time_slot)}
                      className={`group relative flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                        !slot.available
                          ? "cursor-not-allowed border-slate-800/60 bg-slate-950/40 opacity-50"
                          : isSelected
                            ? "border-emerald-400 bg-emerald-500/15 shadow-md shadow-emerald-500/15 ring-1 ring-emerald-400/40 cursor-pointer"
                            : "border-slate-800 bg-slate-950/70 hover:border-emerald-500/40 hover:bg-slate-900 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            !slot.available
                              ? "bg-slate-800/80 text-slate-500"
                              : isSelected
                                ? "bg-emerald-500 text-slate-950"
                                : "bg-slate-800/90 text-emerald-400 group-hover:bg-emerald-500/20"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p
                            className={`text-sm font-semibold ${
                              !slot.available
                                ? "text-slate-500 line-through"
                                : isSelected
                                  ? "text-white"
                                  : "text-slate-200"
                            }`}
                          >
                            {slot.time_slot}
                          </p>
                          <p
                            className={`text-[11px] font-medium ${
                              slot.status === "available"
                                ? isSelected
                                  ? "text-emerald-300"
                                  : "text-emerald-400/80"
                                : slot.status === "pending"
                                  ? "text-amber-400"
                                  : "text-rose-400"
                            }`}
                          >
                            {slot.status === "available"
                              ? isSelected
                                ? "Selected"
                                : "Available"
                              : slot.status === "pending"
                                ? "Pending Verification"
                                : "Booked"}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 3: Team Size & Dynamic Pricing */}
            <section className="rounded-3xl border border-slate-800/90 bg-slate-900/75 p-5 shadow-xl shadow-slate-950/40 backdrop-blur-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                  3
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Players Per Team & Pricing
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select a match format or enter custom players per team
                  </p>
                </div>
              </div>

              {/* Preset Tier Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {settings.tiers.map((tier) => {
                  const isActive =
                    !useCustomPlayers &&
                    playersPerTeam === tier.players_per_team;
                  return (
                    <button
                      key={tier.players_per_team}
                      type="button"
                      onClick={() =>
                        handleSelectPresetTier(tier.players_per_team)
                      }
                      className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                        isActive
                          ? "border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400/40 shadow-md shadow-emerald-500/15"
                          : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                            isActive
                              ? "bg-emerald-500 text-slate-950"
                              : "bg-slate-800 text-emerald-300"
                          }`}
                        >
                          {tier.players_per_team}v{tier.players_per_team}
                        </span>
                        <Users
                          className={`h-4 w-4 ${
                            isActive ? "text-emerald-300" : "text-slate-500"
                          }`}
                        />
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-400">
                          {tier.label}
                        </p>
                        <p className="font-mono-num mt-1 text-lg font-extrabold text-white">
                          {formatBDT(tier.total_price)}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-emerald-400">
                          Advance: {formatBDT(tier.advance_amount)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Players Per Team Input */}
              <div
                className={`mt-3 rounded-2xl border p-4 transition-all ${
                  useCustomPlayers
                    ? "border-emerald-400/70 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      Custom Players per Team
                    </p>
                    <p className="text-xs text-slate-400">
                      Need 4v4, 8v8, 9v9, or tournament squads? Adjust player
                      count below.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleCustomPlayerChange(playersPerTeam - 1)
                      }
                      aria-label="Decrease players per team"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-emerald-500/50 hover:text-white cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={2}
                      max={22}
                      value={playersPerTeam}
                      onFocus={() => setUseCustomPlayers(true)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isNaN(val)) {
                          handleCustomPlayerChange(val);
                        }
                      }}
                      aria-label="Players per team"
                      className="font-mono-num h-10 w-20 rounded-xl border border-slate-700 bg-slate-950 text-center text-base font-bold text-white outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleCustomPlayerChange(playersPerTeam + 1)
                      }
                      aria-label="Increase players per team"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-emerald-500/50 hover:text-white cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Step 4: Customer Details */}
            <section className="rounded-3xl border border-slate-800/90 bg-slate-900/75 p-5 shadow-xl shadow-slate-950/40 backdrop-blur-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                  4
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Player & Contact Details
                  </h3>
                  <p className="text-xs text-slate-400">
                    Used for booking verification and WhatsApp updates
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="customer_name"
                    className="mb-1.5 block text-xs font-semibold text-slate-300"
                  >
                    Customer Name <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="customer_name"
                      type="text"
                      required
                      placeholder="e.g. Tanvir Hasan"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 py-3 pr-4 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="customer_phone"
                    className="mb-1.5 block text-xs font-semibold text-slate-300"
                  >
                    Phone / WhatsApp Number{" "}
                    <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="customer_phone"
                      type="tel"
                      required
                      placeholder="e.g. 01712345678"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 py-3 pr-4 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="team_name"
                    className="mb-1.5 block text-xs font-semibold text-slate-300"
                  >
                    Team Name{" "}
                    <span className="font-normal text-slate-500">
                      (Optional)
                    </span>
                  </label>
                  <div className="relative">
                    <Trophy className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="team_name"
                      type="text"
                      placeholder="e.g. Dhaka Strikers XI"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 py-3 pr-4 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Live Booking Summary & Confirm CTA */}
          <aside className="lg:col-span-5 xl:col-span-4">
            <div className="sticky top-22 rounded-3xl border border-emerald-500/25 bg-slate-900/90 p-5 shadow-2xl shadow-slate-950/60 backdrop-blur-md sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-base font-extrabold text-white">
                  Booking Summary
                </h3>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  {pricing.tierLabel}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-400">
                    <CalendarDays className="h-4 w-4 text-emerald-400" />
                    Match Date
                  </span>
                  <span className="font-semibold text-white">
                    {formatDisplayDate(selectedDate)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    Time Slot
                  </span>
                  <span
                    className={`font-semibold ${
                      selectedSlot ? "text-white" : "text-amber-400"
                    }`}
                  >
                    {selectedSlot || "Not selected"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Users className="h-4 w-4 text-emerald-400" />
                    Format
                  </span>
                  <span className="font-semibold text-white">
                    {formatTeamSize(playersPerTeam)} ({playersPerTeam} players/team)
                  </span>
                </div>
              </div>

              {/* Price Calculation Box */}
              <div className="mt-5 space-y-2.5 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Total Turf Price</span>
                  <span className="font-mono-num font-bold text-white">
                    {formatBDT(pricing.totalAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Remaining Due at Turf</span>
                  <span className="font-mono-num font-semibold text-slate-300">
                    {formatBDT(
                      Math.max(0, pricing.totalAmount - pricing.advanceAmount)
                    )}
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-300">
                        <Wallet className="h-4 w-4" />
                        Required Advance (Ogrim)
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Locks your slot immediately
                      </p>
                    </div>
                    <span className="font-mono-num text-2xl font-extrabold text-emerald-400">
                      {formatBDT(pricing.advanceAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedSlot}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-emerald-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Locking Slot...
                  </>
                ) : (
                  <>Confirm Booking</>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
                By confirming, your slot is locked as{" "}
                <span className="font-semibold text-amber-300">Pending</span>{" "}
                until advance verification via bKash / Nagad / WhatsApp.
              </p>
            </div>
          </aside>
        </form>
      </main>

      {/* Booking Confirmation Modal */}
      {confirmedResult && (
        <BookingModal
          booking={confirmedResult.booking}
          whatsappUrl={confirmedResult.whatsappUrl}
          onDone={handleModalDone}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  Check,
  Calendar,
  Clock,
  Users,
  MessageCircle,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { Booking } from "@/types/booking";
import { formatBDT, formatDisplayDate, formatTeamSize } from "@/lib/pricing";

interface BookingModalProps {
  booking: Booking;
  whatsappUrl: string;
  onDone: () => void;
}

export function BookingModal({
  booking,
  whatsappUrl,
  onDone,
}: BookingModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(booking.booking_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable in non-HTTPS contexts
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-confirmed-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-emerald-500/30 bg-slate-900 shadow-2xl shadow-emerald-950/60">
        {/* Top emerald accent glow */}
        <div className="bg-gradient-to-b from-emerald-500/20 via-emerald-500/5 to-transparent px-6 pt-7 pb-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
            <CheckCircle2 className="h-9 w-9 text-emerald-400" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            Slot Locked • Pending Verification
          </span>
          <h2
            id="booking-confirmed-title"
            className="mt-3 text-2xl font-extrabold tracking-tight text-white"
          >
            Booking Reserved!
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Your slot has been held. Complete the advance (Ogrim) to confirm.
          </p>
        </div>

        {/* Details Card */}
        <div className="space-y-4 px-6 pb-6">
          {/* Booking ID Banner */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Booking ID
              </p>
              <p className="font-mono-num text-base font-bold text-emerald-400">
                {booking.booking_id}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500/50 hover:text-white cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Match Summary Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                Match Date
              </div>
              <p className="mt-1 font-semibold text-white">
                {formatDisplayDate(booking.match_date)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                Player Count
              </div>
              <p className="mt-1 font-semibold text-white">
                {formatTeamSize(booking.players_per_team)} ({booking.players_per_team}/team)
              </p>
            </div>

            <div className="col-span-2 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                Time Slot
              </div>
              <p className="mt-1 font-semibold text-white">
                {booking.time_slot}
              </p>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/30 p-4">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Total Match Fee</span>
              <span className="font-mono-num font-semibold text-slate-200">
                {formatBDT(booking.total_amount)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-emerald-500/20 pt-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                <Wallet className="h-4 w-4" />
                Required Advance (Ogrim)
              </span>
              <span className="font-mono-num text-xl font-extrabold text-emerald-400">
                {formatBDT(booking.advance_amount)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/40 transition hover:bg-[#22c55e] active:scale-[0.99]"
            >
              <MessageCircle className="h-4 w-4 fill-slate-950" />
              Send Booking Summary via WhatsApp
            </a>

            <button
              type="button"
              onClick={onDone}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-[0.99] cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

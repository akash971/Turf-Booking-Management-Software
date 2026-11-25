"use client";

import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarPickerProps {
  selectedDate: string; // YYYY-MM-DD
  minDate: string; // YYYY-MM-DD (today)
  onSelectDate: (date: string) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toISO(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function addDaysISO(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return toISO(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function CalendarPicker({
  selectedDate,
  minDate,
  onSelectDate,
}: CalendarPickerProps) {
  const [initialYear, initialMonth] = useMemo(() => {
    const [y, m] = (selectedDate || minDate).split("-").map(Number);
    return [y, m - 1];
  }, [selectedDate, minDate]);

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const [minYear, minMonth] = useMemo(() => {
    const [y, m] = minDate.split("-").map(Number);
    return [y, m - 1];
  }, [minDate]);

  const canGoPrev =
    viewYear > minYear || (viewYear === minYear && viewMonth > minMonth);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const monthLabel = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [viewYear, viewMonth]);

  const days = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ iso: string | null; dayNum: number | null }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ iso: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ iso: toISO(viewYear, viewMonth, d), dayNum: d });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const quickDates = useMemo(() => {
    const d0 = minDate;
    const d1 = addDaysISO(minDate, 1);
    const d2 = addDaysISO(minDate, 2);
    const formatChip = (iso: string, label: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      const sub = new Date(y, m - 1, d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
      return { iso, label, sub };
    };
    return [
      formatChip(d0, "Today"),
      formatChip(d1, "Tomorrow"),
      formatChip(d2, new Date(...(d2.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))) as [number, number, number])).toLocaleDateString("en-US", { weekday: "short" })),
    ];
  }, [minDate]);

  const selectAndSyncView = (iso: string) => {
    onSelectDate(iso);
    const [y, m] = iso.split("-").map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
  };

  return (
    <div className="space-y-4">
      {/* Quick Date Shortcuts */}
      <div className="grid grid-cols-3 gap-2">
        {quickDates.map((chip) => {
          const active = selectedDate === chip.iso;
          return (
            <button
              key={chip.iso}
              type="button"
              onClick={() => selectAndSyncView(chip.iso)}
              className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition-all cursor-pointer ${
                active
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-sm shadow-emerald-500/20"
                  : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-xs font-semibold">{chip.label}</span>
              <span
                className={`text-[11px] ${
                  active ? "text-emerald-300" : "text-slate-400"
                }`}
              >
                {chip.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Month Calendar Grid */}
      <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <CalendarIcon className="h-4 w-4 text-emerald-400" />
            <span>{monthLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              aria-label="Previous month"
              className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition hover:border-slate-700 hover:text-white cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
            >
              {day}
            </div>
          ))}

          {days.map((cell, idx) => {
            if (!cell.iso || cell.dayNum === null) {
              return <div key={`empty-${idx}`} className="h-9" />;
            }

            const isPast = cell.iso < minDate;
            const isSelected = cell.iso === selectedDate;
            const isToday = cell.iso === minDate;

            return (
              <button
                key={cell.iso}
                type="button"
                disabled={isPast}
                onClick={() => onSelectDate(cell.iso!)}
                className={`relative flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-emerald-500 font-bold text-slate-950 shadow-md shadow-emerald-500/30 cursor-pointer"
                    : isPast
                      ? "cursor-not-allowed text-slate-700 line-through decoration-slate-700/60"
                      : isToday
                        ? "border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                        : "text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                }`}
              >
                {cell.dayNum}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

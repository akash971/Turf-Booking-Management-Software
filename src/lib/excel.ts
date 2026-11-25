import * as XLSX from "xlsx";
import type { Booking } from "@/types/booking";

function formatCreatedDate(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
}

function capitalizeStatus(status: string): string {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function generateBookingsExcelBuffer(bookings: Booking[]): Buffer {
  const headers = [
    "Booking ID",
    "Booking Created Date",
    "Match Date",
    "Time Slot",
    "Customer Name",
    "Phone Number",
    "Players Per Team",
    "Total Amount (BDT)",
    "Advance Paid (BDT)",
    "Status",
  ];

  const rows = bookings.map((b) => [
    b.booking_id,
    formatCreatedDate(b.created_at),
    b.match_date,
    b.time_slot,
    b.team_name ? `${b.customer_name} (${b.team_name})` : b.customer_name,
    b.customer_phone,
    `${b.players_per_team}v${b.players_per_team}`,
    b.total_amount,
    b.status === "cancelled" ? 0 : b.advance_amount,
    capitalizeStatus(b.status),
  ]);

  const sheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Auto-fit column widths based on header + cell content lengths
  const colWidths = headers.map((header, colIndex) => {
    let maxLen = header.length;
    for (const row of rows) {
      const cellValue = row[colIndex];
      const strLen = cellValue != null ? String(cellValue).length : 0;
      if (strLen > maxLen) {
        maxLen = strLen;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 4, 12), 42) };
  });
  worksheet["!cols"] = colWidths;

  // Format numeric currency columns (Total Amount & Advance Paid)
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:J1");
  for (let rowIdx = 1; rowIdx <= range.e.r; rowIdx++) {
    for (const colIdx of [7, 8]) {
      const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      const cell = worksheet[cellAddr];
      if (cell && typeof cell.v === "number") {
        cell.z = "#,##0";
      }
    }
  }

  // Add auto-filter across header row
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(rows.length, 1), c: headers.length - 1 },
    }),
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Turf Bookings");

  // Also include a compact Summary sheet for the owner
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;
  const confirmedAdvance = bookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + b.advance_amount, 0);
  const pendingAdvance = bookings
    .filter((b) => b.status === "pending")
    .reduce((sum, b) => sum + b.advance_amount, 0);
  const totalRevenueProjected = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + b.total_amount, 0);

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Metric", "Value"],
    ["Exported Records", bookings.length],
    ["Confirmed Bookings", confirmedCount],
    ["Pending Bookings", pendingCount],
    ["Cancelled Bookings", cancelledCount],
    ["Confirmed Advance Collected (BDT)", confirmedAdvance],
    ["Pending Advance Expected (BDT)", pendingAdvance],
    ["Total Active Booking Value (BDT)", totalRevenueProjected],
  ]);
  summarySheet["!cols"] = [{ wch: 36 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const arrayBuffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });

  return Buffer.from(arrayBuffer);
}

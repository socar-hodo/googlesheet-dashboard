"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export interface CsvDownloadButtonProps<T> {
  data: T[];
  headers: readonly string[];
  rowMapper: (row: T) => Array<string | number | null | undefined>;
  filename: string;
  label?: string;
  disabled?: boolean;
}

function csvEscape(v: unknown): string {
  const str = v == null ? "" : String(v);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function CsvDownloadButton<T>({
  data,
  headers,
  rowMapper,
  filename,
  label = "CSV 다운로드",
  disabled,
}: CsvDownloadButtonProps<T>) {
  function handleClick() {
    const lines = [
      headers.map(csvEscape).join(","),
      ...data.map((row) => rowMapper(row).map(csvEscape).join(",")),
    ];
    const csv = "\ufeff" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || data.length === 0}
    >
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

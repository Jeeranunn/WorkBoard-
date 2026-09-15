"use client";

import { useEffect } from "react";

// Automatic error boundary for every route under (app). Without this, a
// thrown error/rejected fetch on any page left the UI hung on a blank or
// stale screen with no feedback — this shows a clear, explicit error state
// with a retry action instead.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <h2 className="text-sm font-semibold text-red-700">เกิดข้อผิดพลาด</h2>
      <p className="max-w-sm text-sm text-red-600">
        ไม่สามารถโหลดหน้านี้ได้ กรุณาลองใหม่อีกครั้ง
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
      >
        ลองใหม่
      </button>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import type { AttendanceFormState } from "@/app/(app)/my-work/actions";

const initialState: AttendanceFormState = { error: null };

export function AttendanceActionForm({
  action,
  label,
  pendingLabel,
  buttonClassName,
}: {
  action: (
    state: AttendanceFormState,
    formData: FormData,
  ) => Promise<AttendanceFormState>;
  label: string;
  pendingLabel: string;
  buttonClassName: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className={`${buttonClassName} disabled:opacity-60`}
        >
          {pending ? pendingLabel : label}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="max-w-[16rem] text-right text-xs text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}

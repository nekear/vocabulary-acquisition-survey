import { NextResponse } from "next/server";

import { isAllowedOrigin } from "@/lib/server/origin";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * Confirmation finalizes a previously initialized submission after the object upload
 * succeeds, verifying storage state before the database row is marked uploaded.
 * Note: the object is uploaded directly to Supabase in order to bypass the Vercel's request body size limits.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // Rejecting cross-origin confirmation attempts to prevent outside pages
    // from finalizing uploads on behalf of the user.
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { error: "Origin not allowed.", code: "invalid_request" },
        { status: 403 },
      );
    }

    // Loading the pending submission row first to give the endpoint the current
    // status and storage path it needs to verify finalization.
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();

    const { data: submission, error: fetchError } = await supabase
      .from("submissions")
      .select("id, storage_path, status")
      .eq("id", id)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        {
          error: "The submission was not found.",
          code: "submission_not_found",
        },
        { status: 404 },
      );
    }

    // Enforcing valid status transitions to keep repeated confirmations safe
    // and prevent already finalized rows from being mutated again.
    if (submission.status === "uploaded") {
      return NextResponse.json({ ok: true });
    }

    if (submission.status !== "pending") {
      return NextResponse.json(
        {
          error: "This submission has already been finalized.",
          code: "submission_already_finalized",
        },
        { status: 409 },
      );
    }

    // Verifying that the uploaded object exists before finalizing the row to
    // keep the database from claiming success without storage evidence.
    const { data: fileInfo, error: infoError } = await supabase.storage
      .from("submissions")
      .info(submission.storage_path);

    const fileSize = fileInfo?.size ?? 0;

    // Keeping confirmation separate from the raw upload to ensure the database
    // never claims a submission exists unless storage can prove it.
    if (infoError || !fileInfo || fileSize <= 0) {
      return NextResponse.json(
        {
          error: "The uploaded object could not be found.",
          code: "upload_not_found",
        },
        { status: 422 },
      );
    }

    // Recording the confirmed size and timestamp only after storage verification
    // to make the DB row an accurate statement about what was actually uploaded.
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        status: "uploaded",
        size_bytes: fileSize,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to confirm submission", updateError);
      return NextResponse.json(
        {
          error: "The submission could not be confirmed.",
          code: "internal_error",
        },
        { status: 500 },
      );
    }

    // Returning a simple success marker to keep the confirm step focused on
    // state transition rather than duplicating submission metadata in the response.
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unexpected confirm submission error", error);
    return NextResponse.json(
      { error: "An unexpected error occurred.", code: "internal_error" },
      { status: 500 },
    );
  }
}

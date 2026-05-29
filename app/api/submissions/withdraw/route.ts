import { NextRequest, NextResponse } from "next/server";

import { isAllowedOrigin } from "@/lib/server/origin";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { hashTokenSha256 } from "@/lib/server/submissions";
import { withdrawSubmissionSchema } from "@/lib/validation";

/**
 * Marks all non-withdrawn submissions belonging to one withdrawal token as
 * withdrawn, without revealing any other submitter data.
 */
export async function POST(request: NextRequest) {
  try {
    // Rejecting cross-origin requests before processing withdrawal tokens to
    // keep token-based deletion semantics tied to trusted origins.
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { error: "Origin not allowed.", code: "invalid_request" },
        { status: 403 },
      );
    }

    // Validating the incoming token first to avoid needless hashing and
    // database work for malformed requests.
    const body = await request.json();
    const parsedBody = withdrawSubmissionSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "A withdrawal token is required.", code: "invalid_request" },
        { status: 400 },
      );
    }

    // Hashing the token before lookup to ensure the database never receives the
    // plaintext withdrawal token as a persisted identifier.
    const supabase = createSupabaseServiceClient();
    const tokenHash = await hashTokenSha256(parsedBody.data.token);

    const { data: submitter, error: submitterError } = await supabase
      .from("submitters")
      .select("id")
      .eq("withdrawal_token_hash", tokenHash)
      .single();

    if (submitterError || !submitter) {
      return NextResponse.json(
        { error: "The provided token was not found.", code: "token_not_found" },
        { status: 404 },
      );
    }

    // Finding active submissions first to let the endpoint report an exact
    // count and preserve idempotent behavior for repeated withdrawal attempts.
    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select("id")
      .eq("submitter_id", submitter.id)
      .neq("status", "withdrawn");

    if (submissionsError) {
      console.error("Failed to fetch linked submissions", submissionsError);
      return NextResponse.json(
        { error: "The withdrawal could not be completed.", code: "internal_error" },
        { status: 500 },
      );
    }

    // Treating "nothing left to withdraw" as a successful zero-count response
    // to keep the endpoint idempotent for users retrying the same token.
    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ withdrawn_count: 0 });
    }

    // Marking every remaining linked submission in one update to keep the
    // withdrawal action consistent across a participant's submission history.
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        status: "withdrawn",
        withdrawn_at: new Date().toISOString(),
      })
      .eq("submitter_id", submitter.id)
      .neq("status", "withdrawn");

    if (updateError) {
      console.error("Failed to mark submissions as withdrawn", updateError);
      return NextResponse.json(
        { error: "The withdrawal could not be completed.", code: "internal_error" },
        { status: 500 },
      );
    }

    // Returning the affected count to give the user a concrete audit signal
    // about how many submissions were withdrawn.
    return NextResponse.json({ withdrawn_count: submissions.length });
  } catch (error) {
    console.error("Unexpected withdraw submission error", error);
    return NextResponse.json(
      { error: "An unexpected error occurred.", code: "internal_error" },
      { status: 500 },
    );
  }
}

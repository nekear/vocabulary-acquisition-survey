import { NextRequest, NextResponse } from "next/server";

import { isAllowedOrigin } from "@/lib/server/origin";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { hashTokenSha256 } from "@/lib/server/submissions";
import { linkSubmissionSchema } from "@/lib/validation";

/**
 * Resolves a withdrawal token to the associated submitter and returns the most
 * recently saved language profile without mutating any submission data.
 * See Step1Profile.tsx.
 */
export async function POST(request: NextRequest) {
  try {
    // Rejecting cross-origin requests before accepting a withdrawal token to
    // keep token-based lookups confined to trusted origins.
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { error: "Origin not allowed.", code: "invalid_request" },
        { status: 403 },
      );
    }

    // Validating the request body up front to avoid doing token hashing or DB
    // lookups for malformed requests.
    const body = await request.json();
    const parsedBody = linkSubmissionSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "The provided token is invalid.", code: "invalid_request" },
        { status: 400 },
      );
    }

    // Hashing the token before lookup to match the way submitter records are
    // stored, so raw withdrawal tokens never become query keys in the database.
    const supabase = createSupabaseServiceClient();
    const tokenHash = await hashTokenSha256(parsedBody.data.previous_token);

    const { data: submitter, error: submitterError } = await supabase
      .from("submitters")
      .select("id")
      .eq("withdrawal_token_hash", tokenHash)
      .single();

    if (submitterError || !submitter) {
      return NextResponse.json(
        {
          error: "The provided token was not found.",
          code: "previous_token_not_found",
        },
        { status: 404 },
      );
    }

    // Loading only the latest saved profile to keep this endpoint narrowly
    // scoped to prefill data instead of exposing broader submission history.
    const { data: latestProfileSubmission, error: profileLookupError } =
      await supabase
        .from("submissions")
        .select("user_profile")
        .eq("submitter_id", submitter.id)
        .not("user_profile", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (profileLookupError) {
      console.error("Failed to fetch linked user profile", profileLookupError);
      return NextResponse.json(
        {
          error: "The linked submission could not be loaded.",
          code: "internal_error",
        },
        { status: 500 },
      );
    }

    // Returning only the linked profile snapshot to avoid leaking internal IDs
    // or hashed token material back to the client.
    return NextResponse.json({
      user_profile: latestProfileSubmission?.user_profile ?? null,
    });
  } catch (error) {
    console.error("Unexpected link submission error", error);
    return NextResponse.json(
      { error: "An unexpected error occurred.", code: "internal_error" },
      { status: 500 },
    );
  }
}

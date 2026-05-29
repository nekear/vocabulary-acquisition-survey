import { NextRequest, NextResponse } from "next/server";

import { SUBMISSION_MAX_BYTES } from "@/lib/constants";
import { isAllowedOrigin } from "@/lib/server/origin";
import { createSupabaseServiceClient } from "@/lib/supabase";
import {
  generateWithdrawalToken,
  hashTokenSha256,
} from "@/lib/server/submissions";
import { initSubmissionSchema } from "@/lib/validation";

const maxPayloadBytes =
  Number(process.env.SUBMISSION_MAX_BYTES) || SUBMISSION_MAX_BYTES;
const withdrawalTokenBytes = Number(process.env.WITHDRAWAL_TOKEN_BYTES) || 32;

/**
 * Initializes a submission by validating the request, resolving the submitter
 * identity, creating a pending database row, and issuing a signed upload URL.
 */
export async function POST(request: NextRequest) {
  try {
    // Rejecting cross-origin requests before touching submission state to keep
    // third-party sites from driving this endpoint from the browser.
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { error: "Origin not allowed.", code: "invalid_request" },
        { status: 403 },
      );
    }

    // Validating the client-provided metadata first to ensure we only create
    // submitters and submissions for well-formed requests.
    const body = await request.json();
    const parsedBody = initSubmissionSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "The request body is invalid.", code: "invalid_request" },
        { status: 400 },
      );
    }

    const {
      consent,
      expected_size_bytes,
      previous_token,
      schema_version,
      user_profile,
    } = parsedBody.data;

    // Enforcing the upload limit before creating submission rows or storage URLs
    // to make oversized payloads fail fast and leave no partial state behind.
    if (expected_size_bytes > maxPayloadBytes) {
      return NextResponse.json(
        {
          error: "The submission exceeds the configured size limit.",
          code: "payload_too_large",
          expected_size_bytes,
          max_size_bytes: maxPayloadBytes,
        },
        { status: 413 },
      );
    }

    const supabase = createSupabaseServiceClient();
    let submitterId: string;
    let withdrawalToken: string | null = null;

    // Reusing an existing submitter when a valid withdrawal token is supplied to
    // let multiple uploads stay linked without storing the raw token.
    if (previous_token) {
      const previousTokenHash = await hashTokenSha256(previous_token);
      const { data: existingSubmitter, error: submitterLookupError } =
        await supabase
          .from("submitters")
          .select("id")
          .eq("withdrawal_token_hash", previousTokenHash)
          .single();

      if (submitterLookupError || !existingSubmitter) {
        return NextResponse.json(
          {
            error: "The provided token was not found.",
            code: "previous_token_not_found",
          },
          { status: 404 },
        );
      }

      submitterId = existingSubmitter.id;
    } else {
      // Creating a fresh submitter here because this is the only moment the
      // plaintext withdrawal token exists after generation. Also, only its hash is persisted.
      withdrawalToken = generateWithdrawalToken(withdrawalTokenBytes);
      const withdrawalTokenHash = await hashTokenSha256(withdrawalToken);
      const { data: submitter, error: submitterInsertError } = await supabase
        .from("submitters")
        .insert({ withdrawal_token_hash: withdrawalTokenHash })
        .select("id")
        .single();

      if (submitterInsertError || !submitter) {
        console.error("Failed to create submitter", submitterInsertError);
        return NextResponse.json(
          {
            error: "The submission could not be initialized.",
            code: "internal_error",
          },
          { status: 500 },
        );
      }

      submitterId = submitter.id;
    }

    // Persisting a pending submission row before issuing storage credentials to
    // give confirmation a stable record to finalize later.
    const submissionId = crypto.randomUUID();
    const storagePath = `submissions/${submissionId}.json.gz`;

    const { error: submissionInsertError } = await supabase
      .from("submissions")
      .insert({
        id: submissionId,
        submitter_id: submitterId,
        schema_version,
        storage_path: storagePath,
        status: "pending",
        consent_publish_revlogs: consent.publish_revlogs,
        consent_publish_userinfo: consent.publish_userinfo,
        user_profile,
        client_user_agent:
          request.headers.get("user-agent")?.slice(0, 255) ?? null,
      });

    if (submissionInsertError) {
      console.error("Failed to create submission row", submissionInsertError);
      return NextResponse.json(
        {
          error: "The submission could not be initialized.",
          code: "internal_error",
        },
        { status: 500 },
      );
    }

    // Creating the signed upload URL after the row exists to let storage and the
    // database point at the same submission identifier.
    const { data: uploadData, error: uploadUrlError } = await supabase.storage
      .from("submissions")
      .createSignedUploadUrl(storagePath);

    if (uploadUrlError || !uploadData) {
      console.error("Failed to create signed upload URL", uploadUrlError);
      // Removing the pending row immediately so a DB record without a
      // usable upload URL cannot ever complete and would otherwise be orphaned.
      await supabase.from("submissions").delete().eq("id", submissionId);
      return NextResponse.json(
        {
          error: "The upload URL could not be created.",
          code: "internal_error",
        },
        { status: 500 },
      );
    }

    // Returning only the upload coordinates and optional new token so we can keep the
    // response minimal while giving the client everything needed for the next step.
    return NextResponse.json({
      submission_id: submissionId,
      upload_url: uploadData.signedUrl,
      ...(withdrawalToken ? { withdrawal_token: withdrawalToken } : {}),
    });
  } catch (error) {
    console.error("Unexpected init submission error", error);
    return NextResponse.json(
      { error: "An unexpected error occurred.", code: "internal_error" },
      { status: 500 },
    );
  }
}

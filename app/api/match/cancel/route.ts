import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { match_id } = body;
    const user_id = String(sessionUserId);

    if (!match_id) {
      return NextResponse.json(
        { error: "Missing match_id" },
        { status: 400 }
      );
    }

    const { data: cancelResult, error: cancelError } =
      await supabaseAdmin.rpc("cancel_match", {
        p_match_id: String(match_id),
        p_user_id: user_id,
      });

    if (cancelError) {
      console.error("ATOMIC CANCEL FAILED:", cancelError);

      return NextResponse.json(
        { error: "Failed to cancel match" },
        { status: 500 }
      );
    }

    if (!cancelResult?.success) {
      const errorMessage =
        cancelResult?.error || "Failed to cancel match";

      const status =
        errorMessage === "Only creator can cancel match"
          ? 403
          : errorMessage === "Match not found"
            ? 404
            : 400;

      return NextResponse.json(
        { error: errorMessage },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: cancelResult.message || "Match cancelled and refunds issued",
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
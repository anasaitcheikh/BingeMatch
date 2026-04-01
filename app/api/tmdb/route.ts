import { NextRequest, NextResponse } from "next/server";
import { getTrending, searchMulti, discoverByGenres, getSimilar, getPopularAnime } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "trending": {
        const type = (searchParams.get("type") || "all") as "movie" | "tv" | "all";
        const data = await getTrending(type);
        return NextResponse.json(data);
      }

      case "search": {
        const query = searchParams.get("q") || "";
        if (!query) return NextResponse.json({ results: [] });
        const data = await searchMulti(query);
        return NextResponse.json(data);
      }

      case "discover": {
        const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
        const genres = searchParams.get("genres") || "";
        const genreIds = genres.split(",").map(Number).filter(Boolean);
        const page = Number(searchParams.get("page") || "1");
        const data = await discoverByGenres(mediaType, genreIds, page);
        return NextResponse.json(data);
      }

      case "similar": {
        const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
        const id = Number(searchParams.get("id"));
        if (!id) return NextResponse.json({ results: [] });
        const data = await getSimilar(mediaType, id);
        return NextResponse.json(data);
      }

      case "anime": {
        const data = await getPopularAnime();
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("TMDB API error:", err);
    return NextResponse.json({ error: "API error", results: [] }, { status: 500 });
  }
}

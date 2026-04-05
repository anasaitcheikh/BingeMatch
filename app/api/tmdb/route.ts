import { NextRequest, NextResponse } from "next/server";
import {
  getTrending, searchMulti, discoverPrecise,
  getSimilar, getRecommendations, getPopularAnime,
  getMovieDetails, getTVDetails, getKeywords,
} from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "trending": {
        const type = (searchParams.get("type") || "all") as "movie" | "tv" | "all";
        return NextResponse.json(await getTrending(type));
      }

      case "search": {
        const query = searchParams.get("q") || "";
        if (!query) return NextResponse.json({ results: [] });
        return NextResponse.json(await searchMulti(query));
      }

      case "discover": {
        const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
        const genres = searchParams.get("genres") || "";
        const excludeGenres = searchParams.get("excludeGenres") || "";
        const keywords = searchParams.get("keywords") || "";
        const sortBy = searchParams.get("sortBy") || "vote_average.desc";
        const minVotes = Number(searchParams.get("minVotes") || "200");
        const minScore = Number(searchParams.get("minScore") || "6.0");
        const yearFrom = searchParams.get("yearFrom") ? Number(searchParams.get("yearFrom")) : undefined;
        const yearTo   = searchParams.get("yearTo")   ? Number(searchParams.get("yearTo"))   : undefined;
        const runtimeMin = searchParams.get("runtimeMin") ? Number(searchParams.get("runtimeMin")) : undefined;
        const runtimeMax = searchParams.get("runtimeMax") ? Number(searchParams.get("runtimeMax")) : undefined;
        const page = Number(searchParams.get("page") || "1");

        return NextResponse.json(await discoverPrecise(mediaType, {
          genreIds:        genres       ? genres.split(",").map(Number)       : [],
          withoutGenreIds: excludeGenres ? excludeGenres.split(",").map(Number) : [],
          withKeywords:    keywords     ? keywords.split(",").map(Number)     : [],
          sortBy, minVotes, minScore, yearFrom, yearTo, page,
          runtime: { min: runtimeMin, max: runtimeMax },
        }));
      }

      case "similar": {
        const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
        const id = Number(searchParams.get("id"));
        if (!id) return NextResponse.json({ results: [] });
        return NextResponse.json(await getSimilar(mediaType, id));
      }

      case "recommendations": {
        const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
        const id = Number(searchParams.get("id"));
        if (!id) return NextResponse.json({ results: [] });
        return NextResponse.json(await getRecommendations(mediaType, id));
      }

      case "keywords": {
        const mediaType = (searchParams.get("mediaType") || "tv") as "movie" | "tv";
        const id = Number(searchParams.get("id"));
        if (!id) return NextResponse.json({ results: [], keywords: [] });
        return NextResponse.json(await getKeywords(mediaType, id));
      }

      case "details": {
        const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
        const id = Number(searchParams.get("id"));
        if (!id) return NextResponse.json({});
        return NextResponse.json(
          mediaType === "movie" ? await getMovieDetails(id) : await getTVDetails(id)
        );
      }

      case "anime": {
        return NextResponse.json(await getPopularAnime());
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("TMDB API error:", err);
    return NextResponse.json({ error: "API error", results: [] }, { status: 500 });
  }
}

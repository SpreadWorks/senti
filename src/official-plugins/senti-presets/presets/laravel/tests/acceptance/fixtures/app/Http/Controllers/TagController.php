<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TagController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Tag::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:50|unique:tags',
            'slug' => 'required|string|max:50|unique:tags',
        ]);

        $tag = Tag::create($validated);

        return response()->json($tag, 201);
    }

    public function show(Tag $tag): JsonResponse
    {
        $tag->load('threads');
        return response()->json($tag);
    }

    public function update(Request $request, Tag $tag): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'string|max:50|unique:tags,name,' . $tag->id,
            'slug' => 'string|max:50|unique:tags,slug,' . $tag->id,
        ]);

        $tag->update($validated);

        return response()->json($tag);
    }

    public function destroy(Tag $tag): JsonResponse
    {
        $tag->threads()->detach();
        $tag->delete();

        return response()->json(null, 204);
    }
}

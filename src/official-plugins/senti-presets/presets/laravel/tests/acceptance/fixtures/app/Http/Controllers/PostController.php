<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\Thread;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;

class PostController extends Controller
{
    public function store(Request $request, Thread $thread): RedirectResponse
    {
        $validated = $request->validate([
            'body' => 'required|string',
        ]);

        $thread->posts()->create([
            'user_id' => $request->user()->id,
            'body' => $validated['body'],
            'posted_at' => now(),
        ]);

        return redirect()->route('threads.show', $thread);
    }

    public function edit(Thread $thread, Post $post)
    {
        return view('posts.edit', compact('thread', 'post'));
    }

    public function update(Request $request, Thread $thread, Post $post): RedirectResponse
    {
        $validated = $request->validate([
            'body' => 'required|string',
        ]);

        $post->update($validated);

        return redirect()->route('threads.show', $thread);
    }

    public function destroy(Thread $thread, Post $post): RedirectResponse
    {
        $post->delete();
        return redirect()->route('threads.show', $thread);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Thread;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Http\RedirectResponse;

class ThreadController extends Controller
{
    public function index(): View
    {
        $threads = Thread::with(['user', 'tags'])->latest()->paginate(20);
        return view('threads.index', compact('threads'));
    }

    public function create(): View
    {
        return view('threads.create');
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string',
            'tags' => 'array',
            'tags.*' => 'exists:tags,id',
        ]);

        $thread = $request->user()->threads()->create($validated);
        $thread->tags()->sync($validated['tags'] ?? []);

        return redirect()->route('threads.show', $thread);
    }

    public function show(Thread $thread): View
    {
        $thread->load(['user', 'posts.user', 'tags']);
        return view('threads.show', compact('thread'));
    }

    public function edit(Thread $thread): View
    {
        return view('threads.edit', compact('thread'));
    }

    public function update(Request $request, Thread $thread): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string',
            'status' => 'in:open,closed,archived',
            'tags' => 'array',
        ]);

        $thread->update($validated);
        $thread->tags()->sync($validated['tags'] ?? []);

        return redirect()->route('threads.show', $thread);
    }

    public function destroy(Thread $thread): RedirectResponse
    {
        $thread->delete();
        return redirect()->route('threads.index');
    }
}

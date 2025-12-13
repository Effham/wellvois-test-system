<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Note;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class NoteController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-note')->only(['index', 'show']);
        $this->middleware('permission:add-note')->only(['create', 'store']);
        $this->middleware('permission:update-note')->only(['edit', 'update']);
        $this->middleware('permission:delete-note')->only('destroy');
    }

    /**
     * Display a listing of the notes.
     */
    public function index()
    {
        $notes = Note::forUser(Auth::id())
            ->latest()
            ->get();

        return Inertia::render('Notes/Index', [
            'notes' => $notes,
        ]);
    }

    /**
     * Show the form for creating a new note.
     */
    public function create()
    {
        $notes = Note::forUser(Auth::id())
            ->orderBy('sort_order')
            ->get();

        return Inertia::render('Notes/Create', [
            'notes' => $notes,
        ]);
    }

    /**
     * Store a newly created note in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'nullable|string',
            'priority' => ['required', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        $userId = Auth::id();
        $maxOrder = Note::forUser($userId)->max('sort_order') ?? -1;

        $note = Note::create([
            'user_id' => $userId,
            'title' => $validated['title'],
            'content' => $validated['content'] ?? '',
            'priority' => $validated['priority'],
            'tags' => $validated['tags'] ?? [],
            'sort_order' => $maxOrder + 1,
        ]);

        return redirect()->route('notes.create')->with('success', 'Note created successfully');
    }

    /**
     * Display the specified note.
     */
    public function show(Note $note)
    {
        // Ensure user can only view their own notes
        if ($note->user_id !== Auth::id()) {
            abort(403);
        }

        return response()->json(['note' => $note]);
    }

    /**
     * Update the specified note in storage.
     */
    public function update(Request $request, Note $note)
    {
        // Ensure user can only update their own notes
        if ($note->user_id !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|nullable|string',
            'priority' => ['sometimes', 'required', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'tags' => 'sometimes|nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        $note->update($validated);

        return redirect()->route('notes.create')->with('success', 'Note updated successfully');
    }

    /**
     * Remove the specified note from storage.
     */
    public function destroy(Note $note)
    {
        // Ensure user can only delete their own notes
        if ($note->user_id !== Auth::id()) {
            abort(403);
        }

        $note->delete();

        return redirect()->route('notes.create')->with('success', 'Note deleted successfully');
    }

    /**
     * Reorder notes when drag and drop
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'noteId' => 'required|integer',
            'newOrder' => 'required|integer|min:0',
        ]);

        $userId = Auth::id();
        $note = Note::forUser($userId)->findOrFail($validated['noteId']);

        $notes = Note::forUser($userId)->orderBy('sort_order')->get();

        // Remove the note from its current position
        $notes = $notes->reject(function ($n) use ($note) {
            return $n->id === $note->id;
        })->values();

        // Insert the note at the new position
        $notes->splice($validated['newOrder'], 0, [$note]);

        // Update sort_order for all notes
        foreach ($notes as $index => $n) {
            Note::where('id', $n->id)->update(['sort_order' => $index]);
        }

        return redirect()->route('notes.create')->with('success', 'Note reordered successfully');
    }
}

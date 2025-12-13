import React, { useState, useEffect } from 'react';
import { Head, usePage, useForm, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Plus,
    Save, 
    X, 
    Tag, 
    FileText,
    AlertCircle,
    GripVertical,
    Edit
} from 'lucide-react';

interface Note {
    id: number;
    title: string;
    content: string;
    priority: string;
    tags: string[];
    sort_order: number;
    user_id: number;
    created_at: string;
    updated_at: string;
}

interface PageProps {
    notes: Note[];
    flash?: {
        success?: string;
        error?: string;
    };
    [key: string]: any;
}

const notePriorities = [
    { name: 'Low', value: 'low', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700' },
    { name: 'Medium', value: 'medium', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
    { name: 'High', value: 'high', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-700' },
    { name: 'Urgent', value: 'urgent', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
];

const getPriorityData = (priority: string) => {
    return notePriorities.find(p => p.value === priority) || notePriorities[0];
};

export default function Create({ notes: initialNotes, flash }: PageProps) {
    const notes = initialNotes.sort((a, b) => a.sort_order - b.sort_order);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [draggedNote, setDraggedNote] = useState<Note | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [editTagInput, setEditTagInput] = useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

    // Inertia form for creating notes
    const { data: createData, setData: setCreateData, post: createPost, processing: createProcessing, errors: createErrors, reset: resetCreate } = useForm({
        title: '',
        content: '',
        priority: 'medium',
        tags: [] as string[]
    });
    
    // Inertia form for editing notes
    const { data: editData, setData: setEditData, put: editPut, processing: editProcessing, errors: editErrors, reset: resetEdit } = useForm({
        title: '',
        content: '',
        priority: 'medium',
        tags: [] as string[]
    });

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const createNote = () => {
        // Frontend validation
        if (!createData.title.trim()) {
            toast.error('Note title is required');
            return;
        }

        createPost(route('notes.store'), {
            onSuccess: () => {
                resetCreate();
                setTagInput('');
                setIsDialogOpen(false);
                // Success message will come from flash message
            },
            onError: (errors) => {
                console.error('Error creating note:', errors);
                toast.error('Failed to create note');
            }
        });
    };

    const showDeleteDialog = (note: Note) => {
        setNoteToDelete(note);
        setIsDeleteDialogOpen(true);
    };

    const deleteNote = () => {
        if (!noteToDelete) return;

        router.delete(route('notes.destroy', noteToDelete.id), {
            onSuccess: () => {
                // Success message will come from flash message
                setIsDeleteDialogOpen(false);
                setNoteToDelete(null);
            },
            onError: (errors) => {
                console.error('Error deleting note:', errors);
                toast.error('Failed to delete note');
                setIsDeleteDialogOpen(false);
                setNoteToDelete(null);
            }
        });
    };

    const addTag = () => {
        const tag = tagInput.trim();
        if (tag && !createData.tags.includes(tag)) {
            setCreateData('tags', [...createData.tags, tag]);
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setCreateData('tags', createData.tags.filter((tag: string) => tag !== tagToRemove));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            addTag();
        }
    };

    const handleCreateFormKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.target !== e.currentTarget) {
            const target = e.target as HTMLElement;
            // Don't submit if we're in the tag input or textarea
            if (target.id === 'tag-input' || target.tagName === 'TEXTAREA') {
                return;
            }
            // Only submit if title is filled and we're not already loading
            if (createData.title.trim() && !createProcessing) {
                e.preventDefault();
                createNote();
            }
        }
    };

    // Edit functionality
    const openEditModal = (note: Note) => {
        setEditingNote(note);
        setEditData({
            title: note.title,
            content: note.content,
            priority: note.priority,
            tags: [...note.tags]
        });
        setEditTagInput('');
        setIsEditDialogOpen(true);
    };

    const updateNote = () => {
        if (!editData.title.trim() || !editingNote) {
            toast.error('Note title is required');
            return;
        }

        editPut(route('notes.update', editingNote.id), {
            onSuccess: () => {
                resetEdit();
                setEditTagInput('');
                setIsEditDialogOpen(false);
                setEditingNote(null);
                // Success message will come from flash message
            },
            onError: (errors) => {
                console.error('Error updating note:', errors);
                toast.error('Failed to update note');
            }
        });
    };

    const addEditTag = () => {
        const tag = editTagInput.trim();
        if (tag && !editData.tags.includes(tag)) {
            setEditData('tags', [...editData.tags, tag]);
            setEditTagInput('');
        }
    };

    const removeEditTag = (tagToRemove: string) => {
        setEditData('tags', editData.tags.filter((tag: string) => tag !== tagToRemove));
    };

    const handleEditKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            addEditTag();
        }
    };

    const handleEditFormKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.target !== e.currentTarget) {
            const target = e.target as HTMLElement;
            // Don't submit if we're in the tag input or textarea
            if (target.id === 'edit-tag-input' || target.tagName === 'TEXTAREA') {
                return;
            }
            // Only submit if title is filled and we're not already loading
            if (editData.title.trim() && !editProcessing) {
                e.preventDefault();
                updateNote();
            }
        }
    };

    // Drag and Drop functionality
    const handleDragStart = (e: React.DragEvent, note: Note, index: number) => {
        setDraggedNote(note);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setDraggedNote(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedNote) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        
        if (!draggedNote) return;

        const dragIndex = notes.findIndex(note => note.id === draggedNote.id);
        if (dragIndex === dropIndex) return;

        setDraggedNote(null);
        setDragOverIndex(null);

        // Send reorder request to backend
        router.post(route('notes.reorder'), {
            noteId: draggedNote.id,
            newOrder: dropIndex
        }, {
            onSuccess: () => {
                // Success message will come from flash message
            },
            onError: (errors) => {
                console.error('Error reordering note:', errors);
                toast.error("Failed to reorder note");
                // Page will reload automatically to revert changes
            }
        });
    };

    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Clinical Notes', href: '/notes/create' }
        ]}>
            <Head title="Clinical Notes" />

            {/* Page Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 mb-6">
                <div className="flex items-center justify-between w-full">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">Clinical Notes</h2>
                        <p className="text-sm text-gray-600">Manage patient notes and observations</p>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground">
                                <Plus className="h-4 w-4 mr-2" />
                                Create Note
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md" onKeyDown={handleCreateFormKeyDown}>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-sidebar-accent" />
                                    Create New Note
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Title *</Label>
                                    <Input
                                        id="title"
                                        value={createData.title}
                                        onChange={(e) => setCreateData('title', e.target.value)}
                                        placeholder="Enter note title..."
                                        className="w-full"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="content">Content</Label>
                                    <Textarea
                                        id="content"
                                        value={createData.content}
                                        onChange={(e) => setCreateData('content', e.target.value)}
                                        placeholder="Enter note content..."
                                        rows={4}
                                        className="w-full resize-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="priority">Priority</Label>
                                    <select
                                        id="priority"
                                        value={createData.priority}
                                        onChange={(e) => setCreateData('priority', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {notePriorities.map(priority => (
                                            <option key={priority.value} value={priority.value}>
                                                {priority.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tags</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="tag-input"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder="Add a tag..."
                                            className="flex-1"
                                        />
                                        <Button 
                                            type="button" 
                                            onClick={addTag}
                                            variant="outline"
                                            size="sm"
                                        >
                                            <Tag className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {createData.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {createData.tags.map((tag: string, index: number) => (
                                                <Badge 
                                                    key={index} 
                                                    variant="secondary"
                                                    className="text-xs"
                                                >
                                                    {tag}
                                                    <button
                                                        onClick={() => removeTag(tag)}
                                                        className="ml-1 hover:text-red-600"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setIsDialogOpen(false)}
                                        disabled={createProcessing}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={createNote}
                                        disabled={createProcessing || !createData.title.trim()}
                                        className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground"
                                    >
                                        {createProcessing ? (
                                            <>
                                                <AlertCircle className="mr-2 h-4 w-4 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />
                                                Create Note
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Note Dialog */}
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogContent className="sm:max-w-md" onKeyDown={handleEditFormKeyDown}>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Edit className="h-5 w-5 text-sidebar-accent" />
                                    Edit Note
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-title">Title *</Label>
                                    <Input
                                        id="edit-title"
                                        value={editData.title}
                                        onChange={(e) => setEditData('title', e.target.value)}
                                        placeholder="Enter note title..."
                                        className="w-full"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-content">Content</Label>
                                    <Textarea
                                        id="edit-content"
                                        value={editData.content}
                                        onChange={(e) => setEditData('content', e.target.value)}
                                        placeholder="Enter note content..."
                                        rows={4}
                                        className="w-full resize-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-priority">Priority</Label>
                                    <select
                                        id="edit-priority"
                                        value={editData.priority}
                                        onChange={(e) => setEditData('priority', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {notePriorities.map(priority => (
                                            <option key={priority.value} value={priority.value}>
                                                {priority.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tags</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="edit-tag-input"
                                            value={editTagInput}
                                            onChange={(e) => setEditTagInput(e.target.value)}
                                            onKeyPress={handleEditKeyPress}
                                            placeholder="Add a tag..."
                                            className="flex-1"
                                        />
                                        <Button 
                                            type="button" 
                                            onClick={addEditTag}
                                            variant="outline"
                                            size="sm"
                                        >
                                            <Tag className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {editData.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {editData.tags.map((tag: string, index: number) => (
                                                <Badge 
                                                    key={index} 
                                                    variant="secondary"
                                                    className="text-xs"
                                                >
                                                    {tag}
                                                    <button
                                                        onClick={() => removeEditTag(tag)}
                                                        className="ml-1 hover:text-red-600"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => {
                                            setIsEditDialogOpen(false);
                                            setEditingNote(null);
                                        }}
                                        disabled={editProcessing}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={updateNote}
                                        disabled={editProcessing || !editData.title.trim()}
                                        className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground"
                                    >
                                        {editProcessing ? (
                                            <>
                                                <AlertCircle className="mr-2 h-4 w-4 animate-spin" />
                                                Updating...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />
                                                Update Note
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="py-6">
                <div className="w-full px-6">
                    {notes.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm border p-12">
                            <div className="text-center">
                                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No notes created</h3>
                                <p className="text-gray-500 mb-6">Create your first clinical note to get started</p>
                                <Button 
                                    onClick={() => setIsDialogOpen(true)}
                                    className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Note
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-sm border">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">All Notes</h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {notes.length} note{notes.length !== 1 ? 's' : ''} total
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-8"></TableHead>
                                                <TableHead>Title</TableHead>
                                                <TableHead>Content</TableHead>
                                                <TableHead>Priority</TableHead>
                                                <TableHead>Tags</TableHead>
                                                <TableHead>Created</TableHead>
                                                <TableHead className="w-24">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {notes.length > 0 ? (
                                                notes.map((note, index) => {
                                                    const priorityData = getPriorityData(note.priority);
                                                    return (
                                                        <TableRow
                                                            key={note.id}
                                                            draggable
                                                            className={`cursor-move hover:bg-gray-50 transition-colors ${
                                                                draggedNote?.id === note.id ? "opacity-50 bg-blue-50" : ""
                                                            } ${
                                                                dragOverIndex === index ? "border-t-2 border-blue-500" : ""
                                                            }`}
                                                            onDragStart={(e) => handleDragStart(e, note, index)}
                                                            onDragEnd={handleDragEnd}
                                                            onDragOver={(e) => handleDragOver(e, index)}
                                                            onDrop={(e) => handleDrop(e, index)}
                                                        >
                                                            <TableCell>
                                                                <GripVertical className="h-4 w-4 text-gray-400" />
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="font-medium text-gray-900">{note.title}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-sm text-gray-600 max-w-xs truncate">
                                                                    {note.content || '-'}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge className={priorityData.badge} variant="secondary">
                                                                    {priorityData.name}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {note.tags.slice(0, 2).map((tag, tagIndex) => (
                                                                        <Badge 
                                                                            key={tagIndex}
                                                                            variant="outline"
                                                                            className="text-xs"
                                                                        >
                                                                            {tag}
                                                                        </Badge>
                                                                    ))}
                                                                    {note.tags.length > 2 && (
                                                                        <span className="text-xs text-gray-500">+{note.tags.length - 2}</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-sm text-gray-500">
                                                                    {new Date(note.created_at).toLocaleDateString()}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => openEditModal(note)}
                                                                        disabled={createProcessing || editProcessing}
                                                                        className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => showDeleteDialog(note)}
                                                                        disabled={createProcessing || editProcessing}
                                                                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="h-24 text-center">
                                                        No results.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => {
                    setIsDeleteDialogOpen(false);
                    setNoteToDelete(null);
                }}
                onConfirm={deleteNote}
                title="Delete Note"
                description={`Are you sure you want to delete "${noteToDelete?.title}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                isLoading={createProcessing || editProcessing}
            />

            <Toaster position="top-right" />
        </AppLayout>
    );
} 
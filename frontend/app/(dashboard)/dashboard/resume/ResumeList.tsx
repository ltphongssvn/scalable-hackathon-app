'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Download, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Resume {
    id: number;
    originalName?: string;  // Backend might send camelCase
    original_name?: string; // Or snake_case
    fileSize?: number;
    file_size?: number;
    mimeType?: string;
    mime_type?: string;
    uploadedAt?: string;
    uploaded_at?: string;
    filename: string;
}

// Helper function to safely format dates
const formatDate = (dateValue: string | undefined | null): string => {
    if (!dateValue) return 'Unknown time';

    try {
        const date = new Date(dateValue);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            return 'Unknown time';
        }
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
        console.error('Date formatting error:', error);
        return 'Unknown time';
    }
};

// Helper function to get value with fallback for different naming conventions
const getResumeField = (resume: Resume, field: 'name' | 'size' | 'type' | 'date'): any => {
    switch (field) {
        case 'name':
            return resume.originalName || resume.original_name || 'Unnamed file';
        case 'size':
            return resume.fileSize || resume.file_size || 0;
        case 'type':
            return resume.mimeType || resume.mime_type || 'unknown';
        case 'date':
            return resume.uploadedAt || resume.uploaded_at;
        default:
            return null;
    }
};

export default function ResumeList() {
    console.log('ResumeList component is mounting!');

    const [resumes, setResumes] = useState<Resume[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        fetchResumes();
    }, []);

    const fetchResumes = async () => {
        try {
            const token = localStorage.getItem('token');
            console.log('Token:', token);

            const url = `${process.env.NEXT_PUBLIC_API_URL}/resumes`;
            console.log('Fetching from URL:', url);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                throw new Error('Failed to fetch resumes');
            }

            const data = await response.json();
            console.log('Fetched data:', data);

            // Log the first resume to see its structure
            if (data.data && data.data.length > 0) {
                console.log('First resume structure:', data.data[0]);
            }

            setResumes(data.data || []);
        } catch (err) {
            setError('Failed to load resumes');
            console.error('Error fetching resumes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (resumeId: number) => {
        // Confirm deletion with user
        if (!confirm('Are you sure you want to delete this resume?')) {
            return;
        }

        setDeletingId(resumeId);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resumes/${resumeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete resume');
            }

            // Remove the deleted resume from the local state
            setResumes(resumes.filter(resume => resume.id !== resumeId));

            // Show success feedback (you could add a toast notification here)
            console.log('Resume deleted successfully');
        } catch (err) {
            console.error('Error deleting resume:', err);
            alert('Failed to delete resume. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    console.log('Current state - Loading:', loading, 'Error:', error, 'Resumes count:', resumes.length);

    if (loading) return <div className="text-center py-4">Loading resumes...</div>;
    if (error) return <div className="text-red-500 text-center py-4">{error}</div>;
    if (resumes.length === 0) return <div className="text-gray-500 text-center py-4">No resumes uploaded yet</div>;

    return (
        <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Your Resumes</h3>
            <div className="space-y-3">
                {resumes.map((resume) => {
                    const name = getResumeField(resume, 'name');
                    const size = getResumeField(resume, 'size');
                    const uploadDate = getResumeField(resume, 'date');
                    const isDeleting = deletingId === resume.id;

                    return (
                        <div
                            key={resume.id}
                            className={`border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-opacity ${
                                isDeleting ? 'opacity-50' : ''
                            }`}
                        >
                            <div className="flex items-center space-x-3 flex-1">
                                <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <Link
                                        href={`/dashboard/resume/${resume.id}`}
                                        className="font-medium text-gray-900 hover:text-blue-600 hover:underline block truncate"
                                    >
                                        {name}
                                    </Link>
                                    <p className="text-sm text-gray-500">
                                        {formatFileSize(size)} • Uploaded {formatDate(uploadDate)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex space-x-2 ml-4 flex-shrink-0">
                                <button
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Download resume"
                                >
                                    <Download className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(resume.id)}
                                    disabled={isDeleting}
                                    className={`p-2 text-red-600 hover:bg-red-50 rounded ${
                                        isDeleting ? 'cursor-not-allowed opacity-50' : ''
                                    }`}
                                    title="Delete resume"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
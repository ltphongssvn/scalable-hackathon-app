'use client';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Download, Trash2 } from 'lucide-react';

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
                    
                    return (
                        <div key={resume.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                                <FileText className="h-8 w-8 text-blue-500" />
                                <div>
                                    <p className="font-medium">{name}</p>
                                    <p className="text-sm text-gray-500">
                                        {formatFileSize(size)} • Uploaded {formatDate(uploadDate)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                                    <Download className="h-5 w-5" />
                                </button>
                                <button className="p-2 text-red-600 hover:bg-red-50 rounded">
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

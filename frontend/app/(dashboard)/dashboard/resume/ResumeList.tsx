'use client';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Download, Trash2 } from 'lucide-react';

interface Resume {
    id: number;
    original_name: string;
    file_size: number;
    mime_type: string;
    uploaded_at: string;
    filename: string;
}

export default function ResumeList() {
    console.log('ResumeList component is mounting!'); // Debug: Verify component is executing

    const [resumes, setResumes] = useState<Resume[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchResumes();
    }, []);

    const fetchResumes = async () => {
        try {
            const token = localStorage.getItem('token');
            console.log('Token:', token); // Debug: Check if token exists

            // Using the environment variable for consistency with the upload endpoint
            const url = `${process.env.NEXT_PUBLIC_API_URL}/resumes`;
            console.log('Fetching from URL:', url); // Debug: Check the constructed URL

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            console.log('Response status:', response.status); // Debug: Check response status

            if (!response.ok) {
                throw new Error('Failed to fetch resumes');
            }

            const data = await response.json();
            console.log('Fetched data:', data); // Debug: Check what data we received
            console.log('Resumes array:', data.data); // Debug: Check the resumes array specifically

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

    // Debug: Log the current state
    console.log('Current state - Loading:', loading, 'Error:', error, 'Resumes count:', resumes.length);

    if (loading) return <div className="text-center py-4">Loading resumes...</div>;
    if (error) return <div className="text-red-500 text-center py-4">{error}</div>;
    if (resumes.length === 0) return <div className="text-gray-500 text-center py-4">No resumes uploaded yet</div>;

    return (
        <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4"> </h3>
            <div className="space-y-3">
                {resumes.map((resume) => (
                    <div key={resume.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center space-x-3">
                            <FileText className="h-8 w-8 text-blue-500" />
                            <div>
                                <p className="font-medium">{resume.original_name}</p>
                                <p className="text-sm text-gray-500">
                                    {formatFileSize(resume.file_size)} • Uploaded {formatDistanceToNow(new Date(resume.uploaded_at), { addSuffix: true })}
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
                ))}
            </div>
        </div>
    );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import VoiceRecorder from '@/app/components/VoiceRecorder';

interface VoiceResume {
    id: number;
    filename: string;
    fileSize: number;
    status: string;
    uploadedAt: string;
    parsedAt?: string;
    summary?: {
        name?: string;
        email?: string;
        skills?: string[];
        experienceLevel?: string;
        confidenceScore?: number;
    };
    confidence?: {
        overall: number;
        level: string;
    };
}

export default function VoiceResumePage() {
    const [voiceResumes, setVoiceResumes] = useState<VoiceResume[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchVoiceResumes();
    }, []);

    const fetchVoiceResumes = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                return;
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/voiceresumes`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    router.push('/login');
                    return;
                }
                throw new Error('Failed to fetch voice resumes');
            }

            const data = await response.json();
            setVoiceResumes(data.data?.resumes || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadSuccess = () => {
        fetchVoiceResumes();
    };

    const getStatusBadge = (status: string) => {
        const statusClasses = {
            'uploaded': 'bg-gray-100 text-gray-800',
            'transcribing': 'bg-blue-100 text-blue-800',
            'transcribed': 'bg-indigo-100 text-indigo-800',
            'parsing': 'bg-yellow-100 text-yellow-800',
            'parsed': 'bg-purple-100 text-purple-800',
            'enhancing': 'bg-pink-100 text-pink-800',
            'enhanced': 'bg-green-100 text-green-800',
            'completed': 'bg-green-100 text-green-800',
            'failed': 'bg-red-100 text-red-800',
        };

        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
        );
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="container mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Voice Resume</h1>
                <p className="text-gray-600 mt-2">Record and manage your professional voice introductions</p>
            </div>

            {/* Voice Recorder Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Record New Voice Resume</h2>
                <VoiceRecorder onUploadSuccess={handleUploadSuccess} />
            </div>

            {/* Voice Resumes List */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Your Voice Resumes</h2>

                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Loading voice resumes...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-600">{error}</p>
                        <button
                            onClick={fetchVoiceResumes}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Try Again
                        </button>
                    </div>
                ) : voiceResumes.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-600">No voice resumes yet. Record your first one above!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {voiceResumes.map((resume) => (
                            <div key={resume.id} className="border rounded-lg p-4 hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="font-medium text-gray-900">{resume.filename}</h3>
                                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                                            <p>Size: {formatFileSize(resume.fileSize)}</p>
                                            <p>Uploaded: {formatDate(resume.uploadedAt)}</p>
                                            {resume.parsedAt && <p>Processed: {formatDate(resume.parsedAt)}</p>}
                                        </div>

                                        {resume.summary && (
                                            <div className="mt-3 p-3 bg-gray-50 rounded">
                                                {resume.summary.name && <p className="text-sm"><strong>Name:</strong> {resume.summary.name}</p>}
                                                {resume.summary.email && <p className="text-sm"><strong>Email:</strong> {resume.summary.email}</p>}
                                                {resume.summary.experienceLevel && <p className="text-sm"><strong>Experience:</strong> {resume.summary.experienceLevel}</p>}
                                            </div>
                                        )}

                                        {resume.confidence && (
                                            <div className="mt-2">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-sm text-gray-600">Confidence:</span>
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[200px]">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full"
                                                            style={{ width: `${resume.confidence.overall}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-sm font-medium">{resume.confidence.overall}%</span>
                                                    <span className="text-xs text-gray-500">({resume.confidence.level})</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="ml-4">
                                        {getStatusBadge(resume.status)}
                                    </div>
                                </div>

                                <div className="mt-4 flex space-x-2">
                                    {resume.status === 'completed' && (
                                        <>
                                            <button
                                                onClick={() => router.push(`/dashboard/voice-resume/${resume.id}`)}
                                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                            >
                                                View Details
                                            </button>
                                            <button
                                                onClick={() => {/* Implement download */}}
                                                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                                            >
                                                Download
                                            </button>
                                        </>
                                    )}
                                    {resume.status === 'failed' && (
                                        <button
                                            onClick={() => {/* Implement retry */}}
                                            className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                                        >
                                            Retry Processing
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
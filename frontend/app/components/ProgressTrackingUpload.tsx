// Enhanced Resume Upload Component with Real-Time Progress Tracking
// This demonstrates advanced React patterns for handling real-time updates

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

interface UploadStage {
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    message?: string;
}

interface ProgressData {
    id: string;
    status: string;
    progress: number;
    currentStage?: string;
    stages: {
        upload: UploadStage;
        validation: UploadStage;
        parsing: UploadStage;
        storing: UploadStage;
    };
    error?: string;
}

export default function ProgressTrackingUpload() {
    const { token } = useAuth();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadId, setUploadId] = useState<string | null>(null);
    const [progressData, setProgressData] = useState<ProgressData | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);

    /**
     * Connect to Server-Sent Events for progress tracking
     *
     * This demonstrates how to consume real-time updates from the backend.
     * The EventSource API automatically handles reconnection, making it
     * robust for production use.
     */
    useEffect(() => {
        if (!uploadId || !token) return;

        console.log(`📡 Connecting to progress stream for upload: ${uploadId}`);

        // Create EventSource connection
        const eventSource = new EventSource(
            `${process.env.NEXT_PUBLIC_API_URL}/progress/${uploadId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            } as any // TypeScript doesn't fully support EventSource options
        );

        eventSourceRef.current = eventSource;

        // Handle connection open
        eventSource.addEventListener('connected', (event) => {
            console.log('✅ Connected to progress stream');
        });

        // Handle progress updates
        eventSource.addEventListener('progress', (event) => {
            const data = JSON.parse(event.data) as ProgressData;
            console.log('📊 Progress update:', data);
            setProgressData(data);

            // Check if upload is complete or failed
            if (data.status === 'completed' || data.status === 'failed') {
                setIsUploading(false);
                // Close the connection after a delay
                setTimeout(() => {
                    eventSource.close();
                }, 2000);
            }
        });

        // Handle errors
        eventSource.addEventListener('error', (event) => {
            console.error('❌ SSE Error:', event);
            if (eventSource.readyState === EventSource.CLOSED) {
                console.log('Connection closed');
                setIsUploading(false);
            }
        });

        // Cleanup on unmount or when uploadId changes
        return () => {
            console.log('🧹 Closing progress stream');
            eventSource.close();
        };
    }, [uploadId, token]);

    /**
     * Handle file upload with progress tracking
     *
     * This demonstrates how to initiate an upload and immediately
     * start tracking its progress using the returned uploadId.
     */
    const handleUpload = async () => {
        if (!selectedFile || !token) return;

        setIsUploading(true);
        setProgressData(null);
        setUploadId(null);

        try {
            const formData = new FormData();
            formData.append('resume', selectedFile);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/resumes/upload`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                }
            );

            const data = await response.json();

            if (data.success && data.uploadId) {
                console.log(`🚀 Upload started with ID: ${data.uploadId}`);
                setUploadId(data.uploadId);
                // Progress tracking will start automatically via useEffect
            } else {
                throw new Error(data.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            setIsUploading(false);
            // Handle error UI updates
        }
    };

    /**
     * Render progress bar for a specific stage
     *
     * This component demonstrates how to create intuitive visual
     * feedback for multi-stage operations.
     */
    const renderStageProgress = (stageName: string, stage: UploadStage) => {
        const stageLabels: { [key: string]: string } = {
            upload: '📤 Uploading File',
            validation: '✅ Validating',
            parsing: '🤖 AI Analysis',
            storing: '💾 Saving'
        };

        const getStatusIcon = () => {
            switch (stage.status) {
                case 'completed': return '✅';
                case 'failed': return '❌';
                case 'in_progress': return '⏳';
                default: return '⏸️';
            }
        };

        const getProgressColor = () => {
            switch (stage.status) {
                case 'completed': return 'bg-green-500';
                case 'failed': return 'bg-red-500';
                case 'in_progress': return 'bg-blue-500';
                default: return 'bg-gray-300';
            }
        };

        return (
            <div key={stageName} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                        {getStatusIcon()} {stageLabels[stageName] || stageName}
                    </span>
                    <span className="text-sm text-gray-500">
                        {stage.progress}%
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                        style={{ width: `${stage.progress}%` }}
                    />
                </div>
                {stage.message && (
                    <p className="text-xs text-gray-600 mt-1">{stage.message}</p>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">
                Resume Upload with Real-Time Progress
            </h2>

            {/* File Selection */}
            <div className="mb-6">
                <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    id="file-input"
                    disabled={isUploading}
                />
                <label
                    htmlFor="file-input"
                    className={`inline-flex items-center px-4 py-2 border rounded-md cursor-pointer
                        ${isUploading
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                    {selectedFile ? selectedFile.name : 'Choose File'}
                </label>
            </div>

            {/* Upload Button */}
            <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className={`w-full py-2 px-4 rounded-md font-medium
                    ${!selectedFile || isUploading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
                {isUploading ? 'Processing...' : 'Upload Resume'}
            </button>

            {/* Progress Tracking UI */}
            {progressData && (
                <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">
                        Upload Progress: {progressData.progress}%
                    </h3>

                    {/* Overall Progress Bar */}
                    <div className="mb-6">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                                className="h-3 rounded-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${progressData.progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Individual Stage Progress */}
                    <div className="space-y-3">
                        {Object.entries(progressData.stages).map(([stageName, stage]) =>
                            renderStageProgress(stageName, stage)
                        )}
                    </div>

                    {/* Status Message */}
                    {progressData.status === 'completed' && (
                        <div className="mt-4 p-4 bg-green-100 text-green-700 rounded-md">
                            ✅ Resume uploaded and processed successfully!
                        </div>
                    )}

                    {progressData.status === 'failed' && (
                        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
                            ❌ Upload failed: {progressData.error || 'Unknown error'}
                        </div>
                    )}
                </div>
            )}

            {/* Demo Button for Testing */}
            <div className="mt-8 pt-8 border-t border-gray-200">
                <button
                    onClick={async () => {
                        const response = await fetch(
                            `${process.env.NEXT_PUBLIC_API_URL}/progress/demo`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ duration: 20000 })
                            }
                        );
                        const data = await response.json();
                        if (data.success) {
                            setUploadId(data.demoId);
                            setIsUploading(true);
                        }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                >
                    Run Progress Demo (No File Required)
                </button>
            </div>
        </div>
    );
}
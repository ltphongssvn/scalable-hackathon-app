'use client'

import { useState, useRef } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Upload, Mic, ArrowLeft, FileText } from 'lucide-react'
import ResumeList from './ResumeList'

export default function ResumeManagementPage() {
    const { user, token, isLoading } = useAuth()
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)

    // Redirect if not authenticated
    if (!isLoading && !user) {
        router.push('/login')
        return null
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Validate file type
        if (file.type !== 'application/pdf') {
            setUploadError('Please upload a PDF file')
            return
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            setUploadError('File size must be less than 10MB')
            return
        }

        setUploading(true)
        setUploadError('')

        try {
            // Create form data for file upload
            const formData = new FormData()
            formData.append('resume', file)

            // Upload to backend
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resumes/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || 'Failed to upload resume')
            }

            // Clear the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }

            // Trigger a refresh of the resume list
            setRefreshKey(prev => prev + 1)

            // Show success (you could add a toast notification here)
            console.log('Resume uploaded successfully')
        } catch (error) {
            console.error('Upload error:', error)
            setUploadError(error instanceof Error ? error.message : 'Failed to upload resume')
        } finally {
            setUploading(false)
        }
    }

    const handleVoiceRecord = () => {
        // Navigate to voice recording interface
        // This would be implemented as a separate page or modal
        router.push('/dashboard/voice-resume')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {/* Header with back button */}
                <div className="mb-6">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Resume Management</h1>
                    <p className="mt-2 text-gray-600">Upload and manage your professional profile</p>
                </div>

                {/* Upload Section */}
                <div className="bg-white shadow rounded-lg p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Upload New Resume</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* PDF Upload */}
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                            <p className="text-sm text-gray-600 mb-3">Upload PDF Resume</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="file-upload"
                                disabled={uploading}
                            />
                            <label
                                htmlFor="file-upload"
                                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                                    uploading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                                }`}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                {uploading ? 'Uploading...' : 'Choose File'}
                            </label>
                            <p className="text-xs text-gray-500 mt-2">PDF format, max 10MB</p>
                        </div>

                        {/* Voice Recording */}
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                            <Mic className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                            <p className="text-sm text-gray-600 mb-3">Record Voice Introduction</p>
                            <button
                                onClick={handleVoiceRecord}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                            >
                                <Mic className="h-4 w-4 mr-2" />
                                Start Recording
                            </button>
                            <p className="text-xs text-gray-500 mt-2">2-minute audio introduction</p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {uploadError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600">{uploadError}</p>
                        </div>
                    )}
                </div>

                {/* Resume List Section */}
                <div className="bg-white shadow rounded-lg p-6">
                    <ResumeList key={refreshKey} />
                </div>
            </div>
        </div>
    )
}
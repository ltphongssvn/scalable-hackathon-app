'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { ArrowLeft } from 'lucide-react'
import ResumeList from './ResumeList'

export default function ResumePage() {
    const auth = useAuth()
    const router = useRouter()
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [successMessage, setSuccessMessage] = useState<string>('')
    const [refreshList, setRefreshList] = useState(0)

    // Protect the route - redirect to login if not authenticated
    useEffect(() => {
        if (!auth.isLoading && !auth.user) {
            router.push('/login')
        }
    }, [auth.isLoading, auth.user, router])

    // Handle file selection
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            // Validate file type
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
            if (!allowedTypes.includes(file.type)) {
                setErrorMessage('Please select a PDF, DOC, or DOCX file')
                setSelectedFile(null)
                return
            }

            // Validate file size (5MB limit)
            const maxSize = 5 * 1024 * 1024 // 5MB in bytes
            if (file.size > maxSize) {
                setErrorMessage('File size must be less than 5MB')
                setSelectedFile(null)
                return
            }

            setSelectedFile(file)
            setErrorMessage('')
            setUploadStatus('idle')
        }
    }

    // Handle file upload
    const handleUpload = async () => {
        if (!selectedFile || !auth.token) {
            return
        }

        setUploadStatus('uploading')
        setErrorMessage('')
        setSuccessMessage('')

        const formData = new FormData()
        formData.append('resume', selectedFile)

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resumes/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                },
                body: formData
            })

            const data = await response.json()

            if (response.ok) {
                setUploadStatus('success')
                setSuccessMessage('Resume uploaded successfully!')
                setSelectedFile(null)

                // Reset file input
                const fileInput = document.getElementById('resume-upload') as HTMLInputElement
                if (fileInput) {
                    fileInput.value = ''
                }

                // Trigger a refresh of the resume list
                setRefreshList(prev => prev + 1)

                // Clear success message after 3 seconds
                setTimeout(() => {
                    setSuccessMessage('')
                    setUploadStatus('idle')
                }, 3000)
            } else {
                setUploadStatus('error')
                setErrorMessage(data.message || 'Failed to upload resume')
            }
        } catch (error) {
            setUploadStatus('error')
            setErrorMessage('Network error. Please check your connection and try again.')
        }
    }

    // Show loading state while checking authentication
    if (auth.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    // Show nothing if not authenticated (will redirect)
    if (!auth.user) {
        return null
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header with back navigation */}
                <div className="mb-6">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 mr-2" />
                        Back to Dashboard
                    </button>
                </div>

                {/* Main content */}
                <div className="bg-white rounded-lg shadow-lg">
                    {/* Page header */}
                    <div className="p-8 border-b border-gray-200">
                        <h1 className="text-3xl font-bold text-gray-800">Upload Your Resume</h1>
                        <p className="text-gray-600 mt-2">
                            Upload your resume in PDF or Word format. We'll parse it using AI to extract relevant information.
                        </p>
                    </div>

                    {/* Upload section */}
                    <div className="p-8">
                        {/* Success message at the top if there is one */}
                        {successMessage && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-green-700 font-medium">{successMessage}</p>
                            </div>
                        )}

                        {/* Upload area */}
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                            <svg
                                className="mx-auto h-16 w-16 text-gray-400 mb-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>

                            <label htmlFor="resume-upload" className="cursor-pointer">
                                <span className="mt-2 block text-base font-medium text-gray-700">
                                    Select File
                                </span>
                                <span className="text-sm text-gray-500">
                                    PDF, DOC, or DOCX up to 5MB
                                </span>
                            </label>

                            <input
                                id="resume-upload"
                                name="resume-upload"
                                type="file"
                                className="sr-only"
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileSelect}
                                disabled={uploadStatus === 'uploading'}
                            />
                        </div>

                        {/* Selected file info */}
                        {selectedFile && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-700">
                                    Selected: <span className="font-medium">{selectedFile.name}</span>
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        )}

                        {/* Error message */}
                        {errorMessage && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{errorMessage}</p>
                            </div>
                        )}

                        {/* Upload button */}
                        {selectedFile && uploadStatus !== 'success' && (
                            <button
                                onClick={handleUpload}
                                disabled={uploadStatus === 'uploading'}
                                className={`mt-6 w-full py-3 px-4 rounded-lg font-medium text-white transition-all ${
                                    uploadStatus === 'uploading'
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                                }`}
                            >
                                {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Resume'}
                            </button>
                        )}

                        {/* Resume list component */}
                        <ResumeList key={refreshList} />
                    </div>

                    {/* Coming soon section */}
                    <div className="p-8 bg-gray-50 border-t border-gray-200">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Coming Soon</h2>
                        <div className="space-y-3">
                            <div className="flex items-start">
                                <svg className="h-6 w-6 text-blue-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                <div>
                                    <h3 className="font-medium text-gray-800">Voice Resume Recording</h3>
                                    <p className="text-sm text-gray-600">Record your experience using Whisper AI</p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <svg className="h-6 w-6 text-blue-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <div>
                                    <h3 className="font-medium text-gray-800">AI Resume Parsing</h3>
                                    <p className="text-sm text-gray-600">Automatic extraction with Hugging Face</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
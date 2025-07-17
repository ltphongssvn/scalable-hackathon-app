'use client'
import { useAuth } from '@/app/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

// TypeScript interfaces define the shape of our data
// This helps catch type errors during development and provides better IDE support
interface UploadResponse {
    success: boolean
    message: string
    fileUrl?: string      // Optional: URL where the file is stored
    parsedData?: any      // Optional: Data extracted by Hugging Face (future feature)
}

export default function ResumePage() {
    // Extract authentication data from context
    // user: current logged-in user object
    // token: JWT token for API authentication
    // isLoading: indicates if auth state is still being determined
    const { user, token, isLoading } = useAuth()
    const router = useRouter()

    // State management for the upload process
    // Each state variable serves a specific purpose in the UI/UX flow
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // useRef creates a reference to the file input DOM element
    // This allows us to programmatically reset the input after successful upload
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Authentication guard: redirects to login if user is not authenticated
    // The dependency array ensures this runs whenever auth state changes
    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login')
        }
    }, [user, isLoading, router])

    // File validation function ensures only valid files are processed
    // This saves bandwidth and provides immediate user feedback
    const validateFile = (file: File): boolean => {
        // Define allowed MIME types for resume files
        const allowedTypes = [
            'application/pdf',                                                              // PDF files
            'application/msword',                                                          // .doc files
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'    // .docx files
        ]
        const maxSize = 5 * 1024 * 1024 // 5MB in bytes

        // Check file type
        if (!allowedTypes.includes(file.type)) {
            setError('Please upload a PDF or Word document')
            return false
        }

        // Check file size
        if (file.size > maxSize) {
            setError('File size must be less than 5MB')
            return false
        }

        // Clear any previous errors if validation passes
        setError(null)
        return true
    }

    // Handle file selection from the input element
    // This runs when user selects a file through the file dialog
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] // Get the first selected file
        if (file && validateFile(file)) {
            setSelectedFile(file)
            setError(null) // Clear any previous errors
        }
    }

    // Handle the actual file upload to the backend
    // This is an async function that manages the entire upload flow
    const handleUpload = async () => {
        // Early return if prerequisites aren't met
        if (!selectedFile || !token) return

        // Reset states for new upload attempt
        setUploading(true)
        setError(null)
        setSuccess(null)

        try {
            // FormData is the standard way to upload files via HTTP
            // It automatically sets the correct Content-Type header (multipart/form-data)
            const formData = new FormData()
            formData.append('resume', selectedFile) // 'resume' is the field name the backend expects

            // Make the API request
            // Note: We don't set Content-Type header - FormData handles this automatically
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/resume/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}` // Include JWT token for authentication
                    // Don't set Content-Type here! FormData needs to set its own boundary
                },
                body: formData
            })

            // Parse the JSON response
            const data: UploadResponse = await response.json()

            // Check if the request was successful
            if (!response.ok) {
                throw new Error(data.message || 'Upload failed')
            }

            // Success! Update UI accordingly
            setSuccess('Resume uploaded successfully!')
            setSelectedFile(null) // Clear selected file

            // Reset the file input element
            // This is necessary because file inputs maintain their value
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }

            // Here you could also:
            // - Store the fileUrl in state for display
            // - Redirect to a results page
            // - Trigger a refetch of user's resumes

        } catch (err) {
            // Error handling with user-friendly messages
            setError(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            // Always run: reset loading states
            setUploading(false)
            setUploadProgress(0)
        }
    }

    // Loading state while checking authentication
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    // Return null if no user (will redirect due to useEffect)
    if (!user) {
        return null
    }

    // Main component render
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {/* Header Section */}
                <div className="mb-8">
                    {/* Back navigation */}
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center"
                    >
                        ← Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Upload Your Resume</h1>
                    <p className="mt-2 text-gray-600">
                        Upload your resume in PDF or Word format. We'll parse it using AI to extract relevant information.
                    </p>
                </div>

                {/* Main Upload Card */}
                <div className="bg-white shadow rounded-lg p-6">
                    {/* Error Message Display */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Success Message Display */}
                    {success && (
                        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm text-green-600">{success}</p>
                        </div>
                    )}

                    {/* File Upload Drop Zone */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        {/* Upload Icon */}
                        <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                        >
                            <path
                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                        {/* Hidden File Input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx"  // Limit file picker to these types
                            className="hidden"
                            id="file-upload"
                        />

                        {/* Visible Label that triggers file input */}
                        <label
                            htmlFor="file-upload"
                            className="mt-4 cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            Select File
                        </label>

                        <p className="mt-2 text-sm text-gray-500">
                            PDF, DOC, or DOCX up to 5MB
                        </p>

                        {/* Selected File Display */}
                        {selectedFile && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-md">
                                <p className="text-sm text-gray-700">
                                    Selected: <span className="font-medium">{selectedFile.name}</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Upload Button */}
                    <div className="mt-6">
                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || uploading}
                            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                                !selectedFile || uploading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                            }`}
                        >
                            {uploading ? 'Uploading...' : 'Upload Resume'}
                        </button>
                    </div>
                </div>

                {/* Future Features Preview Section */}
                <div className="mt-8 bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Coming Soon</h2>
                    <div className="space-y-3">
                        {/* Voice Recording Feature */}
                        <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-900">Voice Resume Recording</p>
                                <p className="text-sm text-gray-500">Record your experience using Whisper AI</p>
                            </div>
                        </div>

                        {/* AI Parsing Feature */}
                        <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-900">AI Resume Parsing</p>
                                <p className="text-sm text-gray-500">Automatic extraction with Hugging Face</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'

export default function ResumePage() {
    const auth = useAuth()
    const router = useRouter()
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [successMessage, setSuccessMessage] = useState<string>('')

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
            // Note: NEXT_PUBLIC_API_URL already includes /api/v1, so we just append /resumes/upload
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
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <h1 className="text-3xl font-bold mb-2 text-gray-800">Resume Management</h1>
                    <p className="text-gray-600 mb-8">
                        Welcome, {auth.user.fullName}! Upload and manage your resumes here.
                    </p>

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <svg
                            className="mx-auto h-12 w-12 text-gray-400 mb-4"
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

                        <div className="mb-4">
                            <label htmlFor="resume-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-700">
                  Click to upload or drag and drop
                </span>
                                <span className="text-xs text-gray-500">
                  PDF, DOC, DOCX up to 5MB
                </span>
                            </label>
                            <input
                                id="resume-upload"
                                name="resume-upload"
                                type="file"
                                className="sr-only"
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileSelect}
                            />
                        </div>

                        {selectedFile && (
                            <div className="mt-4">
                                <p className="text-sm text-gray-600">
                                    Selected: <span className="font-medium">{selectedFile.name}</span>
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="mt-4 p-3 bg-red-50 rounded-md">
                                <p className="text-sm text-red-600">{errorMessage}</p>
                            </div>
                        )}

                        {successMessage && (
                            <div className="mt-4 p-3 bg-green-50 rounded-md">
                                <p className="text-sm text-green-600">{successMessage}</p>
                            </div>
                        )}

                        {selectedFile && uploadStatus !== 'success' && (
                            <button
                                onClick={handleUpload}
                                disabled={uploadStatus === 'uploading'}
                                className={`mt-6 px-6 py-3 rounded-md text-white font-medium transition-colors ${
                                    uploadStatus === 'uploading'
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {uploadStatus === 'uploading' ? (
                                    <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </span>
                                ) : (
                                    'Upload Resume'
                                )}
                            </button>
                        )}
                    </div>

                    {/* Future: List of uploaded resumes will go here */}
                    <div className="mt-8">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Uploaded Resumes</h2>
                        <p className="text-gray-600 text-sm">
                            Your uploaded resumes will appear here. This feature is coming soon!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
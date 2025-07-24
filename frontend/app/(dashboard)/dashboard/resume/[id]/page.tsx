'use client'

import { use, useEffect, useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, FileText, Mail, Briefcase, GraduationCap, Code } from 'lucide-react'

interface ParsedData {
    name?: string
    email?: string
    phone?: string
    location?: string
    summary?: string
    skills?: string[]
    experience?: Array<{
        title: string
        company: string
        duration: string
        description: string
    }>
    education?: Array<{
        degree: string
        institution: string
        year: string
    }>
    error?: string
    attempted?: boolean
}

interface ResumeDetails {
    id: number
    filename: string
    parsedAt: string | null
    parsingStatus: 'not_started' | 'completed' | 'failed' | 'error'
    parsedData: ParsedData | null
}

// Update the params type to be a Promise for Next.js 15
export default function ResumeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    // Unwrap the params Promise using React.use()
    const { id } = use(params)

    const { token, user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const [resume, setResume] = useState<ResumeDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [reparsing, setReparsing] = useState(false)

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login')
        }
    }, [user, authLoading, router])

    useEffect(() => {
        if (token && id) {
            fetchResumeDetails()
        }
    }, [token, id])

    const fetchResumeDetails = async () => {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/resumes/${id}/parsed`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            )

            if (!response.ok) {
                throw new Error('Failed to fetch resume details')
            }

            const data = await response.json()

            // Ensure parsed data has the correct structure
            if (data.data && data.data.parsedData) {
                const parsedData = data.data.parsedData

                // Ensure experience is always an array
                if (parsedData.experience && !Array.isArray(parsedData.experience)) {
                    console.warn('Experience data is not an array, converting...')
                    parsedData.experience = []
                }

                // Ensure education is always an array
                if (parsedData.education && !Array.isArray(parsedData.education)) {
                    console.warn('Education data is not an array, converting...')
                    parsedData.education = []
                }

                // Ensure skills is always an array
                if (parsedData.skills && !Array.isArray(parsedData.skills)) {
                    console.warn('Skills data is not an array, converting...')
                    parsedData.skills = []
                }
            }

            setResume(data.data)
        } catch (err) {
            setError('Failed to load resume details')
            console.error('Error fetching resume:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleReparse = async () => {
        setReparsing(true)
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/resumes/${id}/reparse`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            )

            if (!response.ok) {
                throw new Error('Failed to reparse resume')
            }

            // Wait a moment then refresh the data
            setTimeout(() => {
                fetchResumeDetails()
                setReparsing(false)
            }, 3000)
        } catch (err) {
            console.error('Error reparsing resume:', err)
            alert('Failed to reparse resume')
            setReparsing(false)
        }
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-red-500">{error}</div>
            </div>
        )
    }

    if (!resume) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-500">Resume not found</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/dashboard/resume')}
                        className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to Resumes
                    </button>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{resume.filename}</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Parsing Status: {' '}
                                <span className={`font-medium ${
                                    resume.parsingStatus === 'completed' ? 'text-green-600' :
                                        resume.parsingStatus === 'failed' ? 'text-red-600' :
                                            resume.parsingStatus === 'error' ? 'text-red-600' :
                                                'text-yellow-600'
                                }`}>
                                    {resume.parsingStatus.charAt(0).toUpperCase() + resume.parsingStatus.slice(1)}
                                </span>
                            </p>
                        </div>

                        <button
                            onClick={handleReparse}
                            disabled={reparsing}
                            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                                reparsing
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${reparsing ? 'animate-spin' : ''}`} />
                            {reparsing ? 'Reparsing...' : 'Reparse Resume'}
                        </button>
                    </div>
                </div>

                {/* Content */}
                {resume.parsingStatus === 'completed' && resume.parsedData && !resume.parsedData.error ? (
                    <div className="space-y-6">
                        {/* Personal Information */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {resume.parsedData.name && (
                                    <div className="flex items-center">
                                        <FileText className="h-5 w-5 text-gray-400 mr-2" />
                                        <div>
                                            <p className="text-sm text-gray-500">Name</p>
                                            <p className="font-medium">{resume.parsedData.name}</p>
                                        </div>
                                    </div>
                                )}
                                {resume.parsedData.email && (
                                    <div className="flex items-center">
                                        <Mail className="h-5 w-5 text-gray-400 mr-2" />
                                        <div>
                                            <p className="text-sm text-gray-500">Email</p>
                                            <p className="font-medium">{resume.parsedData.email}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Skills */}
                        {resume.parsedData.skills && Array.isArray(resume.parsedData.skills) && resume.parsedData.skills.length > 0 && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <Code className="h-5 w-5 mr-2" />
                                    Skills
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {resume.parsedData.skills.map((skill, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Experience */}
                        {resume.parsedData.experience && Array.isArray(resume.parsedData.experience) && resume.parsedData.experience.length > 0 && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <Briefcase className="h-5 w-5 mr-2" />
                                    Experience
                                </h2>
                                <div className="space-y-4">
                                    {resume.parsedData.experience.map((exp, index) => (
                                        <div key={index} className="border-l-2 border-gray-200 pl-4">
                                            <h3 className="font-medium text-gray-900">{exp.title}</h3>
                                            <p className="text-sm text-gray-600">{exp.company}</p>
                                            <p className="text-sm text-gray-500">{exp.duration}</p>
                                            {exp.description && (
                                                <p className="mt-2 text-gray-700">{exp.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Education */}
                        {resume.parsedData.education && Array.isArray(resume.parsedData.education) && resume.parsedData.education.length > 0 && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <GraduationCap className="h-5 w-5 mr-2" />
                                    Education
                                </h2>
                                <div className="space-y-4">
                                    {resume.parsedData.education.map((edu, index) => (
                                        <div key={index} className="border-l-2 border-gray-200 pl-4">
                                            <h3 className="font-medium text-gray-900">{edu.degree}</h3>
                                            <p className="text-sm text-gray-600">{edu.institution}</p>
                                            <p className="text-sm text-gray-500">{edu.year}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : resume.parsingStatus === 'failed' || resume.parsedData?.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <p className="text-red-600">
                            Failed to parse resume. {resume.parsedData?.error || 'Unknown error occurred.'}
                        </p>
                        <button
                            onClick={handleReparse}
                            className="mt-4 text-red-700 underline hover:text-red-800"
                        >
                            Try parsing again
                        </button>
                    </div>
                ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                        <p className="text-yellow-700">
                            This resume hasn't been parsed yet. Click the "Reparse Resume" button to extract information.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
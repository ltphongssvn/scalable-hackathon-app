'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'

interface VoiceRecorderProps {
    onUploadSuccess?: () => void  // Callback to refresh the resume list
}

export default function VoiceRecorder({ onUploadSuccess }: VoiceRecorderProps) {
    // Get authentication token from context
    const { token } = useAuth()

    // State management for recording process
    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Refs for managing recording state
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Effect to manage recording timer
    useEffect(() => {
        if (isRecording && !isPaused) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [isRecording, isPaused])

    // Format recording time for display
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // Start recording function
    const startRecording = async () => {
        try {
            setError(null)
            setSuccess(null)

            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

            // Create MediaRecorder instance
            // We'll use webm format as it's widely supported and works well with Whisper
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            })

            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            // Handle data available event
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data)
                }
            }

            // Handle recording stop
            mediaRecorder.onstop = () => {
                // Create blob from chunks
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                setAudioBlob(blob)

                // Create URL for audio playback
                const url = URL.createObjectURL(blob)
                setAudioUrl(url)

                // Clean up stream
                stream.getTracks().forEach(track => track.stop())
            }

            // Start recording
            mediaRecorder.start()
            setIsRecording(true)
            setRecordingTime(0)

        } catch (err) {
            console.error('Error accessing microphone:', err)
            setError('Failed to access microphone. Please ensure you have granted permission.')
        }
    }

    // Stop recording function
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            setIsPaused(false)
        }
    }

    // Pause/Resume recording
    const togglePause = () => {
        if (mediaRecorderRef.current) {
            if (isPaused) {
                mediaRecorderRef.current.resume()
                setIsPaused(false)
            } else {
                mediaRecorderRef.current.pause()
                setIsPaused(true)
            }
        }
    }

    // Reset recording
    const resetRecording = () => {
        setAudioBlob(null)
        setAudioUrl(null)
        setRecordingTime(0)
        setError(null)
        setSuccess(null)
        chunksRef.current = []
    }

    // Upload audio to backend
    const uploadAudio = async () => {
        if (!audioBlob || !token) return

        setUploading(true)
        setError(null)
        setSuccess(null)

        try {
            // Create FormData and append audio file
            const formData = new FormData()

            // Convert blob to file with proper extension
            const audioFile = new File([audioBlob], `voice-resume-${Date.now()}.webm`, {
                type: 'audio/webm'
            })

            formData.append('audio', audioFile)

            // Make API request to voice resume endpoint
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/voiceresumes/upload-voice`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Upload failed')
            }

            setSuccess('Voice resume uploaded successfully! Transcription in progress...')

            // Call the success callback if provided
            if (onUploadSuccess) {
                onUploadSuccess()
            }

            // Reset after successful upload
            setTimeout(() => {
                resetRecording()
            }, 3000)

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload audio')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
                {/* Microphone Icon */}
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>

                <h3 className="mt-2 text-sm font-medium text-gray-900">Voice Resume Recording</h3>
                <p className="mt-1 text-sm text-gray-500">Record your experience and let AI transcribe it</p>

                {/* Error Display */}
                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Success Display */}
                {success && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-sm text-green-600">{success}</p>
                    </div>
                )}

                {/* Recording Controls */}
                {!audioBlob ? (
                    <div className="mt-4">
                        {!isRecording ? (
                            <button
                                onClick={startRecording}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                            >
                                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                    <circle cx="10" cy="10" r="8" />
                                </svg>
                                Start Recording
                            </button>
                        ) : (
                            <div className="space-y-3">
                                {/* Recording Timer */}
                                <div className="text-2xl font-mono text-red-600">
                                    {formatTime(recordingTime)}
                                </div>

                                {/* Recording Animation */}
                                <div className="flex justify-center items-center space-x-1">
                                    <div className="w-1 h-4 bg-red-600 animate-pulse"></div>
                                    <div className="w-1 h-6 bg-red-600 animate-pulse animation-delay-200"></div>
                                    <div className="w-1 h-4 bg-red-600 animate-pulse animation-delay-400"></div>
                                    <div className="w-1 h-8 bg-red-600 animate-pulse animation-delay-600"></div>
                                    <div className="w-1 h-4 bg-red-600 animate-pulse animation-delay-800"></div>
                                </div>

                                {/* Control Buttons */}
                                <div className="flex justify-center space-x-3">
                                    <button
                                        onClick={togglePause}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        {isPaused ? 'Resume' : 'Pause'}
                                    </button>
                                    <button
                                        onClick={stopRecording}
                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700"
                                    >
                                        Stop Recording
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Audio Preview and Upload */
                    <div className="mt-4 space-y-3">
                        {/* Audio Player */}
                        <audio controls className="mx-auto" src={audioUrl || undefined}>
                            Your browser does not support the audio element.
                        </audio>

                        {/* Duration Display */}
                        <p className="text-sm text-gray-500">
                            Duration: {formatTime(recordingTime)}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex justify-center space-x-3">
                            <button
                                onClick={resetRecording}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Record Again
                            </button>
                            <button
                                onClick={uploadAudio}
                                disabled={uploading}
                                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                                    uploading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {uploading ? 'Uploading...' : 'Upload Voice Resume'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
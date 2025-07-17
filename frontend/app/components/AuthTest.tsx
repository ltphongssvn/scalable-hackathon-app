'use client'

import { useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'

export default function AuthTest() {
    const { user, token, logout } = useAuth()
    const [testResult, setTestResult] = useState<string>('')

    const testProtectedRoute = async () => {
        if (!token) {
            setTestResult('No token found. Please login first.')
            return
        }

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (response.ok) {
                const data = await response.json()
                setTestResult(`Protected route test successful! User: ${data.data.email}`)
            } else {
                setTestResult(`Protected route test failed: ${response.status} ${response.statusText}`)
            }
        } catch (error) {
            setTestResult(`Error testing protected route: ${error}`)
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Authentication Status</h3>
            {user ? (
                <div className="space-y-2">
                    <p className="text-green-600 dark:text-green-400">✓ Logged in as: {user.email}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Username: {user.username}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Token: {token ? 'Present' : 'Missing'}</p>
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={testProtectedRoute}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Test Protected Route
                        </button>
                        <button
                            onClick={logout}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                            Logout
                        </button>
                    </div>
                    {testResult && (
                        <p className="mt-2 text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">
                            {testResult}
                        </p>
                    )}
                </div>
            ) : (
                <p className="text-yellow-600 dark:text-yellow-400">Not logged in</p>
            )}
        </div>
    )
}
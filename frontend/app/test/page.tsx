import AuthTest from '@/app/components/AuthTest'

export default function TestPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
                    Authentication System Test Dashboard
                </h1>
                <div className="grid gap-6">
                    <AuthTest />
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-2">Test Instructions</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <li>Open the Network tab in your browser's developer tools to monitor API calls</li>
                            <li>Navigate to /register to create a new account</li>
                            <li>After registration, check if you're automatically logged in</li>
                            <li>Return to this page to see your authentication status</li>
                            <li>Click "Test Protected Route" to verify token authentication</li>
                            <li>Try refreshing the page to ensure session persistence</li>
                            <li>Click "Logout" and verify you're redirected to login</li>
                        </ol>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-2">Quick Navigation</h3>
                        <div className="flex gap-4">
                            <a
                                href="/login"
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                            >
                                Go to Login
                            </a>
                            <a
                                href="/register"
                                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
                            >
                                Go to Register
                            </a>
                            <a
                                href="/"
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
                            >
                                Go to Home
                            </a>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-2">What This Tests</h3>
                        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                            <div>
                                <strong className="text-gray-900 dark:text-gray-100">Registration Flow:</strong>
                                <p>Tests whether new users can create accounts with email, username, full name, and password. Verifies that the backend properly validates input, hashes passwords, and returns authentication tokens.</p>
                            </div>
                            <div>
                                <strong className="text-gray-900 dark:text-gray-100">Auto-Login After Registration:</strong>
                                <p>Confirms that users are automatically authenticated after successful registration, eliminating the need for a separate login step.</p>
                            </div>
                            <div>
                                <strong className="text-gray-900 dark:text-gray-100">Session Persistence:</strong>
                                <p>Verifies that authentication tokens are stored in localStorage and restored on page refresh, maintaining user sessions across browser reloads.</p>
                            </div>
                            <div>
                                <strong className="text-gray-900 dark:text-gray-100">Protected API Access:</strong>
                                <p>Tests that authenticated users can access protected endpoints using their JWT tokens, while unauthorized requests are properly rejected.</p>
                            </div>
                            <div>
                                <strong className="text-gray-900 dark:text-gray-100">Logout Functionality:</strong>
                                <p>Ensures that logging out clears all authentication data and redirects users to the login page.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
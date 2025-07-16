'use client'

import { useEffect, useState } from 'react'

export default function ApiTest() {
  const [status, setStatus] = useState<string>('Checking API...')
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    // Test the API connection
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`)
      .then(res => res.json())
      .then(data => {
        setStatus('API Connected!')
        setData(data)
      })
      .catch(err => {
        setStatus('API Connection Failed')
        console.error('API Error:', err)
      })
  }, [])

  return (
    <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-2">Backend API Status</h3>
      <p className={`text-sm ${status.includes('Connected') ? 'text-green-600' : 'text-red-600'}`}>
        {status}
      </p>
      {data && (
        <pre className="mt-2 text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

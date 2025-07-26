import { NextResponse } from 'next/server'

export async function GET() {
    // This endpoint helps diagnose localStorage issues
    const diagnosticScript = `
    <html>
      <head><title>Storage Diagnostic</title></head>
      <body>
        <h2>localStorage Diagnostic Test</h2>
        <div id="results"></div>
        <script>
          const results = document.getElementById('results');
          
          try {
            // Test 1: Can we use localStorage?
            localStorage.setItem('test', 'value');
            const testValue = localStorage.getItem('test');
            localStorage.removeItem('test');
            
            results.innerHTML += '<p>✅ localStorage is working: ' + (testValue === 'value') + '</p>';
            
            // Test 2: Check for existing token
            const token = localStorage.getItem('token');
            results.innerHTML += '<p>Token exists: ' + (token !== null) + '</p>';
            if (token) {
              results.innerHTML += '<p>Token value: ' + token.substring(0, 20) + '...</p>';
            }
            
            // Test 3: Check for user data
            const userData = localStorage.getItem('user');
            results.innerHTML += '<p>User data exists: ' + (userData !== null) + '</p>';
            
            // Test 4: Check API URL configuration
            results.innerHTML += '<p>API URL: ${process.env.NEXT_PUBLIC_API_URL || 'NOT SET'}</p>';
            
          } catch (error) {
            results.innerHTML = '<p>❌ Error accessing localStorage: ' + error.message + '</p>';
          }
        </script>
      </body>
    </html>
  `;

    return new NextResponse(diagnosticScript, {
        headers: { 'Content-Type': 'text/html' },
    });
}
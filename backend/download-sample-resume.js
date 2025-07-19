const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function downloadSampleResume() {
    try {
        // Using a sample PDF from a reliable source
        const url = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
        
        console.log('Downloading sample PDF...');
        
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream'
        });
        
        const writer = fs.createWriteStream('sample-resume.pdf');
        
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log('Sample PDF downloaded successfully!');
                console.log('File saved as: sample-resume.pdf');
                resolve();
            });
            writer.on('error', reject);
        });
        
    } catch (error) {
        console.error('Error downloading file:', error.message);
    }
}

downloadSampleResume();

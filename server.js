const express = require('express');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// GHL Configuration
const GHL_API_KEY = process.env.GHL_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb21wYW55X2lkIjoiblNLTmN5VkliMVBGc1BmaDBOOHYiLCJ2ZXJzaW9uIjoxLCJpYXQiOjE3Njk3MDAyNTkzODEsInN1YiI6ImpnbnZZalJMZGhiajhvWWN3TkhJIn0.VZiHAl97Y0fJSo6llU4bUa_9Ek-T5QLujKedgKNJXiY';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'mEVG4cNTDGfVm2PUOipQ';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// Serve the form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store submissions (in production, use a database)
const submissions = [];

// Handle form submission
app.post('/submit', upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'scripts', maxCount: 1 },
    { name: 'clientList', maxCount: 1 },
    { name: 'faqFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const formData = req.body;
        
        // Log the submission
        console.log('Form submission received:', {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            business: formData.businessName
        });
        
        // Store submission
        const submission = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            data: formData,
            files: req.files ? Object.keys(req.files) : []
        };
        submissions.push(submission);
        
        // Try to send to GHL (will fail silently if API key is wrong)
        try {
            const contactData = {
                locationId: GHL_LOCATION_ID,
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone,
                name: `${formData.firstName} ${formData.lastName}`,
                address1: formData.address,
                city: formData.city,
                state: formData.state,
                postalCode: formData.zip,
                country: formData.country,
                website: formData.website,
                tags: ['LeadStorm Onboarding', 'New Client'],
                notes: `LeadStorm AI Onboarding Submission

Business: ${formData.businessName}
Legal Name: ${formData.legalName}
Email: ${formData.email}
Phone: ${formData.phone}

Social Media:
- IG: ${formData.igUsername}
- TikTok: ${formData.tiktokUsername}
- WhatsApp: ${formData.whatsappNumber}

Calendar: ${formData.startTime} - ${formData.endTime}
Duration: ${formData.duration}min
Max per day: ${formData.maxAppointments}

Trigger Keywords: ${formData.triggerKeywords}

Additional Info: ${formData.additionalInfo || 'None'}`
            };

            const ghlResponse = await axios.post(
                `${GHL_BASE_URL}/contacts/`,
                contactData,
                {
                    headers: {
                        'Authorization': `Bearer ${GHL_API_KEY}`,
                        'Version': '2021-07-28',
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }
            );
            
            console.log('GHL Contact Created:', ghlResponse.data.contact?.id);
            submission.ghlContactId = ghlResponse.data.contact?.id;
        } catch (ghlError) {
            console.log('GHL API error (non-blocking):', ghlError.message);
            // Continue anyway - form is still saved
        }

        // Clean up uploaded files
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(file => {
                    fs.unlink(file.path, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            });
        }

        res.json({ 
            success: true, 
            message: 'Form submitted successfully!',
            submissionId: submission.id
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error submitting form. Please try again.' 
        });
    }
});

// View submissions (admin endpoint)
app.get('/submissions', (req, res) => {
    res.json(submissions);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`LeadStorm Onboarding Form running on port ${PORT}`);
});

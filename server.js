const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// GHL Configuration
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-4984dd29-6cf2-4172-859c-6ccc53a9a949';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'mEVG4cNTDGfVm2PUOipQ';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// Store submissions in memory
const submissions = [];

// Serve the form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission
app.post('/submit', async (req, res) => {
    try {
        const formData = req.body;
        
        console.log('Form submission received:', {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            business: formData.businessName
        });
        
        // Store submission
        const submission = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            data: formData
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

            // Use agency API endpoint with locationId in body
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
